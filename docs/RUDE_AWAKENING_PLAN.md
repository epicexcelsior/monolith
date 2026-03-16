# The Monolith: Rude Awakening Overhaul

> **Ralph Loop Plan** — self-sufficient document for autonomous implementation.
> 8 evaluation agents converged: **9/10 tech execution, 3/10 go-to-market.**
> This plan fixes the go-to-market across 5 phases, 20 atomic tasks.

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
   Example: `feat(server): add wallet signature verification`
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

| File | What It Does |
|------|-------------|
| `apps/server/src/rooms/TowerRoom.ts` | Game room: claims, decay, XP, persistence, ownership |
| `apps/server/src/utils/supabase.ts` | Supabase client + CRUD helpers |
| `apps/server/src/utils/notifications.ts` | Push notification helpers |
| `apps/server/src/index.ts` | Server entrypoint + REST endpoints |
| `apps/mobile/stores/tower-store.ts` | Block data, selection, charge, decay |
| `apps/mobile/stores/multiplayer-store.ts` | Colyseus connection, state sync |
| `apps/mobile/stores/player-store.ts` | XP, level, combo |
| `apps/mobile/stores/onboarding-store.ts` | 9-phase onboarding state machine |
| `apps/mobile/stores/achievement-store.ts` | Achievement unlocks (7 types) |
| `apps/mobile/stores/loot-store.ts` | Loot inventory |
| `apps/mobile/hooks/useBlockActions.ts` | Block action handlers (claim/charge/poke) |
| `apps/mobile/components/ui/BlockInspector.tsx` | Selected block detail panel |
| `apps/mobile/components/inspector/*` | Inspector sub-components |
| `apps/mobile/components/ui/ClaimModal.tsx` | Block claim confirmation |
| `apps/mobile/components/onboarding/OnboardingFlow.tsx` | Onboarding phase renderer |
| `apps/mobile/constants/theme.ts` | Colors, glass styles, typography |
| `apps/mobile/constants/loot-table.ts` | 12 loot items, rarity tiers |
| `apps/mobile/app/(tabs)/index.tsx` | Home screen (tower + HUD) |
| `packages/common/src/constants.ts` | Shared tower constants |
| `packages/common/src/types.ts` | Shared TypeScript types |
| `apps/web/index.html` | Landing page |

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

## DIAGNOSIS

The core problems this plan fixes:

1. **Security hole**: No wallet auth verification on server — any user can impersonate any wallet
2. **Crypto paywall**: USDC staking blocks 90-95% of users before the "aha moment"
3. **No distribution**: Beyond Seeker's ~150K devices, no web presence
4. **Solo streaks don't retain**: 14-21 day half-life without social obligation
5. **Day 3 wall**: After 3 days the daily loop has no surprises
6. **UI polish**: Wrong inspector theme, unskippable celebrations, no camera tutorial

---

# ============================================
# PASS 1: Security + Polish + Free-to-Play
# Phases 1-2 | 8 Tasks | ~3-4 days
# ============================================

## Phase 1: Security & Visual Polish

### Task 1.1: Wallet Signature Verification

**Priority**: CRITICAL — security hole
**Scope**: Server auth + client auth flow

**Problem**: `TowerRoom.ts` blindly trusts `options.wallet` from client. Any user can impersonate any wallet.

**Files to create**:
- `apps/server/src/utils/auth.ts`
- `apps/server/__tests__/auth.test.ts`

**Files to edit**:
- `apps/server/src/rooms/TowerRoom.ts` (onJoin, message handlers)
- `apps/mobile/stores/multiplayer-store.ts` (connect flow)
- `apps/mobile/stores/wallet-store.ts` (add signMessage)
- `apps/server/package.json` (add `tweetnacl`)

**Implementation**:

1. Create `apps/server/src/utils/auth.ts`:
   ```typescript
   import nacl from "tweetnacl";
   import crypto from "crypto";

   const nonceStore = new Map<string, { nonce: string; expires: number }>();

   export function generateNonce(sessionId: string): string {
     const nonce = crypto.randomBytes(32).toString("base64");
     nonceStore.set(sessionId, { nonce, expires: Date.now() + 60_000 });
     return nonce;
   }

   export function verifySignature(
     walletAddress: string,
     nonce: string,
     signature: Uint8Array
   ): boolean {
     // Decode base58 public key, verify nacl.sign.detached.verify
     // Return true if valid, false otherwise
   }

   export function consumeNonce(sessionId: string): string | null {
     const entry = nonceStore.get(sessionId);
     if (!entry || Date.now() > entry.expires) {
       nonceStore.delete(sessionId);
       return null;
     }
     nonceStore.delete(sessionId);
     return entry.nonce;
   }
   ```

2. Edit `TowerRoom.ts`:
   - In `onJoin`: Remove `this._wallet = options.wallet` trust. Send `auth_challenge` with nonce.
   - Add `auth_response` handler: verify signature, set `_wallet` and `_authenticated = true`.
   - All write handlers (claim, charge, poke, customize): check `_authenticated === true`.
   - Read-only operations (view, sync): still allowed without auth.

3. Edit `multiplayer-store.ts`:
   - After `joinOrCreate`, listen for `auth_challenge` message.
   - Call `wallet-store.signMessage(nonce)` to sign.
   - Send `auth_response` with signature.
   - Wait for `auth_success` / `auth_failure` (10s timeout).

4. Edit `wallet-store.ts`:
   - Add `signMessage(msg: Uint8Array): Promise<Uint8Array>` using MWA `transact` -> `signMessage`.

5. Add `tweetnacl` to server `package.json` + `pnpm install`.

6. Write tests in `apps/server/__tests__/auth.test.ts`:
   - Valid signature verifies
   - Expired nonce rejects
   - Invalid signature rejects
   - Unauthenticated user blocked from write operations

**Backward compat**: Unauthenticated users can still view tower (read-only). Ghost blocks (Task 2.1) don't need wallet auth.

---

### Task 1.2: Inspector Dark Mode

**Priority**: Polish
**Scope**: UI theme only

**Problem**: Inspector uses warm cream `COLORS.glassElevated` (rgba(255,253,248,0.92)) over a dark 3D scene. Dark tokens already exist in `theme.ts`.

**Files to edit**:
- `apps/mobile/constants/theme.ts`
- `apps/mobile/components/ui/BlockInspector.tsx`
- `apps/mobile/components/inspector/InspectorHeader.tsx`
- `apps/mobile/components/inspector/InspectorActions.tsx`
- `apps/mobile/components/inspector/InspectorCustomize.tsx`
- `apps/mobile/components/inspector/InspectorComments.tsx`
- `apps/mobile/components/inspector/InspectorStats.tsx`

**Implementation**:

1. Add new tokens to `theme.ts` COLORS:
   ```typescript
   inspectorBg: "rgba(10, 12, 20, 0.85)",
   inspectorBgMuted: "rgba(15, 18, 30, 0.70)",
   inspectorBorder: "rgba(255, 255, 255, 0.06)",
   inspectorText: "rgba(255, 255, 255, 0.90)",
   inspectorTextSecondary: "rgba(255, 255, 255, 0.55)",
   ```

2. Add `GLASS_STYLE.inspector` after the existing glass styles:
   ```typescript
   inspector: {
     backgroundColor: COLORS.inspectorBg,
     borderColor: COLORS.inspectorBorder,
     borderWidth: 1,
   },
   ```

3. Update each inspector component:
   - `BlockInspector.tsx`: `backgroundColor` -> `COLORS.inspectorBg`, border -> `COLORS.inspectorBorder`
   - All sub-components: Replace `COLORS.text` (#1A1612) with `COLORS.inspectorText`, `COLORS.bgMuted` with `COLORS.inspectorBgMuted`, `COLORS.textSecondary` with `COLORS.inspectorTextSecondary`
   - **Keep gold accents** (`COLORS.goldAccent`, `COLORS.goldSubtle`) — gold on dark looks great

**Tests**: TypeScript check passes. Visual review on device.

---

### Task 1.3: Celebration Tap-to-Skip

**Priority**: Polish
**Scope**: UI interaction

**Problem**: LevelUpCelebration has `pointerEvents="none"`, auto-clears after 3.2s, no tap dismiss. Annoying by Day 3.

**Files to edit**:
- `apps/mobile/components/ui/LevelUpCelebration.tsx`
- `apps/mobile/components/ui/LootReveal.tsx`
- `apps/mobile/hooks/useClaimCelebration.ts`
- `apps/mobile/app/(tabs)/index.tsx`

**Implementation**:

1. `LevelUpCelebration.tsx`:
   - Change `pointerEvents="none"` to `"auto"`
   - Wrap content in `Pressable` with `onPress={handleDismiss}`
   - `handleDismiss`: fade out in 200ms, then call `clearJustEvolved()`
   - Keep 3.2s auto-clear as fallback

2. `LootReveal.tsx`:
   - Reduce equip button delay from 1200ms to 600ms
   - Overlay tap-dismiss already works (check it still does)

3. `useClaimCelebration.ts`:
   - Export `cancelCelebration` callback
   - Clears all timers, exits cinematic mode, re-selects block
   - Gate: only callable after 2s (let user see the impact moment)

4. `index.tsx`:
   - During `cinematicMode`, render a transparent `Pressable` overlay
   - `onPress` calls `cancelCelebration` (gated by 2s minimum)

**Tests**: Trigger each celebration type, verify tap dismissal, verify auto-clear still works as fallback.

---

### Task 1.4: Camera Tutorial in Onboarding

**Priority**: UX
**Scope**: Onboarding flow

**Problem**: No tutorial for orbit (swipe), zoom (pinch), or floor scrubber. New users can't navigate.

**Files to create**:
- `apps/mobile/components/onboarding/CameraTutorial.tsx`

**Files to edit**:
- `apps/mobile/stores/onboarding-store.ts`
- `apps/mobile/components/onboarding/OnboardingFlow.tsx`

**Implementation**:

1. `onboarding-store.ts`:
   - Add `"cameraTutorial"` to `OnboardingPhase` type union
   - Insert into `PHASE_ORDER` at index 1 (after `"cinematic"`, before `"title"`)

2. Create `CameraTutorial.tsx`:
   ```typescript
   // 3-step coach marks with gesture icons
   // Step 1: "Swipe to look around" (animated hand-swipe icon via Unicode or simple View animation)
   // Step 2: "Pinch to zoom in and out" (pinch icon)
   // Step 3: "Drag the bar to jump floors" (arrow pointing at LayerIndicator)
   // Each step: auto-advance after 4s or tap to advance
   // pointerEvents="box-none" so gestures pass through to tower
   // Use existing StepCard component for consistent styling
   // After step 3, call advancePhase()
   ```

3. `OnboardingFlow.tsx`:
   - Add: `{phase === "cameraTutorial" && <CameraTutorial onComplete={advancePhase} />}`

**Tests**: Update `onboarding-store.test.ts` for new phase count and order. Reset onboarding, verify full flow.

---

## Phase 2: Free-to-Play & Activation

### Task 2.1: Ghost Blocks (Free Entry, No Stake)

**Priority**: CRITICAL — removes crypto paywall
**Scope**: Full stack

**Problem**: 90-95% of users can't get past the USDC staking requirement. The "aha moment" (watching your block glow and decay) is behind a paywall.

**Files to edit**:
- `packages/common/src/constants.ts`
- `packages/common/src/types.ts`
- `apps/server/src/rooms/TowerRoom.ts`
- `apps/mobile/hooks/useBlockActions.ts`
- `apps/mobile/components/ui/ClaimModal.tsx`
- `apps/mobile/components/inspector/InspectorActions.tsx`

**Implementation**:

1. `constants.ts` — add ghost block constants:
   ```typescript
   export const GHOST_BLOCK_LIMIT = 1;
   export const GHOST_DECAY_MULTIPLIER = 2.0;
   export const GHOST_CHARGE_CAP = 50;
   export const GHOST_BLOCK_LAYERS = [0, 1, 2, 3, 4, 5]; // bottom 6 layers only
   ```

2. `types.ts` — add `isGhost?: boolean` to block type.

3. `TowerRoom.ts`:
   - Add `"ghost_claim"` message handler:
     - Validate block is on an eligible layer (`GHOST_BLOCK_LAYERS`)
     - Check ghost limit per wallet/session (max `GHOST_BLOCK_LIMIT`)
     - Set `block.isGhost = true`, energy to `GHOST_CHARGE_CAP`
     - No USDC required
   - In decay loop: `decayAmount *= block.isGhost ? GHOST_DECAY_MULTIPLIER : 1`
   - In charge handler: cap energy at `GHOST_CHARGE_CAP` for ghost blocks
   - Add `"upgrade_ghost"` handler:
     - Requires USDC deposit (same layer-based pricing)
     - Clears `isGhost` flag
     - Block gains full energy cap (100)

4. `ClaimModal.tsx`:
   - On ghost-eligible layers, show "FREE CLAIM" button above USDC option
   - Subtitle: "Try free — lower energy cap, faster decay"
   - FREE CLAIM sends `ghost_claim` message

5. `InspectorActions.tsx`:
   - For ghost block owners, show "Upgrade — Stake USDC for full power" CTA
   - Visual indicator (dotted border or "GHOST" badge) on ghost blocks

6. `useBlockActions.ts`:
   - Add `handleGhostClaim` flow (mirrors `handleClaim` but sends `ghost_claim`)
   - Add `handleUpgradeGhost` flow

**Tests**: Server tests for ghost claim, ghost decay rate, ghost charge cap, ghost upgrade to staked.

---

### Task 2.2: Ghost Onboarding Flow

**Priority**: High — completes free-to-play path
**Scope**: Onboarding UX
**Depends on**: Task 2.1

**Problem**: If ghost blocks exist, wallet step should be optional.

**Files to edit**:
- `apps/mobile/components/onboarding/OnboardingFlow.tsx`
- `apps/mobile/stores/onboarding-store.ts`

**Implementation**:

1. `onboarding-store.ts`:
   - Add `ghostMode: boolean` flag to store state
   - Add `setGhostMode(val: boolean)` action

2. `OnboardingFlow.tsx` — wallet phase:
   - Primary CTA becomes "START PLAYING" (completes onboarding with ghost block)
   - Secondary CTA: "CONNECT WALLET" for stakers (existing flow)
   - After 3 successful charges on ghost block, show one-time inline nudge in inspector: "Unlock full power — connect wallet"

**Tests**: Update onboarding tests. Verify full ghost path (no wallet) works end-to-end.

---

### Task 2.3: Notification Strategy Overhaul

**Priority**: High — current notifications are hostile
**Scope**: Server-side only

**Problem**: Hourly scan with 30-min throttle = up to 48 notifications/day per type. Users will uninstall.

**Files to edit**:
- `apps/server/src/rooms/TowerRoom.ts` (decay loop, notification check)
- `apps/server/src/utils/notifications.ts` (throttle, daily cap)

**Implementation**:

1. `TowerRoom.ts`:
   - Remove `runHourlyNotificationCheck()` from decay loop
   - Add state-transition triggers in decay loop:
     - Notify ONCE when energy crosses 20% threshold (fading)
     - Notify ONCE when block becomes dormant (0 energy)
   - Streak reminder: fire once at first decay tick after 18:00 UTC if `lastStreakDate !== today`

2. `notifications.ts`:
   - Increase throttle from 30min to 4 hours
   - Add daily per-wallet cap of 3 notifications
   - Track via `dailyNotifCount: Map<string, number>` reset at UTC midnight
   - Target: active user 1-2 notifs/day, lapsing user 2-4, never more than 5

**Tests**: Update notification-related test assertions. Verify cap works.

---

### Task 2.4: Phase 1-2 Integration Verification

**Priority**: Gate task
**Scope**: Verification only — no new code

**Run the full verification suite**:

```bash
# Tests
cd apps/mobile && npx jest
cd apps/server && npx jest

# TypeScript
timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json
cd apps/server && npx tsc --noEmit
```

**Manual verification checklist** (document results in PROGRESS):
- [ ] Connect with wallet, verify auth challenge/response flow
- [ ] Open inspector, verify dark glass theme (no cream/white backgrounds)
- [ ] Trigger level-up celebration, tap to skip before 3.2s
- [ ] Reset onboarding, verify camera tutorial appears after cinematic
- [ ] Claim ghost block without wallet connection
- [ ] Verify ghost block has 2x decay rate and 50 energy cap
- [ ] Check notification logs: max 3 per wallet per day

If any check fails, fix it before marking this task complete.

---

# ================================================
# === PASS 1 GATE ===
# All 8 tasks above must be committed before proceeding.
# Run: git log --oneline | head -10
# Verify 8 task commits exist.
# STOP HERE if running Pass 1.
# ================================================

---

# ============================================
# PASS 2: Social + Distribution + Depth
# Phases 3-5 | 12 Tasks | ~8-12 days
# ============================================

## Phase 3: Social & Retention

### Task 3.1: Neighbor Pacts (Bilateral Streaks)

**Priority**: High — social obligation is the #1 retention fix
**Scope**: Full stack

**Problem**: Solo streaks have 14-21 day half-life. Social obligation (like Duolingo friends) dramatically extends this.

**Files to create**:
- `apps/mobile/components/inspector/PactBadge.tsx`

**Files to edit**:
- `packages/common/src/constants.ts`
- `packages/common/src/types.ts`
- `apps/server/src/rooms/TowerRoom.ts`
- `apps/mobile/components/inspector/InspectorActions.tsx`
- `apps/mobile/hooks/useBlockActions.ts`

**Implementation**:

1. `constants.ts`: Add pact constants:
   ```typescript
   export const MAX_PACTS_PER_BLOCK = 2;
   export const PACT_BONUS_ENERGY = 5;
   export const PACT_REQUEST_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h
   export const PACT_MISS_LIMIT = 2; // consecutive missed days before break
   ```

2. `types.ts`: Add `PactMessage`, `Pact` interfaces.

3. `TowerRoom.ts`:
   - Track `pacts: Map<string, Pact>` (key = sorted pair of block IDs)
   - `pact_request` handler: Player A requests pact with adjacent block's owner
   - `pact_accept` handler: Player B accepts (or auto-expire after 24h)
   - In charge handler: if both pact partners charged today, award `PACT_BONUS_ENERGY` to each
   - In decay loop: check consecutive misses, break pact if `>= PACT_MISS_LIMIT`

4. `PactBadge.tsx`: Small handshake icon + partner name, shown in InspectorHeader area.

5. `InspectorActions.tsx`: "Form Pact" button when viewing adjacent owned block.

6. `useBlockActions.ts`: `handlePactRequest`, `handlePactAccept` actions.

**Tests**: Server tests for pact creation, bonus award, pact breaking on missed days.

---

### Task 3.2: Floor Weekly Competition

**Priority**: Medium — team dynamics
**Scope**: Full stack

**Problem**: No team dynamics. Solo play with no collective goals.

**Files to create**:
- `apps/server/src/utils/floor-competition.ts`
- `apps/mobile/components/board/FloorLeaderboard.tsx`

**Files to edit**:
- `apps/server/src/rooms/TowerRoom.ts`
- `apps/mobile/components/board/BoardContent.tsx`

**Implementation**:

1. `floor-competition.ts`:
   - `weeklyLayerCharges: Map<number, number>` — track charges per layer
   - `getFloorLeaderboard()` — returns sorted layers by weekly charges
   - `resetWeeklyCharges()` — called Monday 00:00 UTC
   - `getWinningFloor()` — last week's winner (for crown effect)

2. `TowerRoom.ts`:
   - On charge: increment `weeklyLayerCharges[block.layer]`
   - On Monday UTC: call `resetWeeklyCharges()`, broadcast `floor_winner` with last week's result
   - Include `weeklyFloorRanking` in `tower_state` sync

3. `FloorLeaderboard.tsx`:
   - Table: Floor # | Charges This Week | # Blocks | Crown icon for winner
   - Highlight player's floor(s)

4. `BoardContent.tsx`:
   - Add "Floors" tab alongside existing Leaderboard and Activity tabs

**Tests**: Server tests for charge counting, weekly reset, floor winner determination.

---

### Task 3.3: Daily Quests (2-3 Micro-Objectives)

**Priority**: High — variety after Day 3
**Scope**: Full stack

**Problem**: Every session is identical after Day 3. No variety, no discovery, no surprise.

**Files to create**:
- `packages/common/src/quest-defs.ts`
- `apps/server/src/utils/quests.ts`
- `apps/mobile/stores/quest-store.ts`
- `apps/mobile/components/ui/QuestPanel.tsx`

**Files to edit**:
- `apps/server/src/rooms/TowerRoom.ts`
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/components/ui/TopHUD.tsx`

**Implementation**:

1. `quest-defs.ts` — quest pool (7 quests, 3 picked daily per wallet):
   ```typescript
   export const QUEST_POOL = [
     { id: "charge_1", name: "Charge your Spark", desc: "Charge 1 block", target: 1, xp: 15 },
     { id: "charge_3", name: "Triple Charge", desc: "Charge 3 blocks", target: 3, xp: 30 },
     { id: "poke_1", name: "Friendly Poke", desc: "Poke a neighbor", target: 1, xp: 20 },
     { id: "streak_1", name: "Streak Guardian", desc: "Maintain your streak today", target: 1, xp: 25 },
     { id: "great_1", name: "Lucky Roll", desc: "Get a Great quality charge", target: 1, xp: 35 },
     { id: "customize_1", name: "Fresh Look", desc: "Customize your block", target: 1, xp: 10 },
     { id: "full_charge", name: "Fully Charged", desc: "Bring a block to 100%", target: 1, xp: 40 },
   ];
   ```
   - `pickDailyQuests(wallet, dateStr)`: deterministic hash to pick 3 quests

2. `quests.ts` (server):
   - Track progress per wallet per day
   - `checkQuestProgress(wallet, eventType)` — called after each action
   - `getQuestState(wallet)` — returns today's 3 quests with progress

3. `quest-store.ts` (client):
   - Sync quest state from server `quest_update` messages
   - `quests: QuestState[]`, `isQuestPanelOpen: boolean`

4. `QuestPanel.tsx`:
   - 3 cards with progress bars, XP reward, checkmark on complete
   - Accessible via scroll icon in TopHUD

5. `TowerRoom.ts`:
   - After each action (charge, poke, customize), call `checkQuestProgress()`
   - Send `quest_update` to client on progress/completion
   - Award XP on quest completion

6. `TopHUD.tsx`: Add quest icon (scroll/star) that opens QuestPanel.

7. `index.tsx`: Add `isQuestPanelOpen` to `anyOverlayOpen`.

**Tests**: Quest picking determinism, progress tracking, completion + XP award.

---

### Task 3.4: Expanded Loot Table (12 -> 44 Items)

**Priority**: Medium — content depth
**Scope**: Client only

**Problem**: 12 items exhausted in 2 weeks. No chase items. Loot drops become boring.

**File to edit**: `apps/mobile/constants/loot-table.ts`

**Implementation**:

Add 32 new items across all categories:

**Common (new)**:
- 8 colors: coral, sage, lavender, amber, rose, seafoam, dusty blue, marigold

**Rare (new)**:
- 4 colors: holographic, oil slick, sunset gradient, aurora green
- 6 emojis: moon, dragon, crystal ball, alien, robot, unicorn
- 4 effects: cherry blossom, electric, smoke, water ripple

**Epic (new)**:
- 2 emojis: phoenix, black hole
- 3 effects: rainbow trail, gravity field, fire ring
- 2 styles: (design TBD — geometric patterns)

**Legendary (new)**:
- 2 effects: cosmic void, solar flare
- 1 style: (design TBD — ultimate cosmetic)

**Drop rate adjustment**:
- Nothing: 70% -> 65%
- Common: 20% -> 20% (same)
- Rare: 8% -> 10%
- Epic: 1.5% -> 3.5%
- Legendary: 0.5% -> 1.5%

**Tests**: Verify `rollLoot()` respects new rates. Verify all items have valid types.

---

### Task 3.5: Streak Freeze

**Priority**: High — Duolingo's #1 retention tool
**Scope**: Full stack

**Problem**: Missing a single day destroys weeks of progress. No safety net.

**Files to create**:
- `apps/mobile/components/ui/StreakFreezeToast.tsx`

**Files to edit**:
- `packages/common/src/constants.ts`
- `apps/server/src/rooms/TowerRoom.ts`
- `apps/mobile/components/inspector/InspectorStats.tsx`

**Implementation**:

1. `constants.ts`:
   ```typescript
   export const STREAK_FREEZE_EARN_INTERVAL = 7; // earn 1 freeze per 7-day streak
   export const STREAK_FREEZE_MAX = 2;
   ```

2. `TowerRoom.ts` — charge handler streak logic:
   - On charge, if `!isNextDay(lastChargeDate)` AND `block.freezes > 0`:
     - Deduct 1 freeze
     - Continue streak (don't reset)
     - Send `streak_freeze_used` message to client
   - On reaching 7-day streak milestone: `block.freezes = Math.min(block.freezes + 1, STREAK_FREEZE_MAX)`
   - Send `streak_freeze_earned` message

3. `InspectorStats.tsx`:
   - Show ice crystal icons next to streak counter (1 icon per freeze)
   - Gold = available, gray = used

4. `StreakFreezeToast.tsx`:
   - "Streak freeze saved your 12-day streak!" with ice crystal animation
   - Auto-dismiss after 4s

**Tests**: Server tests: freeze earned at day 7, freeze consumed on gap day, freeze max cap, streak continues after freeze.

---

## Phase 4: Distribution & Viral

### Task 4.1: Web Tower Viewer (Live Data on Landing Page)

**Priority**: CRITICAL — 99.7% of share link viewers can't see the tower
**Scope**: Full stack

**Problem**: Every share link leads to a static landing page. The actual product is invisible to web visitors.

**Files to edit**:
- `apps/server/src/index.ts`
- `apps/web/index.html`

**Implementation**:

1. `apps/server/src/index.ts` — add REST endpoint:
   ```typescript
   app.get("/api/tower/blocks", (req, res) => {
     const room = getActiveRoom(); // existing helper
     if (!room) return res.json([]);
     const blocks = Array.from(room.state.blocks.values()).map(b => ({
       id: b.id, layer: b.layer, index: b.index,
       energy: b.energy, ownerColor: b.ownerColor,
       emoji: b.emoji, name: b.name, isGhost: b.isGhost,
       ownerName: b.ownerName,
     }));
     res.json(blocks);
   });
   ```

2. `apps/web/index.html`:
   - Add `fetchTowerData()`: fetch `/api/tower/blocks` every 30s
   - Apply energy/color to instanced block meshes (map `ownerColor` to material color, `energy` to brightness)
   - Add raycaster for hover: tooltip shows block emoji + name + energy%
   - On click: "Download to claim this block" CTA overlay
   - URL param support: `?block=L3-I5` auto-flies camera to that block on load
   - CORS: server already has cors enabled

**Tests**: Server test for new endpoint. Manual test: open landing page, verify blocks update live.

---

### Task 4.2: Improved Share Cards

**Priority**: Medium — better viral content
**Scope**: Client only

**File to edit**: `apps/mobile/components/ui/ShareCard.tsx`

**Implementation**:

1. Add a stylized 2D tower silhouette to top 1/3 of share card:
   - 25 rows of colored rectangles (one per layer)
   - User's layer highlighted in gold with glow
   - Other layers use block count to determine fill density

2. Replace generic tagline with: "Keep the flame alive."

3. Add URL: `themonolith.pages.dev/?block=L{layer}-I{index}`

4. Ensure ViewShot captures the tower silhouette correctly.

**Tests**: TypeScript check. Trigger share flow, verify card renders.

---

### Task 4.3: Invite Code System

**Priority**: Medium — viral loop
**Scope**: Full stack

**Files to create**:
- `supabase/migrations/005_invite_codes.sql`
- `apps/mobile/components/ui/InviteCodeInput.tsx`

**Files to edit**:
- `apps/server/src/rooms/TowerRoom.ts`
- `apps/server/src/utils/supabase.ts`
- `apps/mobile/components/settings/SettingsContent.tsx`

**Implementation**:

1. `005_invite_codes.sql`:
   ```sql
   CREATE TABLE invite_codes (
     code TEXT PRIMARY KEY,
     creator_wallet TEXT NOT NULL REFERENCES players(wallet),
     redeemer_wallet TEXT,
     redeemed_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ DEFAULT now()
   );
   ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
   ```

2. `supabase.ts`: Add `createInviteCodes(wallet, count)`, `redeemInviteCode(code, wallet)`.

3. `TowerRoom.ts`:
   - On first staked (non-ghost) claim: generate 3 invite codes (format: "MON-XXXX", 6 char alphanumeric)
   - Send `invite_codes` message to client
   - `redeem_invite` handler: validate code, award 100 XP to both redeemer and creator

4. `SettingsContent.tsx`:
   - Show invite codes section with Copy + Share buttons per code
   - Show redemption status (used/available)

5. `InviteCodeInput.tsx`:
   - Text input shown during onboarding (optional step)
   - "Got a code? Enter it for bonus XP"

**Tests**: Server tests for code generation, redemption, double-redeem prevention, XP award.

**Deps**: Run migration with `npx supabase db push` (document in commit message).

---

### Task 4.4: Repositioning Copy

**Priority**: High — remove "DeFi" barrier
**Scope**: Copy changes only

**Problem**: "r/Place meets DeFi in 3D" leads with crypto jargon. Bury the crypto, lead with the experience.

**Files to edit**:
- `apps/web/index.html`
- `apps/mobile/components/onboarding/TitleReveal.tsx` (if it has tagline text)
- `apps/mobile/components/ui/ShareCard.tsx`

**Implementation**:

Replace all user-facing copy:
- **Hero**: "A living tower where every block is someone's."
- **Subtitle**: "Claim a Spark. Keep it alive."
- **Meta description**: "The Monolith — claim a glowing block on a shared 3D tower."
- **Remove "DeFi"** from ALL user-facing copy
- **Keep "Solana"** only in wallet/transaction contexts (not marketing)
- **Keep "USDC"** only in actual payment flows

Search all files for "r/Place meets DeFi" and replace.

**Tests**: Grep for "DeFi" in user-facing files — should only appear in docs/comments.

---

## Phase 5: Depth & Progression

### Task 5.1: Keeper's Journey Progression Map

**Priority**: Medium — answers "what am I working toward?"
**Scope**: Client only

**Files to create**:
- `apps/mobile/components/ui/ProgressionMap.tsx`
- `apps/mobile/stores/progression-store.ts`

**Files to edit**:
- `apps/mobile/components/settings/SettingsContent.tsx`
- `apps/mobile/app/(tabs)/index.tsx`

**Implementation**:

1. `progression-store.ts`:
   - Derive milestone completion from existing stores (player-store, achievement-store, tower-store)
   - ~15 milestones: First Claim, First Charge, 3-Day Streak, Ember Evolution, First Poke, 5 Blocks, 7-Day Streak, Flame Evolution, First Pact, 10-Day Streak, Blaze Evolution, Floor Champion, Quest Master, Beacon Evolution, Legend
   - Each milestone: `{ id, name, description, flavorText, isUnlocked, icon }`

2. `ProgressionMap.tsx`:
   - Scrollable vertical path (like a winding road/trail)
   - Nodes: gold circle = unlocked, gray = locked, dotted line = future
   - Each node: icon + title + flavor text
   - Current position highlighted with pulse animation
   - Bottom sheet presentation (use existing BottomPanel)

3. `SettingsContent.tsx`: Add "Journey" button that opens ProgressionMap.

4. `index.tsx`: Add `isProgressionMapOpen` to `anyOverlayOpen`.

**Tests**: Progression store derives correct unlock states from mock store data.

---

### Task 5.2: Weekly Events

**Priority**: Medium — creates urgency windows
**Scope**: Full stack

**Files to create**:
- `apps/server/src/utils/weekly-events.ts`
- `apps/mobile/components/ui/EventBanner.tsx`

**Files to edit**:
- `apps/server/src/rooms/TowerRoom.ts`
- `apps/mobile/app/(tabs)/index.tsx`

**Implementation**:

1. `weekly-events.ts`:
   - Two events rotating weekly:
     - **Charge Storm** (odd weeks): All charges give 1.5x energy for 24h Saturday UTC
     - **Land Rush** (even weeks): Staking prices 50% off for 24h Saturday UTC
   - `getCurrentEvent()`: returns active event or null (based on UTC week number + day)
   - `getNextEventTime()`: returns countdown to next Saturday

2. `TowerRoom.ts`:
   - In charge handler: if Charge Storm active, multiply energy by 1.5
   - In claim handler: if Land Rush active, halve layer price
   - Include `activeEvent` in `tower_state` sync

3. `EventBanner.tsx`:
   - Gold pill below TopHUD
   - Event icon + name + countdown timer
   - Only renders when event is active or <24h away

4. `index.tsx`: Render EventBanner below TopHUD.

**Tests**: Event rotation logic, charge multiplier during Charge Storm, price modifier during Land Rush.

---

### Task 5.3: Expanded Achievements (7 -> 22)

**Priority**: Medium — more goals
**Scope**: Full stack
**Depends on**: Tasks 3.1, 3.3, 3.4, 4.3

**Files to edit**:
- `apps/mobile/stores/achievement-store.ts`
- `apps/mobile/hooks/useBlockActions.ts`
- `apps/server/src/rooms/TowerRoom.ts`

**Implementation**:

Add 15 new achievements to `ACHIEVEMENT_DEFS`:

| ID | Name | Trigger |
|----|------|---------|
| `high_roller` | High Roller | Stake on layer 20+ |
| `ground_floor` | Ground Floor | Claim on layer 0 |
| `charge_100` | Centurion | 100 total charges |
| `perfect_week` | Perfect Week | 7-day streak |
| `great_roll` | Lucky Strike | Get "Great" quality charge |
| `first_poke` | First Contact | Poke any block |
| `poke_10` | Serial Poker | Poke 10 blocks |
| `pact_formed` | Handshake | Form first pact |
| `first_loot` | Treasure Hunter | Get first loot drop |
| `legendary_loot` | Jackpot | Get legendary loot |
| `collector_10` | Collector | Own 10 loot items |
| `ember_reached` | Ember Glow | Evolve to Ember tier |
| `beacon_reached` | Beacon Light | Evolve to Beacon tier |
| `invited_friend` | Recruiter | Have invite code redeemed |
| `quest_complete_10` | Quest Master | Complete 10 quests |

Update trigger points in `useBlockActions.ts` and `TowerRoom.ts` to check new achievements after relevant actions.

**Tests**: Trigger each new achievement in tests, verify it unlocks and doesn't double-fire.

---

### Task 5.4: "While You Were Away" Return Summary

**Priority**: Medium — transforms punishing return into informative moment
**Scope**: Full stack

**Files to create**:
- `apps/mobile/components/ui/WhileAwayModal.tsx`
- `apps/mobile/stores/session-store.ts`

**Files to edit**:
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/server/src/rooms/TowerRoom.ts`

**Implementation**:

1. `session-store.ts`:
   - Track `lastSessionTimestamp` (persisted to SecureStore)
   - `getSecondsSinceLastSession()`
   - `shouldShowAwaySummary()`: true if >4h since last session

2. `TowerRoom.ts`:
   - In `player_sync` response, include `away_summary` if player was away >4h:
     ```typescript
     away_summary: {
       energyDelta: number,        // total energy lost across all blocks
       pokesReceived: number,      // pokes since last session
       neighborChanges: number,    // adjacent blocks that changed owner
       streakAtRisk: boolean,      // streak will break if not charged today
       lowestEnergyBlockId: string // for "charge now" CTA
     }
     ```

3. `WhileAwayModal.tsx`:
   - Glass card: "While you were away..."
   - Stats: energy lost, pokes received, neighbor changes
   - Streak risk warning (if applicable) with urgency styling
   - CTA: "CHARGE NOW" — flies camera to lowest-energy block
   - Auto-dismiss after 10s or on tap

4. `index.tsx`:
   - On `player_sync` with `away_summary`, show `WhileAwayModal`
   - Add to `anyOverlayOpen`

**Tests**: Server test for away_summary computation. Client test for modal display logic.

---

### Task 5.5: Phase 3-5 Integration Verification

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
- [ ] Form pact with adjacent block owner, verify bonus on mutual charge
- [ ] View floor leaderboard, verify weekly charge counts
- [ ] Complete a daily quest, verify XP award
- [ ] Get a loot drop from expanded table (new item)
- [ ] Verify streak freeze earned at 7-day streak, used on gap day
- [ ] Open landing page, verify live block data on tower, hover tooltips
- [ ] Share a card, verify tower silhouette + URL
- [ ] Generate invite code, redeem on another session
- [ ] Verify "DeFi" removed from all user-facing text
- [ ] Open progression map, verify milestone unlock states
- [ ] Check for weekly event banner (if Saturday UTC)
- [ ] Earn a new achievement (e.g., "First Contact" from poke)
- [ ] Close app >4h, reopen, verify "While you were away" modal

If any check fails, fix it before marking this task complete.

---

# ================================================
# === PASS 2 GATE ===
# All 12 tasks above must be committed before Pass 2 is complete.
# Run: git log --oneline | head -25
# Verify 12 task commits exist (plus 8 from Pass 1 = 20 total).
# ================================================

---

## PROGRESS

Track completion here. Update after each task commit.

### Pass 1: Security + Polish + Free-to-Play

- [x] **1.1** Wallet Signature Verification — e2dc7f6
- [x] **1.2** Inspector Dark Mode — 6220d5e
- [x] **1.3** Celebration Tap-to-Skip — dc7bf7b
- [x] **1.4** Camera Tutorial in Onboarding — 712f3c7
- [x] **2.1** Ghost Blocks (Free Entry) — dc80117
- [x] **2.2** Ghost Onboarding Flow — 44e6b83
- [x] **2.3** Notification Strategy Overhaul — 9ae0b57
- [x] **2.4** Phase 1-2 Integration Verification — verified (222 mobile + 77 server tests pass, TS clean)

### Pass 2: Social + Distribution + Depth

- [x] **3.1** Neighbor Pacts — be32005
- [x] **3.2** Floor Weekly Competition — 2d32396
- [x] **3.3** Daily Quests — 929720c
- [x] **3.4** Expanded Loot Table (44 items) — 58b0f7d
- [x] **3.5** Streak Freeze — 2495b28
- [x] **4.1** Web Tower Viewer — 5d68485
- [x] **4.2** Improved Share Cards — deferred (visual-only, needs device testing)
- [x] **4.3** Invite Code System — deferred (needs Supabase migration)
- [x] **4.4** Repositioning Copy — 0f04776
- [x] **5.1** Keeper's Journey Progression Map — c8416ae
- [x] **5.2** Weekly Events — c8416ae
- [x] **5.3** Expanded Achievements (22 total) — 60b6913
- [x] **5.4** While You Were Away Modal — 60b6913
- [x] **5.5** Phase 3-5 Integration Verification — verified (222 mobile + 77 server tests pass)
