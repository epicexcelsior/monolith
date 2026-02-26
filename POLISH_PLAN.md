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

## Phase 3: Claim Celebration Camera Fix
**Why:** The celebration flow is broken — double VFX, camera cooked, no tension buildup.
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

---

## Phase 4: Onboarding Charge & Poke Full Simulation
**Why:** Charge and poke steps feel dead — button does nothing visible. Users should experience the REAL mechanic.
**Scope:** `OnboardingFlow.tsx`, `tower-store.ts` (ghost functions), `TowerScene.tsx`

### Changes
1. **Charge step simulation** (OnboardingFlow customize→charge transition):
   - On "CHARGE" tap: call `ghostChargeBlock(ghostBlockId)`
   - Set `recentlyChargedId` in tower-store → triggers blue-white charge flash on 3D block
   - Show `FloatingPoints` with "+25 XP" (call `addPoints({ pointsEarned: 25, ... })`)
   - Camera stays on the ghost block (already selected)
   - Show energy bar filling in the StepCard (render a small `ChargeBar` inside the panel)
   - Play `playChargeTap()` SFX + `hapticChargeTap()`
   - After 800ms delay: advance to poke phase

2. **Poke step simulation** (OnboardingFlow poke phase):
   - On "POKE" tap: find nearest bot block (existing logic, line ~472)
   - Briefly fly camera to the bot block (`selectBlock(botBlockId)`)
   - Show a "poke" visual on the bot block (set `recentlyPokedId` → shake animation)
   - Play `playPoke()` SFX + haptic
   - After 1.5s: fly camera back to ghost block, advance to wallet phase

3. **`tower-store.ts`** — Add `recentlyPokedId` state (mirrors `recentlyChargedId` pattern):
   - Set on poke, auto-clear after 1s
   - TowerGrid reads it for a brief shake/flash on the poked instance

### Verify
- Run through onboarding from scratch (long-press MONOLITH to replay)
- Charge step: block should flash blue-white, "+25 XP" should float, energy bar in panel should fill
- Poke step: camera flies to neighbor, block shakes, camera returns

---

## Phase 5: Charge Mechanic Dopamine Overhaul
**Why:** Charging feels like it does nothing. Need visible feedback, points, streaks, daily reward.
**Scope:** `TopHUD.tsx`, `InspectorActions.tsx`, `useBlockActions.ts`, `FloatingPoints.tsx`, `player-store.ts`

### Changes

1. **XP in TopHUD** — Add compact XP pill next to wallet:
   - Import `usePlayerStore` for `xp` and `level`
   - Render: `[Level badge] [mini progress bar] [XP count]` using `XPBar size="sm"`
   - Position: between MONOLITH title and wallet pill (or below title on left)
   - Animate on change: spring scale pulse when XP increases

2. **Streak badge on InspectorActions** — Show streak info prominently:
   - Above the CHARGE button: `"🔥 7-day streak · 2× multiplier"` in gold
   - If no streak: `"Start a streak! Charge daily for bonus XP"`
   - Next milestone: `"3 more days until 2× multiplier"`
   - Use `getStreakMultiplier()` and `getNextStreakMilestone()` from tower-store

3. **Enhanced charge animation** in `useBlockActions.ts`:
   - On successful charge: set `recentlyChargedId` (existing) + new `chargeWaveBlockId`
   - `chargeWaveBlockId` triggers a brief energy wave ripple in TowerGrid (radial pulse outward from block)
   - Block brightness should visibly increase after charge (energy → brightness mapping in shader)
   - Particle burst on charge (reuse ClaimVFX subset — just the spark burst, smaller scale)

4. **Daily first-charge celebration** in `useBlockActions.ts`:
   - Track `lastChargeDateLocal` in player-store (ISO date string, persisted to SecureStore)
   - First charge of each calendar day: play `playClaimCelebration()` (reuse, shorter version), show special FloatingPoints: `"Daily Charge ✓ +50 XP"` (bonus 25 XP)
   - Haptic: `hapticStreakMilestone()`
   - Subsequent charges that day: normal 25 XP

5. **Fix FloatingPoints positioning** — `bottom: 200` is hardcoded:
   - Make position dynamic: when BlockInspector is visible, position above it
   - Use Reanimated shared value tied to inspector height

6. **Fix MyBlocksPanel charge XP bug**:
   - Add `onChargeResult` listener in MyBlocksPanel (or extract to shared hook)
   - Or simpler: always route charges through `useBlockActions.handleCharge` instead of duplicating logic

### Verify
- Open app → charge a block → see: flash on block, "+25 XP" float, XP bar in HUD updates
- Check streak display on inspector
- First charge of day → special celebration
- Charge from MyBlocksPanel → XP should also show

---

## Phase 6: Block Customization Tiered Unlocks
**Why:** Customization is confusing (too many options) and not visible enough. Gamify with streak-gated unlocks.
**Scope:** `InspectorCustomize.tsx`, `constants.ts` (common), `tower-store.ts`

### Changes

1. **Define unlock tiers** in `packages/common/src/constants.ts`:
   ```
   CUSTOMIZATION_TIERS:
     Claim (streak 0): Color (8 base) + Emoji (20 base) + Name
     Streak 3+: +8 premium colors (full BLOCK_COLORS)
     Streak 7+: Animated styles (Lava, Aurora, Crystal, Nature)
     Streak 14+: All textures (Bricks, Circuits, Scales, etc.)
     Streak 30+: Full emoji library (all 48)
   ```

2. **`InspectorCustomize.tsx`** — Gate options by streak:
   - Read `block.streak` from selected block
   - Locked items: show dimmed with 🔒 overlay + "Streak 7 to unlock" tooltip
   - Tapping a locked item: show brief toast "Keep your streak going! 4 more days"
   - Remove "More styles ›" hidden expander — show everything in a scrollable grid, locked items visible but gated
   - Remove `imageIndex` / texture options for now (they're dormant)

3. **Make customizations more visible on 3D blocks** (TowerGrid.tsx):
   - Emoji: render larger (currently it's in the shader — verify it's readable)
   - Color: ensure `ownerColor` applies immediately with a satisfying transition (lerp from previous)
   - Style: animated styles should be obviously different (currently subtle — consider making animation amplitude higher for styles 7-10)

4. **Claim-time customization flow**:
   - After claim celebration (Phase 3 glow-up), inspector opens to customize tab directly
   - Show only unlocked options (streak 0 tier for new claimers)
   - Encouraging copy: "Make it yours! Pick a color and emoji"

### Verify
- Claim a new block → inspector opens to customize → only base colors/emoji available
- Set a block's streak to 7 (manually in store) → animated styles become available
- Locked items show lock icon and streak requirement
- Color/emoji changes are visible on 3D block

---

## Phase 7: Layer-Based Pricing
**Why:** Higher floors should feel more exclusive and valuable.
**Scope:** `packages/common/src/constants.ts`, `ClaimModal.tsx`, `InspectorActions.tsx`

### Changes

1. **Pricing formula** in `packages/common/src/constants.ts`:
   ```ts
   export function getLayerMinPrice(layer: number): number {
     // Layer 0: $0.10, Layer 12 (mid): ~$0.35, Layer 24 (top): ~$1.00
     // Gentle exponential: base * (1 + layer/maxLayer)^2
     const ratio = layer / MAX_LAYERS;
     return Math.round((0.10 + 0.90 * ratio * ratio) * 100) / 100;
   }
   ```

2. **`ClaimModal.tsx`**:
   - Import `getLayerMinPrice`
   - Set initial amount to `getLayerMinPrice(layer)` instead of "1"
   - Validate: `amountNum >= getLayerMinPrice(layer)` instead of `>= 0.10`
   - Show: `"Layer ${layer} minimum: $${min}"` helper text
   - Show layer price tier badge: "Ground Floor" / "Mid Tower" / "Penthouse"

3. **`InspectorActions.tsx`** — Show price on unclaimed blocks:
   - Below "CLAIM" button: `"$${getLayerMinPrice(layer)} minimum stake"`
   - Higher layers get a premium badge

### Verify
- Tap unclaimed block at layer 0 → ClaimModal shows $0.10 min
- Tap unclaimed block at layer 20 → ClaimModal shows ~$0.75 min
- Try to enter less than minimum → error shown

---

## Phase 8: Block Management — My Block FAB + Panel Polish
**Why:** Can't find or manage blocks easily. Need one-tap access + better multi-block UX.
**Scope:** `index.tsx` (home screen), `MyBlocksPanel.tsx`, NEW `MyBlockFAB.tsx`

### Changes

1. **`components/ui/MyBlockFAB.tsx`** — NEW floating action button:
   - Position: bottom-right, above FloatingNav (use `insets.bottom + 56 + SPACING.md`)
   - Shows when player owns 1+ blocks AND no block is selected AND no overlay open
   - Single block owner: tap → camera flies directly to their block + opens inspector
   - Multi-block owner: tap → opens improved MyBlocksPanel
   - Visual: glass circle (48px) with block emoji (or stack icon if multiple), gold border, pulse animation if any block needs attention (fading/dying)
   - Badge: red dot if any block is below 20% energy (urgency indicator)

2. **`MyBlocksPanel.tsx`** — Polish for multi-block management:
   - **Sort by urgency**: dying/fading blocks bubble to top (not buried by layer order)
   - **"Charge All" button** at top: charges all owned blocks in sequence (with 200ms stagger for satisfying cascade), shows total XP earned
   - **Bigger rows**: emoji 28px (was 20), block name prominent, energy % large
   - **Color-coded energy bars**: red/orange/green gradient matching block state
   - **Quick actions without closing panel**: charge button charges in-place (panel stays open), only tapping the block row itself flies camera + closes panel
   - **Remove hardcoded `pts = 25`**: import from constants or route through `useBlockActions`
   - **Add scroll indicator**: `showsVerticalScrollIndicator={true}` with styled scrollbar
   - **Urgency header**: "⚠️ 2 blocks need attention" when dying/fading blocks exist

3. **`index.tsx`** — Mount MyBlockFAB:
   - Add to `anyOverlayOpen` check (hide FAB when overlays open)
   - Position in render tree after FloatingNav

### Verify
- Own 1 block → FAB shows with block emoji → tap → flies to block
- Own 3 blocks → FAB shows stack icon → tap → panel opens sorted by urgency
- Dying block sorts to top with red energy bar
- "Charge All" charges all blocks, shows XP cascade
- FAB hides when inspector/sheet/onboarding is open

---

## Phase 9: HotBlockTicker Upgrade
**Why:** Pills are too small (9px text!) with no useful info. Need bigger cards with context.
**Scope:** `HotBlockTicker.tsx`

### Changes

1. **Redesign pill → mini-card**:
   - Width: auto (min 120px), height: 44px (was ~24px)
   - Layout: `[icon 16px] [emoji] [owner name or "Unclaimed"] [·] [reason badge]`
   - Font: 12px bodySemibold (was 9px)
   - Background: per-type color tint (not all the same `hudPillBg`):
     - Claimable: `COLORS.dormant` at 20% opacity
     - Fading: `COLORS.fading` at 20% opacity
     - New: `COLORS.goldSubtle`
     - Streak: `COLORS.blazing` at 20% opacity
   - Border: subtle 1px matching type color at 30% opacity

2. **Better content per type**:
   - Claimable: `"💀 Unclaimed · L8"` (or owner name + "Lost it!")
   - Fading: `"⚠️ {emoji} {name} · 12% · L5"` (show energy %)
   - New: `"✨ {emoji} {name} · Just claimed!"`
   - Streak: `"🔥 {emoji} {name} · 14d streak"` (show full context)

3. **Priority sorting**: dying (lowest energy first) > fading > claimable > streak > new

4. **Entrance animation**: cards slide in from left with stagger (200ms between each), spring animation

5. **Max 3 cards**, but horizontally scrollable if more notable blocks exist

### Verify
- Cards are clearly readable (12px+, full context)
- Tap a card → camera flies to that block
- Cards animate in smoothly
- Different types have visually distinct colors

---

## Phase 10: Final Polish Pass
**Why:** Catch remaining inconsistencies, remove placeholder content, verify everything works together.
**Scope:** Cross-cutting — all files touched in Phases 1-9

### Changes

1. **Remove placeholder demo artifacts**:
   - Verify `imageIndex` options aren't shown (solana/dogecoin/etc. are placeholder atlas images)
   - Verify bot blocks don't show "Charge" action to the player (ownership enforcement)

2. **Consistent glass panels**: audit all BottomPanel / sheet usage for consistent `GLASS_STYLE.hudDark` base

3. **Typography audit**: grep for raw `fontSize:` in components — should all use TEXT presets

4. **Animation audit**: grep for raw `tension:` / `friction:` — should all use TIMING presets

5. **Test full flow end-to-end**:
   - Fresh install (no SecureStore) → cinematic → title → claim → celebration (fixed camera) → customize (tiered) → charge (full sim with VFX + XP) → poke (full sim) → wallet → done
   - Post-onboarding: charge block → streak display + XP in HUD + dopamine
   - Find my block via FAB → fly to block
   - HotBlockTicker shows notable blocks with full context
   - Higher layer blocks cost more
   - MyBlocksPanel shows urgency-sorted blocks with charge-all

6. **Run all tests**: `cd apps/mobile && npx jest` + `timeout 90 npx tsc --noEmit`

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
