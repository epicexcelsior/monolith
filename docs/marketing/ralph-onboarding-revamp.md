# Onboarding Revamp — Ralph Loop Plan

> **Goal:** Transform the first 60 seconds from "confusing tutorial" into "jaw-dropping immersion → intuitive game entry."
> **Branch:** `feat/onboarding-revamp` (from current `feat/ui-overhaul`)
> **Deadline:** March 9, 2026
> **Success criteria:** New player downloads → sees majestic tower → claims a block → customizes it → charges it → optionally pokes → prompted to connect wallet. All within ~60s, with consistent VFX timing and polished particles.

---

## Current Problems

1. **No immersion** — tower appears with a quick 3s sweep, then walls of text
2. **Title screen is wordy** — "650 blocks. One tower. Yours to keep — or lose." Intimidating before they even understand the game
3. **Claim flow is confusing** — relies on standard BlockInspector, user must find the CLAIM button
4. **Customization is broken** — color picker during onboarding gets overwritten by phase transition (selectBlock(null) + ghost state cleared)
5. **No charge tutorial** — the core daily loop isn't taught
6. **No poke prompt** — social mechanic undiscoverable
7. **No wallet prompt** — no conversion funnel
8. **VFX timing mismatch** — converging particles appear at t=0 but the boom is at t=2.5s, audio buildup too quiet
9. **Particles could be richer** — more emitters, more variety, more color

---

## New Flow (7 phases)

```
CINEMATIC (5-8s)  →  TITLE (3-4s)  →  CLAIM (user-paced)  →  CELEBRATION (3-4s)
    →  CUSTOMIZE (user-paced)  →  CHARGE (user-paced)  →  POKE (optional, dismissible)
    →  WALLET (dismissible)  →  DONE
```

---

## Architecture Notes

### Key Files

| Area | Files |
|------|-------|
| Onboarding orchestrator | `apps/mobile/components/onboarding/OnboardingFlow.tsx` |
| Title reveal | `apps/mobile/components/onboarding/TitleReveal.tsx` |
| Coach marks | `apps/mobile/components/onboarding/CoachMark.tsx` |
| Onboarding store | `apps/mobile/stores/onboarding-store.ts` |
| Tower scene / camera | `apps/mobile/components/tower/TowerScene.tsx` |
| Tower reveal hook | `apps/mobile/hooks/useTowerReveal.ts` |
| Claim VFX | `apps/mobile/components/tower/ClaimVFX.tsx` |
| Claim effect config | `apps/mobile/constants/ClaimEffectConfig.ts` |
| Claim celebration hook | `apps/mobile/hooks/useClaimCelebration.ts` |
| Sound generation | `scripts/generate-sounds.js` |
| Audio utils | `apps/mobile/utils/audio.ts` |
| Haptics | `apps/mobile/utils/haptics.ts` |
| Block inspector actions | `apps/mobile/components/inspector/InspectorActions.tsx` |
| Block inspector customize | `apps/mobile/components/inspector/InspectorCustomize.tsx` |
| Block actions hook | `apps/mobile/hooks/useBlockActions.ts` |
| Tower grid (flash/shockwave) | `apps/mobile/components/tower/TowerGrid.tsx` |
| Theme constants | `apps/mobile/constants/theme.ts` |
| Wallet connect sheet | `apps/mobile/components/ui/WalletConnectSheet.tsx` |
| Wallet store | `apps/mobile/stores/wallet-store.ts` |
| Main screen | `apps/mobile/app/(tabs)/index.tsx` |

### State Machine Change

**Current phases:** `title → claim → customize → reveal → done`

**New phases:** `cinematic → title → claim → celebration → customize → charge → poke → wallet → done`

Update `onboarding-store.ts` to support the expanded phase list. Each phase transition is explicit via `advancePhase()`. The `phase` field drives all conditional rendering in `OnboardingFlow.tsx`.

### Critical Patterns

- **Read before writing** — always read every file before modifying it
- **No `new` in useFrame** — pre-allocate vectors/colors in useRef
- **mediump + highp uTime** — any new shaders must use `uniform highp float uTime;`
- **Ghost block state** — onboarding uses `ghostClaimBlock`/`ghostCustomizeBlock` which operate on local demo state, not server
- **Camera uses nearestAzimuth()** — never set raw azimuth for programmatic moves
- **Fire-and-forget audio** — `playX()` calls are synchronous, no await
- **pointerEvents="box-none"** on overlay containers so tower taps pass through when needed
- **Run `/ui-standards` after UI changes** — verify no hardcoded colors, proper theme usage
- **Run `/perf` after particle/shader changes** — verify geometry budget and fill rate

---

## Phase 1: Onboarding Store + State Machine

**Goal:** Expand the phase state machine to support the full new flow. This is the foundation everything else builds on.

### Task 1.1 — Update onboarding-store.ts

**Read first:** `apps/mobile/stores/onboarding-store.ts`

Update the `OnboardingPhase` type:
```typescript
type OnboardingPhase =
  | 'cinematic'   // NEW: camera fly-around
  | 'title'       // title overlay (slimmed down)
  | 'claim'       // dedicated CTA
  | 'celebration' // NEW: VFX plays out, no UI
  | 'customize'   // color + emoji picker
  | 'charge'      // NEW: charge tutorial
  | 'poke'        // NEW: optional poke prompt
  | 'wallet'      // NEW: wallet connect card
  | 'done';
```

- Initial phase changes from `'title'` to `'cinematic'`
- `advancePhase()` should follow the sequence above in order
- Add a `skipToPhase(phase: OnboardingPhase)` for edge cases (e.g., skip poke)
- Keep the same SecureStore persistence (`HAS_COMPLETED_ONBOARDING`)
- `resetOnboarding()` still works for replay from Settings

### Task 1.2 — Skeleton OnboardingFlow phases

**Read first:** `apps/mobile/components/onboarding/OnboardingFlow.tsx`

Add empty phase blocks for `cinematic`, `celebration`, `charge`, `poke`, `wallet` in the render. Each should be a `{phase === "x" && <View>...</View>}` placeholder with a "Phase: X" debug label. We'll fill them in subsequent phases.

Remove the current `reveal` phase entirely — it's being replaced by the combination of `celebration` + `charge` + `poke` + `wallet` which communicate the same info better through action rather than text.

### Verification
- `cd apps/mobile && npx jest --testPathPattern onboarding` — existing tests still pass
- `timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json` — zero errors

---

## Phase 2: Cinematic Camera Fly-Around

**Goal:** When the app opens for a new player, the tower builds up (existing reveal) and then the camera does a slow, dramatic 360° orbit (5-8s) showing the full scale and beauty of the tower.

### Task 2.1 — Extend useTowerReveal for cinematic orbit

**Read first:** `apps/mobile/hooks/useTowerReveal.ts`, `apps/mobile/components/tower/TowerScene.tsx`

The current `useTowerReveal` does a 3-second build-up reveal (blocks scale up layer by layer + camera sweeps 72°). We need to add a second phase:

**Phase A — Build reveal (existing, 3s):**
- Blocks scale up layer by layer
- Camera sweeps 72° (existing `REVEAL_AZIMUTH_SWEEP`)
- `playTowerRise()` SFX fires

**Phase B — Cinematic orbit (NEW, 5-6s):**
- Starts after Phase A completes (at t=3s)
- Camera does a smooth ~300° orbit (nearly full circle, not exact 360 to avoid jumpiness)
- Elevation gently oscillates: 1.2 → 1.0 → 1.3 (slightly above → slightly below → settle at overview)
- Zoom gently breathes: 40 → 35 → 42 → 40 (closer during mid-orbit for intimacy)
- LookAt Y drifts up slightly then settles (draws eye up the tower)
- Ease: cubic ease-in-out for the full arc
- Total duration: ~8s (3s build + 5s orbit)

**Implementation approach:**
- Add `cinematicOrbitProgress` (0→1 over 5s) to the reveal controller
- Drive camera targets in `useFrame` based on this progress
- Use `nearestAzimuth()` base + progress * orbitArc for azimuth
- The orbit should feel weightless — no sharp acceleration
- When orbit completes, set `revealComplete = true` in store
- The onboarding store listens for `revealComplete` to advance from `cinematic` → `title`

**New constants:**
```typescript
const CINEMATIC_ORBIT_DURATION = 5; // seconds after build reveal
const CINEMATIC_ORBIT_ARC = Math.PI * 1.67; // ~300 degrees
const CINEMATIC_ELEVATION_CURVE = [1.2, 1.0, 1.3, 1.2]; // keyframes
const CINEMATIC_ZOOM_CURVE = [40, 35, 42, 40]; // keyframes
```

### Task 2.2 — Wire cinematic phase to onboarding store

**Read first:** `apps/mobile/app/(tabs)/index.tsx`

- When `phase === 'cinematic'`, disable all HUD elements (FloatingNav, TopHUD, etc.)
- The tower reveal + cinematic orbit plays automatically
- When the orbit completes, the store advances to `'title'`
- No user interaction needed during this phase — pure spectacle

### Task 2.3 — Add ambient SFX for cinematic orbit

**Read first:** `apps/mobile/utils/audio.ts`, `scripts/generate-sounds.js`

The current `towerRise` SFX covers the 3s build. We need a gentle ambient pad for the orbit phase:
- Option A: Extend `towerRise` WAV to be ~8s with a rising pad that blooms after the initial rumble
- Option B: Add a new `cinematic-pad.wav` that crossfades in at t=3s
- **Preferred: Option A** — single audio track, simpler timing

Update `generate-sounds.js` to produce a longer `tower-rise.wav`:
- 0-3s: existing low rumble rising in pitch (the build phase)
- 3-8s: warm pad that blooms open (A major, reverb tail, volume swell from -12dB to -6dB then fade)
- Total: ~8-9s WAV

### Verification
- App opens → blocks build up → camera orbits smoothly → settles at overview
- No jank, no jump cuts, smooth easing throughout
- `timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json` — zero errors
- `/perf` — no new geometry or shader cost (camera-only animation)

---

## Phase 3: Title Screen Overlay

**Goal:** "MONOLITH" appears overlaid during the last 2-3 seconds of the orbit, with a minimal one-line hook and a CTA. Clean, bold typography. The tower is always visible behind.

### Task 3.1 — Redesign TitleReveal component

**Read first:** `apps/mobile/components/onboarding/TitleReveal.tsx`, `apps/mobile/constants/theme.ts`

Replace the current multi-text fade sequence with:

**Layout (centered, over tower):**
```
                    [subtle scrim ~20% black]

                         MONOLITH
                   Own your piece of the tower

                       [ GET STARTED ]
```

**Typography:**
- "MONOLITH": `FONT_FAMILY.headingBlack` (Outfit 900), 48px, `COLORS.textOnDark`, 6px letter-spacing, text shadow for readability over 3D
- Tagline: `FONT_FAMILY.bodyMedium` (Inter 500), 16px, `COLORS.textMuted`, 0.5px letter-spacing
- CTA button: Gold pill (`COLORS.gold` bg, `COLORS.textOnGold` text), `FONT_FAMILY.bodySemibold`, 16px, 1px letter-spacing, `SHADOW.gold` glow

**Animation timing:**
- "MONOLITH" fades in during last 2s of cinematic orbit (the title phase starts while orbit is finishing)
- Tagline fades in 400ms after title
- CTA button springs in 600ms after title (scale 0.8→1 + fade)
- Very subtle scrim (rgba(6,8,16,0.20)) behind text area only — don't dim the whole tower

**On CTA tap:**
- `hapticButtonPress()` + `playButtonTap()`
- Fade out all elements (200ms)
- `advancePhase()` → `claim`

**Skip button** remains in top-right corner (same style as current).

### Task 3.2 — Remove old verbose copy

Delete the old "650 blocks. One tower. Yours to keep — or lose." messaging from TitleReveal. The stakes messaging moves to after the claim (during charge/reveal steps).

### Verification
- Title appears smoothly over the orbiting tower
- Text is readable over any tower angle (text shadow + scrim)
- CTA button is obviously tappable
- `/ui-standards` — no hardcoded colors, proper theme tokens

---

## Phase 4: Dedicated Claim CTA

**Goal:** After title, camera flies to an auto-selected block. A big, bold, centered "CLAIM THIS BLOCK" button appears — not the standard BlockInspector. Clear, focused, no visual noise.

### Task 4.1 — Update claim phase in OnboardingFlow

**Read first:** `apps/mobile/components/onboarding/OnboardingFlow.tsx`, `apps/mobile/components/tower/TowerScene.tsx`

When `advancePhase()` transitions from `title` → `claim`:
1. `pickTutorialBlock()` selects an unclaimed block near layer 8 (existing logic, keep it)
2. `setGhostBlock(blockId)` + `selectBlock(blockId)` — camera flies to block
3. **DO NOT show BlockInspector during onboarding claim** — add a guard: `if (isOnboarding && phase === 'claim') return null` in BlockInspector rendering (check how index.tsx conditionally renders it)

**Dedicated claim UI (new):**
- Appears 800ms after camera starts flying (let them see the approach)
- Centered on screen, lower third
- Coach mark arrow pointing down at the block
- Block preview: show the block's layer number ("Layer 8") and position
- Big gold button: "CLAIM THIS BLOCK" with `FONT_FAMILY.headingBold`, 22px
- Subtitle: "This block is yours to keep. Or lose." (brief stakes hint)
- Spring entrance animation (scale + fade)

**On claim tap:**
1. `hapticButtonPress()`
2. `ghostClaimBlock(ghostBlockId)` — local claim
3. `advancePhase()` → `celebration`
4. `triggerCelebration(block.position, -1, true)` — triggers full VFX sequence

### Task 4.2 — Suppress BlockInspector during onboarding

**Read first:** `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/components/ui/BlockInspector.tsx`

Add onboarding phase awareness to BlockInspector visibility:
- When `onboardingPhase` is not `'done'`, hide the standard BlockInspector
- The onboarding flow handles all block interaction UI during tutorial
- After onboarding completes, BlockInspector resumes normal behavior

### Verification
- Camera flies smoothly to the selected block
- Big CTA is clearly visible and tappable
- No BlockInspector panel competing for attention
- The block highlights/glows to indicate it's the target

---

## Phase 5: VFX Timing Fix + Particle Enhancement

**Goal:** Fix the timing mismatch (particles before boom), tighten the buildup, add more particle variety and color.

### Task 5.1 — Tighten claim celebration timing

**Read first:** `apps/mobile/constants/ClaimEffectConfig.ts`, `apps/mobile/hooks/useClaimCelebration.ts`

**Current issue:** `CLAIM_IMPACT_OFFSET_SECS = 2.5` — too long. Converging particles are visible for 2.5 seconds before the boom, and the buildup audio isn't prominent enough to justify the wait.

**Changes:**
- Reduce `CLAIM_IMPACT_OFFSET_SECS` from `2.5` to `1.5`
- Adjust phase fractions to match:
  ```
  buildup:     0-42%   (0-1.5s for normal 3.5s duration)
  impact:      42-55%  (1.5-1.93s)
  celebration: 55-88%  (1.93-3.08s)
  settle:      88-100% (3.08-3.5s)
  ```
- Reduce normal `duration` from `5.5` to `4.0` (snappier overall)
- Reduce first-claim `duration` from `7.5` to `5.5` (still special but not as long)
- Update haptic chain timing to match new 1.5s buildup:
  ```
  0ms: Light, 200ms: Light, 400ms: Medium, 700ms: Medium,
  1000ms: Heavy, 1300ms: Heavy
  1500ms: Heavy impact + Success
  2400ms, 2600ms, 2800ms: Light settle taps
  ```

### Task 5.2 — Regenerate claim celebration audio

**Read first:** `scripts/generate-sounds.js`

Update the `claimCelebration` sound synthesis to match the new 1.5s impact offset:
- 0-1.5s: Tighter, more audible buildup — rising tone from 100Hz to 400Hz, increasing volume from -18dB to -6dB, add a subtle white noise swell
- 1.5s: Big impact — low boom (60Hz, -2dB) + high crystal shatter (2kHz-8kHz, -4dB) + reverb tail
- 1.5-3.5s: Celebration shimmer — descending chimes in A Dorian, gentle reverb fadeout
- Run `node scripts/generate-sounds.js` to regenerate the WAV

### Task 5.3 — Enhance ClaimVFX particle system

**Read first:** `apps/mobile/components/tower/ClaimVFX.tsx`

Add more emitters and variety to the existing wawa-vfx system:

**New/enhanced emitters:**

1. **Buildup phase (0 → 1.5s):**
   - Existing: 120 converging violet particles — keep but increase to 160 and add gold/amber tones alongside violet
   - NEW: `glowRef` — 20 large soft orbs (size 0.8-2.0) that pulse around the block during buildup, AdditiveBlending, warm amber color, very slow speed (0.5-2), lifetime matching buildup duration

2. **Wave 1 (t=1.5s) — impact burst:**
   - Existing sparks: increase from 200 → 280 particles, add white-hot core particles
   - Existing stars: keep at 80, increase stretchScale from 8 → 12 for more dramatic streaks
   - Existing rays: increase from 30 → 50, add color variety (gold → white → cyan gradient)
   - NEW: `ringRef` — 60 particles arranged in an expanding ring pattern (speed outward only, uniform Y, radial distribution), gold/white, short lifetime 0.3-0.8s. Creates the "shockwave ring" look.

3. **Wave 2 (t=1.8s):**
   - Existing confetti: keep at 180, add more saturated colors (currently limited palette)
   - Existing embers: increase from 80 → 120, add slight color variation (amber → orange → rose)

4. **Wave 3 (t=2.05s):**
   - Existing aurora: keep at 40
   - NEW: `trailRef` — 30 StretchBillboard particles with very long lifetime (4-8s) and very slow speed (0.1-1), large size (0.5-2.0), low opacity. These are the lingering "aftermath" particles that make the scene feel alive after the explosion.

**Color palette expansion:**
- Current: violet, gold, orange, white, amber
- Add: cyan-white (for core flash), rose-pink (confetti), warm white (rays), seafoam green (aurora, ties to solarpunk theme)

### Task 5.4 — Fix camera shake timing

**Read first:** `apps/mobile/components/tower/TowerScene.tsx` (search for `CLAIM_IMPACT_OFFSET_SECS`)

Update the camera celebration sequence to use the new 1.5s offset:
- Primary shake at t=1.5s (was 2.5s)
- Aftershock at t=1.9s (was 2.9s)
- Zoom-in at t=2.9s (was 3.9s)
- Pre-zoom restore at `duration - 0.5s`
- Reduce orbit speed from 0.0025 → 0.002 since total duration is shorter

### Task 5.5 — Fix TowerGrid shockwave timing

**Read first:** `apps/mobile/components/tower/TowerGrid.tsx` (search for `CLAIM_PHASES` and `uClaimWave`)

The shockwave ring and claim light in the BlockShader read from `CLAIM_PHASES.impact.start`. Verify these phase fraction changes cascade correctly:
- The shockwave should trigger at the new 42% mark (was 45%)
- Light ramp should match new timing
- Claim flash per-block animation (2s gold pulse) should start at the impact moment

### Verification
- Claim a block → buildup is 1.5s with visible particle convergence + audible rising tone
- At 1.5s: BOOM — particles explode, camera shakes, shockwave ring, sound impact, all simultaneous
- Confetti + embers follow immediately
- Lingering aurora + trails for 3-4s after
- Total sequence feels punchy, not dragged out
- `/perf` — check fill rate with new particle counts (should be fine since wawa-vfx is instanced)
- `timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json` — zero errors

---

## Phase 6: Customize Phase (Color + Emoji)

**Goal:** After the claim celebration settles, the customize panel slides up. Player picks a color and emoji. Their choices actually persist on the ghost block and don't get overwritten.

### Task 6.1 — Fix ghost block customization persistence

**Read first:** `apps/mobile/stores/tower-store.ts` (search for `ghostCustomizeBlock`, `clearGhostBlock`, `completeOnboarding`)

**The bug:** `handleCustomizeDone` calls `selectBlock(null)` which triggers camera deselect, and `completeOnboarding()` may clear ghost state. The customization doesn't visually persist.

**Fix:**
- `ghostCustomizeBlock` should write to the demo block's `ownerColor` and `ownerEmoji` fields directly in the `demoBlocks` array
- `completeOnboarding()` should NOT clear the ghost block's customization — it should merge the ghost block into the "real" demo state as a permanently customized block
- Remove the `selectBlock(null)` call from the customize→charge transition (we still want the block selected during charge)
- `clearGhostBlock()` should only clear the ghost ID reference, not the block's visual properties

### Task 6.2 — Redesign customize UI for onboarding

**Read first:** `apps/mobile/components/onboarding/OnboardingFlow.tsx` (customize section), `apps/mobile/components/inspector/InspectorCustomize.tsx`

Replace the current inline color-only picker with a better panel:

**Layout:**
```
┌────────────────────────────────────────┐
│  Step 2 of 5  [● ● ○ ○ ○]            │
│                                        │
│  Make it yours                         │
│  Pick a color and emoji                │
│                                        │
│  COLOR                                 │
│  [■][■][■][■][■][■][■][■]            │
│                                        │
│  EMOJI                                 │
│  [🔥][⚡][💎][🌟][🎯][👑][🌊][🎨]  │
│                                        │
│         [ LOOKS GOOD →]               │
└────────────────────────────────────────┘
```

**Details:**
- Glass-backed panel (`GLASS_STYLE.hudDark`), slide up from bottom with spring animation
- Step indicator dots updated for new 5-step flow (claim ✓, customize ●, charge ○, poke ○, wallet ○)
- Section headers: `FONT_FAMILY.bodySemibold`, 11px, uppercase, `COLORS.textMuted`, 2px letter-spacing (use `TEXT.overline` preset)
- Color swatches: 8 from `BLOCK_COLORS`, 48x48px, rounded, gold border on selected
- Emoji row: horizontal ScrollView, 8 visible + scroll for more, from `BLOCK_ICONS`
- Each tap: `ghostCustomizeBlock(id, { color })` or `ghostCustomizeBlock(id, { emoji })` + haptic + SFX
- "LOOKS GOOD" CTA: gold button, advances to `charge` phase
- **Remove the 8-second auto-advance timer** — let the user take their time
- The block on the tower updates in real-time as they pick (existing ghostCustomizeBlock wiring)

### Verification
- Pick a color → block changes on tower in real-time
- Pick an emoji → block shows the emoji
- Tap "LOOKS GOOD" → customization persists, block still shows chosen color/emoji
- No visual reset or flicker during transition

---

## Phase 7: Charge Tutorial

**Goal:** Teach the core daily loop. "Charge your block to keep it alive." Player taps charge, sees the blue pulse, understands the mechanic.

### Task 7.1 — Build charge tutorial phase

**Read first:** `apps/mobile/hooks/useBlockActions.ts` (search for `handleCharge`), `apps/mobile/components/onboarding/OnboardingFlow.tsx`

When `phase === 'charge'`:

1. Camera should still be focused on their newly claimed + customized block
2. Re-select the ghost block if not selected: `selectBlock(ghostBlockId)`
3. Show a tutorial overlay:

**Layout:**
```
┌────────────────────────────────────────┐
│  Step 3 of 5  [● ● ● ○ ○]            │
│                                        │
│  Charge your block daily               │
│  Miss 3 days and anyone can take it    │
│                                        │
│         [ ⚡ CHARGE ]                  │
│                                        │
│  Your block decays every 24 hours.     │
│  Come back to keep it alive.           │
└────────────────────────────────────────┘
```

**On charge tap:**
1. `hapticButtonPress()` + `playChargeTap()`
2. Call `ghostChargeBlock(ghostBlockId)` — need to add this to tower-store if it doesn't exist (increments energy locally without server)
3. Show the blue-white charge flash on the block (existing `recentlyChargedId` mechanism — set it to the ghost block ID)
4. Brief pause (800ms) to let the flash play
5. `advancePhase()` → `poke`

**Typography:**
- "Charge your block daily": `FONT_FAMILY.heading` 20px, `COLORS.goldLight`
- Warning: `FONT_FAMILY.bodySemibold` 14px, `COLORS.fading` (orange-red)
- Instructions: `FONT_FAMILY.body` 13px, `COLORS.textMuted`
- Button: Blue-white gradient or `COLORS.blazing` with ⚡ icon, same glass button style

### Verification
- Charge button triggers blue-white flash on block
- Haptic + SFX fire simultaneously
- Phase advances after charge
- Stakes messaging is clear but not intimidating

---

## Phase 8: Optional Poke Prompt

**Goal:** Briefly introduce the social mechanic. Dismissible — don't block the flow.

### Task 8.1 — Build poke prompt phase

**Read first:** `apps/mobile/stores/poke-store.ts`, `apps/mobile/hooks/useBlockActions.ts` (search for `handlePoke`)

When `phase === 'poke'`:

1. Camera pans to a nearby bot-owned block (pick one adjacent to the player's claimed block, or on the same layer)
2. Select that block: `selectBlock(nearbyBotBlockId)`
3. Show a dismissible tooltip overlay:

**Layout:**
```
┌────────────────────────────────────────┐
│  Step 4 of 5  [● ● ● ● ○]            │
│                                        │
│  Poke your neighbors 👋               │
│  Give them a boost of energy           │
│                                        │
│  [ POKE ]        [ SKIP → ]           │
└────────────────────────────────────────┘
```

**On POKE tap:**
1. `hapticButtonPress()` + `playPokeSend()`
2. Visual feedback (the block flashes or bounces — can reuse charge flash with a different color, or just play the existing poke animation)
3. Brief pause (600ms)
4. `advancePhase()` → `wallet`

**On SKIP tap:**
1. `hapticButtonPress()` + `playButtonTap()`
2. `advancePhase()` → `wallet`

**Finding a nearby bot block:**
```typescript
function pickNearbyBotBlock(ghostBlockId: string, demoBlocks: DemoBlock[]): string | null {
  const ghost = demoBlocks.find(b => b.id === ghostBlockId);
  if (!ghost) return null;
  const candidates = demoBlocks.filter(b =>
    b.owner !== null &&
    b.id !== ghostBlockId &&
    Math.abs(b.layer - ghost.layer) <= 2
  );
  if (candidates.length === 0) return null;
  // Pick closest by position
  return candidates.sort((a, b) =>
    Math.abs(a.indexInLayer - ghost.indexInLayer) - Math.abs(b.indexInLayer - ghost.indexInLayer)
  )[0].id;
}
```

### Verification
- Camera pans to a bot block
- Poke button fires visual + audio feedback
- Skip works and doesn't break the flow
- Phase advances correctly either way

---

## Phase 9: Wallet Connect Prompt

**Goal:** End of onboarding. "Connect your wallet to play for real." Dismissible — they can stay in demo mode.

### Task 9.1 — Build wallet connect phase

**Read first:** `apps/mobile/components/ui/WalletConnectSheet.tsx`, `apps/mobile/stores/wallet-store.ts`

When `phase === 'wallet'`:

1. Camera returns to overview position: `selectBlock(null)`, targets reset to overview zoom/elevation
2. Show a bottom card (reuse `BottomPanel` component or similar glass panel):

**Layout:**
```
┌────────────────────────────────────────┐
│  Step 5 of 5  [● ● ● ● ●]            │
│                                        │
│  You're in.                            │
│                                        │
│  Connect a wallet to stake real USDC   │
│  and compete on the leaderboard.       │
│                                        │
│  [ CONNECT WALLET ]    [ PLAY DEMO → ] │
│                                        │
│  Seed Vault · Phantom · Solflare       │
└────────────────────────────────────────┘
```

**On CONNECT WALLET:**
1. `hapticButtonPress()` + `playButtonTap()`
2. Open `WalletConnectSheet` (set `showConnectSheet(true)` on wallet store)
3. On successful connect: `completeOnboarding()` + `skipOnboarding()`
4. On dismiss/cancel: stay on wallet phase, user can tap "PLAY DEMO"

**On PLAY DEMO:**
1. `hapticButtonPress()` + `playButtonTap()`
2. `completeOnboarding()` + `skipOnboarding()` — phase → done

**Typography:**
- "You're in.": `FONT_FAMILY.headingBold` 24px, `COLORS.goldLight`
- Description: `FONT_FAMILY.body` 14px, `COLORS.textOnDark`
- Wallet hint: `FONT_FAMILY.body` 12px, `COLORS.textMuted`

### Verification
- Wallet connect opens the real MWA flow
- "Play Demo" completes onboarding without wallet
- All UI elements clean up properly
- No lingering overlays or ghost state

---

## Phase 10: Integration, Polish & Edge Cases

**Goal:** Wire everything together, handle edge cases, ensure smooth transitions between all phases.

### Task 10.1 — Phase transition animations

**Read first:** `apps/mobile/components/onboarding/OnboardingFlow.tsx`

Each phase transition should feel smooth:
- **cinematic → title**: Title fades in over the last 2s of orbit (overlap, not cut)
- **title → claim**: Title fades out (200ms), camera flies to block (800ms async)
- **claim → celebration**: CTA scales down + fades (150ms), celebration VFX takes over
- **celebration → customize**: Customize panel springs up as VFX settles (overlap at ~80% of celebration)
- **customize → charge**: Panel morphs/slides to charge content (keep same container, swap content with crossfade)
- **charge → poke**: Camera pans to neighbor, poke tooltip springs in
- **poke → wallet**: Camera returns to overview, wallet card slides up
- **wallet → done**: Card slides down, all overlays gone

### Task 10.2 — Step indicator updates

The `StepDots` component should reflect the new 5-step flow:
- Step 1: Claim (completed after claim phase)
- Step 2: Customize
- Step 3: Charge
- Step 4: Poke
- Step 5: Connect

Show dots starting from the `claim` phase (not during cinematic/title — those are pre-tutorial spectacle).

### Task 10.3 — Skip button behavior

The skip button should:
- Be visible from `title` phase onward (not during cinematic — let them watch)
- Skip always completes onboarding fully (clears ghost state, sets done, writes SecureStore)
- Confirmation not needed — it's a tutorial, not a destructive action

### Task 10.4 — Replay from Settings

**Read first:** `apps/mobile/components/settings/SettingsContent.tsx`

"Replay Onboarding" should:
1. `resetOnboarding()` — clears SecureStore, resets phase to `cinematic`
2. Navigate to the tower tab
3. The full flow plays again identically
4. If player already has blocks, the tutorial claim is still a ghost claim (demo mode)

### Task 10.5 — Hide standard HUD during onboarding

**Read first:** `apps/mobile/app/(tabs)/index.tsx`

During onboarding (phase !== 'done'), hide:
- FloatingNav (bottom pills)
- TopHUD (top bar)
- HotBlockTicker
- LiveActivityTicker
- BlockInspector (already handled in Phase 4)
- Any other HUD overlays

Show only:
- The 3D tower
- The onboarding overlay
- The skip button

### Verification (Full flow test)
1. Fresh install / replay → cinematic orbit plays (5-8s), tower looks majestic
2. "MONOLITH" title fades in during orbit → minimal text, clear CTA
3. Tap "GET STARTED" → camera flies to unclaimed block, big CLAIM button
4. Tap "CLAIM" → celebration VFX (1.5s buildup → boom → particles), camera shakes
5. Celebration settles → customize panel (color + emoji), choices persist on block
6. Tap "LOOKS GOOD" → charge tutorial, tap charge, blue flash plays
7. Camera pans to neighbor → optional poke prompt
8. Overview returns → wallet connect or "Play Demo"
9. Onboarding complete, all HUD elements appear, player is in the game
10. Replay from Settings works identically

### Final checks
- `cd apps/mobile && npx jest` — all tests pass
- `timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json` — zero errors
- `/ui-standards` — no hardcoded colors, proper theme usage
- `/perf` — particle counts within budget, no new shader cost

---

## Summary of Files Modified

| File | Changes |
|------|---------|
| `stores/onboarding-store.ts` | New phase state machine (9 phases) |
| `components/onboarding/OnboardingFlow.tsx` | Complete rewrite — all new phases |
| `components/onboarding/TitleReveal.tsx` | Minimal redesign — "MONOLITH" + hook + CTA |
| `hooks/useTowerReveal.ts` | Add cinematic orbit phase (5s, ~300°) |
| `constants/ClaimEffectConfig.ts` | Tighten timing (2.5s→1.5s), new phase fractions |
| `hooks/useClaimCelebration.ts` | Updated durations + haptic chain |
| `components/tower/ClaimVFX.tsx` | New emitters (glow, ring, trails), more particles |
| `components/tower/TowerScene.tsx` | Updated camera celebration timing |
| `components/tower/TowerGrid.tsx` | Updated shockwave/light timing |
| `scripts/generate-sounds.js` | Tighter buildup audio, extended tower-rise |
| `stores/tower-store.ts` | Fix ghost block persistence, add ghostChargeBlock |
| `app/(tabs)/index.tsx` | Hide HUD during onboarding |
| `components/ui/BlockInspector.tsx` | Suppress during onboarding phases |
| `utils/audio.ts` | New/updated sound exports if needed |

---

## Completion Criteria

When this plan is done:
1. New player has a "wow" moment within 5 seconds (cinematic orbit)
2. They understand the core loop: claim → customize → charge → poke
3. VFX timing is tight — buildup feels intentional, boom is synchronized
4. Particles are rich and varied — multiple colors, emitter types, lingering effects
5. All customization choices persist visually
6. Wallet conversion funnel exists but doesn't block demo play
7. Zero TypeScript errors, all existing tests pass
8. Performance within budget (`/perf` clean)

`ONBOARDING_REVAMP_COMPLETE`
