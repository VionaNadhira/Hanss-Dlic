'use client'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getDroadAudio, DlicomRoadAudioManager } from '@/lib/droad/audioManager'
import type { BgmId, SfxId } from '@/lib/droad/audioConfig'
interface Ctx {
  audio: DlicomRoadAudioManager
  unlocked: boolean
  muted: boolean
  master: number
  sfx: number
  bgm: number
  unlock: () => Promise<void>
  playSfx: (id: SfxId, opts?: { volume?: number; key?: string }) => void
  playSfxOnce: (key: string, id: SfxId) => boolean
  playBgm: (id: BgmId, opts?: { loop?: boolean; fadeMs?: number; volume?: number }) => void
  stopBgm: (fadeMs?: number) => void
  duckBgm: (amount?: number, duration?: number) => void
  setMaster: (v: number) => void
  setSfx: (v: number) => void
  setBgmVol: (v: number) => void
  toggleMute: () => void
  updateIntensity: (mult: number) => void
}
const AudioCtx = createContext<Ctx | null>(null)
export function DlicomRoadAudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<DlicomRoadAudioManager | null>(null)
  if (!audioRef.current) {
    console.log('[Dlicom Road Audio] Creating new audio manager instance')
    audioRef.current = getDroadAudio()
  }
  const audio = audioRef.current
  console.log('[Dlicom Road Audio] Provider initialized')
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((n) => n + 1), [])
  useEffect(() => { 
    console.log('[Dlicom Road Audio] Preloading assets')
    audio.preload() 
  }, [audio])
  useEffect(() => {
    let removed = false
    const h = () => { 
      console.log('[Dlicom Road Audio] Unlock attempt via user interaction')
      audio.unlock().then(() => {
        refresh()
        if (!removed) {
          removed = true
          window.removeEventListener('pointerdown', h)
          window.removeEventListener('keydown', h)
          window.removeEventListener('touchstart', h)
        }
        // Auto-play menu BGM on first unlock so users hear music right away
        if (audio.isUnlocked() && !audio.getVolumes().muted) {
          audio.playBgm('menu' as BgmId, { loop: true, volume: 0.22, fadeMs: 500 })
        }
      }).catch(() => {})
    }
    window.addEventListener('pointerdown', h)
    window.addEventListener('keydown', h)
    window.addEventListener('touchstart', h, { passive: true } as AddEventListenerOptions)
    return () => {
      removed = true
      window.removeEventListener('pointerdown', h)
      window.removeEventListener('keydown', h)
      window.removeEventListener('touchstart', h)
    }
  }, [audio, refresh])
  const vol = audio.getVolumes()
  console.log('[Dlicom Road Audio] Volume state:', vol)
  const unlock = useCallback(async () => { 
    console.log('[Dlicom Road Audio] Unlock called via API')
    await audio.unlock(); 
    refresh(); 
  }, [audio, refresh])
  const setMaster = useCallback((v: number) => { audio.setMasterVolume(v); refresh() }, [audio, refresh])
  const setSfx = useCallback((v: number) => { audio.setSfxVolume(v); refresh() }, [audio, refresh])
  const setBgmVol = useCallback((v: number) => { audio.setBgmVolume(v); refresh() }, [audio, refresh])
  const toggleMute = useCallback(() => { audio.toggleMute(); refresh() }, [audio, refresh])
  const playSfx = useCallback((id: SfxId, opts?: { volume?: number; key?: string }) => { 
    console.log(`[Dlicom Road Audio] playSfx called: ${id}`, opts)
    return audio.playSfx(id, opts) 
  }, [audio])
  const playSfxOnce = useCallback((key: string, id: SfxId) => { 
    console.log(`[Dlicom Road Audio] playSfxOnce called: ${key}:${id}`)
    return audio.playSfxOnce(key, id) 
  }, [audio])
  const playBgm = useCallback((id: BgmId, opts?: { loop?: boolean; fadeMs?: number; volume?: number }) => { 
    console.log(`[Dlicom Road Audio] playBgm called: ${id}`, opts)
    return audio.playBgm(id, opts) 
  }, [audio])
  const stopBgm = useCallback((fadeMs?: number) => { 
    console.log(`[Dlicom Road Audio] stopBgm called: ${fadeMs}`)
    return audio.stopBgm(fadeMs) 
  }, [audio])
  const duckBgm = useCallback((a?: number, d?: number) => { 
    console.log(`[Dlicom Road Audio] duckBgm called: ${a}, ${d}`)
    return audio.duckBgm(a, d) 
  }, [audio])
  const updateIntensity = useCallback((m: number) => { 
    console.log(`[Dlicom Road Audio] updateIntensity called: ${m}`)
    return audio.updateIntensity(m) 
  }, [audio])
  const value = useMemo<Ctx>(() => ({
    audio, unlocked: audio.isUnlocked(), muted: vol.muted, master: vol.master, sfx: vol.sfx, bgm: vol.bgm,
    unlock, playSfx, playSfxOnce, playBgm, stopBgm, duckBgm, setMaster, setSfx, setBgmVol, toggleMute, updateIntensity,
  }), [audio, vol.muted, vol.master, vol.sfx, vol.bgm, unlock, playSfx, playSfxOnce, playBgm, stopBgm, duckBgm, setMaster, setSfx, setBgmVol, toggleMute, updateIntensity, tick])
  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>
}
export function useDroadAudio() {
  const c = useContext(AudioCtx)
  if (!c) throw new Error('useDroadAudio must be inside DlicomRoadAudioProvider')
  return c
}
export function useDroadAudioOptional() { return useContext(AudioCtx) }
