'use client'
import { BGM_PATHS, SFX_PATHS, SFX_PRIORITY, SFX_COOLDOWN_MS, BGM_INTENSITY, STORAGE_KEY, DEFAULT_VOLUMES, type SfxId, type BgmId } from './audioConfig'

type VolState = { master: number; sfx: number; bgm: number; muted: boolean }

function loadVol(): VolState {
  if (typeof window === 'undefined') return { ...DEFAULT_VOLUMES }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return {
        master: clamp01(p.master ?? 1),
        sfx: clamp01(p.sfx ?? 1),
        bgm: clamp01(p.bgm ?? 0.7),
        muted: !!p.muted,
      }
    }
  } catch {}
  return { ...DEFAULT_VOLUMES }
}

function saveVol(v: VolState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)) } catch {}
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, Number(n) || 0))
}

export class DlicomRoadAudioManager {
  private vol: VolState = loadVol()
  private unlocked = false
  private pendingBgm: { id: BgmId; loop: boolean } | null = null
  private bgm: HTMLAudioElement | null = null
  private curBgm: BgmId | null = null
  private sfxCache = new Map<string, HTMLAudioElement>()
  private lastPlay = new Map<string, number>()
  private played = new Set<string>()
  private active = new Map<HTMLAudioElement, number>()
  private duckTimer: number | null = null
  private ctx: AudioContext | null = null
  private synthBgmInterval: number | null = null
  private maxConcurrent = 8
  private bgmBaseVol = 0.35
  private synthStep = 0
  private currentMultiplier = 1

  constructor() {
    console.log('[Dlicom Road AudioManager] constructor')
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVis)
    }
  }

  destroy() {
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVis)
    this.stopBgm(0)
    this.stopSfxAll()
  }

  private onVis = () => {
    if (document.hidden) {
      if (this.bgm && !this.bgm.paused) {
        this.bgm.pause()
        ;(this.bgm as unknown as { _wasPlaying?: boolean })._wasPlaying = true
      }
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {})
      }
    } else {
      if ((this.bgm as unknown as { _wasPlaying?: boolean })?._wasPlaying && this.unlocked && !this.vol.muted) {
        ;(this.bgm as unknown as { _wasPlaying?: boolean })._wasPlaying = false
        this.bgm.play().catch(() => {})
      }
      if (this.ctx && this.ctx.state === 'suspended' && this.unlocked && !this.vol.muted) {
        this.ctx.resume().catch(() => {})
      }
    }
  }

  isUnlocked() { return this.unlocked }
  getVolumes(): VolState { return { ...this.vol } }

  private eff(category: 'sfx' | 'bgm', base = 1) {
    if (this.vol.muted) return 0
    const cat = category === 'sfx' ? this.vol.sfx : this.vol.bgm
    return clamp01(this.vol.master * cat * base)
  }

private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
                  (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AC) {
        console.log('[Dlicom Road Audio] Creating new AudioContext')
        this.ctx = new AC()
      } else {
        console.warn('[Dlicom Road Audio] AudioContext not available')
      }
    }
    return this.ctx
  }

  async unlock() {
    console.log('[Dlicom Road Audio] unlock() called, unlocked:', this.unlocked)
    if (this.unlocked) return
    try {
      const ctx = this.getAudioContext()
      console.log('[Dlicom Road Audio] AudioContext state:', ctx?.state)
      if (ctx && ctx.state === 'suspended') {
        console.log('[Dlicom Road Audio] Resuming suspended AudioContext')
        await ctx.resume()
      }
    } catch (e) {
      console.warn('[Dlicom Road Audio] Error resuming AudioContext:', e)
    }
    // Mark unlocked as long as we have an AudioContext — the synthesizer
    // only needs the AudioContext, not HTMLAudio. Previously this was gated
    // behind a silent Audio().play() which fails without a valid src on
    // many browsers, preventing unlock entirely.
    this.unlocked = true
    console.log('[Dlicom Road Audio] Unlocked set to true')
    if (this.pendingBgm) {
      const pb = this.pendingBgm
      this.pendingBgm = null
      this.playBgm(pb.id, { loop: pb.loop })
    }
  }

  preload() {
    if (typeof window === 'undefined') return
    const all = [...Object.entries(SFX_PATHS), ...Object.entries(BGM_PATHS)]
    for (const [key, src] of all) {
      const a = new Audio(src)
      a.preload = 'auto'
      a.addEventListener('error', () => {
        // Missing asset is fine; fallback synthesis handles it
      })
      if ((SFX_PATHS as Record<string, string>)[key]) this.sfxCache.set(key, a)
    }
  }

  setMasterVolume(v: number) { this.vol.master = clamp01(v); saveVol(this.vol); this.applyBgmVol() }
  setSfxVolume(v: number) { this.vol.sfx = clamp01(v); saveVol(this.vol) }
  setBgmVolume(v: number) { this.vol.bgm = clamp01(v); saveVol(this.vol); this.applyBgmVol() }

  setMuted(m: boolean) {
    this.vol.muted = m
    saveVol(this.vol)
    if (m) {
      if (this.bgm && !this.bgm.paused) this.bgm.pause()
      this.stopSynthBgm()
    } else {
      if (this.curBgm && this.unlocked) {
        this.startSynthBgm(this.curBgm)
        if (this.bgm) this.bgm.play().catch(() => {})
      }
    }
    this.applyBgmVol()
  }

  toggleMute() { this.setMuted(!this.vol.muted) }

  private applyBgmVol(base = this.bgmBaseVol) {
    if (this.bgm) {
      this.bgm.volume = this.eff('bgm', base)
    }
  }

  private canPlay(key: string, priority: number): boolean {
    const cd = SFX_COOLDOWN_MS[key] ?? 0
    const last = this.lastPlay.get(key) ?? 0
    if (cd && Date.now() - last < cd) return false
    if (this.active.size >= this.maxConcurrent) {
      let minP = Infinity
      let minEl: HTMLAudioElement | null = null
      for (const [el, p] of this.active) if (p < minP) { minP = p; minEl = el }
      if (minEl && priority <= minP) return false
      if (minEl) {
        try { minEl.pause(); minEl.currentTime = 0 } catch {}
        this.active.delete(minEl)
      }
    }
    return true
  }

  private ensureRunning() {
    const ctx = this.getAudioContext()
    if (ctx && ctx.state === 'suspended' && this.unlocked && !this.vol.muted) {
      ctx.resume().catch(() => {})
    }
  }

  playSfx(id: SfxId, opts: { volume?: number; key?: string } = {}) {
    console.log(`[Dlicom Road AudioManager] playSfx called with id: ${id}, opts:`, opts);
    if (typeof window === 'undefined') return
    if (!this.unlocked) {
        console.log('[Dlicom Road AudioManager] playSfx aborted: not unlocked')
        return
    }
    if (this.vol.muted) {
        console.log('[Dlicom Road AudioManager] playSfx aborted: muted')
        return
    }
    this.ensureRunning()
    const key = opts.key ?? id
    const pri = SFX_PRIORITY[id] ?? 10
    if (!this.canPlay(key, pri)) return
    this.lastPlay.set(key, Date.now())

    // 1. Synthesize via Web Audio API (instant, guaranteed to sound great)
    this.synthesizeSfx(id, opts.volume ?? 1)

    // 2. Also try HTMLAudio if file is present
    const src = (SFX_PATHS as Record<string, string>)[id]
    console.log(`[Dlicom Road Audio] Attempting to load SFX '${id}' from src: ${src}`)
    if (src) {
      try {
        const el = new Audio(src)
        el.volume = this.eff('sfx', opts.volume ?? 1)
        this.active.set(el, pri)
        const cleanup = () => this.active.delete(el)
        el.addEventListener('ended', cleanup, { once: true })
        el.addEventListener('error', cleanup, { once: true })
        const p = el.play()
        if (p) p.catch(() => {
          console.warn(`[Dlicom Road Audio] Failed to play SFX '${id}' from ${src}`)
          this.active.delete(el)
        })
      } catch (e) {
        console.warn(`[Dlicom Road Audio] Error creating audio element for '${id}':`, e)
      }
    } else {
      console.warn(`[Dlicom Road Audio] No SFX path defined for id: ${id}`)
    }
  }

  playSfxOnce(key: string, id: SfxId, opts?: { volume?: number }) {
    if (this.played.has(key)) return false
    this.played.add(key)
    if (this.played.size > 200) {
      const it = this.played.values().next().value
      if (it) this.played.delete(it)
    }
    this.playSfx(id, { ...opts, key: id })
    return true
  }

  hasPlayed(key: string) { return this.played.has(key) }
  markPlayed(key: string) { this.played.add(key) }
  clearPlayedForRound(roundId: string) {
    for (const k of [...this.played]) if (k.startsWith(roundId + ':')) this.played.delete(k)
  }

  playBgm(id: BgmId, opts: { loop?: boolean; fadeMs?: number; volume?: number } = {}) {
    console.log(`[Dlicom Road AudioManager] playBgm called with id: ${id}, opts:`, opts);
    if (typeof window === 'undefined') return
    const loop = opts.loop ?? true
    const vol = opts.volume ?? 0.35
    this.bgmBaseVol = vol

    if (!this.unlocked || this.vol.muted) {
      this.pendingBgm = { id, loop }
      return
    }

    this.ensureRunning()
    this.curBgm = id

    // Synthesize procedural ambient arcade BGM track
    this.startSynthBgm(id)

    // Also attempt MP3 playback if available
    const src = (BGM_PATHS as Record<string, string>)[id]
    if (src) {
      try {
        const next = new Audio(src)
        next.loop = loop
        next.volume = this.eff('bgm', vol)
        const p = next.play()
        if (p) {
          p.then(() => {
            if (this.bgm && this.bgm !== next) {
              try { this.bgm.pause() } catch {}
            }
            this.bgm = next
          }).catch(() => {
            // File not present, synth continues cleanly
          })
        }
      } catch {}
    }
  }

  stopBgm(fadeMs = 250) {
    this.pendingBgm = null
    this.curBgm = null
    this.stopSynthBgm()
    if (this.bgm) {
      try { this.bgm.pause(); this.bgm.src = '' } catch {}
      this.bgm = null
    }
  }

  duckBgm(amount = 0.3, duration = 900) {
    if (this.vol.muted) return
    const base = this.eff('bgm', this.bgmBaseVol)
    if (this.bgm) this.bgm.volume = base * amount
    if (this.duckTimer) window.clearTimeout(this.duckTimer)
    this.duckTimer = window.setTimeout(() => {
      if (this.bgm) this.bgm.volume = base
    }, duration)
  }

  fadeBgm(baseVol: number, _ms = 250) {
    this.bgmBaseVol = baseVol
    this.applyBgmVol(baseVol)
  }

  updateIntensity(multiplier: number) {
    this.currentMultiplier = multiplier
    let chosen = BGM_INTENSITY[0]
    for (const t of BGM_INTENSITY) if (multiplier >= t.mult) chosen = t
    if (this.curBgm !== chosen.bgm && this.curBgm !== 'crash') {
      this.playBgm(chosen.bgm, { loop: true, fadeMs: 700, volume: chosen.vol })
    } else {
      this.fadeBgm(chosen.vol, 400)
    }
  }

  stopSfxAll() {
    for (const el of this.active.keys()) {
      try { el.pause(); el.currentTime = 0 } catch {}
    }
    this.active.clear()
  }

/** Web Audio API sound effect synthesizer */
  private synthesizeSfx(id: SfxId, volumeScale = 1) {
    const ctx = this.getAudioContext()
    console.log(`[Dlicom Road Audio] synthesizeSfx called: ${id}, volumeScale: ${volumeScale}`)
    if (!ctx || this.vol.muted) {
      console.log(`[Dlicom Road Audio] synth skipped: ctx=${!!ctx}, muted=${this.vol.muted}`)
      return
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const volState = this.vol
    console.log(`[Dlicom Road Audio] volume state: master=${volState.master}, sfx=${volState.sfx}, bgm=${volState.bgm}, muted=${volState.muted}`)
    const gainVal = this.eff('sfx', volumeScale)
    console.log(`[Dlicom Road Audio] gainVal (master * sfx * volumeScale): ${gainVal}`)
    if (gainVal <= 0.001) {
      console.log(`[Dlicom Road Audio] gainVal too low: ${gainVal}`)
      return
    }

    const now = ctx.currentTime
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(gainVal * 3, now) // Boost base synth volume
    console.log(`[Dlicom Road Audio] masterGain set to ${gainVal * 3} at ${now}`)
    masterGain.connect(ctx.destination)
    console.log(`[Dlicom Road Audio] masterGain connected to destination`)

    if (id === 'button-hover') {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(700, now)
      g.gain.setValueAtTime(0.04, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
      osc.connect(g); g.connect(masterGain)
      osc.start(now); osc.stop(now + 0.04)
    } else if (id === 'button-click') {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(450, now)
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.06)
      g.gain.setValueAtTime(0.12, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
      osc.connect(g); g.connect(masterGain)
      osc.start(now); osc.stop(now + 0.07)
    } else if (id === 'bet') {
      // Crisp casino chip clink
      ;[1200, 2400].forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + idx * 0.03)
        g.gain.setValueAtTime(0.18, now + idx * 0.03)
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.03 + 0.08)
        osc.connect(g); g.connect(masterGain)
        osc.start(now + idx * 0.03); osc.stop(now + idx * 0.03 + 0.09)
      })
    } else if (id === 'start') {
      // Energetic rising arpeggio
      ;[440, 554.37, 659.25, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + idx * 0.06)
        g.gain.setValueAtTime(0.14, now + idx * 0.06)
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.12)
        osc.connect(g); g.connect(masterGain)
        osc.start(now + idx * 0.06); osc.stop(now + idx * 0.06 + 0.13)
      })
    } else if (id.startsWith('step')) {
      // Crisp footstep pop
      const stepIdx = id === 'step-01' ? 1 : id === 'step-02' ? 2 : id === 'step-03' ? 3 : 0
      const pitch = 320 + stepIdx * 45
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(pitch, now)
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, now + 0.07)
      g.gain.setValueAtTime(0.16, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
      osc.connect(g); g.connect(masterGain)
      osc.start(now); osc.stop(now + 0.07)
    } else if (id === 'multiplier-up') {
      // Rising melodic bell
      ;[659.25, 830.61, 987.77].forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + idx * 0.05)
        g.gain.setValueAtTime(0.12, now + idx * 0.05)
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.18)
        osc.connect(g); g.connect(masterGain)
        osc.start(now + idx * 0.05); osc.stop(now + idx * 0.05 + 0.19)
      })
    } else if (id === 'vehicle-pass') {
      // Filtered noise swoosh
      const bufferSize = ctx.sampleRate * 0.35
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
      const noise = ctx.createBufferSource()
      noise.buffer = buffer
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(400, now)
      filter.frequency.exponentialRampToValueAtTime(1400, now + 0.15)
      filter.frequency.exponentialRampToValueAtTime(300, now + 0.35)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.08, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
      noise.connect(filter); filter.connect(g); g.connect(masterGain)
      noise.start(now); noise.stop(now + 0.35)
    } else if (id === 'cashout' || id === 'win') {
      // Triumphant win chord
      const chords = [523.25, 659.25, 783.99, 1046.50]
      chords.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + idx * 0.07)
        g.gain.setValueAtTime(0.15, now + idx * 0.07)
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.35)
        osc.connect(g); g.connect(masterGain)
        osc.start(now + idx * 0.07); osc.stop(now + idx * 0.07 + 0.36)
      })
    // Crash sound is handled by the audio file, so we skip synthesis for it
    // to avoid doubling when the file is present else if (id === 'error') {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(140, now)
      g.gain.setValueAtTime(0.12, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
      osc.connect(g); g.connect(masterGain)
      osc.start(now); osc.stop(now + 0.15)
    }
  }

  /** Procedural synth arcade background loop */
  private startSynthBgm(state: BgmId) {
    this.stopSynthBgm()
    if (state === 'crash') return

    const notes = state === 'tension'
      ? [110, 110, 123.47, 130.81, 146.83, 130.81]
      : state === 'gameplay'
      ? [130.81, 164.81, 196.00, 220.00, 196.00, 164.81]
      : [98.00, 123.47, 146.83, 164.81]

    const tempo = state === 'tension' ? 220 : state === 'gameplay' ? 320 : 500

    this.synthBgmInterval = window.setInterval(() => {
      const ctx = this.getAudioContext()
      if (!ctx || this.vol.muted || !this.unlocked) return
      const bgmGain = this.eff('bgm', this.bgmBaseVol) * 0.45 // Boost BGM volume
      if (bgmGain <= 0.001) return

      const now = ctx.currentTime
      const freq = notes[this.synthStep % notes.length]
      this.synthStep++

      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = state === 'tension' ? 'sawtooth' : 'sine'
      osc.frequency.setValueAtTime(freq, now)

      g.gain.setValueAtTime(bgmGain, now)
      g.gain.exponentialRampToValueAtTime(0.0001, now + (tempo / 1000) * 0.85)

      osc.connect(g)
      g.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + (tempo / 1000) * 0.9)
    }, tempo)
  }

  private stopSynthBgm() {
    if (this.synthBgmInterval !== null) {
      clearInterval(this.synthBgmInterval)
      this.synthBgmInterval = null
    }
  }
}

let singleton: DlicomRoadAudioManager | null = null
export function getDroadAudio(): DlicomRoadAudioManager {
  if (!singleton) singleton = new DlicomRoadAudioManager()
  return singleton
}
