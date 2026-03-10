# UI Fix-Up Plan

## Issue 1: Board/Me sheets show empty black bar
**Root cause**: `BoardSheet` and `SettingsSheet` receive `<View />` as children (placeholder).
The actual content lives in `blocks.tsx` (BoardScreen) and `settings.tsx` (MeScreen), which use
`ScreenLayout` (a full-screen ScrollView with safe area + bg color). We need to extract the
*content* from those screens into sheet-compatible components.

**Fix**:
- Create `components/ui/BoardContent.tsx` — extract the JSX from `BoardScreen` (lines 423–616)
  but replace `ScreenLayout` with a plain `ScrollView` (dark bg, no safe area top padding since
  BottomPanel handles that). Keep all hooks/state inside the component.
- Create `components/ui/SettingsContent.tsx` — same extraction from `MeScreen` (lines 97–351).
  Replace `ScreenLayout` with `ScrollView`, adapt `router.push("/(tabs)")` calls to use the
  `onClose` prop instead (since we're already on the tower screen).
- Wire them into `index.tsx`:
  ```tsx
  <BoardSheet visible={showBoard} onClose={...}>
    <BoardContent />
  </BoardSheet>
  <SettingsSheet visible={showSettings} onClose={...}>
    <SettingsContent onClose={...} />
  </SettingsSheet>
  ```
- Both content components get `dark` text color props since they sit on dark glass sheets.

**Files**: `BoardContent.tsx` (new), `SettingsContent.tsx` (new), `index.tsx` (wire up)

---

## Issue 2: AchievementToast positioning
**Root cause**: `top: 60` is hardcoded, doesn't account for safe area or new TopHUD.

**Fix**: Use `useSafeAreaInsets()` → `top: insets.top + 8` so it sits just below the status bar,
above the TopHUD. The TopHUD already accounts for safe area, so this avoids overlap.

**File**: `AchievementToast.tsx`

---

## Issue 3: Top HUD blocks tower — collapse to minimal dot
**Design**: Replace current always-visible TopHUD + TowerStats with a collapsible system:
- **Collapsed state** (default): A single small pill/dot in top-right corner showing online count
  (or just a subtle "i" icon). Tappable to expand.
- **Expanded state**: Current TopHUD + TowerStats slide in. Auto-collapse after 5s of no touch,
  or tap the dot again to collapse.
- The "MONOLITH" title and wallet pill only show in expanded state.

**Implementation**:
- Add `hudExpanded` state to `index.tsx` (default: `false`)
- Create `HudToggle` component — the minimal dot (top-right, safe area aware)
- Wrap TopHUD + TowerStats in an Animated container that slides in/out
- Auto-collapse timer: 5s after last interaction

**Files**: `index.tsx`, `TopHUD.tsx` (add visible prop), new `HudToggle.tsx` or inline in index

---

## Issue 4: Annoying SFX (tab switch, button tap, panel/sheet open)
**Fix approach**: Reduce volume or remove the most repetitive sounds.
- **Tab switch**: Reduce volume significantly (currently Kenney CC0, probably too loud).
  The simplest fix: skip playing `playTabSwitch()` entirely from FloatingNav — navigation
  haptics are enough feedback.
- **Button tap**: Same — remove `playButtonTap()` calls from high-frequency interactions.
  Keep it only for important actions (claim, charge).
- **Panel/sheet open**: Remove `playSheetOpen()` from BottomPanel. The haptic is enough.
- **Tower rise**: The generated bass sweep may be too harsh. Options:
  a) Lower the volume in the WAV (regenerate with lower amplitude)
  b) Skip it entirely during reveal (the visual is strong enough)
  c) User can replace the WAV file manually

**Approach**: Remove the most annoying calls, document the drop-in replacement system.

**Files**: `FloatingNav.tsx`, `BottomPanel.tsx`, various components that call `playButtonTap()`

---

## Issue 5: Tower rise SFX improvement
**Fix**: Regenerate `tower-rise.wav` with lower amplitude (currently too boomy). Reduce peak
from ~0.38 to ~0.15, make it more of a subtle rumble than an announcement. Or simply remove
the `playTowerRise()` call from `useTowerReveal.ts` and let the visual speak for itself.

**File**: `scripts/generate-sounds.js` or `useTowerReveal.ts`

---

## Issue 6: Claim SFX/VFX timing mismatch
**Root cause**: `playClaimCelebration()` fires at t=0 of the celebration. The audio's BOOM
is at 2.5s. The VFX Wave 1 explosion fires when `elapsed >= 2.5s`. The ScreenFlash fires
at 45% of duration (2.475s for 5.5s, 3.375s for 7.5s first claim).

The mismatch is: for **first claims** (7.5s duration), the screen flash fires at 3.375s
but the audio BOOM is at 2.5s — an 875ms gap where the BOOM has already hit but the
visual impact hasn't.

**Fix**: Change ScreenFlash to use absolute time (2.5s) instead of fractional phase:
- In `ScreenFlash.tsx`, trigger flash when `elapsed >= CLAIM_IMPACT_OFFSET_SECS` instead
  of using `CLAIM_PHASES.impact.start * duration`.
- This syncs the flash to the audio BOOM regardless of celebration duration.

**File**: `ScreenFlash.tsx`, possibly `ClaimEffectConfig.ts`

---

## Issue 7: SFX drop-in replacement documentation
**Deliverable**: Create `apps/mobile/assets/sfx/README.md` mapping every WAV filename to
its trigger, timing constraints, and volume tier. User can then:
1. Record/download a WAV
2. Name it to match the existing filename
3. Drop it into `assets/sfx/`
4. Rebuild

No code changes needed for replacements.

---

## Execution Order
1. **Issue 1** (Board/Me content) — biggest visible bug
2. **Issue 3** (Collapsible HUD) — second biggest UX issue
3. **Issue 4+5** (SFX cleanup) — quick wins
4. **Issue 2** (Toast positioning) — quick fix
5. **Issue 6** (Claim timing) — precision fix
6. **Issue 7** (SFX docs) — documentation
7. TypeScript check + test run
