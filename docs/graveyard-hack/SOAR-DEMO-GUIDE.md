# SOAR Demo Guide — Hackathon Judges

> How to activate, demo, and roll back the MagicBlock SOAR integration.

## Current Status

**Code is integrated but DISABLED by default** (feature flag: `SOAR_ENABLED = false`).

This is intentional — the code compiles and passes all 222+84 tests, but requires a one-time on-chain setup before it can be activated. The setup takes ~5 minutes.

---

## Activation Steps (5 minutes)

### Step 1: Install Solana CLI (if not already)

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
```

### Step 2: Run the setup script

```bash
cd apps/mobile

# This generates a keypair, funds it on devnet, registers the game + leaderboard + 7 achievements
npx ts-node --esm scripts/setup-soar.ts
```

This outputs a JSON config with all on-chain addresses and the authority secret key.

### Step 3: Paste addresses into constants

Open `apps/mobile/services/soar-constants.ts` and replace the placeholder addresses with the ones from the setup script output:

- `SOAR_GAME_ADDRESS`
- `SOAR_LEADERBOARD_ADDRESS`
- `SOAR_AUTHORITY_PUBKEY`
- All 7 `SOAR_ACHIEVEMENTS` addresses
- `SOAR_AUTHORITY_SECRET` bytes
- Set `SOAR_ENABLED = true`

### Step 4: Test locally

```bash
cd apps/mobile && npx expo start --dev-client
```

Connect wallet, claim a block, check console for `[SOAR]` logs.

### Step 5: Deploy

```bash
cd apps/mobile && eas update --branch preview --message "Enable SOAR on-chain leaderboard"
```

---

## Demo Script for Judges

### What SOAR Does (30-second pitch)

"Every time a player claims a block, charges it, or hits a streak milestone, we write that score to an **on-chain leaderboard** and unlock **on-chain achievements** via MagicBlock's SOAR program. Scores are verifiable on Solana Explorer — not just a database entry."

### Live Demo Flow

1. **Connect wallet** (MWA popup)
   - SOAR auto-registers the player on-chain (second MWA approval)
   - Console: `[SOAR] Player registered on-chain successfully`

2. **Claim a block**
   - Score submitted to SOAR leaderboard
   - "First Claim" achievement unlocked
   - Console: `[SOAR] Score submitted: 300 XP, tx: <sig>`
   - Console: `[SOAR] Achievement unlocked: first_claim, tx: <sig>`

3. **Charge the block**
   - Score updated on-chain
   - Console: `[SOAR] Score submitted: 325 XP, tx: <sig>`

4. **Show Solana Explorer**
   - Go to `https://explorer.solana.com/tx/<sig>?cluster=devnet`
   - Show the SOAR program call with the score data

5. **Show the XP leaderboard**
   - Open Board tab → XP tab
   - Purple "Verified on Solana via SOAR" badge visible

6. **Show the SOAR game account**
   - Go to `https://explorer.solana.com/address/<SOAR_GAME_ADDRESS>?cluster=devnet`
   - "The Monolith" game registered with MagicBlock

### What Makes This Impressive

- **Zero disruption** — existing game loop unchanged, SOAR is a parallel write
- **Fire-and-forget** — network failures never block gameplay
- **Authority-signed** — server-validated scores only (players can't self-report)
- **7 achievements** — First Claim, 3/7/14/30-day streaks, Top 10, Empire Builder
- **Feature-flagged** — can be disabled without removing code
- **Clean architecture** — follows exact same pattern as Tapestry integration

### Explorer Links (fill in after setup)

- Game: `https://explorer.solana.com/address/<SOAR_GAME_ADDRESS>?cluster=devnet`
- Leaderboard: `https://explorer.solana.com/address/<SOAR_LEADERBOARD_ADDRESS>?cluster=devnet`
- SOAR Program: `https://explorer.solana.com/address/SoarNNzwQHMwcfdkdLc6kvbkoMSxcHy89gTHrjhJYkk?cluster=devnet`

---

## Rollback Procedure (2 minutes)

### Quick disable (no code removal)

Set `SOAR_ENABLED = false` in `apps/mobile/services/soar-constants.ts`. All SOAR functions become no-ops.

### Full removal

```bash
# 1. Delete new files
rm apps/mobile/services/soar-constants.ts
rm apps/mobile/utils/soar.ts
rm apps/mobile/scripts/setup-soar.ts

# 2. Revert modifications
git checkout apps/mobile/hooks/useBlockActions.ts
git checkout apps/mobile/hooks/useAuthorization.ts
git checkout apps/mobile/components/board/BoardContent.tsx

# 3. Remove dependency
cd apps/mobile && pnpm remove @magicblock-labs/soar-sdk bn.js @types/bn.js

# 4. Remove pnpm overrides from package.json (the "pnpm" key)
```

Or just: `git checkout main -- .` and `pnpm install`.

---

## File Manifest

| File | Action | Purpose |
|------|--------|---------|
| `services/soar-constants.ts` | **NEW** | Addresses, authority key, feature flag |
| `utils/soar.ts` | **NEW** | Fire-and-forget SOAR wrapper (~290 lines) |
| `scripts/setup-soar.ts` | **NEW** | One-shot on-chain setup (not shipped in APK) |
| `hooks/useBlockActions.ts` | **MODIFY** | +30 lines (5 SOAR call sites) |
| `hooks/useAuthorization.ts` | **MODIFY** | +40 lines (auto-register on connect) |
| `components/board/BoardContent.tsx` | **MODIFY** | +15 lines (on-chain badge) |
| `package.json` | **MODIFY** | +3 deps, pnpm overrides, Jest transform |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| SDK Anchor version conflict | `pnpm.overrides` forces 0.31.1 |
| Metaplex deps break Metro bundler | Feature flag disables all SOAR code paths |
| Devnet rate limits | Fire-and-forget — failures are silent |
| Authority key in app bundle | Devnet only, controls only SOAR game (no funds) |
| Player not registered | `ensureSoarPlayer` check, silently no-ops |
| Second MWA popup on connect | Graceful degradation if user declines |
