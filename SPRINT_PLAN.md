# Monolith Pre-Testing Sprint Plan

> **Goal:** Get the app ready for 3-5 Android testers with a real, retentive gameplay loop.
> **Deadline:** March 9, 2026 (13 days from plan creation: Feb 24).
> **Success criteria:** Testers understand what to do, come back day 2, think it's fun, see each other's changes.
> **Narrative hook:** *"This tower is shared. Own a piece. Defend it daily."*

---

## Current State (as of Feb 24)

**Working:** 3D tower (650 blocks, 60 FPS), MWA wallet connect, claim/charge/customize, bot simulation, Colyseus multiplayer (Railway), sound effects + haptics, HotBlockTicker, AchievementToast, LoadingScreen, EAS preview build pipeline.

**Tests:** 278 passing (207 mobile + 71 server), zero TypeScript errors.

**Branches:** All merged to `main`. No pending branches.

**Key issues blocking tester readiness:**
1. HUD disappears after first claim celebration (doesn't reappear)
2. Customization doesn't persist to Supabase or broadcast to other players
3. No poke/social mechanic — no reason to return
4. Leaderboard shows no real data
5. No player identity (just wallet addresses)
6. Onboarding doesn't teach the loop
7. Push notifications not wired end-to-end
8. No "My Blocks" management panel
9. Activity feed not wired to real multiplayer events

---

## Architecture Notes

### Server Message Protocol (Colyseus, JSON)

**Existing client→server messages:** `claim`, `charge`, `customize`, `request_state`, `register_push_token`

**Existing server→client messages:** `tower_state`, `block_update`, `charge_result`, `claim_result`, `customize_result`, `player_sync`, `error`

**New messages needed:**
- Client→server: `poke { blockId: string, wallet: string }`
- Server→client: `poke_result { success: boolean, message?: string }`
- Server→client: `poke_received { fromName: string, blockId: string, energyAdded: number }`

### Database Schema (Supabase)

**Existing tables:** `blocks`, `players`, `events`, `push_tokens` (migration pending), `notification_log` (migration pending)

**Schema changes needed:**
- `players` table: add `username TEXT` column (for display names)
- `events` table: add `"poke"` as valid event type
- New migration: `003_player_username_and_pokes.sql`

### Key Files

| Area | Files |
|------|-------|
| Server room | `apps/server/src/rooms/TowerRoom.ts` |
| Server tests | `apps/server/__tests__/room/TowerRoom.test.ts` |
| Multiplayer store | `apps/mobile/stores/multiplayer-store.ts` |
| Tower store | `apps/mobile/stores/tower-store.ts` |
| Main screen | `apps/mobile/app/(tabs)/index.tsx` |
| Block inspector | `apps/mobile/components/ui/BlockInspector.tsx` |
| Onboarding | `apps/mobile/components/onboarding/OnboardingFlow.tsx` |
| Player store | `apps/mobile/stores/player-store.ts` |
| Wallet store | `apps/mobile/stores/wallet-store.ts` |
| Activity store | `apps/mobile/stores/activity-store.ts` |
| Achievement store | `apps/mobile/stores/achievement-store.ts` |
| Leaderboard modal | `apps/mobile/components/ui/LeaderboardModal.tsx` |
| Theme constants | `apps/mobile/constants/theme.ts` |
| Audio utils | `apps/mobile/utils/audio.ts` |
| Haptics utils | `apps/mobile/utils/haptics.ts` |
| Common types | `packages/common/src/types.ts` |
| Notifications | `apps/mobile/utils/notifications.ts`, `apps/server/src/utils/notifications.ts` |
| Push tokens | `apps/server/src/utils/push-tokens.ts` |

---

## Phase 1: Critical Fixes (must ship first, blocks all other phases)

### Task 1.1 — Fix HUD reappear bug after first claim

**Problem:** After the first claim celebration (cinematic mode), the HUD (top bar, stats, ticker) doesn't come back. Only happens on first claim after app launch.

**Root cause investigation:**
- `cinematicMode` in `tower-store.ts` controls the hide/show
- `cinematicAnim` spring in `index.tsx` drives opacity/translateY
- Likely: `cinematicMode` is set to `true` during celebration but never set back to `false`, or the `useClaimCelebration` hook doesn't fire the reset callback on first run

**Files to check:**
- `apps/mobile/hooks/useClaimCelebration.ts` — look for `setCinematicMode(false)` timing
- `apps/mobile/stores/tower-store.ts` — `cinematicMode` setter and `recentlyClaimedId` lifecycle
- `apps/mobile/app/(tabs)/index.tsx` — `cinematicAnim` spring animation

**Fix:** Ensure `cinematicMode` resets to `false` after celebration completes. Add a safety timeout (e.g., 8s max) that forces reset even if animation callbacks fail.

**Test:** Unit test in `useClaimCelebration.test.ts` — verify `cinematicMode` resets to `false` after celebration sequence completes.

### Task 1.2 — Fix customization persistence + multiplayer broadcast

**Problem 1: Persistence.** `customizeBlock()` in `tower-store.ts` updates local state but check if `persistBlocks()` properly writes appearance data (color, emoji, name, style) to Supabase via the server's `upsertBlock()`.

**Problem 2: Broadcast.** When a player customizes in multiplayer, the server's `customize` message handler sends `block_update` with `eventType: "customize"` — verify that the update includes ALL appearance fields (color, emoji, name, style, textureId) and that other clients' `multiplayer-store.ts` applies them correctly.

**Problem 3: UX.** Color picker and emoji picker need to be usable. Color picker should offer the design system palette. Emoji picker should be a grid of ~30 presets (not a full keyboard emoji picker).

**Files:**
- `apps/mobile/components/ui/BlockInspector.tsx` — customization UI
- `apps/mobile/components/ui/ColorPicker.tsx` — color selection
- `apps/server/src/rooms/TowerRoom.ts` — `customize` handler (line ~445)
- `apps/mobile/stores/multiplayer-store.ts` — `block_update` handler (line ~348)

**Tests:**
- Colyseus integration test: customize broadcasts to other clients with all fields
- Unit test: `tower-store.ts` customizeBlock persists all appearance fields

### Task 1.3 — Wire activity-store to multiplayer events

**Problem:** `ActivityFeed` component shows nothing because `activity-store` is never populated.

**Fix:** In `multiplayer-store.ts`, when receiving `block_update` messages, construct an `ActivityEvent` and call `useActivityStore.getState().addEvent(...)`.

**Message-to-event mapping:**
- `block_update` with `eventType: "claim"` → `"PlayerName claimed a block on Layer X!"`
- `block_update` with `eventType: "charge"` → `"PlayerName charged their block on Layer X"`
- `block_update` with `eventType: "customize"` → `"PlayerName customized their block on Layer X"`
- Future: `poke_received` → `"PlayerName poked your block! +10% energy"`

**Files:**
- `apps/mobile/stores/multiplayer-store.ts` — add `useActivityStore` import, dispatch events in `block_update` handler
- `apps/mobile/stores/activity-store.ts` — already has `addEvent()`

**Test:** Unit test: verify `block_update` message triggers `addEvent` with correct message string.

---

## Phase 2: Player Identity

### Task 2.1 — Username system (Supabase-backed)

**Problem:** Players see wallet addresses (0x1a2b...3c4d). Need display names.

**Implementation:**
1. Add `username TEXT` column to `players` table (new migration `003_player_username.sql`)
2. Server: new message handler `set_username { wallet, username }` → validates (3-20 chars, alphanumeric + underscore, unique), writes to Supabase
3. Server: include `username` in `player_sync` message and in `tower_state` block data
4. Mobile: `wallet-store.ts` or `player-store.ts` gains `username` field
5. Mobile: on first wallet connect, if no username set, show a modal: "Choose your name" with text input
6. Mobile: `BlockInspector` shows username instead of truncated address
7. Mobile: `LeaderboardModal` shows username
8. Mobile: `ActivityFeed` uses username in event messages

**Note on .skr:** MWA does NOT provide the Seeker username via `authorize()`. A future enhancement could query Solana Name Service (SNS) to resolve `.skr` domains, but for now, app-stored usernames are the pragmatic path.

**Files:**
- New: `supabase/migrations/003_player_username.sql`
- `apps/server/src/rooms/TowerRoom.ts` — `set_username` handler, include username in state
- `apps/mobile/stores/player-store.ts` — username field
- `apps/mobile/components/ui/UsernameModal.tsx` — new component
- `apps/mobile/app/_layout.tsx` — show modal after wallet connect if no username

**Tests:**
- Colyseus: `set_username` validates, persists, broadcasts
- Colyseus: duplicate username rejected
- Unit: player-store username setter

---

## Phase 3: Poke Mechanic (the social hook)

### Task 3.1 — Server-side poke handler

**Spec:**
- Client sends: `poke { blockId: string, wallet: string }`
- Server validates: block exists, block has an owner, owner != sender, sender hasn't poked this block in 24h
- On success: add 10% energy to target block (capped at MAX_ENERGY), award 15 XP to poker, broadcast `block_update`, send `poke_result { success: true }` to poker, send `poke_received` to pokee if online
- On failure: send `error { message }` to poker
- Cooldown: 1 poke per block per 24h per poker (tracked in-memory Map, keyed by `${poker_wallet}:${blockId}`)
- Supabase: insert event type `"poke"` into `events` table
- Push notification: trigger for pokee (uses existing notification infrastructure)

**Files:**
- `apps/server/src/rooms/TowerRoom.ts` — new `onMessage("poke", ...)` handler
- `apps/server/src/utils/notifications.ts` — add poke notification type
- `packages/common/src/types.ts` — add `PokeMessage` type

**Tests (Colyseus integration):**
- Can poke another player's block → energy increases, poker gets XP, broadcast sent
- Cannot poke own block → error
- CAN poke bot blocks (most blocks are bot-owned in early testing — lets testers interact with more of the tower)
- Cooldown enforced: second poke within 24h fails
- Multiple clients: pokee receives `poke_received` message

### Task 3.2 — Mobile poke UI

**Spec:**
- In `BlockInspector`, when viewing a block owned by someone ELSE (including bots):
  - Show "Poke" button with 👉 icon
  - On tap: send poke message, play SFX (`playButtonTap` or new poke sound), haptic feedback
  - Show result: "Poked! +10% energy sent" or error
  - If on cooldown: show "Poked today" with timer to next poke
- Poke cooldown tracked in `poke-store.ts` (simple Map<blockId, lastPokeTime>, persisted to AsyncStorage)

**Files:**
- `apps/mobile/components/ui/BlockInspector.tsx` — add poke button
- New: `apps/mobile/stores/poke-store.ts` — cooldown tracking
- `apps/mobile/stores/multiplayer-store.ts` — send `poke` message, handle `poke_result` and `poke_received`
- `apps/mobile/utils/audio.ts` — add poke SFX if desired (can reuse `playButtonTap`)

**Tests:**
- Unit: poke-store cooldown logic
- Unit: poke button shown only for others' blocks

### Task 3.3 — Wire poke to push notifications

**Spec:** When a poke succeeds, the server sends a push notification to the pokee:
- Title: "You got poked!"
- Body: "{pokerName} poked your block on Layer {layer}! +10% energy"
- Only if pokee has registered a push token

**Files:**
- `apps/server/src/utils/notifications.ts` — add `sendPokeNotification()`
- `apps/server/src/rooms/TowerRoom.ts` — call from poke handler

**Test:** Colyseus: verify notification mock is called with correct args after poke.

---

## Phase 4: My Blocks Panel

### Task 4.1 — My Blocks bottom sheet

**Spec:**
- Accessible from HUD: small icon/button near top bar (e.g., grid icon or "My Blocks" text)
- Opens a bottom sheet / modal listing all blocks owned by the current wallet
- Each block row shows:
  - Layer number + block position
  - Energy bar (green >60%, yellow 20-60%, red <20%, styled with theme colors)
  - Streak badge (if streak > 0, show "🔥 3d" etc.)
  - "Charge" button (respects cooldown, shows countdown timer if cooling down)
- Tapping the block row (not the charge button) navigates the camera to that block + selects it
- Empty state: "You don't own any blocks yet. Tap a block on the tower to claim it!"

**Files:**
- New: `apps/mobile/components/ui/MyBlocksPanel.tsx`
- `apps/mobile/app/(tabs)/index.tsx` — add trigger button in HUD top bar
- `apps/mobile/stores/tower-store.ts` — selector: `getMyBlocks(wallet)` returns filtered + sorted demoBlocks

**Tests:**
- Unit: `getMyBlocks` selector returns correct blocks for wallet
- Unit: charge button respects cooldown

---

## Phase 5: Real Leaderboard

### Task 5.1 — Server leaderboard endpoint

**Spec:**
- Server HTTP endpoint: `GET /leaderboard?tab=xp|energy|streak&limit=50`
- Queries Supabase:
  - `xp` tab: `SELECT wallet, username, xp FROM players ORDER BY xp DESC LIMIT 50`
  - `energy` tab: aggregate from blocks table: `SELECT owner, SUM(energy) as total_energy FROM blocks GROUP BY owner ORDER BY total_energy DESC LIMIT 50`
  - `streak` tab: `SELECT owner, MAX(streak) as best_streak FROM blocks GROUP BY owner ORDER BY best_streak DESC LIMIT 50`
- Returns: `{ entries: LeaderboardEntry[], myRank?: number }`

**Files:**
- `apps/server/src/index.ts` — add Express route `/leaderboard`
- `apps/server/src/utils/supabase.ts` — add query functions

**Tests:**
- Unit: leaderboard query functions with mocked Supabase

### Task 5.2 — Mobile leaderboard UI

**Spec:**
- `LeaderboardModal` already exists — update it to:
  - Fetch from server `/leaderboard` endpoint
  - Show 3 tabs: XP, Energy, Streak
  - Show username (with fallback to truncated address)
  - Highlight current player's row
  - Show "Your rank: #X" at bottom
- Fetch on modal open, cache for 30s

**Files:**
- `apps/mobile/components/ui/LeaderboardModal.tsx` — rework to use real data
- `apps/mobile/stores/activity-store.ts` — `setLeaderboard()` already exists

**Tests:**
- Unit: leaderboard data parsing, tab switching

---

## Phase 6: Push Notifications End-to-End

### Task 6.1 — Run `supabase db push`

**Prerequisites:** Supabase CLI + access token. User runs this manually:
```bash
npx supabase link --project-ref pscgsbdznfitscxflxrm
npx supabase db push
```
This creates `push_tokens` and `notification_log` tables.

Also push migration `003_player_username.sql` (from Phase 2).

### Task 6.2 — Device token registration

**Current state:** `registerForPushNotifications()` exists in `utils/notifications.ts` and is called somewhere. Verify:
- Token is sent to server via `register_push_token` message
- Server stores in Supabase `push_tokens` table
- Token is refreshed on app launch

**Files:**
- `apps/mobile/utils/notifications.ts` — verify registration flow
- `apps/server/src/utils/push-tokens.ts` — verify storage

### Task 6.3 — Notification triggers

**Three triggers needed:**

1. **Low energy (20%):** In server's bot simulation loop or a periodic check, scan blocks. If any player-owned block drops below 20% energy, send push: "Your block on Layer X is fading! Charge it before someone claims it." Throttle: max 1 per block per day.

2. **Poke received:** Already wired in Phase 3.

3. **Daily charge reminder:** Server cron (or `setInterval` since it's a single-process server): at 9 AM UTC, check all player-owned blocks that haven't been charged today. Send: "Don't lose your streak! Charge your blocks today." Throttle: max 1 per player per day.

**Files:**
- `apps/server/src/rooms/TowerRoom.ts` — low energy check in energy decay
- `apps/server/src/index.ts` — daily reminder interval
- `apps/server/src/utils/notifications.ts` — notification templates

**Tests:**
- Colyseus: low energy notification triggers at 20% threshold
- Unit: daily reminder query logic

---

## Phase 7: Onboarding Rework

### Task 7.1 — New onboarding flow

**Current:** `OnboardingFlow.tsx` has phases (title → explore → claim → done). Needs rework for new narrative.

**New flow:**
1. **Majestic reveal (3s):** Camera slowly orbits the tower from a high angle. Title fades in: "THE MONOLITH". Subtitle: "650 blocks. Real people. Real stakes."
2. **Stakes message (tap to continue):** "This tower is shared. Own a piece. Defend it daily."
3. **Claim prompt:** Camera zooms to a random unclaimed block. Coach mark: "Tap to claim your first block." Player taps → claim flow runs.
4. **Post-claim celebration:** Existing celebration VFX plays. Text: "This block is yours. Charge it daily or lose it."
5. **Poke prompt:** Camera pans to a neighboring owned block. Coach mark: "Poke a neighbor — give them energy." Player taps poke → animation plays.
6. **Done:** "You're in. Check back tomorrow to keep your streak." → dismiss onboarding.

**Skip button** visible on all screens for returning players.

**Files:**
- `apps/mobile/components/onboarding/OnboardingFlow.tsx` — rework phases
- `apps/mobile/stores/onboarding-store.ts` — update phase names
- `apps/mobile/components/onboarding/TitleReveal.tsx` — update copy
- New: `apps/mobile/components/onboarding/MajesticReveal.tsx` — auto-orbit camera component

**Tests:**
- Unit: onboarding-store phase transitions
- Manual: verify on device (creative/visual, hard to unit test)

---

## Phase 8: Block Reclaim Mechanic (the stakes)

### Task 8.1 — Server-side dormant block reclaim

**Problem:** Without consequences for not charging, the game has no stakes. Dormant blocks (0 energy for 3+ consecutive days) should become claimable by anyone.

**Spec:**
- A block is "dormant" when: `energy === 0` AND `lastChargeTime` is 3+ days ago (72 hours)
- Dormant blocks get a visual indicator (e.g., cracked/dark shader variant, or a subtle skull overlay)
- When a player claims a dormant block: it's a "reclaim" — previous owner loses it, new owner gets it at full energy
- Server already has `wasReclaim` logic in the claim handler — verify it works end-to-end
- Push notification to previous owner: "Your block on Layer X was claimed by {playerName}! Claim another before it's too late."

**Files:**
- `apps/server/src/rooms/TowerRoom.ts` — verify reclaim logic in `claim` handler
- `apps/mobile/stores/tower-store.ts` — `isDormant(block)` helper
- `apps/mobile/components/tower/BlockShader.ts` — visual indicator for dormant blocks
- `apps/mobile/components/ui/BlockInspector.tsx` — show "Claimable!" badge on dormant blocks

**Tests:**
- Colyseus: block at 0 energy for 72h+ can be claimed by another player
- Colyseus: block at 0 energy for <72h cannot be reclaimed
- Unit: `isDormant()` helper returns correct values

## Phase 9: Deposit/Withdraw Flow

### Task 9.1 — Verify deposit/withdraw works on devnet

**Current state:** `useStaking.ts` has deposit/withdraw logic using the Anchor program. The smart contract has security issues (missing mint constraint) but these don't affect devnet testing since the app hardcodes `DEVNET_USDC_MINT`.

**Spec:**
- Deposit: player deposits USDC to claim a block (amount stored in `stakedAmount`)
- Withdraw: player can withdraw their USDC from any owned block
- Faucet screen: allows getting devnet USDC for testing (already exists at `/faucet`)
- Verify: the full flow works end-to-end on devnet (faucet → deposit → claim → withdraw)

**Files:**
- `apps/mobile/hooks/useStaking.ts` — deposit/withdraw logic
- `apps/mobile/app/deposit.tsx` — deposit screen
- `apps/mobile/app/withdraw.tsx` — withdraw screen
- `apps/mobile/app/faucet.tsx` — devnet faucet

**Tests:**
- Manual on-device test (requires devnet RPC + wallet)
- Verify error handling: insufficient balance, transaction failure, timeout

### Task 9.2 — Connect deposit to claim flow

**Spec:** When a player claims a block:
1. If wallet connected: prompt for USDC deposit amount (minimum 0.01 USDC)
2. Execute on-chain deposit transaction
3. On success: send `claim` message to server with `amount`
4. Block shows staked amount in `BlockInspector`

Verify this flow is wired correctly. If the claim currently works without deposit (demo mode), ensure the deposit step is added when wallet is connected.

## Phase 10: Settings Screen Cleanup

### Task 10.1 — Settings screen polish

**Current state:** Settings tab exists at `apps/mobile/app/(tabs)/settings.tsx`. Review and fix:
- Show player info: username, wallet address, XP, level
- Show owned blocks count
- Audio on/off toggle (tied to `audio.ts`)
- Haptics on/off toggle
- "Reset onboarding" button (dev/test utility)
- Link to faucet (for devnet testing)
- App version number
- Consistent with glass/solarpunk design system

**Files:**
- `apps/mobile/app/(tabs)/settings.tsx`

**Tests:**
- Smoke: renders without crash

## Phase 11: UI Polish (time permitting)

### Task 8.1 — Consistent SFX on new interactions
- Poke: use existing `playButtonTap` or add dedicated poke SFX
- My Blocks panel open: `playPanelOpen`
- Leaderboard open: `playPanelOpen`
- Charge from My Blocks: `playChargeTap`

### Task 8.2 — Better celebration particles
- Particles spawn from claimed block's screen position, not center
- Shockwave ring emanates from block

### Task 8.3 — Holographic block visuals (LOW PRIORITY)
- Preset image textures rendered into block faces via texture atlas
- Shader modification for holographic shimmer effect
- Only attempt if all other phases complete

---

## Smart Contract (NOT blocking testing)

The on-chain program has a missing mint constraint on deposit/withdraw. This is a **critical security fix for mainnet** but does NOT block devnet testing because:
- The mobile app hardcodes `DEVNET_USDC_MINT`
- No real money at stake on devnet
- Fix is documented in `docs/SMART_CONTRACT_FIX_PLAN.md`

**Action:** Apply the fix, run `anchor test`, redeploy to devnet, update mobile IDL — but do this AFTER the gameplay sprint, not during.

---

## Testing Strategy

### For every feature:
1. **Unit tests** for stores, utils, selectors (Jest)
2. **Colyseus integration tests** for all server message handlers (Jest + `@colyseus/testing`)
3. **TypeScript** must stay zero-error (`timeout 90 npx tsc --noEmit`)

### Test commands:
```bash
cd apps/mobile && npx jest          # 207+ tests
cd apps/server && npx jest          # 71+ tests
timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json
cd apps/server && npx tsc --noEmit
```

### Before each EAS build — manual checklist:
- [ ] Launch app → see tower render
- [ ] Onboarding completes
- [ ] Claim a block → celebration plays → HUD reappears
- [ ] Charge the block → energy increases, SFX plays
- [ ] Customize block (color, emoji) → persists on restart
- [ ] Poke someone's block → they see energy increase
- [ ] Leaderboard shows real data
- [ ] Push notification received (low energy or poke)

---

## Branching Strategy

**All work goes on a single feature branch: `feat/pre-testing-sprint`.** User reviews the full diff before merging to main.

```
main (stable, tested baseline)
└── feat/pre-testing-sprint   ← ALL phases committed here, one commit per task
```

**Workflow:**
1. Create branch once: `git checkout -b feat/pre-testing-sprint`
2. Implement each task, commit with conventional commit message
3. Run full test suite after each task — do NOT proceed if tests fail
4. When all phases are complete, push branch for review: `git push -u origin feat/pre-testing-sprint`
5. **User reviews the full diff**, then merges to main when satisfied

**DO NOT merge to main. DO NOT push to main. Only push the feature branch.**

---

## Implementation Order for Ralph

Ralph should work through these tasks in this exact order. Each task must pass all existing tests + new tests before moving to the next. **Each phase must be on its own branch.**

```
Phase 1.1  → Fix HUD reappear bug
Phase 1.2  → Fix customization persistence + broadcast
Phase 1.3  → Wire activity-store to multiplayer events
Phase 2.1  → Username system (migration + server + mobile)
Phase 3.1  → Poke server handler + Colyseus tests
Phase 3.2  → Poke mobile UI
Phase 3.3  → Poke push notification
Phase 4.1  → My Blocks panel
Phase 5.1  → Leaderboard server endpoint
Phase 5.2  → Leaderboard mobile UI
Phase 6.2  → Push notification device token verification
Phase 6.3  → Push notification triggers (low energy, daily reminder)
Phase 7.1  → Onboarding rework
Phase 8.1  → Dormant block reclaim mechanic
Phase 9.1  → Verify deposit/withdraw on devnet
Phase 9.2  → Connect deposit to claim flow
Phase 10.1 → Settings screen cleanup
Phase 11.x → UI polish (SFX, particles, celebration)
```

All commits stay on `feat/pre-testing-sprint`. User merges to main after review.

**Phase 6.1 (supabase db push) must be done manually by the user before Phase 2.1 and Phase 6.x can work.**

---

## Ralph Loop Start Command

Start Ralph with:
```
/ralph-loop
```

When prompted for the task, use:

```
Implement the Monolith pre-testing sprint plan.

CRITICAL INSTRUCTIONS:
1. Read SPRINT_PLAN.md FIRST — it contains the complete plan with specs, files, and tests for every task.
2. Read CONTEXT.md for project state, gotchas, and file map.
3. Read docs/LESSONS.md for known pitfalls.

BRANCHING:
- All work goes on ONE branch: feat/pre-testing-sprint
- If the branch doesn't exist yet: git checkout -b feat/pre-testing-sprint
- If it already exists: git checkout feat/pre-testing-sprint
- DO NOT merge to main. DO NOT push to main. Only commit to this branch.
- Push the feature branch periodically: git push -u origin feat/pre-testing-sprint

WORKFLOW PER TASK:
- Read the relevant files BEFORE modifying them
- Implement the fix/feature per the spec in SPRINT_PLAN.md
- Write tests: unit tests for stores/utils, Colyseus integration tests for server handlers
- Run ALL tests: cd apps/mobile && npx jest && cd ../../apps/server && npx jest
- Run TypeScript: timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json && cd apps/server && npx tsc --noEmit
- DO NOT proceed to the next task if tests fail. Fix failures first.
- Commit each completed task with a conventional commit message

START WITH Phase 1 (critical fixes).
SKIP Phase 6.1 (supabase db push — requires manual user action).
Work through ALL phases in order until complete.
```
