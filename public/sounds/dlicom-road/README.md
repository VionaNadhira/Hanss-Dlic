# Dlicom Road Audio Assets — expected files

Base: `public/sounds/dlicom-road/`
All paths configurable in `src/lib/droad/audioConfig.ts`.

BGM (loopable, 1–3 min, normalized -14 LUFS):
- bgm/menu.mp3 — low-volume ambient, idle
- bgm/gameplay.mp3 — main run loop
- bgm/tension.mp3 — crossfade at multiplier >=3
- bgm/crash.mp3 — short stinger, play once, not looped

SFX (keep <2s, avoid clipping):
- sfx/bet.mp3 (0.1–0.3s) — bet accepted
- sfx/start.mp3 (0.3–0.8s) — round start cue
- sfx/step.mp3, step-01/02/03.mp3 (0.1–0.25s) — footstep variation
- sfx/multiplier-up.mp3 (0.2–0.5s)
- sfx/cashout.mp3 (0.4–1.0s)
- sfx/win.mp3 (0.7–2s) — scales with tier
- sfx/crash.mp3 (0.5–1.5s) — impact
- sfx/vehicle-pass.mp3 (0.3–1.5s)
- sfx/button-hover.mp3, button-click.mp3 (subtle UI)
- sfx/countdown.mp3 — if countdown UI added
- sfx/error.mp3 — bet rejected

Missing files: manager warns `[Dlicom Road Audio] Missing audio:` and continues gameplay.
