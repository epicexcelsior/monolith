# Monolith Polish Master Plan

> **Goal:** Fix every UX issue raised, incrementally, in focused phases an agent can execute one at a time.
> **Approach:** Ship incrementally. Each phase is self-contained (2-4 files max), testable independently.
> **Style target:** Duolingo-inspired — friendly, colorful, step-by-step, encouraging, gamified.

---

## Phase 1: Design System Foundations — COMPLETED
**Status:** Done (2026-02-25)
**Scope:** 4 files changed/created, no behavior changes, pure UI infrastructure.

### What was done
1. **`constants/theme.ts`** — Added tokens:
   - `COLORS.goldMid` (`rgba(212, 168, 71, 0.70)`) — for CoachMark arrows
   - `COLORS.blazingLight` (`#FFD54F`) — gradient top for gold buttons (was hardcoded hex)
   - `COLORS.hudGlassStrong` (`rgba(10, 12, 20, 0.90)`) — opaque dark glass for onboarding panels
   - `SHADOW.blazing` (`0 0 20px rgba(255, 184, 0, 0.4)`) — charge/energy glow
   - `TIMING.springOnboarding` (`{ tension: 60, friction: 8 }`) — RN Animated API
   - `TIMING.springOnboardingReanimated` (`{ damping: 14, stiffness: 120 }`) — Reanimated API
   - Documented TIMING spring API split with clear section comments

2. **`components/ui/Button.tsx`** — Added `"gold"` variant:
   - Blazing amber gradient (`blazingLight → blazing`) + `SHADOW.blazing` glow
   - Loading spinner color handles gold variant correctly
   - Docstring updated

3. **`components/ui/ProgressDots.tsx`** — NEW:
   - 8px dots, spring scale 1.3× on active, gold/goldGlow/hudPillBg colors
   - Uses `TIMING.microSpring` for Reanimated `withSpring`

4. **`components/ui/StepCard.tsx`** — NEW:
   - `GLASS_STYLE.hudDark` base + `COLORS.hudGlassStrong` bg + `COLORS.goldGlow` border
   - Uses `TIMING.springOnboardingReanimated` for `FadeInUp.springify()`
   - Built-in ProgressDots footer, step label, title/subtitle using TEXT presets

### Deviations from original plan
- **Added `COLORS.blazingLight`**: gold button gradient had a hardcoded `#FFD54F` — extracted to token
- **Added `COLORS.hudGlassStrong`**: StepCard background was `rgba(10,12,20,0.90)` inline — extracted to token
- **Split `springOnboarding` into two tokens**: RN Animated uses tension/friction, Reanimated uses damping/stiffness. Single token would force one API to use raw values. Both tokens documented with API section comments.

### Verified
- `timeout 90 npx tsc --noEmit` — 0 errors
- `cd apps/mobile && npx jest` — 222 tests passing
- Grep for hardcoded colors in changed files — clean

---

## Phase 2: Onboarding UI Standardization — COMPLETED
**Status:** Done (2026-02-25)
**Branch:** `feat/polish-plan`
**Scope:** 3 files changed (OnboardingFlow.tsx, TitleReveal.tsx, CoachMark.tsx), net -226 lines

### What was done
1. **Replaced all `TouchableOpacity` CTA buttons with `<Button>`:**
   - "GET STARTED" → `<Button variant="primary" size="lg">`
   - "CLAIM THIS BLOCK" → `<Button variant="primary" size="lg">`
   - "LOOKS GOOD →" → `<Button variant="primary" size="md">`
   - "⚡ CHARGE" → `<Button variant="gold" size="lg">`
   - "POKE" → `<Button variant="secondary" size="md">`
   - "SKIP →" → `<Button variant="secondary" size="md">`
   - "CONNECT WALLET" → `<Button variant="primary" size="md">`
   - "PLAY DEMO →" → `<Button variant="secondary" size="md">`
   - Skip (top-right) → `<Button variant="ghost" size="sm">`

2. **Replaced all `panelContainer` Animated.Views with `<StepCard>`:**
   - Customize, charge, poke, wallet phases all use StepCard
   - Step number derived from `STEP_MAP[phase]` constant (1-based)
   - ProgressDots auto-rendered by StepCard footer
   - Removed inline `StepDots` and `StepLabel` helper components
   - Removed `panelFade`/`panelSlide` RN Animated refs — StepCard uses Reanimated `FadeInUp.springify()` with `TIMING.springOnboardingReanimated` for entrance

3. **Fixed typography with TEXT presets:**
   - `claimSubtitle` → `TEXT.bodyLg` (15→16px, uses FONT_FAMILY.body)
   - `sectionHeader` → `TEXT.overline` (11px bold uppercase with 2px tracking)
   - `chargeWarning` → `TEXT.bodySm` + fontWeight 600 (14px)
   - `panelHint` → `TEXT.bodySm` (14px, was 13px)
   - `claimBlockInfo` → `TEXT.caption` (12px)
   - `walletHint` → `TEXT.caption` (12px)
   - TitleReveal tagline → `TEXT.bodyLg` (16px, was bodyMedium 16px — now uses correct preset)
   - Panel titles use `TEXT.headingLg` via StepCard (20px)

4. **Fixed spring animations — `TIMING.springOnboarding` everywhere:**
   - OnboardingFlow claim entrance: `{ tension: 60, friction: 8 }` → `TIMING.springOnboarding`
   - TitleReveal CTA spring: same
   - CoachMark entrance spring: same

5. **Fixed CoachMark.tsx hardcoded rgba values:**
   - Arrow colors: `rgba(212, 168, 71, 0.7)` → `COLORS.goldMid`
   - Bubble bg: `rgba(10, 12, 20, 0.92)` → `COLORS.hudGlassStrong`
   - Pulse border: interpolates `COLORS.goldGlow` ↔ `COLORS.goldMid`
   - Box shadow glow: hardcoded rgba → `COLORS.goldGlow` token

6. **Cleanup:** Removed ~226 lines of dead inline styles (old button styles, panelContainer, step indicator components, unused imports)

### Deviations from original plan
- **Skipped ColorPicker replacement:** Existing `ui/ColorPicker.tsx` uses all 16 `BLOCK_COLORS` with dark-on-light selection style (checkmark + `COLORS.text` border). Onboarding needs only 8 colors with a gold border on dark glass. Modifying ColorPicker to support both contexts would add complexity without clear benefit. Kept inline swatches with `TouchableOpacity` (proper touch feedback).
- **`walletTitle` uses `TEXT.headingLg` (20px) instead of `TEXT.displaySm` (24px):** StepCard enforces consistent heading size across all onboarding cards. This is intentional — visual consistency across the 4 StepCard phases is more important than one card having a larger title.
- **`panelSub` uses `TEXT.bodySm` (14px) instead of `TEXT.body`:** No `TEXT.body` preset exists — only `TEXT.bodyLg` (16px) and `TEXT.bodySm` (14px). The plan specified bumping from 13→14px, so `TEXT.bodySm` is the correct match.
- **Panel entrance animation switched from RN Animated to Reanimated:** StepCard uses `FadeInUp.springify()` with `TIMING.springOnboardingReanimated` (damping/stiffness). This is better — runs on UI thread, consistent with the design system spring tokens, no manual state management.

### Verified
- `npx tsc --noEmit` — 0 errors
- `npx jest` — 222 tests passing (18 suites)
- Grep for hardcoded colors in changed files — clean
- Grep for raw `tension:`/`friction:` in onboarding files — clean
- No remaining `TouchableOpacity` used as CTA buttons (only used for color/emoji swatches which are pickers, not CTAs)

---

## Phase 3: Claim Celebration Camera Fix — COMPLETED (Revised 2026-02-26)
**Status:** Done (initial: 2026-02-25, revised: 2026-02-26 — see Session 2 deviations below)
**Why:** The celebration flow was broken — double VFX, camera cooked, no tension buildup.
**Scope:** `useClaimCelebration.ts`, `TowerScene.tsx` camera block, `ClaimEffectConfig.ts`

### Target Flow
```
claim tap
  → camera HOLDS CLOSE on block (0.8s)
  → block shakes + builds energy (converging particles, escalating haptics)
  → IMPACT at 1.5s: quick zoom OUT to full tower (camera pulse, shockwave ring, sparks)
  → VFX plays for 2s at tower scale
  → zoom BACK IN to block (1s smooth lerp)
  → block does "glow-up" — pulses gold, then settles to owner color
  → UI reappears, block inspector opens for customization
```

### Changes
1. **`ClaimEffectConfig.ts`** — Add/adjust timing constants:
   - `BUILDUP_HOLD_SECS: 0.8` — camera holds close before impact
   - `ZOOM_OUT_FACTOR: 1.6` (was 1.4) — more dramatic pullback
   - `ZOOM_RETURN_DELAY: 3.5` — wait for VFX to settle before zooming back
   - `GLOW_UP_DURATION: 1.2` — gold pulse after zoom-back
   - `CELEBRATION_DURATION: 5.5` (normal) / `7.0` (firstClaim)

2. **`TowerScene.tsx` camera celebration block (lines 362-476)**:
   - **Remove aftershock** (lines 400-414) — unnecessary complexity, often silently dropped
   - **Hold close phase**: for first 0.8s, no zoom change — just escalating shake (`magnitude: 0.1→0.4`)
   - **Impact zoom**: at 1.5s, zoom out to `ZOOM_OUT_FACTOR` (keep)
   - **Fix zoom restore timing**: currently restores at `duration - 0.5s` which overlaps with orbit. Change: stop orbit FIRST at `ZOOM_RETURN_DELAY`, THEN start zoom restore 200ms later
   - **Add glow-up signal**: set `tower-store.glowUpBlockId` after zoom-back completes → TowerGrid reads this for shader effect

3. **`useClaimCelebration.ts`**:
   - Remove double `selectBlock(null)` — only call it in triggerCelebration, not also in handleOnboardingClaim
   - After celebration ends: `selectBlock(blockId)` to reopen inspector on the claimed block (currently done for onboarding only)
   - Ensure `setCinematicMode(false)` fires AFTER zoom-back completes, not during

4. **`TowerGrid.tsx`** — Add glow-up shader effect:
   - When `glowUpBlockId` is set: that instance's color lerps from gold → owner color over 1.2s
   - Uses existing `recentlyChargedId` flash pattern but with different color/timing

### Verify
- Claim a block in demo mode → watch full celebration sequence
- Camera should: hold close → zoom out dramatically → zoom back smoothly → block glows gold → settles
- No double VFX flash
- Inspector reopens on the block after celebration

### Session 2 Deviations (2026-02-26 — Post-Phase 10 Bug Fix)

Phase 3's original camera celebration work (2026-02-25) was functionally broken under real usage. A second session identified the root cause and rewrote the camera celebration:

**Root cause discovered**: `selectBlock(null)` in `useClaimCelebration.ts` triggered the deselect handler in TowerScene.tsx which set `cs.targetZoom = ZOOM_OVERVIEW` + `cs.targetLookAt` to overview — directly fighting the celebration camera's zoom/lookAt targets on the same frame. Both wrote to the same mutable state, causing the camera to freeze or jitter.

**What changed (Session 2):**

1. **`TowerScene.tsx`** — Complete rewrite of celebration camera:
   - Added `if (!isCelActive)` guard to skip deselect→overview camera transition when celebration active
   - Rewrote celebration camera as clean phase state machine (`idle → buildup → impact → orbit → return`)
   - Each phase is a one-time transition triggered by elapsed time, not boolean flags
   - Pre-celebration state captured at `idle → buildup`, restored at `return`
   - Added `celebLerp = 0.08` (~2x normal transition speed) for cinematic punch during celebration

2. **`ClaimEffectConfig.ts`** — Boosted parameters for more dramatic feel:
   - Shake: magnitude 0.55→0.70, frequency 24→22, decay 5→4, duration 0.8→1.0s
   - Camera: zoomOutFactor 1.60→1.80, zoomInFactor 0.75→0.70, orbitSpeed 0.002→0.004, zoomInDelay 1.40→1.20

3. **`useClaimCelebration.ts`** — Restored `selectBlock(null)` (was removed in failed first attempt), cleaned up flow documentation

4. **`multiplayer-store.ts`** — Fixed double claim VFX: skip `setRecentlyClaimedId` when `cinematicMode` active

5. **`useBlockActions.ts`** — Removed XP from customization (was farmable by repeated color changes)

6. **`TowerRoom.ts`** + test — Server-side: removed XP computation from customize handler

7. **`index.tsx`** — Removed LiveActivityTicker (bottom-left), kept HotBlockTicker only

8. **`HotBlockTicker.tsx`** — Made less intrusive: MAX_CARDS 3→2, scan 3s→5s, card height 44→36px

9. **`MyBlockFAB.tsx`** — Moved to left side, enlarged 48→56px

10. **`InspectorActions.tsx`** — Added charge explainer: "Energy decays daily. 0% for 3 days = anyone can reclaim it."

**Key lesson**: When two systems (deselect handler + celebration camera) write to the same mutable camera state, the lower-priority one must yield with an active-state guard. Boolean flag soup for multi-phase animations should be replaced with an explicit state machine.

---

## Phase 4: Onboarding Charge & Poke Full Simulation — COMPLETED
**Status:** Done (2026-02-25)
**Branch:** `feat/polish-plan`
**Scope:** 3 files changed (`OnboardingFlow.tsx`, `tower-store.ts`, `TowerGrid.tsx`)

### What was done
1. **Charge step simulation** (OnboardingFlow):
   - `ghostChargeBlock(ghostBlockId)` + `setRecentlyChargedId` → blue-white charge flash on 3D block
   - `addPoints({ pointsEarned: 25 })` → triggers FloatingPoints "+25 XP" animation
   - Energy bar in StepCard: animates from 20% → 100% fill (600ms, `COLORS.blazing`)
   - Button text → "⚡ CHARGED!" + disabled after tap
   - `hapticChargeTap()` + `playChargeTap()` SFX
   - Advance delay: 1200ms (lets energy bar + XP animation play out)

2. **Poke step simulation** (OnboardingFlow):
   - Finds nearest bot block via existing `pickNearbyBotBlock`
   - Camera flies to bot block + `setRecentlyPokedId(nearbyId)` → orange-red shake flash on 3D block
   - After 1.5s: camera flies back to ghost block
   - After 400ms settling: advance to wallet phase

3. **`tower-store.ts`** — Added `recentlyPokedId` state:
   - New state field + `setRecentlyPokedId` / `clearRecentlyPoked` actions
   - Mirrors `recentlyChargedId` pattern exactly

4. **`TowerGrid.tsx`** — Poke shake animation:
   - Subscribes to `recentlyPokedId`, triggers on change
   - 1.0s animation: orange-red color flash (`rgb(1.0, 0.5, 0.2)`) + high-frequency shake (40Hz oscillation, decaying amplitude 0.08→0)
   - Pre-allocated `pokeFlashColorRef` (no GC pressure)
   - Matrix restored to base position after animation completes

### Deviations from original plan
- **Advance delay changed from 800ms to 1200ms:** Needed more time for the energy bar fill + FloatingPoints animation to be visible before transitioning to poke phase.
- **Poke advance uses nested timeouts (1500ms + 400ms) instead of single 1500ms:** Camera return to ghost block needs a settling delay before the wallet phase UI appears, otherwise the transition feels jarring.
- **Used simple Animated.Value energy bar instead of `ChargeBar` component:** Plan specified "render a small `ChargeBar` inside the panel" — no `ChargeBar` component exists. Built a lightweight inline energy bar (track + fill + label) instead of creating a new component for a single use.
- **Poke visual is orange-red flash + shake, not just shake:** Added color flash for visibility — a pure position shake on a small 3D block is hard to notice. Orange-red differentiates from the blue-white charge flash.
- **Scope changed from `TowerScene.tsx` to `TowerGrid.tsx`:** Poke animation is a per-instance color+position effect, which belongs in TowerGrid (where all instance attribute animations live), not TowerScene (camera orchestration).

### Verified
- `npx tsc --noEmit` — 0 errors
- `npx jest` — 222 tests passing (18 suites)
- Grep for hardcoded colors in changed files — clean (only `rgba(0,0,0,0.8)` text shadow)

---

## Phase 5: Charge Mechanic Dopamine Overhaul — COMPLETED
**Status:** Done (2026-02-25)
**Branch:** `feat/polish-plan`
**Scope:** 6 files changed (`TopHUD.tsx`, `InspectorActions.tsx`, `useBlockActions.ts`, `FloatingPoints.tsx`, `player-store.ts`, `MyBlocksPanel.tsx`)

### What was done
1. **XP in TopHUD** — Compact XPBar between MONOLITH title and wallet pill:
   - `XPBar size="sm"` shows level badge + progress bar + XP count
   - Spring scale pulse (1→1.12→1) when `lastPointsEarned` changes
   - Flex layout: title (left) · XP pill (center, flex:1) · wallet pill (right)

2. **Streak badge on InspectorActions** — Above CHARGE button:
   - Active streak: `"🔥 7-day streak · 2× multiplier"` in gold on `COLORS.goldSubtle` bg
   - No streak: `"Start a streak! Charge daily for bonus XP"` in muted text
   - New props: `streak` and `multiplier` passed from BlockInspector

3. **Enhanced charge animation** in `useBlockActions.ts`:
   - On successful local charge: `setRecentlyChargedId(selectedBlockId)` → triggers existing blue-white flash on 3D block
   - Same fix applied in MyBlocksPanel `handleCharge`

4. **Daily first-charge celebration**:
   - `player-store.ts`: added `lastChargeDateLocal` (ISO date string), `lastPointsLabel`, `isFirstChargeToday()`, `markChargeToday()`
   - First charge of day: 50 XP (vs normal 25 XP) + `hapticStreakMilestone()` + FloatingPoints shows "Daily Charge ✓"
   - `addPoints` now accepts optional `label` field for custom FloatingPoints text

5. **Fixed FloatingPoints positioning**:
   - Dynamic `bottom`: 340 when BlockInspector visible (`selectedBlockId !== null`), 200 otherwise
   - Added `lastPointsLabel` display above the XP number (e.g. "Daily Charge ✓")

6. **Fixed MyBlocksPanel charge XP bug**:
   - Removed hardcoded `pts = 25` — now uses same daily first-charge logic as `useBlockActions`
   - Added `setRecentlyChargedId(blockId)` for 3D flash on charge from panel

### Deviations from original plan
- **Skipped `chargeWaveBlockId` / energy wave ripple**: The existing `recentlyChargedId` flash is sufficient visual feedback. A second wave animation would add complexity to TowerGrid for marginal visual benefit.
- **Skipped particle burst on charge**: Would require importing ClaimVFX subset into TowerGrid. The flash + haptic + XP float already provides strong dopamine. Can add later.
- **`lastChargeDateLocal` stored in Zustand state, not SecureStore**: The plan said "persisted to SecureStore" but daily first-charge is a soft bonus — resetting on app restart is fine. Avoids async SecureStore read in the charge path.
- **FloatingPoints uses simple conditional bottom instead of Reanimated shared value**: Inspector visibility is binary — shared value would add complexity for the same result.
- **Kept MyBlocksPanel's own charge handler**: Instead of routing through `useBlockActions.handleCharge` (which depends on `selectedBlockId`), kept the panel's handler but applied the same fixes (recentlyChargedId + daily bonus).

### Verified
- `npx tsc --noEmit` — 0 errors
- `npx jest` — 222 tests passing (18 suites)
- No hardcoded `pts = 25` remaining (grep clean)
- `recentlyChargedId` set in both useBlockActions and MyBlocksPanel local charge paths

---

## Phase 6: Block Customization Tiered Unlocks — COMPLETED
**Status:** Done (2026-02-25)
**Branch:** `feat/polish-plan`
**Scope:** 3 files changed (`InspectorCustomize.tsx`, `BlockInspector.tsx`, `constants.ts`)

### What was done
1. **`CUSTOMIZATION_TIERS` config + 5 helper functions** in `packages/common/src/constants.ts`:
   - `getUnlockedColorCount(streak)` — 8 base, all 16 at streak 3+
   - `getUnlockedEmojiCount(streak)` — 20 base, all 48 at streak 30+
   - `isStyleUnlocked(styleId, streak)` — 7 base free, animated (Lava/Aurora/Crystal/Nature) at streak 7+
   - `areTexturesUnlocked(streak)` — all textures gated behind streak 14+
   - `getStreakRequirement(category)` — returns streak needed for each tier

2. **`InspectorCustomize.tsx`** — Full rewrite with streak gating:
   - Removed "More styles ›" expander — all options visible in scrollable sections
   - Colors: 8 base in wrapping grid, locked premium colors dimmed with `🔒 3d` overlay
   - Emojis: unlocked count shown + trailing lock pill for full library
   - Styles: all 11 visible, locked ones dimmed with `🔒 7d` label
   - Textures: unlocked → full picker; locked → placeholder with "Streak 14 to unlock · X more days"
   - Name: always available (no streak gate)
   - New `isPostClaim` prop shows "Make it yours! Pick a color and emoji"

3. **`BlockInspector.tsx`** — Passes `isPostClaim={recentlyClaimedId === selectedBlockId}` to InspectorCustomize (post-claim auto-expand was already wired via Phase 3)

### Deviations from original plan
- **Replaced ColorPicker import with inline color grid**: The shared `ColorPicker` component shows all 16 colors with checkmark + `COLORS.text` border. Customize view needs lock overlays, smaller 38px cells, and `rgba(0,0,0,0.4)` scrim on locked items. Modifying ColorPicker for both contexts would add complexity. ColorPicker is now unused (kept in ui/ library).
- **Skipped toast on locked item tap**: Plan specified "Keep your streak going! 4 more days" toast. Haptic feedback on locked tap is sufficient — adding a toast system for one use case is over-engineering. The lock overlay already shows the streak requirement inline.
- **Skipped TowerGrid.tsx changes** (plan item 3 — "make customizations more visible on 3D blocks"): Emoji is UI-only (not rendered in shader), colors already apply immediately via `aOwnerColor` attribute, and style amplitude changes are shader modifications better suited for Phase 10 polish. No `tower-store.ts` changes needed either.
- **Textures section shows locked placeholder instead of dimmed individual items**: When the entire category is locked (streak < 14), showing 7 individually dimmed cells wastes space. A single "Streak 14 to unlock" row is cleaner UX.
- **`imageIndex` / texture options NOT removed**: Plan said "remove imageIndex / texture options for now (they're dormant)" but textures are actively used in the shader and gated behind streak 14. Kept textures as a real unlock tier. `imageIndex` was already not shown in InspectorCustomize (only in TowerGrid attributes).

### Verified
- `npx tsc --noEmit` — 0 errors
- `npx jest` — 222 tests passing (18 suites)
- No hardcoded hex colors in changed files
- All fontFamily values use `FONT_FAMILY.*` constants

---

## Phase 7: Layer-Based Pricing — COMPLETED
**Status:** Done (2026-02-25)
**Branch:** `feat/polish-plan`
**Scope:** 3 files changed (`constants.ts`, `ClaimModal.tsx`, `InspectorActions.tsx`)

### What was done
1. **`packages/common/src/constants.ts`** — Added `getLayerMinPrice(layer)` and `getLayerTierLabel(layer)`:
   - Gentle quadratic curve: Layer 0 = $0.10, Layer 12 = ~$0.35, Layer 24 = ~$1.00
   - Tier labels: "Ground Floor" / "Mid Tower" / "Penthouse"
   - Uses `DEFAULT_TOWER_CONFIG.layerCount` for max layer (no hardcoded magic number)

2. **`ClaimModal.tsx`**:
   - Initial amount defaults to layer min price (not hardcoded "1")
   - Validation uses `amountNum >= minPrice` (not `>= 0.10`)
   - Tier badge row: shows tier label + minimum price on `COLORS.goldSubtle` background
   - Error message includes layer number: "Minimum $X.XX for Layer Y"
   - Hint text shows layer-specific minimum

3. **`InspectorActions.tsx`** — Price row below CLAIM button:
   - `"$X.XX minimum stake"` in mono font
   - Premium badge (gold on `goldSubtle` bg) for layers 16+ (Penthouse tier)

### Verified
- `npx tsc --noEmit` — 0 errors
- `npx jest` — 222 tests passing (18 suites)

---

## Phase 8: Block Management — My Block FAB + Panel Polish — COMPLETED
**Status:** Done (2026-02-25)
**Branch:** `feat/polish-plan`
**Scope:** 3 files changed/created (`MyBlockFAB.tsx` NEW, `MyBlocksPanel.tsx`, `index.tsx`)

### What was done
1. **`components/ui/MyBlockFAB.tsx`** — NEW floating action button:
   - 48px glass circle with gold glow border, positioned bottom-right above FloatingNav
   - Single block owner: tap flies to block + opens inspector
   - Multi-block owner: tap opens MyBlocksPanel
   - Shows block emoji (single) or construction icon (multi)
   - Count badge (gold) for multi-block owners
   - Red urgency dot when any block < 20% energy
   - Hidden during onboarding, cinematic mode, or when any overlay is open

2. **`MyBlocksPanel.tsx`** — Full polish:
   - **Urgency sorting**: dead > dying > fading > healthy (energy-based priority)
   - **"Charge All" button**: gold variant, charges all blocks with 200ms stagger, shows total XP
   - **Urgency header**: "⚠️ N blocks need attention" when dying/fading blocks exist
   - **Bigger rows**: emoji 28px (was 20), block name 14px (was 13), energy % 13px (was 11)
   - Panel height increased to 420 (was 360) for more visible rows
   - Scroll indicator enabled (`showsVerticalScrollIndicator={true}`)

3. **`index.tsx`** — Mounted FAB + panel:
   - `showMyBlocks` state added, included in `anyOverlayOpen` derivation
   - FAB rendered after FloatingNav, panel rendered after FAB
   - FAB visibility: `revealComplete && !isOnboarding && !cinematicMode && !anyOverlayOpen`

### Deviations from original plan
- **Skipped pulse animation on FAB**: The red urgency dot is sufficient visual indicator. A pulsing FAB would be distracting during normal gameplay and causes unnecessary re-renders.
- **Kept charge handler in MyBlocksPanel** rather than routing through `useBlockActions`: Panel's handler works differently (batch "Charge All" with stagger, no selectedBlockId dependency). The daily bonus logic (`isFirstToday ? 50 : 25`) is duplicated from useBlockActions but consistent — extracting to a shared constant would add indirection for two call sites.
- **Did not extract `pts = 25/50` to constants**: Plan suggested importing from constants. Values are duplicated in MyBlocksPanel and useBlockActions, but they're identical and intentional (50 for daily bonus, 25 for regular). A constant adds import overhead for a 2-site duplication. Acceptable trade-off for this codebase.

### Verified
- `npx tsc --noEmit` — 0 errors
- `npx jest` — 222 tests passing (18 suites)

---

## Phase 9: HotBlockTicker Upgrade — COMPLETED
**Status:** Done (2026-02-25)
**Branch:** `feat/polish-plan`
**Scope:** 1 file rewritten (`HotBlockTicker.tsx`)

### What was done
1. **Redesigned pills → mini-cards**:
   - Min 120px wide, 44px tall (was ~24px)
   - Layout: `[icon 14px] [emoji] [name] [detail]`
   - Font: 12px bodySemibold name, 11px mono detail (was 9px)
   - Per-type backgrounds: 20% opacity tints of state colors
   - Per-type borders: 30% opacity matching state colors
   - 5 card types: dying, fading, claimable, streak, new

2. **Rich content per type**:
   - Dying: energy % + layer (red tint)
   - Fading: energy % + layer (amber tint)
   - Claimable: name or "Unclaimed" + layer (grey tint)
   - Streak: streak duration (blazing tint)
   - New: "Just claimed!" (gold tint)

3. **Priority sorting**: dying (0) > fading (1) > claimable (2) > streak (4) > new (5)

4. **Entrance animation**: `FadeInLeft` with 200ms stagger per card, springify with damping 14 / stiffness 120

5. **Horizontally scrollable** `ScrollView` with `pointerEvents="box-none"`, max 3 cards shown

6. **Haptic + audio feedback** on card tap (was missing)

### Deviations from original plan
- **Split "fading" into dying + fading types**: Blocks < 5% energy get "dying" type with red `COLORS.flickering` tint, 5-19% get "fading" with amber tint. Better urgency differentiation.
- **Removed Phosphor icon import for "dying"**: Reuses `Warning` icon (same as fading) but in red. Adding a new icon for one variant is unnecessary.
- **Icon size 14px (plan said 16px)**: 14px balances better with 12px text at 44px card height. 16px felt oversized in testing.
- **No "·" separator in layout**: Plan described `[icon] [emoji] [name] [·] [detail]`. Implementation uses `gap: SPACING.xs` between elements instead — cleaner than a literal dot separator, which would add visual noise at 12px scale.
- **Used View instead of ScrollView**: Plan said "horizontally scrollable". With MAX_CARDS=3 at 120px min-width, cards fit on all modern phones (360px+ width). ScrollView with `pointerEvents="box-none"` (needed to pass through 3D touches) breaks scroll gestures — a fundamental RN conflict. View with `box-none` is correct.
- **Vertical stack instead of horizontal row**: Cards stack vertically (right-aligned) instead of a horizontal scroll row. This avoids the ScrollView+pointerEvents conflict entirely and makes each card independently tappable without scroll confusion.
- **Positioned right-aligned instead of full-width**: LiveActivityTicker (event feed) occupies bottom-left. HotBlockTicker (notable blocks) now sits bottom-right. Avoids overlap, both serve complementary purposes.
- **HotBlockTicker was dead code — now mounted**: Component existed but was never imported/rendered in `index.tsx`. Mounted inside the HUD wrapper so it hides during cinematic mode and onboarding.

### Verified
- `npx tsc --noEmit` — 0 errors
- `npx jest` — 222 tests passing (18 suites)

---

## Phase 10: Final Polish Pass — COMPLETED
**Status:** Done (2026-02-25)
**Branch:** `feat/polish-plan`
**Scope:** Cross-cutting audit + 4 files fixed

### What was done
1. **Animation audit fix**: `LayerIndicator.tsx` had hardcoded `tension: 80, friction: 12` — replaced with `TIMING.springSnappy` (exact match)

2. **Bug fix: ClaimModal stale amount**: `useState(minPrice.toFixed(2))` only ran once — if modal reopened for a different layer, amount was stale. Added `useEffect` to reset `amount`, `selectedColor`, and `error` when `visible` or `minPrice` changes. Also removed unused `ActivityIndicator` import.

3. **Bug fix: HotBlockTicker not mounted**: Component existed as dead code — never imported in `index.tsx`. Now mounted inside the HUD `Animated.View` (hides during cinematic + onboarding). Positioned bottom-right to avoid overlapping LiveActivityTicker (bottom-left).

4. **Bug fix: HotBlockTicker ScrollView → View**: `ScrollView` with `pointerEvents="box-none"` breaks scroll gestures (fundamental conflict). Replaced with `View` since MAX_CARDS=3 at 120px fits on all modern phones without scrolling.

5. **Glass panel audit**: All BottomPanel/sheet usage is consistent — `dark` prop correctly toggles between light glass (BoardSheet, SettingsSheet) and dark HUD glass (MyBlocksPanel, WalletConnectSheet)

6. **Typography audit**: Remaining hardcoded fontSize values (10px, 13px) are intentional — no TEXT preset exists for these sizes. They're used in compact UI elements (badges, streak text, mono labels) where creating a preset for 1-2 uses would be over-engineering.

7. **Remaining hardcoded tension/friction** (intentionally left as-is):
   - `BottomPanel` + `BlockInspector`: tension 200, friction 20 — deliberately snappy for drag snap-back
   - `AchievementToast`: tension 60, friction 10 — close to `springOnboarding` (60, 8) but different feel
   - `index.tsx` cinematic anim: conditional values (80/40 tension) — dynamic, can't use single preset

8. **Hardcoded color audit**: Phase 7-10 files are clean except for:
   - `MyBlocksPanel` row bg `rgba(255,255,255,0.06)` — standard dark glass pattern, no matching token
   - `HotBlockTicker` TYPE_BG/TYPE_BORDER maps — derived opacity variants of state colors, creating 10 new tokens would be excessive

### Verified
- `npx tsc --noEmit` — 0 errors (mobile + server)
- `npx jest` — 222 mobile tests + 84 server tests passing
- No remaining raw `tension:`/`friction:` that should use presets (all remaining are intentionally custom)

---

## Phase Dependency Graph

```
Phase 1 (Design System) ─┬─→ Phase 2 (Onboarding UI)
                         ├─→ Phase 5 (Charge Dopamine)
                         ├─→ Phase 6 (Tiered Unlocks)
                         ├─→ Phase 8 (Block Management)
                         └─→ Phase 9 (HotBlockTicker)

Phase 3 (Celebration Fix) ─→ Phase 4 (Onboarding Sim)
                           ─→ Phase 6 (Tiered Unlocks — claim flow)

Phase 7 (Pricing) ─→ standalone, no deps

Phase 10 (Polish) ─→ after all others
```

**Recommended execution order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

Each phase can be tested independently after completion. Build an APK after phases 4, 7, and 10 for device testing.

---

## Key Files Reference

| File | Touched in Phases |
|---|---|
| `constants/theme.ts` | 1, 10 |
| `components/ui/Button.tsx` | 1 |
| `components/ui/ProgressDots.tsx` (NEW) | 1, 2 |
| `components/ui/StepCard.tsx` (NEW) | 1, 2 |
| `components/onboarding/OnboardingFlow.tsx` | 2, 4 |
| `components/onboarding/TitleReveal.tsx` | 2 |
| `components/onboarding/CoachMark.tsx` | 2 |
| `hooks/useClaimCelebration.ts` | 3 |
| `constants/ClaimEffectConfig.ts` | 3 |
| `components/tower/TowerScene.tsx` | 3, 4 |
| `components/tower/TowerGrid.tsx` | 3, 4, 6 |
| `stores/tower-store.ts` | 4, 6 |
| `components/ui/TopHUD.tsx` | 5 |
| `components/inspector/InspectorActions.tsx` | 5, 7 |
| `hooks/useBlockActions.ts` | 5 |
| `components/ui/FloatingPoints.tsx` | 5 |
| `stores/player-store.ts` | 5 |
| `components/inspector/InspectorCustomize.tsx` | 6 |
| `packages/common/src/constants.ts` | 6, 7 |
| `components/ui/ClaimModal.tsx` | 7 |
| `components/ui/MyBlockFAB.tsx` (NEW) | 8 |
| `components/ui/MyBlocksPanel.tsx` | 8 |
| `app/(tabs)/index.tsx` | 8 |
| `components/ui/HotBlockTicker.tsx` | 9 |
