'use client'
export const DROAD_AUDIO_BASE = '/sounds/dlicom-road'
export const STORAGE_KEY = 'dlicom-road:audio:v1'
export const SFX_PATHS = {
  bet: `${DROAD_AUDIO_BASE}/sfx/bet.mp3`,
  start: `${DROAD_AUDIO_BASE}/sfx/start.mp3`,
  step: `${DROAD_AUDIO_BASE}/sfx/step.mp3`,
  'step-01': `${DROAD_AUDIO_BASE}/sfx/step-01.mp3`,
  'step-02': `${DROAD_AUDIO_BASE}/sfx/step-02.mp3`,
  'step-03': `${DROAD_AUDIO_BASE}/sfx/step-03.mp3`,
  'multiplier-up': `${DROAD_AUDIO_BASE}/sfx/multiplier-up.mp3`,
  cashout: `${DROAD_AUDIO_BASE}/sfx/cashout.mp3`,
  win: `${DROAD_AUDIO_BASE}/sfx/win.mp3`,
  crash: `${DROAD_AUDIO_BASE}/sfx/crashsound.mp3`,
  'vehicle-pass': `${DROAD_AUDIO_BASE}/sfx/vehicle-pass.mp3`,
  'button-hover': `${DROAD_AUDIO_BASE}/sfx/button-hover.mp3`,
  'button-click': `${DROAD_AUDIO_BASE}/sfx/button-click.mp3`,
  countdown: `${DROAD_AUDIO_BASE}/sfx/countdown.mp3`,
  error: `${DROAD_AUDIO_BASE}/sfx/error.mp3`,
} as const
export const BGM_PATHS = {
  menu: `${DROAD_AUDIO_BASE}/bgm/menu.mp3`,
  gameplay: `${DROAD_AUDIO_BASE}/bgm/gameplay.mp3`,
  tension: `${DROAD_AUDIO_BASE}/bgm/tension.mp3`,
  crash: `${DROAD_AUDIO_BASE}/bgm/crash.mp3`,
} as const
export type SfxId = keyof typeof SFX_PATHS
export type BgmId = keyof typeof BGM_PATHS
export type BgmState = 'idle' | 'gameplay' | 'tension' | 'crash'
export const SFX_PRIORITY: Record<string, number> = {
  crash: 100, win: 90, cashout: 80, 'multiplier-up': 60, step: 40, 'step-01': 40, 'step-02': 40, 'step-03': 40,
  'vehicle-pass': 30, countdown: 50, bet: 70, start: 70, 'button-click': 20, 'button-hover': 10, error: 60,
}
export const SFX_COOLDOWN_MS: Record<string, number> = {
  step: 120, 'step-01': 120, 'step-02': 120, 'step-03': 120, 'vehicle-pass': 400, 'button-hover': 150, 'multiplier-up': 300, countdown: 400,
}
export const BGM_INTENSITY = [
  { mult: 0, bgm: 'gameplay' as BgmId, vol: 0.35 },
  { mult: 2, bgm: 'gameplay' as BgmId, vol: 0.42 },
  { mult: 3, bgm: 'tension' as BgmId, vol: 0.42 },
  { mult: 5, bgm: 'tension' as BgmId, vol: 0.5 },
]
export const WIN_TIERS = [
  { mult: 5, label: 'high' },
  { mult: 2, label: 'medium' },
  { mult: 0, label: 'low' },
]
export const DEFAULT_VOLUMES = { master: 1, sfx: 1, bgm: 0.7, muted: false }
