# The Monolith: Rude Awakening v2 — RALPH Implementation Plan

> **Self-sufficient autonomous implementation plan.**
> Fixes everything the 8 evaluation agents identified: core loop, mid-game UI, ghost economy, endgame, monetization, production readiness, and distribution assets.
> **20 atomic tasks across 2 passes.**
>
> **Prerequisite:** Read `docs/RUDE_AWAKENING_V2.md` for the full diagnosis.

---

## RALPH RULES

Follow these rules **exactly** for each iteration:

1. **One task per iteration.** Find the next `[ ]` task in the PROGRESS section. Implement it fully. Commit. Update PROGRESS. Stop.
2. **Read before writing.** Always read files before modifying them. Check line numbers — they shift after prior tasks.
3. **Run tests after every task.**
   ```bash
   cd apps/mobile && npx jest
   cd apps/server && npx jest
   ```
   Fix any failures before committing. Never commit broken tests.
4. **Commit with conventional commits.**
   Format: `feat(scope): description` or `fix(scope): description`
   Example: `feat(mobile): add While You Were Away modal`
5. **Update PROGRESS after each commit.** Change `[ ]` to `[x]` and add the commit hash.
6. **Check git log first.** Run `git log --oneline -20` to see what's already done. Don't repeat work.
7. **Respect gates.** Do NOT cross `=== PASS 1 GATE ===` or `=== PASS 2 GATE ===`. Stop when you reach one.
8. **Follow CONTEXT.md gotchas.** Read `CONTEXT.md` "Gotchas & Critical Patterns" before starting.
9. **New files need exports.** If you create a new file, make sure it's imported where needed.
10. **Server changes = both paths.** If you change server message handlers, update client handlers in `multiplayer-store.ts` too.
11. **Test commands:**
    - Mobile: `cd apps/mobile && npx jest`
    - Server: `cd apps/server && npx jest`
    - TypeScript: `timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json`
    - Anchor: `cd /home/epic/Downloads/monolith && anchor test`
    - **NEVER run `npx jest` from monorepo root**
12. **Don't over-engineer.** Implement exactly what the task says. No bonus features.

---

## CODEBASE REFERENCE

### Key Files You'll Touch

| File | Purpose | Tasks |
|------|---------|-------|
| `apps/mobile/app/(tabs)/index.tsx` | Home screen, `anyOverlayOpen` boolean (6 overlays tracked) | 1,2,3,4,7,8 |
| `apps/mobile/components/ui/TopHUD.tsx` | Left: "MONOLITH", Right: wallet pill. Center is empty. ~60px height | 2,3 |
| `apps/mobile/stores/session-store.ts` | Has `AwaySummary` interface + `showAwaySummary` flag. Backend done. | 1 |
| `apps/mobile/stores/tower-store.ts` | `chargeBlock()` uses `rollChargeAmount()` (RNG). Ghost: energy 60, decay 2x, cap 50. | 5,6,7 |
| `apps/mobile/stores/onboarding-store.ts` | 10 phases: cinematic→cameraTutorial→title→claim→celebration→customize→charge→poke→wallet→done | 4 |
| `apps/mobile/stores/progression-store.ts` | 15 milestones, derived from player/tower stores | 11 |
| `apps/mobile/hooks/useBlockActions.ts` | Charge flow, multiplayer charge message sending | 7 |
| `apps/mobile/constants/theme.ts` | 9 gold tokens, no Z_INDEX. GLASS_STYLE presets. | 2,3 |
| `apps/mobile/constants/loot-table.ts` | 43 items, `rollLoot(streak)`, 65% nothing rate | 14 |
| `packages/common/src/constants.ts` | GHOST_ constants (decay 2.0x, cap 50), CHARGE_BRACKETS (RNG weights), streak multipliers | 5,6 |
| `apps/server/src/rooms/TowerRoom.ts` | Charge handler (~line 792), ghost handler (~line 569), away_summary (~line 395) | 1,5,6,7,15 |
| `apps/server/src/utils/quests.ts` | `checkQuestProgress()`, `getQuestState()` — server-side only, no client store | 2 |
| `apps/server/src/utils/floor-competition.ts` | `weeklyLayerCharges` Map, `getFloorLeaderboard()` | 9,15 |
| `apps/server/src/utils/weekly-events.ts` | `getCurrentEvent()`, Charge Storm 1.5x / Land Rush 50% off, Saturday UTC | 3 |
| `apps/mobile/components/onboarding/OnboardingFlow.tsx` | Phase renderer, renders per-phase components | 4 |
| `apps/mobile/components/onboarding/CameraTutorial.tsx` | 3-step coach marks (swipe/pinch/scrubber) | 4 |
| `apps/mobile/components/board/BoardContent.tsx` | Leaderboard + activity feed. Has tab structure. | 9 |
| `apps/mobile/components/ui/HotBlockTicker.tsx` | Bottom-right mini-cards, always visible | 8 |
| `apps/mobile/components/ui/MyBlockFAB.tsx` | Bottom-left FAB, always visible | 8 |

### Critical Patterns

- **Dual-path**: Actions have BOTH offline (`tower-store.ts`) and multiplayer (`useBlockActions.ts`) code paths. Update BOTH.
- **Colyseus uses JSON messages** — NOT schema auto-sync.
- **pnpm strict isolation** — declare ALL imported packages as direct deps.
- **`anyOverlayOpen` in index.tsx** — add new overlays here to hide FloatingNav.
- **One SFX per action chain** — don't add sounds to downstream effects.
- **BottomPanel dismiss** — animate off-screen FIRST, THEN call `onClose()`.
- **3 pre-existing TS errors** in `useBlockActions.ts` (dynamic imports) — ignore these.
- **`mediump uTime`** — all `uTime` uniforms MUST use `uniform highp float uTime;`.
- **No `new` in useFrame** — pre-allocate in `useRef`, use `.set()`/`.copy()`.
- **Supabase writes are fire-and-forget** — don't `await` them.

---

## DIAGNOSIS SUMMARY

**8 agents converged on these problems** (see `RUDE_AWAKENING_V2.md` for full analysis):

1. **Core loop has no skill** — pressing CHARGE is not a game. Need timing mechanic.
2. **5 UI systems have no frontend** — quests, progression, events, while-you-were-away, floor leaderboard
3. **Ghost economy is punishing** — net negative energy on Days 1-2 even with perfect play
4. **Streak dead zone Day 7-29** — 23 days with zero multiplier progression
5. **Endgame doesn't exist** — everything caps at Day 150
6. **No monetization beyond staking** — $195 max revenue if all 650 blocks filled
7. **No production infrastructure** — in-memory state lost on restart, no CI, no monitoring
8. **No distribution assets** — no demo video, no analytics, no launch playbook

---

# ============================================
# PASS 1: Ship the Mid-Game + Fix Core Loop
# 10 Tasks | Makes the product testable with real users
# ============================================

## Task 1: While You Were Away Modal

**Priority**: CRITICAL — #1 re-engagement surface (every agent flagged this)
**Scope**: Client UI only (backend already done in `session-store.ts`)

**Problem**: Users open the app after hours away and see... nothing. No context about what happened. No urgency. The session store has `AwaySummary` and `showAwaySummary` but no UI component.

**Files to create**:
- `apps/mobile/components/ui/WhileAwayModal.tsx`

**Files to edit**:
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/stores/multiplayer-store.ts` (if away_summary comes from server)

**Implementation**:

1. Create `WhileAwayModal.tsx`:
   ```typescript
   // Props: awaySummary: AwaySummary, onDismiss: () => void
   // Layout: BottomPanel (reuse existing) with glass background
   // Content:
   //   - "While you were away..." title (COLORS.inspectorText)
   //   - Stats row: "⚡ -23 energy" | "👆 2 pokes" | "🔄 1 neighbor change"
   //   - If streakAtRisk: red warning box "⚠️ Your streak is at risk! Charge now."
   //   - CTA button (gold): "CHARGE NOW" → calls towerStore.selectBlock(lowestEnergyBlockId)
   //   - Secondary: "Dismiss" text button
   //   - Auto-dismiss after 10s via useEffect timer
   // SFX: playNotification() on mount (one SFX rule — this IS the action origin)
   // Haptic: hapticNotification() on mount
   ```

2. Edit `index.tsx`:
   - Import `useSessionStore` and `WhileAwayModal`
   - Read `showAwaySummary` and `awaySummary` from session store
   - Render `{showAwaySummary && <WhileAwayModal ... />}` above FloatingNav
   - Add `showAwaySummary` to `anyOverlayOpen` boolean
   - On dismiss: call `sessionStore.dismissAwaySummary()`

3. Wire server `away_summary` to session store (if not already):
   - In `multiplayer-store.ts`, listen for `away_summary` message
   - Call `sessionStore.setAwaySummary(data)`

**Tests**: Session store already tested. Add test: `WhileAwayModal renders with summary data, dismiss clears flag`.

---

## Task 2: Quest Panel + Streak Counter in TopHUD

**Priority**: CRITICAL — quests exist but are invisible; streak is buried
**Scope**: Client — new store + UI components

**Problem**: Daily quests are tracked server-side (`quests.ts`) but there is no client store and no UI. The streak is the #1 retention mechanic but it's hidden in the inspector. Genshin Impact shows quest progress from the main menu.

**Files to create**:
- `apps/mobile/stores/quest-store.ts`
- `apps/mobile/components/ui/QuestPanel.tsx`

**Files to edit**:
- `apps/mobile/components/ui/TopHUD.tsx`
- `apps/mobile/stores/multiplayer-store.ts` (add `quest_update` handler)
- `apps/mobile/app/(tabs)/index.tsx`

**Implementation**:

1. Create `quest-store.ts`:
   ```typescript
   interface QuestState {
     id: string; name: string; desc: string;
     target: number; progress: number; xp: number; completed: boolean;
   }
   interface QuestStore {
     quests: QuestState[];
     isQuestPanelOpen: boolean;
     setQuests(quests: QuestState[]): void;
     updateQuest(id: string, progress: number): void;
     toggleQuestPanel(): void;
   }
   ```

2. Create `QuestPanel.tsx`:
   - Use `BottomPanel` component for consistent slide-up behavior
   - Title: "Daily Quests" with today's date
   - 3 quest cards, each with: icon, name, description, progress bar, XP reward
   - Completed quests: gold checkmark, strikethrough progress bar
   - Swipe-to-dismiss

3. Edit `TopHUD.tsx` — add center section:
   ```typescript
   // Between title and wallet pill, add:
   // Left of center: flame icon + streak count (e.g., "🔥 7")
   //   - Read bestStreak from owned blocks in towerStore
   //   - Pulse animation on milestone days (3, 7, 10, 14, 21, 30)
   //   - Show ice crystal icons for available streak freezes
   // Right of center: quest progress pill (e.g., "📜 2/3")
   //   - Tap opens QuestPanel
   //   - Gold highlight when all 3 complete
   ```

4. Edit `multiplayer-store.ts`:
   - Add handler for `quest_update` message from server
   - Call `questStore.setQuests(data.quests)` on receive

5. Edit `index.tsx`:
   - Add `isQuestPanelOpen` to `anyOverlayOpen`
   - Render `{isQuestPanelOpen && <QuestPanel ... />}`

**Tests**: Quest store: setQuests, updateQuest, togglePanel. TopHUD: renders streak count.

---

## Task 3: Event Banner

**Priority**: HIGH — weekly events exist server-side but users don't know
**Scope**: Client UI + wire to server data

**Problem**: `weekly-events.ts` runs Charge Storm (1.5x) and Land Rush (50% off) every Saturday UTC, but users have zero visibility.

**Files to create**:
- `apps/mobile/components/ui/EventBanner.tsx`

**Files to edit**:
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/stores/multiplayer-store.ts`

**Implementation**:

1. Create `EventBanner.tsx`:
   ```typescript
   // Props: event: { name: string, type: "charge_storm" | "land_rush", endsAt: number } | null
   // Layout: gold pill positioned below TopHUD (absolute, top: insets.top + 60)
   // Content: event icon (⚡ or 🏷️) + name + countdown timer (HH:MM:SS)
   // Animation: FadeInDown on mount, FadeOutUp on dismiss
   // Tap: brief tooltip explaining the event effect
   // Only renders when event is active or <24h away
   // Use `getNextEventTime()` from weekly-events logic (replicate client-side)
   ```

2. Edit `multiplayer-store.ts`:
   - In `tower_state` handler, read `activeEvent` field (server already includes this)
   - Store in a new `eventStore` or as state in multiplayer-store

3. Edit `index.tsx`:
   - Render `<EventBanner event={activeEvent} />` below TopHUD
   - No need to add to `anyOverlayOpen` (banner is non-blocking)

**Tests**: EventBanner renders with mock event data, hides when no event.

---

## Task 4: Onboarding Trim (10→6 phases) + Spark Naming

**Priority**: HIGH — 25-30 seconds to first reward is too slow; naming creates 3x attachment
**Scope**: Client only

**Problem**: 10-phase onboarding delays the "aha moment" (claim celebration). No name prompt means no personal attachment to the Spark.

**Files to edit**:
- `apps/mobile/stores/onboarding-store.ts`
- `apps/mobile/components/onboarding/OnboardingFlow.tsx`
- `apps/mobile/components/onboarding/CameraTutorial.tsx`

**Implementation**:

1. `onboarding-store.ts` — reduce phases:
   - Remove `"title"` and `"poke"` from `OnboardingPhase` type union
   - Merge `"cinematic"` and `"cameraTutorial"` into single `"intro"` phase
   - New phase order: `"intro" → "claim" → "celebration" → "customize" → "charge" → "wallet" → "done"`
   - Add `sparkName: string | null` to store state
   - Add `setSparkName(name: string)` action

2. `CameraTutorial.tsx` — convert to overlay mode:
   - Instead of a separate phase, render as overlay during cinematic
   - Use `pointerEvents="box-none"` so gestures pass through to tower
   - Coach marks appear contextually during the cinematic orbit
   - Auto-advance each step after 3s or on gesture detection

3. `OnboardingFlow.tsx` — update phase renderer:
   - `"intro"`: Cinematic orbit WITH CameraTutorial overlay. End with "GET STARTED" CTA.
   - Remove `"title"` phase render (show "MONOLITH" as fade-overlay during intro)
   - Remove `"poke"` phase render
   - `"customize"` phase: Add Spark naming prompt BEFORE color/emoji pickers
     - TextInput: "Name your Spark" with placeholder "e.g., Luna, Blaze, Pixel"
     - "Surprise me" button → random name from preset list (12-16 cute names)
     - Store name via `onboardingStore.setSparkName(name)`
     - After naming, proceed to existing color/emoji customization
   - When customization completes, apply name to block via `tower-store.customizeBlock(blockId, { name: sparkName })`

4. Move poke tutorial to post-onboarding:
   - After user's 2nd charge (not during onboarding), show a contextual tooltip on a neighboring block: "Tap a neighbor to poke them! They'll get a notification."
   - Track via SecureStore flag `hasSeenPokeTutorial`

**Tests**: Update onboarding-store tests for new phase count (7 → done). Verify phase order. Test sparkName state.

---

## Task 5: Ghost Block Economy Rebalance

**Priority**: CRITICAL — free users lose energy on Days 1-2 even with perfect play
**Scope**: Full stack (shared constants + server + client)

**Problem**: `GHOST_DECAY_MULTIPLIER = 2.0` and `GHOST_CHARGE_CAP = 50` means ghost blocks drain 24 energy/day but only gain ~22.25 on Days 1-2. Net -1.75. Users are punished for playing perfectly.

**Files to edit**:
- `packages/common/src/constants.ts`
- `apps/server/src/rooms/TowerRoom.ts`
- `apps/mobile/stores/tower-store.ts`

**Implementation**:

1. `constants.ts` — rebalance ghost constants:
   ```typescript
   export const GHOST_DECAY_MULTIPLIER = 1.5;  // Was 2.0 — now net positive Day 1
   export const GHOST_CHARGE_CAP = 70;          // Was 50 — can reach "thriving" state
   export const GHOST_HONEYMOON_DAYS = 3;       // NEW — first 3 days: staked behavior
   ```

2. `TowerRoom.ts` — implement honeymoon period:
   - In ghost claim handler: record `block.ghostClaimedAt = Date.now()`
   - In decay loop: if ghost block AND `(Date.now() - ghostClaimedAt) < GHOST_HONEYMOON_DAYS * 86400000`:
     - Use 1.0x decay (same as staked)
     - Use MAX_ENERGY cap (100) instead of GHOST_CHARGE_CAP
   - After honeymoon: revert to 1.5x decay and 70 cap
   - In charge handler: apply same honeymoon logic for energy cap

3. `tower-store.ts` — update ghost actions:
   - `ghostClaimBlock`: Set energy to 70 (was 60), add `ghostClaimedAt: Date.now()`
   - `ghostChargeBlock`: Respect honeymoon period for cap (100 vs 70)

**New math verification**:
| Day | Multiplier | Charge | Drain (1.5x) | Net |
|-----|-----------|--------|--------------|-----|
| 1-2 (honeymoon) | 1.0x | 22.25 | 12 | **+10.25** |
| 3 (honeymoon ends) | 1.5x | 33.4 | 18 | **+15.4** |
| 7+ | 2.0x | 44.5 | 18 | **+26.5** |

Ghost users are now net positive from Day 1. They can reach "thriving" (70 cap). Honeymoon makes the first 3 days feel like a real experience.

**Tests**: Server test: ghost block decay at 1.5x, honeymoon period logic. Client test: ghost claim energy = 70.

---

## Task 6: Streak Dead Zone Fix + Free Day-1 Freeze

**Priority**: HIGH — Day 7-29 has zero progression; catch-22 on first freeze
**Scope**: Full stack

**Problem**: Streak multiplier jumps from 2.0x at Day 7 to 3.0x at Day 30. That's 23 days of nothing. Also, you need a 7-day streak to earn your first freeze, but new users are the most likely to miss a day.

**Files to edit**:
- `packages/common/src/constants.ts`
- `apps/server/src/rooms/TowerRoom.ts`
- `apps/mobile/stores/tower-store.ts`

**Implementation**:

1. `constants.ts` — fill the dead zone + add milestone celebrations:
   ```typescript
   // Updated getStreakMultiplier function:
   export function getStreakMultiplier(streak: number): number {
     if (streak <= 2) return 1.0;
     if (streak <= 4) return 1.5;
     if (streak <= 6) return 1.75;
     if (streak <= 9) return 2.0;
     if (streak <= 13) return 2.1;   // NEW — Day 10
     if (streak <= 20) return 2.25;  // NEW — Day 14
     if (streak <= 29) return 2.5;   // NEW — Day 21
     return 3.0;                      // Day 30+ (unchanged)
   }

   // Streak milestone days (for UI celebrations):
   export const STREAK_MILESTONES = [3, 7, 10, 14, 21, 30, 50, 100];

   // Free streak freeze on first block claim:
   export const INITIAL_STREAK_FREEZES = 1;  // NEW — Day 1 safety net
   ```

2. `TowerRoom.ts` — grant free freeze on first claim:
   - In claim handler (both ghost and staked): if player's first block, set `block.freezes = INITIAL_STREAK_FREEZES`
   - Server already handles freeze consumption in charge handler

3. `tower-store.ts` — update local streak multiplier to match new function.

**Tests**: Verify multiplier at days 1, 3, 7, 10, 14, 21, 30. Verify free freeze granted on first claim.

---

## Task 7: Charge Window (Timing Mechanic)

**Priority**: CRITICAL — core loop rated 4/10, "zero player agency"
**Scope**: Client only (charge amount still determined locally via `rollChargeAmount`)

**Problem**: The optimal strategy is always identical: tap CHARGE button once per day. No skill, no decision, no mastery curve. Every successful daily-engagement app has player agency.

**Files to create**:
- `apps/mobile/components/ui/ChargeWindow.tsx`

**Files to edit**:
- `apps/mobile/hooks/useBlockActions.ts` (or wherever charge tap is handled)
- `apps/mobile/stores/tower-store.ts` (modify `rollChargeAmount` to accept precision)
- `apps/mobile/components/inspector/InspectorActions.tsx` (CHARGE button triggers ChargeWindow)
- `packages/common/src/constants.ts` (add CHARGE_WINDOW constants)

**Implementation**:

1. `constants.ts` — add charge window config:
   ```typescript
   export const CHARGE_WINDOW = {
     DURATION_MS: 1500,       // Ring contracts over 1.5 seconds
     PERFECT_RADIUS: 0.08,    // Inner 8% = perfect (rare)
     GREAT_RADIUS: 0.25,      // Inner 25% = great
     GOOD_RADIUS: 0.55,       // Inner 55% = good
     // Outer 55-100% = normal
     // Miss (no tap) = normal (fallback, same as before)
     ENABLED: true,           // Feature flag
   };
   ```

2. Create `ChargeWindow.tsx`:
   ```typescript
   // Full-screen overlay triggered when user taps CHARGE
   // Visual: block in center, pulsing ring contracts from large to small
   // Ring color shifts: white → gold → bright gold → brilliant white at center
   // User taps when ring is at desired size
   // Tap position relative to block center determines precision:
   //   - precision = 1.0 - (ringRadius / maxRadius) at tap time
   //   - precision < PERFECT_RADIUS → "perfect" bracket (35 + 5 bonus)
   //   - precision < GREAT_RADIUS → "great" bracket (31-35)
   //   - precision < GOOD_RADIUS → "good" bracket (26-30)
   //   - else → "normal" bracket (20-25)
   //   - miss/timeout → "normal" bracket (15-19)
   // Animation: Animated.timing, 1.5s linear from scale 3.0 to 0.0
   // On tap: freeze ring, flash feedback, haptic, then resolve
   // After resolve: call actual charge with determined quality
   // Accessibility: if settings.autoCharge (new flag), skip window, use RNG as before
   ```

3. `tower-store.ts` — modify `rollChargeAmount`:
   ```typescript
   // Add optional parameter: quality override
   rollChargeAmount(qualityOverride?: "normal" | "good" | "great" | "perfect"): { amount, quality }
   // If qualityOverride provided, select from that bracket directly
   // If "perfect": amount = 40 (35 base + 5 bonus), quality = "perfect"
   // If not provided: use existing RNG (backward compat for tests/bots/auto-charge)
   ```

4. `InspectorActions.tsx` — CHARGE button triggers ChargeWindow:
   - Instead of directly calling charge, set `showChargeWindow = true`
   - ChargeWindow resolves with quality → calls actual charge handler

5. Settings: Add "Auto-charge" toggle (accessibility) that skips the timing window.

**Tests**: rollChargeAmount with quality override returns correct brackets. ChargeWindow component renders and resolves.

---

## Task 8: Quick-Charge Shortcut + Auto-Hide HUD

**Priority**: MEDIUM — reduces daily friction, cleaner spectacle
**Scope**: Client only

**Problem**: Charging requires: tap block → wait for inspector → tap CHARGE. That's 3 taps + a panel animation for a 30-second daily session. Also, HotBlockTicker + MyBlockFAB are always visible, cluttering the tower view.

**Files to edit**:
- `apps/mobile/components/ui/MyBlockFAB.tsx`
- `apps/mobile/components/ui/HotBlockTicker.tsx`
- `apps/mobile/app/(tabs)/index.tsx`

**Implementation**:

1. `MyBlockFAB.tsx` — add quick-charge:
   - Long-press on FAB: "Charge All" (existing functionality)
   - Single tap: if user has exactly 1 block, trigger ChargeWindow directly (skip inspector)
   - If user has multiple blocks: open MyBlocksPanel (existing behavior)
   - Add urgency animation: if any owned block is below 30% energy, FAB pulses orange

2. Auto-hide HUD elements:
   - In `index.tsx`, track `lastInteractionTime` via touch handler on the Canvas wrapper
   - After 5 seconds of no touch: fade out HotBlockTicker and MyBlockFAB (Animated opacity → 0)
   - On any touch: fade back in immediately
   - Use `useRef` for timer to avoid re-renders
   - FloatingNav stays visible (it's the primary navigation)

**Tests**: FAB renders with urgency pulse when block energy < 30%. Auto-hide timer logic.

---

## Task 9: Floor Leaderboard UI

**Priority**: MEDIUM — floor competition exists server-side but is invisible
**Scope**: Client UI

**Problem**: `floor-competition.ts` tracks weekly charges per layer and resets Monday UTC. There is no UI showing this data.

**Files to create**:
- `apps/mobile/components/board/FloorLeaderboard.tsx`

**Files to edit**:
- `apps/mobile/components/board/BoardContent.tsx`
- `apps/mobile/stores/multiplayer-store.ts`

**Implementation**:

1. Create `FloorLeaderboard.tsx`:
   ```typescript
   // Props: floors: Array<{ layer: number, charges: number, blockCount: number }>
   //        winnerLayer: number | null (last week's winner)
   //        playerLayers: number[] (layers where user has blocks)
   // Layout: ScrollView with rows
   // Each row: "Floor {layer}" | charges this week | # blocks | crown icon if winner
   // Player's floors highlighted with gold background
   // Sort by charges descending
   // Header: "This Week's Floor Race" + "Resets Monday UTC"
   ```

2. Edit `BoardContent.tsx`:
   - Add "Floors" as a third tab (alongside Leaderboard and Activity)
   - Render FloorLeaderboard when Floors tab is active
   - Get floor data from multiplayer store (sent with `tower_state`)

3. Edit `multiplayer-store.ts`:
   - Parse `weeklyFloorRanking` from `tower_state` message
   - Store in accessible state

**Tests**: FloorLeaderboard renders sorted floor data, highlights player floors.

---

## Task 10: Pass 1 Integration Verification

**Priority**: Gate task
**Scope**: Verification only — no new code

**Run the full verification suite**:

```bash
cd apps/mobile && npx jest
cd apps/server && npx jest
timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json
cd apps/server && npx tsc --noEmit
```

**Manual verification checklist** (document results in PROGRESS):
- [ ] Open app after 4+ hours away → While You Were Away modal appears
- [ ] TopHUD shows streak count + quest progress
- [ ] Tap quest pill → quest panel opens with 3 quests
- [ ] Complete a quest → toast + XP award
- [ ] Event banner appears on Saturday UTC (or test with mock)
- [ ] Onboarding flow is 6 phases (not 10), includes Spark naming
- [ ] Ghost block at Day 1: energy increases after charge (not decreasing)
- [ ] Ghost block cap is 70, not 50
- [ ] Streak multiplier at Day 10 = 2.1x, Day 14 = 2.25x
- [ ] Free streak freeze available from first claim
- [ ] Charge Window: tap timing determines quality bracket
- [ ] Quick-charge: single-block owner can charge from FAB without inspector
- [ ] HUD auto-hides after 5s inactivity
- [ ] Floor leaderboard visible in Board tab

---

# ================================================
# === PASS 1 GATE ===
# All 10 tasks above must be committed before proceeding.
# Run: git log --oneline | head -15
# Verify 10 task commits exist.
# STOP HERE if running Pass 1.
# ================================================

---

# ============================================
# PASS 2: Endgame + Monetization + Production
# 10 Tasks | Revenue generation + production readiness
# ============================================

## Task 11: Prestige / Ascension System

**Priority**: HIGH — endgame rated 2/10, everything caps at Day 150
**Scope**: Full stack

**Problem**: After reaching Beacon tier (150 charges), there is nothing left to progress toward. Day 200+ players have zero motivation.

**Files to edit**:
- `packages/common/src/constants.ts`
- `apps/server/src/rooms/TowerRoom.ts`
- `apps/mobile/stores/tower-store.ts`
- `apps/mobile/components/inspector/InspectorStats.tsx`
- `apps/mobile/components/inspector/InspectorHeader.tsx`

**Implementation**:

1. `constants.ts` — add ascension system:
   ```typescript
   export const ASCENSION = {
     REQUIRED_TIER: 4,           // Must be Beacon (tier 4) to ascend
     MAX_ASCENSIONS: 10,         // Cap at 10 ascensions
     CHARGE_EFFICIENCY_BONUS: 0.05,  // +5% per ascension (multiplicative)
     // Ascension resets: evolutionTier → 0, totalCharges → 0, bestStreak preserved
     // Ascension grants: ascensionCount++, new tier color palette, leaderboard entry
   };
   ```

2. `TowerRoom.ts` — add `ascend` message handler:
   - Validate: block.evolutionTier === 4 AND block.ascensionCount < MAX_ASCENSIONS
   - Reset: evolutionTier → 0, totalCharges → 0
   - Increment: block.ascensionCount++
   - Preserve: bestStreak, streak, energy, customization
   - Broadcast: `block_update` with eventType "ascend"
   - Award XP: 500 per ascension

3. `tower-store.ts` — add ascensionCount to DemoBlock, handle ascend locally.

4. `InspectorHeader.tsx` — show ascension stars next to block name:
   - 1-10 small gold star icons based on `ascensionCount`
   - Tier label includes ascension: "Spark II" (ascension 1), "Spark III" (ascension 2)

5. `InspectorStats.tsx` — show "ASCEND" button when Beacon + ascensionCount < 10:
   - Gold button with upward arrow icon
   - Confirmation modal: "Reset your evolution to Spark? You keep your streak, customization, and gain +5% charge efficiency permanently."

**Tests**: Server: ascension resets tier, increments count, caps at 10. Client: button visibility logic.

---

## Task 12: Daily Login Calendar

**Priority**: HIGH — "Players return for the reward even when they would not return for gameplay"
**Scope**: Client + server

**Problem**: No reason to open the app beyond charging. Daily login calendars are the #2 retention mechanic after streaks.

**Files to create**:
- `apps/mobile/stores/login-store.ts`
- `apps/mobile/components/ui/LoginCalendar.tsx`

**Files to edit**:
- `apps/server/src/rooms/TowerRoom.ts`
- `apps/mobile/app/(tabs)/index.tsx`

**Implementation**:

1. Create `login-store.ts`:
   ```typescript
   interface LoginStore {
     currentDay: number;          // 1-7 in current cycle
     collectedDays: boolean[];    // [false, false, ...] length 7
     lastCollectedDate: string;   // ISO date string
     showCalendar: boolean;
     collectToday(): void;        // Marks today as collected, advances day
     shouldShowCalendar(): boolean; // True if today not yet collected
   }
   // Persist to SecureStore
   // 7-day rolling cycle, cumulative (missing a day does NOT reset)
   ```

2. Login rewards (hardcoded in constants):
   ```typescript
   export const LOGIN_REWARDS = [
     { day: 1, type: "xp", amount: 5, label: "5 XP" },
     { day: 2, type: "xp", amount: 10, label: "10 XP" },
     { day: 3, type: "loot", rarity: "common", label: "Common Loot" },
     { day: 4, type: "xp", amount: 15, label: "15 XP" },
     { day: 5, type: "freeze", amount: 1, label: "Streak Freeze" },
     { day: 6, type: "xp", amount: 25, label: "25 XP" },
     { day: 7, type: "loot", rarity: "rare", label: "Rare Loot" },
   ];
   ```

3. Create `LoginCalendar.tsx`:
   - 7 gold circles in a horizontal row (use existing ProgressDots as reference)
   - Each circle: day number, reward icon, gold fill if collected, gray if future
   - Today's circle: pulsing glow, "COLLECT" label
   - Tap today's circle: collect animation (scale bounce + gold flash), award reward
   - After collection: auto-dismiss after 2s

4. `index.tsx`:
   - On mount (after onboarding complete): check `loginStore.shouldShowCalendar()`
   - If true: show LoginCalendar overlay
   - Add to `anyOverlayOpen`

5. `TowerRoom.ts` — server validates login reward claims to prevent cheating.

**Tests**: Login store: collect today, day advancement, 7-day cycle reset. Calendar renders 7 circles.

---

## Task 13: Season Pass Infrastructure

**Priority**: HIGH — primary revenue stream ($2.99 USDC per 8-week season)
**Scope**: Full stack

**Problem**: One-time staking ($0.10-$1.00) generates at most $195 total revenue. The season pass is the path to recurring revenue.

**Files to create**:
- `apps/mobile/stores/season-store.ts`
- `apps/mobile/components/ui/SeasonPassPanel.tsx`
- `apps/server/src/utils/seasons.ts`

**Files to edit**:
- `apps/server/src/rooms/TowerRoom.ts`
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/components/settings/SettingsContent.tsx`

**Implementation**:

1. Create `apps/server/src/utils/seasons.ts`:
   ```typescript
   // Season definition
   interface Season {
     id: number; name: string; startDate: string; endDate: string;
     freeTrack: SeasonReward[];    // 10 rewards
     premiumTrack: SeasonReward[]; // 20 rewards
     xpPerLevel: number;          // XP required per season level
   }
   // Season 1: "Genesis" — 8 weeks
   // Free track: XP boosts, common loot, streak freeze at level 5
   // Premium track: exclusive cosmetics (2 colors, 1 style, 1 emoji per season)
   // Season XP earned from: daily charge (10), quest completion (quest XP), poke (5)
   ```

2. Create `season-store.ts`:
   ```typescript
   interface SeasonStore {
     currentSeason: Season | null;
     seasonXP: number;
     seasonLevel: number;          // Derived from XP
     isPremium: boolean;           // Purchased premium pass
     claimedRewards: string[];     // IDs of claimed rewards
     showSeasonPass: boolean;
     purchasePremium(): Promise<void>;  // USDC transaction
     claimReward(rewardId: string): void;
   }
   ```

3. Create `SeasonPassPanel.tsx`:
   - BottomPanel with scrollable track
   - Two rows: Free (top) and Premium (bottom, locked/unlocked)
   - Each reward node: icon, gold border if claimable, gray if locked
   - Current level indicator with progress bar to next
   - "UPGRADE TO PREMIUM — $2.99" CTA if not premium
   - Premium purchase: trigger USDC deposit flow (same as block staking)

4. `TowerRoom.ts` — track season XP:
   - After charge: award 10 season XP
   - After quest completion: award quest XP to season
   - After poke: award 5 season XP
   - Send `season_update` message with level/XP

5. `SettingsContent.tsx` — add "Season Pass" button.

**Tests**: Season store: XP accumulation, level calculation, reward claiming. Server: season XP awards.

---

## Task 14: Loot Pity System + Collection Milestones

**Priority**: MEDIUM — prevents tail-end frustration, adds collection goals
**Scope**: Client + shared constants

**Problem**: A player could charge 200 times without a legendary. No duplicate protection. No collection completion incentive. 43 items exhausted in 2-3 months.

**Files to edit**:
- `apps/mobile/constants/loot-table.ts`
- `apps/mobile/stores/loot-store.ts`

**Implementation**:

1. `loot-table.ts` — add pity counter and collection system:
   ```typescript
   export const PITY = {
     EPIC_GUARANTEE: 30,       // Guaranteed epic every 30 charges without one
     LEGENDARY_GUARANTEE: 100, // Guaranteed legendary every 100 charges without one
   };

   // Collection milestone rewards (new export)
   export const COLLECTION_MILESTONES = [
     { id: "all_common_colors", name: "Rainbow Keeper", items: [...common color IDs], reward: { type: "style", id: "rainbow_shimmer" } },
     { id: "all_rare_emojis", name: "Emoji Master", items: [...rare emoji IDs], reward: { type: "emoji", id: "🌈" } },
     { id: "10_unique", name: "Collector", items: null, count: 10, reward: { type: "xp", amount: 100 } },
     { id: "25_unique", name: "Hoarder", items: null, count: 25, reward: { type: "xp", amount: 250 } },
   ];
   ```

2. Modify `rollLoot` function:
   ```typescript
   rollLoot(streak = 0, chargesSinceEpic = 0, chargesSinceLegendary = 0): LootItem | null
   // If chargesSinceEpic >= PITY.EPIC_GUARANTEE: force epic rarity
   // If chargesSinceLegendary >= PITY.LEGENDARY_GUARANTEE: force legendary rarity
   // Otherwise: existing weighted RNG
   ```

3. `loot-store.ts` — add pity tracking + collection:
   - Add `chargesSinceEpic: number`, `chargesSinceLegendary: number`
   - Reset respective counter when that rarity drops
   - Add `getCollectionProgress()`: returns milestone completion status
   - Add duplicate handling: duplicates convert to "Essence" (future currency)

**Tests**: Pity counter forces epic at 30, legendary at 100. Collection milestone detection.

---

## Task 15: Persist In-Memory State to Supabase

**Priority**: CRITICAL — server restart loses pacts, quests, floor competition, login rewards
**Scope**: Server only

**Problem**: All these Maps are in-memory and lost on every deploy: `pacts`, `walletQuests`, `weeklyLayerCharges`, `pokeCooldowns`. This is the single biggest data integrity risk.

**Files to create**:
- `supabase/migrations/005_game_state.sql`

**Files to edit**:
- `apps/server/src/utils/supabase.ts`
- `apps/server/src/rooms/TowerRoom.ts`
- `apps/server/src/utils/quests.ts`
- `apps/server/src/utils/floor-competition.ts`

**Implementation**:

1. Create migration `005_game_state.sql`:
   ```sql
   CREATE TABLE pacts (
     id TEXT PRIMARY KEY,  -- sorted pair of block IDs
     block_a TEXT NOT NULL,
     block_b TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT now(),
     consecutive_misses_a INT DEFAULT 0,
     consecutive_misses_b INT DEFAULT 0,
     last_charge_a TEXT,   -- ISO date
     last_charge_b TEXT    -- ISO date
   );

   CREATE TABLE quest_progress (
     wallet TEXT NOT NULL,
     quest_id TEXT NOT NULL,
     progress INT DEFAULT 0,
     completed BOOLEAN DEFAULT false,
     date TEXT NOT NULL,   -- ISO date for daily reset
     PRIMARY KEY (wallet, quest_id, date)
   );

   CREATE TABLE floor_competition (
     layer INT NOT NULL,
     charges INT DEFAULT 0,
     week_number INT NOT NULL,
     PRIMARY KEY (layer, week_number)
   );

   CREATE TABLE login_rewards (
     wallet TEXT PRIMARY KEY,
     current_day INT DEFAULT 1,
     collected_days JSONB DEFAULT '[]',
     last_collected TEXT
   );

   ALTER TABLE pacts ENABLE ROW LEVEL SECURITY;
   ALTER TABLE quest_progress ENABLE ROW LEVEL SECURITY;
   ALTER TABLE floor_competition ENABLE ROW LEVEL SECURITY;
   ALTER TABLE login_rewards ENABLE ROW LEVEL SECURITY;
   ```

2. `supabase.ts` — add CRUD for new tables:
   - `loadPacts()`, `upsertPact()`, `deletePact()`
   - `loadQuestProgress(wallet, date)`, `upsertQuestProgress()`
   - `loadFloorCompetition(weekNumber)`, `upsertFloorCharge()`
   - `loadLoginRewards(wallet)`, `upsertLoginRewards()`

3. `TowerRoom.ts` — load on room create, persist on change:
   - In `onCreate`: load pacts, floor competition from Supabase
   - After pact create/break: fire-and-forget upsert/delete
   - After charge (quest progress): fire-and-forget upsert

4. `quests.ts` — load/save quest progress from Supabase instead of in-memory Map.

5. `floor-competition.ts` — load/save from Supabase instead of in-memory Map.

**Tests**: Server tests: pact persistence, quest progress persistence, floor competition persistence.

**Deploy note**: Run `npx supabase db push` after merging.

---

## Task 16: Security Fixes + WebSocket Rate Limiting

**Priority**: HIGH — V6 (trust client stake amount) is a real exploit
**Scope**: Server only

**Problem**: 6 security vulnerabilities identified by Tech Architect agent.

**Files to edit**:
- `apps/server/src/rooms/TowerRoom.ts`
- `apps/server/src/index.ts`

**Implementation**:

1. **V6 Fix — validate on-chain stake amounts**:
   - In claim handler: after client reports `msg.amount`, query Solana RPC for the user's `UserDeposit` PDA balance
   - Compare `pda.amount >= msg.amount` before accepting the claim
   - If mismatch: reject claim with error message
   - Use the existing RPC connection from Blinks routes

2. **V2 Fix — WebSocket rate limiting**:
   ```typescript
   // Add to TowerRoom class:
   private messageCounts = new Map<string, { count: number; resetAt: number }>();
   private readonly MAX_MESSAGES_PER_SECOND = 10;

   // Add rate check at top of onMessage or wrap each handler:
   private checkRateLimit(client: Client): boolean {
     const now = Date.now();
     const entry = this.messageCounts.get(client.sessionId);
     if (!entry || now > entry.resetAt) {
       this.messageCounts.set(client.sessionId, { count: 1, resetAt: now + 1000 });
       return true;
     }
     entry.count++;
     if (entry.count > this.MAX_MESSAGES_PER_SECOND) {
       client.send("error", { message: "Rate limited" });
       return false;
     }
     return true;
   }
   ```

3. **V1 Fix — ghost claim session binding**:
   - Store `sessionId → ghostBlockId` mapping
   - On reconnect: allow session to reclaim its ghost block by matching sessionId

4. **V3 Fix — bind upload tokens to session**:
   - Store `token → sessionId` in upload token map
   - Validate sessionId matches on upload

**Tests**: Rate limiting: >10 messages/second returns error. Stake validation: reject mismatched amounts.

---

## Task 17: CI Pipeline (GitHub Actions)

**Priority**: HIGH — currently no CI, regressions ship silently
**Scope**: DevOps

**Files to create**:
- `.github/workflows/ci.yml`

**Implementation**:

```yaml
name: CI
on: [push, pull_request]
jobs:
  test-mobile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install --frozen-lockfile
      - run: cd apps/mobile && npx jest --ci --coverage
      - run: timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json

  test-server:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install --frozen-lockfile
      - run: cd apps/server && npx jest --ci
      - run: cd apps/server && npx tsc --noEmit
```

**Tests**: Push to branch, verify Actions run and pass.

---

## Task 18: Analytics Pipeline (Retention Tracking)

**Priority**: HIGH — "Can't improve what you can't measure"
**Scope**: Server + Supabase

**Problem**: No analytics. Can't measure D1/D7/D30 retention, streak distribution, ghost→staked conversion, or feature usage.

**Files to create**:
- `supabase/migrations/006_analytics.sql`
- `apps/server/src/utils/analytics.ts`

**Files to edit**:
- `apps/server/src/rooms/TowerRoom.ts`
- `apps/server/src/index.ts`

**Implementation**:

1. Create migration `006_analytics.sql`:
   ```sql
   CREATE TABLE sessions (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     wallet TEXT,
     session_id TEXT NOT NULL,
     started_at TIMESTAMPTZ DEFAULT now(),
     ended_at TIMESTAMPTZ,
     actions JSONB DEFAULT '[]',
     is_ghost BOOLEAN DEFAULT false
   );

   CREATE TABLE daily_metrics (
     date TEXT PRIMARY KEY,
     dau INT DEFAULT 0,
     charges INT DEFAULT 0,
     claims INT DEFAULT 0,
     ghost_claims INT DEFAULT 0,
     ghost_conversions INT DEFAULT 0,
     shares INT DEFAULT 0,
     pokes INT DEFAULT 0
   );
   ```

2. Create `analytics.ts`:
   ```typescript
   export function trackSession(wallet: string, sessionId: string, isGhost: boolean): void
   export function trackAction(sessionId: string, action: string): void
   export function endSession(sessionId: string): void
   export function incrementDailyMetric(metric: string): void
   // All fire-and-forget
   ```

3. `TowerRoom.ts` — instrument key actions:
   - onJoin: `trackSession()`
   - onLeave: `endSession()`
   - claim/charge/poke/customize: `trackAction()` + `incrementDailyMetric()`

4. `index.ts` — add REST endpoint:
   - `GET /api/analytics/daily?days=30` — returns daily metrics for dashboard
   - `GET /api/analytics/retention?cohort=YYYY-MM-DD` — D1/D7/D30 for cohort

**Tests**: Analytics functions write to Supabase. REST endpoints return data.

---

## Task 19: Demo Video (Remotion)

**Priority**: HIGH — "No demo video is the single biggest gap" (Hackathon Judge)
**Scope**: `apps/video/` (Remotion content engine)

**Problem**: The Remotion content engine is built but no final demo video exists.

**Files to edit**:
- `apps/video/` (existing Remotion project)

**Implementation**:

1. Create a 90-second demo composition:
   ```
   0:00-0:05  — Tower rises from darkness, aurora ignites (existing ShowcaseDemo)
   0:05-0:15  — Camera orbits tower showing glowing blocks, Spark faces blinking
   0:15-0:25  — Text: "650 blocks. One tower. Yours or theirs."
   0:25-0:35  — Phone mockup: app opens, cinematic reveal, block selected
   0:35-0:45  — Claim animation: block ignites, celebration, Spark face appears
   0:45-0:55  — Charge window: ring contracts, player taps, "GREAT!" flash
   0:55-1:05  — Customization: color picker, emoji, name ("Meet Luna")
   1:05-1:15  — Time-lapse: blocks fading, streaks climbing, tower breathing
   1:15-1:25  — Text: "30 seconds a day. Keep the flame alive."
   1:25-1:30  — QR code + "Claim Your Spot" CTA
   ```

2. Use existing tower shader assets from ShowcaseDemo.

3. Export to MP4 at 1080p 60fps.

4. Update README.md with video embed link.

**Tests**: Remotion renders without errors. Video exports successfully.

---

## Task 20: Pass 2 Integration Verification

**Priority**: Gate task
**Scope**: Verification only — no new code

**Run the full verification suite**:

```bash
cd apps/mobile && npx jest
cd apps/server && npx jest
timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json
cd apps/server && npx tsc --noEmit
```

**Manual verification checklist** (document results in PROGRESS):
- [ ] Beacon-tier block can Ascend → resets to Spark II with crown badge
- [ ] Login calendar appears on app open, 7-day cycle works
- [ ] Season pass panel shows free/premium tracks
- [ ] Loot pity: 30 charges without epic → guaranteed epic
- [ ] Server restart preserves pacts, quest progress, floor competition
- [ ] WebSocket rate limiting: >10 msg/sec → error
- [ ] Stake amount validated against on-chain PDA
- [ ] CI pipeline runs on push (GitHub Actions green)
- [ ] Analytics: /api/analytics/daily returns data
- [ ] Demo video renders and plays (90 seconds)

---

# ================================================
# === PASS 2 GATE ===
# All 10 tasks above must be committed before Pass 2 is complete.
# Run: git log --oneline | head -25
# Verify 20 task commits exist.
# ================================================

---

## PROGRESS

Track completion here. Update after each task commit.

### Pass 1: Ship Mid-Game + Fix Core Loop

- [ ] **1** While You Were Away Modal
- [ ] **2** Quest Panel + Streak Counter in TopHUD
- [ ] **3** Event Banner
- [ ] **4** Onboarding Trim (10→6) + Spark Naming
- [ ] **5** Ghost Block Economy Rebalance
- [ ] **6** Streak Dead Zone Fix + Free Day-1 Freeze
- [ ] **7** Charge Window (Timing Mechanic)
- [ ] **8** Quick-Charge Shortcut + Auto-Hide HUD
- [ ] **9** Floor Leaderboard UI
- [ ] **10** Pass 1 Integration Verification

### Pass 2: Endgame + Monetization + Production

- [ ] **11** Prestige / Ascension System
- [ ] **12** Daily Login Calendar
- [ ] **13** Season Pass Infrastructure
- [ ] **14** Loot Pity System + Collection Milestones
- [ ] **15** Persist In-Memory State to Supabase
- [ ] **16** Security Fixes + WebSocket Rate Limiting
- [ ] **17** CI Pipeline (GitHub Actions)
- [ ] **18** Analytics Pipeline (Retention Tracking)
- [ ] **19** Demo Video (Remotion)
- [ ] **20** Pass 2 Integration Verification

---

## POST-IMPLEMENTATION: GO-TO-MARKET CHECKLIST

After both passes are complete, execute this distribution plan:

### Week 1: Foundation
- [ ] Apply for Solana Mobile Builder Grants (solanamobile.com/grants)
- [ ] Set up Discord (#welcome, #tower-chat, #strategy, #bug-reports, #memes)
- [ ] Create Twitter/X account, post first build-in-public thread
- [ ] Generate 3 TikTok/Reels from Remotion (tower reveal, claim animation, time-lapse)

### Week 2: Seed Community
- [ ] Manually recruit 25-50 users from Solana Discord servers
- [ ] Create Zealy quest board (follow → join Discord → claim block → 3-day streak)
- [ ] Post dev story on Reddit r/solana and r/indiegaming
- [ ] Submit polished dApp Store listing

### Week 3: Launch
- [ ] Coordinated launch: Twitter thread + Discord + Reddit + TikTok (same hour)
- [ ] Live block claim counter on Twitter: "X / 650 claimed"
- [ ] "Founder" badge for first 50 claimers
- [ ] Each claimer gets 2 invite codes

### Month 1 Targets
| Metric | Target | Stretch |
|--------|--------|---------|
| Blocks claimed | 100 | 200 |
| DAU | 50 | 100 |
| D7 retention | 40% | 55% |
| Twitter followers | 500 | 1,000 |
| Discord members | 100 | 250 |

### Revenue Targets (6-Month)
| Stream | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| Staking fees | $10 | $50 | $150 |
| Season Pass | $0 | $150 | $600 |
| Cosmetics | $0 | $50 | $200 |
| **Total** | **$10** | **$250** | **$950** |

These are conservative targets for a solo dev with no marketing budget. Revenue becomes meaningful at 1,000+ MAU with season pass adoption.

---

## EXPECTED AGENT SATISFACTION AFTER IMPLEMENTATION

| Agent | Before | After Pass 1 | After Pass 2 |
|-------|--------|-------------|-------------|
| User | 3/10 | 6/10 | 7/10 |
| Investor | PASS | Watchlist+ | Interested |
| Hackathon Judge | 7.4/10 | 8.5/10 | 9/10 |
| Designer | Foundation | Solid | Strong |
| Game Designer | 4/10 (loop) | 6/10 | 8/10 |
| Tech Architect | D+ (DevOps) | C+ | B+ |
| Marketer | No assets | Some assets | Launch-ready |
| Researcher | N/A | N/A | Aligned |

**Key improvements**:
- Core loop goes from "press button" (4/10) to "timing skill + decision" (7/10)
- Mid-game goes from "nonexistent" to "5 visible engagement systems"
- Endgame goes from "caps at Day 150" to "infinite via ascension + seasons"
- Revenue goes from "$195 max" to "recurring via season pass"
- DevOps goes from "D+" to "B+ (CI, monitoring, persistence)"
- Distribution goes from "no assets" to "demo video, analytics, launch plan"
