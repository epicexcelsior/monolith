# Ralph Loop: Sound Effects + Haptics — Full Wiring

You are upgrading the sound system for The Monolith at `/home/epic/Downloads/monolith`.
The app has placeholder WAV files and almost no audio wired. Your job:
1. Source better sounds where possible (Kenney CC0 pack for UI taps)
2. Improve the synthesis script for hero sounds
3. Wire EVERY sound + haptic to every interaction
4. Add missing haptics

## BEFORE WRITING ANY CODE

Read ALL of these files:
1. `CONTEXT.md` — project state, gotchas
2. `scripts/generate-sounds.js` — existing PCM synthesizer (rewrite this)
3. `generate-claim-sound.js` — sophisticated claim celebration (DO NOT MODIFY, it's good)
4. `apps/mobile/utils/audio.ts` — audio API (only playClaimCelebration is called anywhere)
5. `apps/mobile/utils/haptics.ts` — haptic API (well-wired, use as pattern reference)
6. `apps/mobile/constants/ClaimEffectConfig.ts` — VFX/haptic/SFX timing config
7. `apps/mobile/hooks/useClaimCelebration.ts` — only place SFX is used
8. `apps/mobile/components/ui/BlockInspector.tsx` — claim, charge, customize handlers
9. `apps/mobile/components/ui/LevelUpCelebration.tsx` — level-up overlay
10. `apps/mobile/app/(tabs)/settings.tsx` — Me tab (mute toggle)
11. `apps/mobile/app/(tabs)/index.tsx` — home screen (initAudio)
12. `apps/mobile/components/onboarding/OnboardingFlow.tsx` — onboarding

## PHASE 1: Download Kenney CC0 Pack for UI Taps

The Kenney UI Audio pack is already downloaded. Extract and convert the best sounds:

```bash
# Extract
cd /tmp && unzip -o kenney-ui-audio.zip -d kenney-ui-audio

# Convert best picks to WAV (16-bit, 44100Hz mono) with ffmpeg
SFX_DIR=/home/epic/Downloads/monolith/apps/mobile/assets/sfx

# Crisp glass tap for block select
ffmpeg -y -i /tmp/kenney-ui-audio/Audio/click5.ogg -ar 44100 -ac 1 -sample_fmt s16 "$SFX_DIR/block-select.wav"

# Soft release for deselect
ffmpeg -y -i /tmp/kenney-ui-audio/Audio/mouserelease1.ogg -ar 44100 -ac 1 -sample_fmt s16 "$SFX_DIR/block-deselect.wav"

# Clean tap for generic buttons
ffmpeg -y -i /tmp/kenney-ui-audio/Audio/click3.ogg -ar 44100 -ac 1 -sample_fmt s16 "$SFX_DIR/button-tap.wav"
```

If the zip doesn't exist at `/tmp/kenney-ui-audio.zip`, download it first:
```bash
curl -L -o /tmp/kenney-ui-audio.zip "https://kenney.nl/media/pages/assets/ui-audio/e19c9b1814-1677590494/kenney_ui-audio.zip"
```

**If the download fails or ffmpeg conversion fails, fall back to generating these 3 sounds with the synthesis script instead.** Don't block on this.

## PHASE 2: Rewrite generate-sounds.js for Hero Sounds

Rewrite `scripts/generate-sounds.js`. It should:
- Generate the 7 hero sounds that Kenney doesn't cover
- NOT overwrite block-select.wav, block-deselect.wav, button-tap.wav if they already exist from Kenney
- Keep zero dependencies (pure Node.js)
- Output 16-bit mono WAV at 44100Hz

**Sound design principles for better synthesis:**
- Layer 3+ oscillators per sound (fundamental + 2nd partial at -6dB + 3rd partial at -12dB)
- Use proper ADSR: attack (5-20ms), decay, sustain, release — not just exponential decay
- Add warmth: slight detune between layers (±1-2Hz creates natural beating)
- Add body: include a sub-octave at -12dB for sounds that need weight
- Simulated reverb: add a quiet copy delayed by 40-80ms at -15dB
- Volume normalize peaks to 0.7 (-3dB)
- Use musical intervals (major 3rds, perfect 5ths, octaves)

**Sounds to generate:**

### `charge-tap.wav` — Energy pulse (0.3s)
- Phase 1 (0-0.05s): Bright transient 1200Hz → 800Hz fast sweep (the "zap")
- Phase 2 (0.05-0.3s): Warm resolution tone at 523Hz (C5) with overtones
- Sub-bass thump at 100Hz, 10ms, -9dB (physical weight)
- Layer: 1047Hz (octave) at -6dB during phase 2
- Character: electric but satisfying — you charged your block and it FELT good

### `block-claim.wav` — Triumphant rising sweep (0.5s)
- Ascending sweep A4(440)→A5(880) over 0.35s
- Harmony: major 3rd (C#5→C#6) at -6dB
- Harmony: perfect 5th (E5→E6) at -9dB
- Final 0.15s: A major triad rings together with shimmer (±1Hz detune)
- Reverb: 60ms delay at -12dB
- Character: achievement unlocked — warm, triumphant, brief

### `streak-milestone.wav` — Ascending celebration chime (0.8s)
- 4-note arpeggio: C5(523)→E5(659)→G5(784)→C6(1047)
- Each note 0.15s with 0.05s overlap (notes build on each other)
- Each has octave overtone at -6dB and 3rd partial at -12dB
- Final C6 sustains 0.25s with ±1Hz detune shimmer
- Reverb: 50ms delay on each note at -12dB
- Character: ascending staircase of light — you're on a roll

### `error.wav` — Gentle "nope" (0.3s)
- Two-note descend: E4(330) 0.12s → C4(262) 0.15s, 0.03s overlap
- Rounded timbre: sine + 0.12× third harmonic (NOT square wave)
- Moderate decay, not harsh
- 40% quieter than positive sounds
- Character: a gentle "that didn't work", not alarming

### `level-up.wav` — Epic ascending fanfare (1.2s)
- 6-note arpeggio across 2 octaves: C4→E4→G4→C5→E5→G5
- Each note 0.1s, heavily overlapping (notes accumulate into chord)
- Final 0.4s: full C major chord sustained with shimmer
- Each note: fundamental + octave (-6dB) + 5th (-9dB)
- Sub-bass: C2(65Hz) drone at -15dB throughout for gravitas
- Very slight pan simulation: alternate left/right emphasis per note
- Reverb: 80ms delay at -12dB
- Character: LEVEL UP — unmistakably celebratory, RPG victory

### `customize.wav` — Satisfying stamp (0.2s)
- Transient: 800Hz→600Hz fast 20ms sweep (the "press")
- Body: 400Hz warm tone, 0.15s decay
- Sub thump: 120Hz, 8ms, -9dB (physical stamp feel)
- Overtone: 1200Hz at -9dB, faster decay than fundamental
- Character: placing a sticker, pressing a rubber stamp

### `claim-celebration.wav` — DO NOT GENERATE
- Skip this entirely. The existing file from `generate-claim-sound.js` is good.
- Verify it exists. If missing, run: `node /home/epic/Downloads/monolith/generate-claim-sound.js`

**After rewriting, run:**
```bash
node /home/epic/Downloads/monolith/scripts/generate-sounds.js
```

Verify all files exist:
```bash
ls -la /home/epic/Downloads/monolith/apps/mobile/assets/sfx/
```

Expected: block-select.wav, block-deselect.wav, button-tap.wav, charge-tap.wav, block-claim.wav, streak-milestone.wav, error.wav, level-up.wav, customize.wav, claim-celebration.wav (10 files).

## PHASE 3: Update audio.ts

Read `apps/mobile/utils/audio.ts` first. Then add the 3 new sounds:

1. Add `loadPlayer` calls for `levelUp`, `customize`, `buttonTap`
2. Add public functions: `playLevelUp()`, `playCustomize()`, `playButtonTap()`
3. Keep all existing functions

## PHASE 4: Add Missing Haptics to haptics.ts

Read `apps/mobile/utils/haptics.ts` first. Add:

```typescript
/** Charge success — medium pulse with quick resolve */
export function hapticChargeTap() {
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Customize applied — light satisfying press */
export function hapticCustomize() {
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Level up — success notification */
export function hapticLevelUp() {
    safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Streak milestone — double-tap celebration */
export function hapticStreakMilestone() {
    if (!HAPTICS_ENABLED) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, 120);
}
```

## PHASE 5: Wire ALL Sounds + Haptics to Interactions

**The rule: every haptic call gets a matching SFX call on the same line or immediately after.**

Read each file before modifying. Find where haptics are called, add the SFX.

### BlockInspector.tsx
Wire these (read the file to find exact locations):
- Panel close / deselect: `hapticBlockDeselect()` already there → add `playBlockDeselect()`
- Claim succeeds (demo mode, the `else` branch): add `hapticBlockClaimed()` + `playBlockClaim()`
- Claim succeeds (multiplayer): handled by useClaimCelebration hook, skip
- Charge succeeds (both modes): add `hapticChargeTap()` + `playChargeTap()`
- Charge cooldown/failure: `hapticError()` already there → add `playError()`
- Customize applied: add `hapticCustomize()` + `playCustomize()`
- Streak milestone (check charge result): if `streak === 3 || streak === 7 || streak === 14 || streak === 30` → `hapticStreakMilestone()` + `playStreakMilestone()`
- All button presses that have `hapticButtonPress()` → add `playButtonTap()` next to each

### TowerScene.tsx
- Block select: `hapticBlockSelect()` exists → add `playBlockSelect()`
- Block deselect: `hapticBlockDeselect()` exists → add `playBlockDeselect()`
- Do NOT add sounds to: zoom snap, layer cross, double-tap reset (too frequent)

### LevelUpCelebration.tsx
- When the overlay appears / animation starts: add `hapticLevelUp()` + `playLevelUp()`

### OnboardingFlow.tsx
- Ghost claim: add `playBlockClaim()` next to existing `hapticButtonPress()`
- Ghost charge: add `playChargeTap()` next to existing `hapticButtonPress()`
- Ghost customize: add `playCustomize()`
- All other buttons: add `playButtonTap()` next to existing `hapticButtonPress()`

### Other screens (deposit.tsx, withdraw.tsx, faucet.tsx, connect.tsx, ClaimModal.tsx)
- Every `hapticButtonPress()` → add `playButtonTap()` next to it
- Every `hapticError()` → add `playError()` next to it
- Every `hapticBlockClaimed()` → add `playBlockClaim()` next to it

### Settings tab (settings.tsx)
Add a mute toggle:
- Import `setMuted`, `isMuted` from `@/utils/audio`
- Add a toggle row (read the file to match existing UI patterns)
- When toggling ON: `playButtonTap()` as confirmation
- Simple text: "Sound" with ON/OFF

## RULES

- **Read every file before modifying it**
- **NEVER modify**: `BlockShader.ts`, `TowerGrid.tsx`, `TowerCore.tsx`, `Foundation.tsx`, `Particles.tsx`, `generate-claim-sound.js`
- **Fire-and-forget** — never await audio/haptic calls
- **Follow existing patterns** — mirror how haptics are wired
- `generate-sounds.js` must remain zero-dependency (pure Node.js)
- Only use `pnpm` for packages (not npm/yarn)
- Import audio functions at the top of each file, don't use dynamic imports in handlers

## VERIFICATION LOOP

Run after every phase:
```bash
# 1. Regenerate sounds (if changed generator)
node /home/epic/Downloads/monolith/scripts/generate-sounds.js

# 2. Verify all 10 WAV files
ls /home/epic/Downloads/monolith/apps/mobile/assets/sfx/*.wav | wc -l
# Should be 10

# 3. TypeScript
cd /home/epic/Downloads/monolith && timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json

# 4. Tests
cd /home/epic/Downloads/monolith/apps/mobile && npx jest --passWithNoTests
```

## COMPLETION CRITERIA

ALL must be true:
1. 10 WAV files exist in assets/sfx/ (3 from Kenney or synth, 6 hero from synth, 1 claim-celebration preserved)
2. audio.ts exports 10 play functions (7 existing + 3 new: playLevelUp, playCustomize, playButtonTap)
3. haptics.ts exports 4 new functions (hapticChargeTap, hapticCustomize, hapticLevelUp, hapticStreakMilestone)
4. Every interaction has paired SFX + haptic (see Phase 5 tables)
5. Mute toggle in settings tab
6. TypeScript compiles
7. All tests pass
8. generate-sounds.js is zero-dependency Node.js
9. claim-celebration.wav NOT overwritten

Output exactly:

SOUNDS_COMPLETE
