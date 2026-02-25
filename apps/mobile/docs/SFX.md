# Sound Effects Guide

How to swap, add, or remove sounds in the Monolith mobile app.

## File locations

- **WAV files**: `apps/mobile/assets/sfx/*.wav`
- **Sound registry**: `apps/mobile/utils/audio.ts`
- **Generator script**: `scripts/generate-sounds.js` (synthesizes WAVs via sox/ffmpeg)

## Swap a sound

1. Replace the `.wav` file in `assets/sfx/` with your new one (keep the same filename)
2. Rebuild the app (`npx expo run:android`)

That's it. No code changes needed.

## Add a new sound

1. Drop your `.wav` into `assets/sfx/my-sound.wav`
2. In `utils/audio.ts`, add a `loadPlayer` call in `initAudio()`:
   ```ts
   await loadPlayer("mySound", require("../assets/sfx/my-sound.wav"));
   ```
3. Add a public export:
   ```ts
   export function playMySound() { play("mySound"); }
   ```
4. Import and call it from any component:
   ```ts
   import { playMySound } from "@/utils/audio";
   // ...
   playMySound();
   ```

## Remove a sound

1. Delete the `loadPlayer(...)` line in `utils/audio.ts`
2. Delete or comment out the `export function play...()` line
3. Remove all `import { playXxx }` references from components
4. Optionally delete the `.wav` file

## Volume hierarchy

Volume is baked into the WAV files themselves (player volume stays at 1.0):

| Tier | Level | Used for |
|------|-------|----------|
| UI taps | ~-14 dB | block select, button tap, layer scroll |
| Feedback | ~-8 dB | charge, customize, poke, error |
| Celebrations | ~-6 dB | claim, streak, level-up |
| Epic | ~0 dB | claim celebration |

To change a sound's volume, adjust the WAV file's gain (e.g. with Audacity or `sox input.wav output.wav gain -8`).

## Current sound map

| Key | File | Trigger |
|-----|------|---------|
| `blockSelect` | block-select.wav | Tap a block in tower |
| `blockDeselect` | block-deselect.wav | Deselect block |
| `buttonTap` | button-tap.wav | UI buttons, nav pills |
| `layerScroll` | layer-scroll.wav | Scrub layer indicator |
| `panelOpen` | panel-open.wav | (available, currently unused) |
| `tabSwitch` | tab-switch.wav | Board sub-tabs |
| `toggle` | toggle.wav | Settings toggles |
| `chargeTap` | charge-tap.wav | Charge a block |
| `customize` | customize.wav | Customization |
| `error` | error.wav | Error feedback |
| `pokeSend` | poke-send.wav | Poke action |
| `pokeReceive` | poke-receive.wav | Someone pokes your block |
| `towerRise` | tower-rise.wav | Tower reveal animation |
| `sheetOpen` | sheet-open.wav | (available, currently unused) |
| `blockClaim` | block-claim.wav | Claim a block |
| `streakMilestone` | streak-milestone.wav | Streak milestone |
| `levelUp` | level-up.wav | Level up |
| `claimCelebration` | claim-celebration.wav | Epic claim celebration |

## Regenerate all sounds from scratch

```bash
node scripts/generate-sounds.js
```

This synthesizes all WAVs using sox/ffmpeg. Edit the script to change frequencies, durations, or effects.

## Tips

- Keep WAVs short (< 500ms for UI, < 2s for celebrations)
- Use mono, 44.1kHz, 16-bit for smallest size
- Test on device — speakers sound different from headphones
- The A Dorian palette (A, E, C#, D) keeps sounds harmonious
