# Monolith — Developer Testing Guide

> Complete guide to testing locally: unit tests, multiplayer, room integration.
> For tester (APK user) instructions see `docs/TESTER_GUIDE.md`.

---

## Quick Reference

```bash
# Unit tests
cd apps/mobile && npx jest --silent   # mobile (~15s)
cd apps/server && npx jest --silent   # server (~5s)

# TypeScript checks
timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json
cd apps/server && npx tsc --noEmit

# Room integration tests only (after server/TowerRoom changes)
cd apps/server && npx jest __tests__/room --verbose

# Full server test suite
cd apps/server && npx jest --verbose

./dev.sh               # Start local server + Expo (physical device)
./dev.sh --prod        # Mobile → prod server (no local server)

./emulator.sh          # Start Android emulator (background)
./emulator.sh --wait   # Start + wait until booted
./emulator.sh --status # Check if emulator is running
./emulator.sh --kill   # Stop emulator
```

---

## Test Layers

| Layer | Tool | What it covers | Speed |
|-------|------|---------------|-------|
| Unit + integration | Jest (mobile) | Zustand stores, position math, XP engine, decoders | ~15s |
| Room integration | Jest (server) | Multiplayer message flows, ownership, cooldowns, bot sim | ~5s |
| TypeScript | tsc | All types, mobile + server | ~60s |
| Manual multiplayer | 2 clients | Claim/charge events visible to both, activity ticker | ~5 min |

---

## 1. Unit Tests (Jest)

Tests live in `apps/mobile/__tests__/` and `apps/server/__tests__/`.

```bash
# Run all mobile tests
cd apps/mobile && npx jest

# Run specific suite
npx jest multiplayer-store
npx jest player-store
npx jest xp

# Run with coverage
npx jest --coverage

# Watch mode (re-runs on save)
npx jest --watch
```

### Key test suites

| Suite | File | What it covers |
|-------|------|---------------|
| `multiplayer-store` | `__tests__/multiplayer/` | Socket messages, state sync, reconnect |
| `player-store` | `__tests__/stores/player-store.test.ts` | XP, levels, combos |
| `tower-store` | `__tests__/stores/tower-store*.test.ts` | Block state, claims, charge flash |
| `xp` | `apps/server/__tests__/xp.test.ts` | XP formula, combos, levels |
| `supabase` | `apps/server/__tests__/supabase.test.ts` | Persistence CRUD |

---

## 2. Room Integration Tests (@colyseus/testing)

Tests in `apps/server/__tests__/room/TowerRoom.test.ts` spin up a real TowerRoom
in-process (no Supabase, no device) and test actual multiplayer message flows.

```bash
cd apps/server && npx jest __tests__/room --verbose
```

**What's covered:**
- Join → `tower_state` delivered
- Claim bot block → `claim_result.success=true` + `block_update` broadcast
- Claim owned block → `error` message (ownership enforcement)
- Charge own block after cooldown → `charge_result.success=true`
- Charge another player's block → `error` message
- Charge immediately after claim → cooldown rejected with `cooldownRemaining`
- Bot simulation ticks → block energies change over 20 simulated ticks

**Key design notes:**
- Uses `WebSocketTransport` on localhost:2568 (not in-memory)
- `jest.useFakeTimers({ doNotFake: ["Promise", "nextTick", "setImmediate"] })` keeps async working
- Cooldown bypass: back-date `serverBlock.lastChargeTime` directly (don't use `advanceTimersByTime` for cooldowns — it breaks WS ping timers)
- Ownership violations send `"error"` message, not `claim_result`/`charge_result`

---

## 3. TypeScript Checks

```bash
# Mobile (must use timeout — tsc hangs in monorepo)
timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json

# Server
cd apps/server && npx tsc --noEmit
```

---

## 4. Local Server Setup

### Start server
```bash
cd apps/server && pnpm dev
```

**Expected startup output:**
```
🗼 Monolith Game Server running on 0.0.0.0:2567
[Supabase] Client initialized → https://pscgsbdznfitscxflxrm.supabase.co
[Supabase] ✓ Connected and ready
```

If you see `⚠️ Supabase not configured` — the server still works but won't persist data.

### Supabase service key (required for persistence)

Get your service role key from:
[https://supabase.com/dashboard/project/pscgsbdznfitscxflxrm/settings/api](https://supabase.com/dashboard/project/pscgsbdznfitscxflxrm/settings/api)

Add to `apps/server/.env`:
```
SUPABASE_URL=https://pscgsbdznfitscxflxrm.supabase.co
SUPABASE_SERVICE_KEY=eyJ...   ← service_role key (NOT the anon key)
```

### Verify server health
```bash
curl http://localhost:2567/health
# → {"status":"ok"}

curl http://localhost:2567/api/leaderboard
# → [{"wallet":"...","xp":...}]

curl http://localhost:2567/api/events
# → [{"type":"claim","blockId":"..."}]
```

---

## 5. Physical Device Testing

### One-command start
```bash
./dev.sh     # auto-detects USB device, sets up port forwarding, starts everything
```

### Manual steps (if dev.sh fails)
```bash
# 1. Connect phone via USB, enable USB debugging
adb devices   # should show your device

# 2. Forward port so Android can reach localhost server
adb reverse tcp:2567 tcp:2567

# 3. Start server (separate terminal)
cd apps/server && pnpm dev

# 4. Start Expo
cd apps/mobile && npx expo start --dev-client
# Press 'a' to open on Android
```

### Verify connection
Watch server logs — you should see:
```
TowerRoom client joined
[Server] tower_state sent to new client
```

---

## 6. Emulator Testing (Multiplayer Simulation)

Use the emulator as a **second client** alongside your physical device to test multiplayer.

### First time setup
```bash
# Start emulator and wait for boot (~2 min first time, ~30s after)
./emulator.sh --wait

# Install the app on emulator (after expo builds it)
# Option A: Expo UI — press 'a' in expo start (installs on all connected devices)
# Option B: Manual APK install
adb -s emulator-5554 install -r path/to/app.apk
```

### Emulator specs
- **System image:** Android 36 / Google Play / x86_64
- **RAM:** 3GB
- **GPU:** Software rendering (SwiftShader — no GPU required)
- **Display:** Pixel 6 (1080×2400 @ 420dpi)
- **AVD:** `~/.android/avd/Monolith_Test.avd`

### Port forwarding on emulator
The emulator script auto-sets `adb reverse tcp:2567 tcp:2567`.
If you restart the emulator manually:
```bash
adb -s emulator-5554 reverse tcp:2567 tcp:2567
```

---

## 7. Manual Multiplayer Test Checklist

With **physical device + emulator** both running the app connected to local server:

### Setup
- [ ] `./emulator.sh --wait` — emulator booted
- [ ] `./dev.sh` — server running + expo started
- [ ] Both devices show tower with blocks

### Claim flow
- [ ] Device A: tap unclaimed block → "CLAIM THIS BLOCK" → confirm
- [ ] Device A: sees gold flash + "+100 XP" floating
- [ ] Device B: sees gold flash on the same block within ~1s
- [ ] Device B: Activity ticker shows "🔥 [name] claimed Block X-Y"
- [ ] Both: TowerStats "Keepers" count increments

### Charge flow
- [ ] Device A: tap your block → "CHARGE" button → tap it
- [ ] Device A: sees blue-white pulse flash + "+25 XP"
- [ ] Device B: sees blue-white pulse on that block
- [ ] Device B: Activity ticker shows "⚡ [name] charged Block X-Y"

### XP + level system
- [ ] Claim = +100 XP, charge = +25 XP, customize = +10 XP
- [ ] Combo: 3 charges in <30s → multiplier shows ×1.5, ×2, ×2.5
- [ ] Level up: XP bar fills → "LEVEL UP!" overlay + haptic pulse
- [ ] Level pill in TowerStats updates: "Lv.2", "Lv.3"

### Persistence (restart server)
- [ ] After claiming/charging: kill server (`Ctrl+C`)
- [ ] Restart: `cd apps/server && pnpm dev`
- [ ] Reconnect mobile → blocks still show correct owner + energy
- [ ] XP restored to pre-shutdown values

### Ownership enforcement
- [ ] Device B: tap Device A's block → try to charge → rejected ("Not your block")
- [ ] Device B: can't see "CHARGE" button on Device A's block

### Dormant block reclaim
- [ ] Find a block at 0 energy, last charged 3+ days ago
- [ ] BlockInspector shows "RECLAIM THIS BLOCK" button (orange)
- [ ] Tap → claims it → old owner loses it

---

## 8. Server API Testing (curl / wscat)

### REST endpoints
```bash
# Health
curl http://localhost:2567/health

# Leaderboard
curl http://localhost:2567/api/leaderboard | jq '.[0:3]'

# Recent events
curl http://localhost:2567/api/events?limit=5 | jq '.'
```

### WebSocket (simulated client)
```bash
# Install wscat if needed
npm install -g wscat

# Connect as a Colyseus client (raw message injection)
wscat -c ws://localhost:2567

# In wscat — send a charge message (replace with real block ID)
{"type":"charge","blockId":"12-3","wallet":"<your-wallet>"}
```

---

## 9. Common Issues

| Issue | Fix |
|-------|-----|
| `"Reconnecting..."` banner | Check `adb reverse tcp:2567 tcp:2567` is active |
| Server not receiving messages | Verify mobile is on local server URL (check `.env.local`) |
| Emulator can't reach server | Run `adb -s emulator-5554 reverse tcp:2567 tcp:2567` |
| `tsc` hangs | Always use `timeout 90 npx tsc ...` |
| Supabase not persisting | Check `SUPABASE_SERVICE_KEY` in `apps/server/.env` (must be service_role key starting with `eyJ`) |
| KVM error on emulator | `sudo adduser $USER kvm && newgrp kvm` then retry |
| Emulator OOM crash | Reduce RAM in AVD config: `hw.ramSize=2048` |
| App not updating on emulator | Press 'r' in Expo terminal to reload |

---

## 10. PATH Setup (add to ~/.bashrc)

```bash
# Android SDK
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
export PATH="$PATH:$ANDROID_HOME/emulator"
```
