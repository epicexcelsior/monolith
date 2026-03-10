# Final Sprint Plan — "Make It Click"

> **Branch:** `feat/final-sprint` (create from `main`)
> **Goal:** Transform the Monolith from "pretty tech demo" into "game that makes sense and feels fun"
> **Deadline:** March 10, 2026
> **Date:** 2026-03-10 (revised)

---

## Executive Summary

The Spark Overhaul (Pass 1 + Pass 2) built the **presentation layer** — faces, reactions, evolution celebrations, glow tuning. But the **game mechanics layer** that gives those visuals meaning is missing or broken. Players can spam-charge infinitely, evolution celebrations fire repeatedly for the same tier, faces appear on all 4 sides of blocks (uncanny), and there's no surprise/delight mechanic to make charging exciting.

This plan fixes the core loop across 3 phases:

1. **Day 1: Make It Make Sense** — Bug fixes + clarity + inspector redesign
2. **Day 2: Make It Exciting** — Loot drops on charge (gacha dopamine)
3. **Day 3: Polish + Ship** — End-to-end flow, visual tuning, APK build

After this sprint, a tester/judge experiences: claim a creature -> customize it (color, face, name) -> charge it (satisfying burst + face reacts) -> sometimes get a loot drop (gacha reveal) -> watch it evolve (dramatic one-time celebration) -> all with a compact inspector that doesn't hide the block.

---

## Table of Contents

1. [Diagnosed Problems](#1-diagnosed-problems)
2. [Design Decisions](#2-design-decisions)
3. [Day 1: Make It Make Sense](#3-day-1-make-it-make-sense)
4. [Day 2: Make It Exciting](#4-day-2-make-it-exciting)
5. [Day 3: Polish + Ship](#5-day-3-polish--ship)
6. [File Change Map](#6-file-change-map)
7. [Loot Drop System Spec](#7-loot-drop-system-spec)
8. [Inspector Redesign Spec](#8-inspector-redesign-spec)
9. [Testing Checklist](#9-testing-checklist)
10. [Constraints & Rules](#10-constraints--rules)
11. [Progress Tracker](#11-progress-tracker)

---

## 1. Diagnosed Problems

### 1.1 Evolution Celebration Fires Repeatedly

**Problem:** Charging spams "YOUR SPARK EVOLVED TO EMBER" multiple times because `justEvolved` in tower-store is set every time `chargeBlock()` crosses a threshold, with no deduplication against the block's current stored tier.

**Root cause:** `tower-store.ts chargeBlock()` computes `newEvolutionTier` via `getEvolutionTier()` and compares it against the tier BEFORE this charge. But in testing mode (thresholds: 3/8/15/25), rapid charging crosses the same threshold multiple times before the store state settles, OR the comparison is against a stale value.

**Evidence:** User reports seeing "Spark to Ember" and "Ember to Flame" messages repeating.

**Fix:** Track `lastCelebratedTier` per block. Only fire `justEvolved` when `newEvolutionTier > lastCelebratedTier`. Store `lastCelebratedTier` on the DemoBlock itself.

**Files:** `apps/mobile/stores/tower-store.ts`

### 1.2 Faces on All 4 Sides

**Problem:** Every block renders its face on all 4 vertical faces of the cube. At certain camera angles, you see 2-3 faces simultaneously, which breaks the "one creature = one face" metaphor and looks uncanny.

**Root cause:** `BlockShader.ts renderFace()` is called for ANY fragment where `abs(vWorldNormal.y) < 0.5` (i.e., any vertical face). There's no check for which face points outward from the tower.

**Fix:** Add an outward-facing check in the fragment shader. Since blocks sit on the tower surface, the outward face is the one whose normal points away from the Y-axis (tower center). Use:
```glsl
float outward = dot(normalize(vWorldPos.xz), vWorldNormal.xz);
```
Only render face when `outward > 0.3` (threshold avoids corner edge cases).

**Files:** `apps/mobile/components/tower/BlockShader.ts`

### 1.3 Inspector Covers the Block

**Problem:** The inspector panel is 420px tall and sits at the bottom of the screen. When viewing your selected block, the inspector covers it entirely. The block — which IS the game — is hidden behind UI.

**Fix:** Redesign the inspector to be ~250px compact by default. Customize becomes a separate expandable sub-panel. See Section 8 for full spec.

**Files:** `apps/mobile/components/ui/BlockInspector.tsx`, `apps/mobile/components/inspector/*`

### 1.4 Progression Is Unclear

**Problem:** Players don't understand what charging DOES beyond "number goes up", how evolution works, or where to find the face picker.

**Fix:**
- Make FloatingPoints say "+1 Charge -- 2 more to Ember!" instead of just "+1 Charge"
- Evolution progress bar in InspectorActions should be the FIRST thing visible
- Face picker section in InspectorCustomize needs to be first and more prominent

**Files:** `apps/mobile/components/ui/FloatingPoints.tsx`, inspector components

### 1.5 Unclaimed Blocks Look Ugly

**Problem:** Unclaimed blocks use dark glass + amber wireframe edges + 0.4Hz pulse. They feel dead rather than inviting.

**Fix:** Warmer, brighter base glass, softer edges, golden shimmer at 0.6Hz. Should feel like empty lanterns waiting to be lit.

**Files:** `apps/mobile/components/tower/BlockShader.ts`

### 1.6 No Variable Reward / Dopamine

**Problem:** Every charge feels identical. No surprise element.

**Fix:** Add loot drops — each charge has a chance to drop a cosmetic reward with a gacha-style reveal animation. See Section 7.

### 1.7 SOAR Badges Add Noise

**Problem:** "Verified on Solana via SOAR" badges on the leaderboard add visual clutter.

**Fix:** Hide SOAR badge from BoardContent.tsx.

**Files:** `apps/mobile/components/board/BoardContent.tsx`

---

## 2. Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Keep charging spammable (no cooldown/windows) | Demo mode — judges/testers need to see progression in one session |
| 2 | Keep testing evolution thresholds (3/8/15/25) | Same reason — fast progression for demo |
| 3 | Front face only | One creature = one face. Cleaner, less uncanny. |
| 4 | Compact inspector (~250px default) | Block must be visible. The creature IS the game. |
| 5 | Loot drops are client-side | No server changes needed. Fine for demo. AsyncStorage persistence. |
| 6 | Cut SOAR badge from leaderboard | Reduce noise. Keep SOAR code intact. |
| 7 | Keep Blinks + Tapestry | Social layer adds depth. |
| 8 | Unclaimed = warm pulsing invitation | Not ugly glass wireframe. Inviting, clearly "claim me". |
| 9 | FloatingPoints shows evolution context | "+1 Charge -- 2 to Ember!" makes every charge feel purposeful |
| 10 | Customize is an expandable sub-panel | Keeps default inspector compact. Tap "Customize" to expand. |
| 11 | ~12 loot items total | Small curated set. 4 rare colors, 3 rare emojis, 3 glow effects, 2 legendary styles. |
| 12 | No new Supabase tables | Loot inventory in AsyncStorage. Server is unchanged. |

---

## 3. Day 1: Make It Make Sense

### Phase 1.1: Front Face Only

**Goal:** Faces render only on the outward-facing side of each block.

**File:** `apps/mobile/components/tower/BlockShader.ts`

**Change in fragment shader**, in the face rendering section (~line 733-743):

Current:
```glsl
float isVertFace = step(abs(vWorldNormal.y), 0.5);
```

Add after `isVertFace`:
```glsl
// Only render face on the outward-facing side (away from tower center Y-axis)
float outward = dot(normalize(vWorldPos.xz), vWorldNormal.xz);
float isFrontFace = step(0.3, outward);  // threshold handles corner blocks
isVertFace *= isFrontFace;
```

**Validation:** Orbit around tower. Each block shows exactly 1 face, always facing outward. No multi-face from corners. Faces still visible at overview distance.

**Risk:** Corner blocks may not show face at all if their outward normal is diagonal. The `0.3` threshold should catch most cases. If corner blocks lose faces, lower to `0.1`.

**Time estimate:** 30 minutes.

---

### Phase 1.2: Fix Evolution Celebration Dedup

**Goal:** "YOUR SPARK EVOLVED TO X" shows exactly once per tier per block, never repeats.

**File:** `apps/mobile/stores/tower-store.ts`

**Changes:**

1. Add `lastCelebratedTier` field to `DemoBlock` interface (near other optional fields like `personality`, `ownerName`):
```typescript
lastCelebratedTier?: number; // Tracks last tier we showed celebration for
```

2. In `chargeBlock()` action, where `justEvolved` is set, change the evolution check:

From:
```typescript
if (newEvolutionTier > oldEvolutionTier) {
  set({ justEvolved: tierInfo.name });
}
```

To:
```typescript
const lastCelebrated = block.lastCelebratedTier ?? 0;
if (newEvolutionTier > lastCelebrated) {
  updatedBlock.lastCelebratedTier = newEvolutionTier;
  set({ justEvolved: tierInfo.name });
}
```

3. In `clearJustEvolved()`: only clears `justEvolved` string, does NOT reset `lastCelebratedTier`.

**Validation:** Charge rapidly through Spark->Ember->Flame. Each celebration shows exactly once. Continuing to charge at same tier shows no celebration. Evolving to next tier shows celebration.

**Time estimate:** 30 minutes.

---

### Phase 1.3: Compact Inspector

**Goal:** Inspector is ~250px default (was 420px). Block is visible behind it. Customize is expandable.

See **Section 8** for full spec.

**Files:**
- `apps/mobile/components/ui/BlockInspector.tsx`
- `apps/mobile/components/inspector/InspectorActions.tsx`
- `apps/mobile/components/inspector/InspectorStats.tsx`
- `apps/mobile/components/inspector/InspectorHeader.tsx`

**Key changes:**
1. Reduce `PANEL_HEIGHT` constant to 260
2. Move energy percentage + streak into InspectorHeader (inline, right-aligned)
3. Simplify InspectorActions: remove streak info badge and charge explainer text
4. Add `isExpanded` state to BlockInspector, animated height transition
5. "Customize" chip toggles expansion (260px -> 520px)
6. ScrollView only enabled when expanded

**Layout (compact mode for own block):**
```
+--------------------------------------------+  <- ~250px total
| [drag handle]                     [X close]|
| [Emoji] "My Spark"  EMBER   72%  7d 2x    |  <- Header: inline stats
|                                             |
| EVOLUTION                                   |
| Ember ====[========]======== Flame          |
| 5 more charges to Flame                     |
|                                             |
| [====== CHARGE ======]                      |  <- BIG gold button
|                                             |
| [Customize]  [Share]  [Comments 3]          |  <- Action chips
+--------------------------------------------+
```

**Time estimate:** 2-3 hours.

---

### Phase 1.4: Clear Progression Messaging

**Goal:** Every charge shows context — how many charges to next evolution.

**Files:**
- `apps/mobile/components/ui/FloatingPoints.tsx`
- `apps/mobile/stores/tower-store.ts`
- `apps/mobile/hooks/useBlockActions.ts`

**Changes:**

1. **tower-store.ts `chargeBlock()`:** Return `chargesToNext` info in the charge result:
```typescript
const nextTierInfo = chargesToNextTier(newTotalCharges, newBestStreak);
return {
  // ... existing fields ...
  chargesToNext: nextTierInfo ? nextTierInfo.needed : 0,
  nextTierName: nextTierInfo ? nextTierInfo.nextTierName : null,
};
```

2. **useBlockActions.ts `handleCharge()`:** Pass evolution context to FloatingPoints via player-store:
```typescript
const label = result.nextTierName
  ? `${result.chargesToNext} more to ${result.nextTierName}`
  : "FULLY EVOLVED";
addPoints(1, label, result.chargeQuality);
```

3. **FloatingPoints.tsx:** Show the label more prominently:
```
+1 Charge        <- white, bold
3 more to Ember  <- gold, smaller, below
```

On evolution:
```
+1 Charge
YOUR SPARK EVOLVED!   <- gold, celebratory
```

**Time estimate:** 1 hour.

---

### Phase 1.5: Face Picker Prominence

**Goal:** The FACE section in InspectorCustomize is obvious and easy to find.

**File:** `apps/mobile/components/inspector/InspectorCustomize.tsx`

**Changes:**

1. Move FACE section to FIRST position (before COLOR)
2. Make face buttons larger: 56px tall (was ~40px). Bigger kaomoji text (18px, was 14px).
3. Add a "Your Spark's personality" subtitle under the FACE header.
4. Selected face button gets gold background tint + gold border.

**Time estimate:** 30 minutes.

---

### Phase 1.6: Cut SOAR Badge

**Goal:** Remove "Verified on Solana via SOAR" badge from the leaderboard.

**File:** `apps/mobile/components/board/BoardContent.tsx`

**Change:** Find the SOAR badge rendering and hide it. Do NOT remove the SOAR integration code — just hide the badge UI element.

**Time estimate:** 15 minutes.

---

### Phase 1.7: Unclaimed Block Pulsing Restyle

**Goal:** Unclaimed blocks pulse warmly and invitingly instead of harsh glass + wireframe.

**File:** `apps/mobile/components/tower/BlockShader.ts`

**Changes in the unclaimed block section (~line 1101-1151):**

1. **Brighter, warmer base:**
```glsl
// OLD: vec3(0.16, 0.12, 0.09)
vec3 glassBase = vec3(0.22, 0.17, 0.13);
```

2. **Softer edges (reduce wireframe harshness):**
```glsl
// OLD: smoothstep(halfExt - 0.035, halfExt, ...)
// NEW: wider smoothstep = softer edge
float eX = smoothstep(halfExt - 0.06, halfExt, lp.x);
float eY = smoothstep(halfExt - 0.06, halfExt, lp.y);
float eZ = smoothstep(halfExt - 0.06, halfExt, lp.z);
```

3. **Warmer, more visible pulse:**
```glsl
// OLD: 0.9 + 0.1 * sin(uTime * 0.4 + ...)
float dormantPulse = 0.88 + 0.12 * sin(uTime * 0.6 + vInstanceOffset * 2.0);
```

4. **Edge color: warm gold instead of amber:**
```glsl
vec3 edgeColorLow = vec3(0.65, 0.45, 0.18);   // warm gold
vec3 edgeColorHigh = vec3(0.85, 0.68, 0.28);  // bright gold
```

5. **Reduce face border harshness:**
```glsl
float edgeGlow = max(wireframe * 0.6, faceOutline * 0.15);
```

**Goal feel:** Warm, inviting, like empty lanterns waiting to be lit. Not dead, not harsh — expectant.

**Time estimate:** 1 hour.

---

## 4. Day 2: Make It Exciting

### Phase 2.1: Loot Drop System (Core)

**Goal:** Each charge has a chance to drop a cosmetic reward. Gacha reveal animation creates dopamine.

See **Section 7** for full loot drop spec.

**New files to create:**
- `apps/mobile/constants/loot-table.ts` — Loot items, rarity tiers, roll function
- `apps/mobile/stores/loot-store.ts` — Zustand store with AsyncStorage persistence
- `apps/mobile/components/ui/LootReveal.tsx` — Gacha reveal overlay

**Existing files to modify:**
- `apps/mobile/hooks/useBlockActions.ts` — Call `rollAndStore()` after charge
- `apps/mobile/app/(tabs)/index.tsx` — Mount `<LootReveal />` component

**Sub-tasks:**

| Sub-task | Description | Time |
|----------|-------------|------|
| Loot table + roll function | Define 12 items, rarity tiers, weighted roll logic | 30min |
| Zustand loot store | `inventory`, `pendingReveal`, `rollAndStore()`, AsyncStorage persistence | 30min |
| Roll on charge | In useBlockActions handleCharge, after charge succeeds call `rollAndStore(streak)` | 15min |
| Drop reveal UI | LootReveal.tsx: full-screen overlay, rarity flash, item card, equip button | 2hr |
| Auto-equip | "Equip" button applies loot via existing customize handlers | 30min |
| Mount + timing | Add LootReveal to index.tsx. Queue after evolution celebration if both fire. | 30min |

**Total time estimate:** ~4 hours.

---

### Phase 2.2: Amplify Charge Quality Feel

**Goal:** Normal/good/great charge rolls feel DRAMATICALLY different.

**Files:**
- `apps/mobile/components/tower/TowerGrid.tsx` (flash animation)
- `apps/mobile/components/ui/FloatingPoints.tsx` (text display)
- `apps/mobile/hooks/useBlockActions.ts` (haptic intensity)

**Changes:**

1. **Flash duration spread (TowerGrid.tsx):**
```typescript
// Current: quality 0=1.2s, 1=1.4s, 2=1.6s
// New: more dramatic spread
const flashDuration = [1.0, 1.4, 2.0][quality];
```

2. **Flash color saturation (TowerGrid.tsx):**
```typescript
const flashColors = [
  [0.7, 0.8, 1.0],   // normal: soft blue-white (subtle)
  [1.0, 0.85, 0.3],  // good: warm gold (noticeable)
  [1.0, 0.95, 0.5],  // great: bright white-gold (dramatic)
];
```

3. **Haptic intensity by quality (useBlockActions.ts):**
```typescript
if (result.chargeQuality === 'great') {
  hapticHeavy();
} else if (result.chargeQuality === 'good') {
  hapticMedium();
} else {
  hapticChargeTap();
}
```

4. **FloatingPoints scale (FloatingPoints.tsx):**
```typescript
const initialScale = quality === 'great' ? 1.8 : quality === 'good' ? 1.4 : 1.1;
```

5. **"LUCKY!" on great rolls** — bigger text, gold glow text shadow.

**Time estimate:** 1 hour.

---

## 5. Day 3: Polish + Ship

### Phase 3.1: End-to-End Flow Test

Walk through manually:
1. Fresh start -> onboarding -> see tower
2. Tap unclaimed block -> claim -> celebration
3. Customize: face -> color -> name -> emoji
4. Charge -> see reaction + floating text + progress
5. Charge until loot drop -> gacha reveal -> equip
6. Charge until Spark -> Ember -> celebration (once!)
7. Inspect another player's block -> poke
8. Tap unclaimed block -> see warm pulse

Fix anything that breaks.

**Time estimate:** 2 hours (including fixes).

### Phase 3.2: Visual Polish Pass

- Charge button pulse: always pulses when chargeable
- Inspector transitions: smooth expand/collapse
- Loot reveal timing: doesn't overlap with evolution celebration
- Face LOD: readable at overview distance
- Unclaimed pulse: warm and inviting
- Color palette: all 16 colors look good with faces

**Time estimate:** 2 hours.

### Phase 3.3: Build + Test on Device

```bash
cd apps/mobile && eas build --platform android --profile preview
```

**Time estimate:** 1 hour build + 1 hour test.

### Phase 3.4: Fire Buffer

Something will break. 2 hours unscheduled fix time.

---

## 6. File Change Map

| File | Day | Changes |
|------|-----|---------|
| `apps/mobile/components/tower/BlockShader.ts` | 1 | Front face only check; unclaimed block pulse restyle |
| `apps/mobile/stores/tower-store.ts` | 1 | `lastCelebratedTier` on DemoBlock; dedup `justEvolved`; return `chargesToNext` from chargeBlock |
| `apps/mobile/components/ui/BlockInspector.tsx` | 1 | Compact height (260px); expandable customize; animated height |
| `apps/mobile/components/inspector/InspectorHeader.tsx` | 1 | Inline energy % + streak badge |
| `apps/mobile/components/inspector/InspectorStats.tsx` | 1 | Merge into header or simplify |
| `apps/mobile/components/inspector/InspectorActions.tsx` | 1 | Remove verbose text; compact evolution card; action chips |
| `apps/mobile/components/inspector/InspectorCustomize.tsx` | 1 | Move FACE to first section; larger buttons |
| `apps/mobile/components/ui/FloatingPoints.tsx` | 1,2 | Show evolution context ("3 more to Ember"); amplify quality |
| `apps/mobile/hooks/useBlockActions.ts` | 1,2 | Pass evolution context to FloatingPoints; loot roll trigger; haptic quality |
| `apps/mobile/components/board/BoardContent.tsx` | 1 | Hide SOAR badge |
| `apps/mobile/stores/loot-store.ts` | 2 | NEW: Loot inventory store (Zustand + AsyncStorage) |
| `apps/mobile/constants/loot-table.ts` | 2 | NEW: Loot items, rarity tiers, roll function |
| `apps/mobile/components/ui/LootReveal.tsx` | 2 | NEW: Gacha reveal overlay (rarity flash + item card) |
| `apps/mobile/components/tower/TowerGrid.tsx` | 2 | Amplify flash duration/color per quality |
| `apps/mobile/app/(tabs)/index.tsx` | 2 | Mount LootReveal component |

**Do NOT modify:**
- `useClaimCelebration.ts` (celebration camera is fragile)
- `apps/mobile/utils/audio.ts` (sound files)
- `apps/mobile/utils/tapestry.ts` (social layer)
- `apps/server/` (no server changes in this sprint)
- `programs/monolith/` (no on-chain changes)
- `apps/video/` (content engine is separate)

---

## 7. Loot Drop System Spec

### 7.1 Loot Table

12 items total across 4 rarity tiers:

| # | Name | Rarity | Type | What It Does |
|---|------|--------|------|--------------|
| 1 | Sunset Blush | Common | Color | Unlocks color #FF8C69 (warm sunset) |
| 2 | Ocean Mist | Common | Color | Unlocks color #4ECDC4 (teal mist) |
| 3 | Violet Dream | Common | Color | Unlocks color #A78BFA (soft purple) |
| 4 | Midnight | Common | Color | Unlocks color #1E1B4B (deep midnight) |
| 5 | Crown | Rare | Emoji | Unlocks crown emoji on block |
| 6 | Diamond | Rare | Emoji | Unlocks diamond emoji on block |
| 7 | Lightning | Rare | Emoji | Unlocks lightning bolt emoji on block |
| 8 | Warm Aura | Rare | Effect | Adds warm particle ring around block |
| 9 | Frost Aura | Rare | Effect | Adds cool blue particle ring around block |
| 10 | Gold Shimmer | Epic | Effect | Block surface has gold shimmer animation |
| 11 | Phoenix Style | Legendary | Style | Unique block visual style (animated fire pattern) |
| 12 | Constellation | Legendary | Style | Unique block visual style (star field pattern) |

### 7.2 Drop Rates

| Rarity | Drop Chance | Item Count | Color |
|--------|-------------|------------|-------|
| Nothing | 70% | - | - |
| Common | 18% | 4 items | White |
| Rare | 9% | 5 items | Blue (#60A5FA) |
| Epic | 2.5% | 1 item | Purple (#A78BFA) |
| Legendary | 0.5% | 2 items | Gold (#D4AF55) |

Streak multiplier increases drop chance: `dropChance * (1 + streak * 0.05)` capped at 2x.

### 7.3 Roll Function

```typescript
// constants/loot-table.ts

export type LootRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type LootType = 'color' | 'emoji' | 'effect' | 'style';

export interface LootItem {
  id: string;
  name: string;
  rarity: LootRarity;
  type: LootType;
  value: string;  // hex color, emoji char, effect id, or style id
  description: string;
}

export const LOOT_TABLE: LootItem[] = [
  { id: 'color_sunset', name: 'Sunset Blush', rarity: 'common', type: 'color', value: '#FF8C69', description: 'A warm sunset glow' },
  { id: 'color_ocean', name: 'Ocean Mist', rarity: 'common', type: 'color', value: '#4ECDC4', description: 'Cool ocean breeze' },
  { id: 'color_violet', name: 'Violet Dream', rarity: 'common', type: 'color', value: '#A78BFA', description: 'Soft purple haze' },
  { id: 'color_midnight', name: 'Midnight', rarity: 'common', type: 'color', value: '#1E1B4B', description: 'Deep midnight blue' },
  { id: 'emoji_crown', name: 'Royal Crown', rarity: 'rare', type: 'emoji', value: '\u{1F451}', description: 'A crown fit for a keeper' },
  { id: 'emoji_diamond', name: 'Diamond', rarity: 'rare', type: 'emoji', value: '\u{1F48E}', description: 'Brilliant and rare' },
  { id: 'emoji_lightning', name: 'Lightning', rarity: 'rare', type: 'emoji', value: '\u{26A1}', description: 'Pure energy' },
  { id: 'effect_warm', name: 'Warm Aura', rarity: 'rare', type: 'effect', value: 'warm_aura', description: 'Warm particle ring' },
  { id: 'effect_frost', name: 'Frost Aura', rarity: 'rare', type: 'effect', value: 'frost_aura', description: 'Cool blue glow ring' },
  { id: 'effect_shimmer', name: 'Gold Shimmer', rarity: 'epic', type: 'effect', value: 'gold_shimmer', description: 'Your block shimmers gold' },
  { id: 'style_phoenix', name: 'Phoenix Style', rarity: 'legendary', type: 'style', value: '7', description: 'Animated fire pattern' },
  { id: 'style_constellation', name: 'Constellation', rarity: 'legendary', type: 'style', value: '8', description: 'Star field pattern' },
];

export const RARITY_COLORS: Record<LootRarity, string> = {
  common: '#FFFFFF',
  rare: '#60A5FA',
  epic: '#A78BFA',
  legendary: '#D4AF55',
};

export const DROP_RATES = {
  nothing: 0.70,
  common: 0.18,
  rare: 0.09,
  epic: 0.025,
  legendary: 0.005,
} as const;

export function rollLoot(streak: number = 0): LootItem | null {
  const multiplier = Math.min(2.0, 1 + streak * 0.05);
  const roll = Math.random();

  // Adjust nothing threshold down (more drops with streak)
  const nothingRate = DROP_RATES.nothing / multiplier;
  if (roll < nothingRate) return null;

  // Determine rarity based on remaining roll space
  const adjusted = roll - nothingRate;
  const remaining = 1 - nothingRate;
  const normalized = adjusted / remaining;

  let rarity: LootRarity;
  const legendaryThresh = DROP_RATES.legendary / (1 - DROP_RATES.nothing);
  const epicThresh = legendaryThresh + DROP_RATES.epic / (1 - DROP_RATES.nothing);
  const rareThresh = epicThresh + DROP_RATES.rare / (1 - DROP_RATES.nothing);

  if (normalized < legendaryThresh) {
    rarity = 'legendary';
  } else if (normalized < epicThresh) {
    rarity = 'epic';
  } else if (normalized < rareThresh) {
    rarity = 'rare';
  } else {
    rarity = 'common';
  }

  const candidates = LOOT_TABLE.filter(item => item.rarity === rarity);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
```

### 7.4 Inventory Store

```typescript
// stores/loot-store.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LootItem, rollLoot } from '../constants/loot-table';

const STORAGE_KEY = 'loot_inventory';

interface LootState {
  inventory: string[];            // Item IDs collected
  pendingReveal: LootItem | null; // Item waiting for reveal UI
  totalDrops: number;

  rollAndStore: (streak: number) => void;
  clearPendingReveal: () => void;
  hydrate: () => Promise<void>;
}

export const useLootStore = create<LootState>((set, get) => ({
  inventory: [],
  pendingReveal: null,
  totalDrops: 0,

  rollAndStore: (streak: number) => {
    const item = rollLoot(streak);
    if (!item) return;

    const { inventory } = get();
    const newInventory = [...inventory, item.id];
    set({
      inventory: newInventory,
      pendingReveal: item,
      totalDrops: get().totalDrops + 1,
    });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newInventory)).catch(() => {});
  },

  clearPendingReveal: () => set({ pendingReveal: null }),

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const inventory = JSON.parse(stored) as string[];
        set({ inventory, totalDrops: inventory.length });
      }
    } catch {}
  },
}));
```

### 7.5 Reveal UI

**LootReveal.tsx** — Full-screen overlay, triggered by `pendingReveal !== null`

**Animation timeline (1.5 seconds total):**
1. **0-0.3s:** Screen dims (dark overlay fades in)
2. **0.3-0.6s:** Rarity-colored flash pulse (white/blue/purple/gold)
3. **0.6-1.2s:** Item card scales in from 0 -> 1.1 -> 1.0 (spring bounce)
4. **1.2-1.5s:** "Equip" button fades in

**Item card layout:**
```
+----------------------------------+
|        [Rarity glow border]      |
|                                  |
|     [Item emoji/icon large]      |
|                                  |
|        "Sunset Blush"            |
|        COMMON COLOR              |
|                                  |
|     [ === EQUIP === ]            |
|     [ Dismiss ]                  |
+----------------------------------+
```

**Card styling by rarity:**
- Common: white border, subtle glow
- Rare: blue border, blue glow
- Epic: purple border, purple glow
- Legendary: gold border, gold glow, screen-wide golden flash

**"Equip" behavior:**
- Color items: call `handleColorChange(lootItem.value)` via useBlockActions
- Emoji items: call `handleEmojiChange(lootItem.value)`
- Effect items: store on block (visual only, shader-driven if time permits, otherwise skip effects for MVP)
- Style items: call `handleStyleChange(parseInt(lootItem.value))`
- "Dismiss" (tap outside or dismiss button): keeps item in inventory but doesn't equip

**Timing relative to charge:**
- Loot roll happens AFTER charge succeeds
- If evolution celebration fires, delay loot reveal by 3.5s (after evolution overlay clears)
- Check: `useTowerStore.getState().justEvolved` — if truthy, use `setTimeout(3500)` before showing reveal

**UI tokens:** Use `COLORS.*` for rarity colors. `FONT_FAMILY.heading` for item name. `RADIUS.lg` for card corners. Gold variant `Button` for equip.

---

## 8. Inspector Redesign Spec

### 8.1 Compact Mode (Default)

**Height:** 260px (was 420px)
**Scroll:** Disabled in compact mode

**Component stack:**
```
1. Drag handle (existing, 8px)
2. InspectorHeader (60px) — emoji + name + tier badge + energy% + streak
3. Evolution progress (50px) — compact gold bar with tier names
4. Charge button (48px) — full-width gold CTA
5. Action row (40px) — [Customize] [Share] [Comments N]
6. Bottom padding (14px)
```

### 8.2 Expanded Mode (Customize open)

**Height:** 520px (animated spring transition)
**Scroll:** Enabled

**Additional content below action row:**
```
6. InspectorCustomize (~260px scrollable)
   - FACE section (5 personality buttons, 56px tall)
   - COLOR section (2 rows of 8)
   - NAME section (input + set button)
   - EMOJI section (compact row of 16)
```

### 8.3 Header Redesign

New: Single dense row with all critical info:

```
[Face emoji 28px]  "My Spark"  [EMBER badge]    72%  [7d 2x]
```

- Face emoji: 28px
- Block name: `headingSemibold`, 16px
- Tier badge: small pill with tier name, gold bg
- Energy %: mono bold, color-coded (green/yellow/red)
- Streak: "7d 2x" in gold mono, only if streak > 0

All on ONE line (flexDirection: 'row', space-between).

### 8.4 Transition Animation

```typescript
const targetHeight = isExpanded ? 520 : 260;
Animated.spring(panelHeight, {
  toValue: targetHeight,
  useNativeDriver: false, // height can't use native driver
  friction: 8,
  tension: 65,
});
```

### 8.5 For Other Players' Blocks

```
+--------------------------------------------+  <- ~220px
| [drag handle]                     [X close]|
| [Emoji] "Rival's Spark"  FLAME  95%       |
| Owner: @username                            |
|                                             |
| [====== POKE ======]                        |
|                                             |
| [Like 12]  [Comments 5]  [Follow]          |
+--------------------------------------------+
```

### 8.6 For Unclaimed Blocks

```
+--------------------------------------------+  <- ~180px
| [drag handle]                     [X close]|
| Empty Spark                                 |
| Floor 7  |  $0.25 USDC                     |
|                                             |
| [====== CLAIM THIS SPARK ======]            |
+--------------------------------------------+
```

---

## 9. Testing Checklist

### Flow Tests
- [ ] Fresh onboarding: cinematic orbit -> claim -> customize (face picker first) -> charge -> evolve
- [ ] Charge shows "+1 Charge -- N more to [Tier]" floating text
- [ ] Evolution celebration fires ONCE per tier (charge rapidly through 3 tiers)
- [ ] Loot drop appears after charge (may need 5-10 charges for 30% drop rate)
- [ ] Loot equip applies to block immediately
- [ ] Inspector compact mode: block visible behind panel
- [ ] Inspector expand: customize panel slides in smoothly
- [ ] Inspector collapse: panel returns to compact height
- [ ] Unclaimed blocks: warm golden pulse, clearly different from owned
- [ ] Dormant blocks: desaturated, sleeping face, clearly different from unclaimed
- [ ] Front face only: orbit around tower, each block has exactly 1 face
- [ ] SOAR badge hidden from leaderboard

### Visual Tests
- [ ] Tower overview: 3 distinct block types visible (owned/unclaimed/dormant)
- [ ] Faces readable at overview distance (~45 units)
- [ ] Great charge roll: noticeably different flash (brighter, longer, stronger haptic)
- [ ] Evolution progress bar: gold, prominent, shows tier names clearly
- [ ] Loot reveal: rarity-colored border, smooth animation, "Equip" button
- [ ] Legendary loot: gold flash, dramatic, feels special

### Performance Tests
- [ ] 60fps on device after all changes
- [ ] No jank during inspector expand/collapse
- [ ] Loot reveal overlay doesn't cause frame drops
- [ ] Front-face-only doesn't break LOD

### Regression Tests
- [ ] `cd apps/mobile && npx jest` — all tests pass
- [ ] `cd apps/server && npx jest` — all tests pass
- [ ] `timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json` — clean (3 baseline only)
- [ ] Claim celebration still works
- [ ] Poke mechanic still works
- [ ] Blinks sharing still works
- [ ] Tapestry comments still work

---

## 10. Constraints & Rules

### Code Quality
1. Use `COLORS.*`, `FONT_FAMILY.*`, `RADIUS.*` tokens only. No hardcoded colors in UI.
2. Shader: no `new` in useFrame, `uTime` uses highp, mediump on fragment.
3. No `new Float32Array()` or `new THREE.Color()` inside useFrame — pre-allocate in useRef.
4. Pre-allocate attribute arrays, write in-place, set `needsUpdate = true`.

### Do NOT Modify
- `useClaimCelebration.ts` — celebration camera choreography is fragile
- `apps/mobile/utils/audio.ts` — sound file loading (can call play functions)
- `apps/mobile/utils/tapestry.ts` — social API wrapper
- `apps/server/` — no server changes (loot is client-side)
- `programs/monolith/` — no on-chain changes
- `apps/video/` — content engine is separate

### Testing
- Run tests after EVERY phase: `cd apps/mobile && npx jest`
- Run TypeScript check: `timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json`
- Fix failures in the same phase, don't defer.

### Commits
- Format: `feat(sprint): day N phase X.Y — [description]`
- One commit per phase (1.1, 1.2, etc.)
- Don't bundle unrelated changes.

---

## 11. Progress Tracker

> Update after completing each phase. Mark `[x]` when done, `[~]` if partial.

### Day 1 — Make It Make Sense
- [ ] **Phase 1.1:** Front Face Only
- [ ] **Phase 1.2:** Evolution Celebration Dedup
- [ ] **Phase 1.3:** Compact Inspector
- [ ] **Phase 1.4:** Clear Progression Messaging
- [ ] **Phase 1.5:** Face Picker Prominence
- [ ] **Phase 1.6:** Cut SOAR Badge
- [ ] **Phase 1.7:** Unclaimed Block Pulsing Restyle

### Day 2 — Make It Exciting
- [ ] **Phase 2.1:** Loot Drop System (Core)
- [ ] **Phase 2.2:** Amplify Charge Quality Feel

### Day 3 — Polish + Ship
- [ ] **Phase 3.1:** End-to-End Flow Test
- [ ] **Phase 3.2:** Visual Polish Pass
- [ ] **Phase 3.3:** Build + Test on Device
- [ ] **Phase 3.4:** Fire Buffer (as needed)

**Notes:**
<!-- Add notes after each phase completion -->
