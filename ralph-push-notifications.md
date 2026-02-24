# Ralph Loop Prompt: Push Notifications System

You are building a push notification system for a React Native / Expo 54 monorepo app.
The project is at `/home/epic/Downloads/monolith`.

## BEFORE WRITING ANY CODE

Read these files first to understand existing patterns:

1. `CONTEXT.md` — project state, gotchas, system dependencies
2. `CLAUDE.md` — agent rules
3. `apps/server/src/rooms/TowerRoom.ts` — game room (claims, charges, decay loop)
4. `apps/server/src/utils/supabase.ts` — fire-and-forget persistence pattern
5. `apps/server/src/utils/xp.ts` — utility module pattern
6. `apps/mobile/stores/multiplayer-store.ts` — Colyseus client, message handlers
7. `apps/mobile/app/_layout.tsx` — root layout
8. `apps/mobile/app.json` — Expo config (needs plugin addition)
9. `apps/mobile/package.json` — dependencies (expo-notifications NOT installed yet)
10. `apps/server/package.json` — server dependencies
11. `supabase/migrations/001_initial.sql` — existing schema
12. `apps/server/__tests__/supabase.test.ts` — test pattern (mock env, dynamic import)
13. `apps/server/__tests__/xp.test.ts` — test pattern (direct import, describe/it)
14. `packages/common/src/constants.ts` — tower dimensions, layout math

## CRITICAL RULES

- **Read every file before modifying it.** Never write blind.
- **pnpm only** — `pnpm add`, never npm or yarn. This is a pnpm workspace monorepo.
- **Fire-and-forget pattern** — all notification sends must be non-blocking, same as supabase.ts writes. Never `await` notifications in the game loop. Log errors, never throw.
- **TypeScript strict** — no `any` unless matching an existing pattern.
- **NEVER modify these files**: `BlockShader.ts`, `TowerGrid.tsx`, `TowerScene.tsx`, `TowerCore.tsx`, `Foundation.tsx`, `Particles.tsx`, or anything in `components/tower/` except if adding a testID.
- **Follow existing patterns** — look at how `supabase.ts`, `xp.ts`, `TowerRoom.ts` are structured before writing new server utils.
- **Colyseus uses JSON messages** — NOT schema auto-sync. See multiplayer-store.ts for the pattern.
- **Supabase writes are fire-and-forget** — `.then()` for error logging, not `await`. See `supabase.ts`.

## WHAT TO BUILD

### Phase 1: Install & Configure (do this first)

1. **Install expo-notifications** in the mobile app:
   ```bash
   cd /home/epic/Downloads/monolith/apps/mobile && pnpm add expo-notifications
   ```

2. **Add to app.json plugins** — add `"expo-notifications"` to the `expo.plugins` array in `apps/mobile/app.json`. Place it after `"expo-updates"`.

3. **Add Android permission** — add `"RECEIVE_BOOT_COMPLETED"` to the `android.permissions` array in `apps/mobile/app.json` (needed for scheduled notifications).

### Phase 2: Supabase Migration

Create `supabase/migrations/002_push_tokens.sql`:

```sql
-- Push notification tokens for players
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL REFERENCES players(wallet) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_push_tokens_wallet ON push_tokens(wallet);

-- RLS: service role only (server manages tokens)
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Notification log to prevent spam (loose throttle)
CREATE TABLE notification_log (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_log_wallet_type ON notification_log(wallet, notification_type, created_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Cleanup old notification logs (keep 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_notification_logs() RETURNS void AS $$
BEGIN
  DELETE FROM notification_log WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Phase 3: Server — Push Token Storage

Create `apps/server/src/utils/push-tokens.ts`:

- `upsertPushToken(wallet: string, token: string): void` — fire-and-forget upsert into push_tokens table
- `removePushToken(token: string): void` — fire-and-forget delete
- `getTokensForPlayer(wallet: string): Promise<string[]>` — returns expo push tokens for a wallet
- `getTokensForPlayers(wallets: string[]): Promise<Map<string, string[]>>` — batch lookup for multiple wallets
- Follow the exact same `getClient()` null-check pattern from `supabase.ts`
- All write operations fire-and-forget with `.then()` error logging

### Phase 4: Server — Notification Sender

Create `apps/server/src/utils/notifications.ts`:

- `sendPushNotification(tokens: string[], title: string, body: string, data?: Record<string, any>): void`
  - Fire-and-forget — uses `fetch()` to POST to `https://exp.host/--/api/v2/push/send`
  - Batch into chunks of 100 (Expo limit per request)
  - Log errors, never throw
  - Set `sound: "default"`, `priority: "high"`

- `sendPlayerNotification(wallet: string, type: string, title: string, body: string, data?: Record<string, any>): void`
  - Looks up tokens for wallet via `getTokensForPlayer()`
  - Checks throttle: queries `notification_log` for this wallet+type in the last 30 minutes
  - If throttled, silently skip (log in __DEV__ only)
  - If not throttled, sends the notification AND inserts a `notification_log` entry
  - All fire-and-forget

- `type NotificationType = "energy_low" | "block_dormant" | "block_reclaimed" | "new_neighbor" | "streak_reminder"`

### Phase 5: Server — Notification Triggers in TowerRoom.ts

Add notification calls to TowerRoom.ts. **Do NOT restructure existing code.** Add calls after existing logic, same pattern as `insertEvent()` calls.

**5a. Energy low warning (in decay loop):**
- Add a counter that increments each decay tick. Every 60 ticks (= ~1 hour at 60s interval), run a "notification check" sweep.
- For each player-owned block with energy <= 20 and energy > 0, call `sendPlayerNotification(block.owner, "energy_low", "Your block is fading!", "Block on floor ${block.layer + 1} is at ${block.energy}% energy. Charge it before it goes dormant!", { blockId: block.id, layer: block.layer, index: block.index })`
- The 30-min throttle in `sendPlayerNotification` prevents spam.

**5b. Block reclaimed (in claim handler):**
- After a successful reclaim (`wasReclaim === true`), look up the PREVIOUS owner (capture `block.owner` before overwriting it).
- Call `sendPlayerNotification(previousOwner, "block_reclaimed", "Your block was reclaimed!", "Someone took your dormant block on floor ${block.layer + 1}. Claim a new one!", { blockId: block.id })`

**5c. New neighbor (in claim handler):**
- After any successful claim, find blocks on the same layer with `index === block.index ± 1` that have a non-bot owner different from the claimer.
- For each neighbor owner, call `sendPlayerNotification(neighborOwner, "new_neighbor", "New neighbor!", "Someone claimed the block next to yours on floor ${block.layer + 1}!", { blockId: block.id })`
- Use `this.state.blocks` to look up neighbors. Block IDs follow the pattern — read `seed-tower.ts` to understand the ID format.

**5d. Daily streak reminder (in decay loop hourly check):**
- During the hourly check sweep, for each player-owned block with `streak >= 3` where `lastStreakDate !== today`:
- Call `sendPlayerNotification(block.owner, "streak_reminder", "Keep your streak alive!", "Your ${block.streak}-day streak on floor ${block.layer + 1} is at risk! Charge your block today.", { blockId: block.id })`

**5e. Block went dormant (in decay loop hourly check):**
- For blocks that just crossed the dormant threshold (energy === 0 AND lastChargeTime is between 3 days ago and 3 days + 1 hour ago — to catch it once):
- Call `sendPlayerNotification(block.owner, "block_dormant", "Your block went dormant!", "Your block on floor ${block.layer + 1} has been dormant for 3 days and can now be reclaimed by anyone.", { blockId: block.id })`

### Phase 6: Server — Register Push Token Handler

Add to TowerRoom.ts `onCreate()` message handlers section:

```typescript
this.onMessage("register_push_token", (client: Client, msg: { wallet: string; token: string }) => {
  try {
    if (!msg.wallet || !msg.token) return;
    upsertPushToken(msg.wallet, msg.token);
    console.log(`[TowerRoom] Push token registered for ${msg.wallet.slice(0, 8)}...`);
  } catch (err) {
    console.error("[TowerRoom] register_push_token error:", err);
  }
});
```

Import `upsertPushToken` from `./utils/push-tokens.js` at the top of TowerRoom.ts.

### Phase 7: Client — Notification Registration Utility

Create `apps/mobile/utils/notifications.ts`:

```typescript
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request push notification permissions and get the Expo push token.
 * Returns null if permission denied or unavailable.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request if not already granted
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[Notifications] Permission not granted");
      return null;
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "d8909ef0-36b3-4c65-aa05-467a3fba6444",
    });

    console.log("[Notifications] Token:", tokenData.data);
    return tokenData.data;
  } catch (err) {
    console.error("[Notifications] Registration failed:", err);
    return null;
  }
}
```

### Phase 8: Client — Send Token on Connect

Modify `apps/mobile/stores/multiplayer-store.ts`:

1. Import `registerForPushNotifications` from `@/utils/notifications`
2. After the room is joined and `set({ connected: true, ... })` is called, add push token registration:

```typescript
// Register push notification token (fire-and-forget)
registerForPushNotifications().then((token) => {
  if (token && room) {
    const wallet = /* get wallet from wallet-store */ undefined;
    if (wallet) {
      room.send("register_push_token", { wallet, token });
    }
  }
}).catch(() => {});
```

To get the wallet, import `useWalletStore` from `@/stores/wallet-store` and use `useWalletStore.getState().publicKey` (check the wallet-store.ts file to find the correct property name — read it first!).

### Phase 9: Client — Handle Notification Taps

Modify `apps/mobile/app/_layout.tsx`:

1. Import `* as Notifications from "expo-notifications"` and `useRouter` from `expo-router`
2. Add a `useEffect` that sets up notification response listeners:
   - When user taps a notification with `data.blockId`, navigate to the home tab and (optionally) select that block
   - For MVP: just navigate to home tab (`router.replace("/(tabs)/")`)
   - Clean up the listener on unmount

### Phase 10: Tests

**Server tests** — create `apps/server/__tests__/notifications.test.ts`:
- Test `sendPushNotification` payload formatting
- Test batching (101 tokens should make 2 fetch calls)
- Test error handling (fetch failure doesn't throw)
- Mock `global.fetch`

**Server tests** — create `apps/server/__tests__/push-tokens.test.ts`:
- Test graceful fallback when Supabase env vars missing (same pattern as supabase.test.ts)
- Test `upsertPushToken` is no-op without env vars
- Test `getTokensForPlayer` returns empty array without env vars

**Server tests** — create `apps/server/__tests__/notification-triggers.test.ts`:
- Test energy low threshold detection (energy = 20 → triggers, energy = 21 → doesn't)
- Test reclaim notification (capture previous owner)
- Test neighbor detection (same layer, adjacent index)
- Test streak reminder (streak >= 3, not charged today)
- Test dormant detection (energy 0, lastChargeTime > 3 days ago)
- For these tests, extract the trigger logic into testable helper functions in `notifications.ts` rather than testing TowerRoom directly.

**Mobile tests** — create `apps/mobile/__tests__/utils/notifications.test.ts`:
- Mock `expo-notifications` module
- Test `registerForPushNotifications` returns token when permission granted
- Test returns null when permission denied
- Test handles errors gracefully

## VERIFICATION LOOP

Run these 4 commands after EVERY significant change. ALL must pass before moving on:

```bash
cd /home/epic/Downloads/monolith && timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json
cd /home/epic/Downloads/monolith/apps/mobile && npx jest --passWithNoTests
cd /home/epic/Downloads/monolith/apps/server && npx tsc --noEmit
cd /home/epic/Downloads/monolith/apps/server && npx jest --passWithNoTests
```

If typecheck hangs, it will be killed at 90s. Fix the errors and re-run.

## PHASE ORDER

Do the phases in order (1 → 10). Run the verification loop after each phase. If a phase breaks verification, fix it before moving to the next phase.

## COMPLETION

When ALL of these are true:
1. All 4 verification commands pass
2. expo-notifications is installed and in app.json plugins
3. Migration file exists at `supabase/migrations/002_push_tokens.sql`
4. Server can store/retrieve push tokens
5. Server sends notifications on: energy low, reclaim, neighbor, streak reminder, dormant
6. Loose throttle prevents notification spam (30-min per type per player)
7. Client registers for notifications and sends token to server
8. Client handles notification taps
9. All new test files pass
10. No existing tests are broken

Output exactly this string:

PUSH_NOTIFICATIONS_COMPLETE
