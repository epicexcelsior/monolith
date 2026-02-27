# SOAR Integration Plan — On-Chain Leaderboard & Achievements

> MagicBlock bounty ($5K pool: $2.5K / $1.5K / $1K)
> Target: 1-2 hours, fully reversible, zero changes to existing systems

## Overview

SOAR (Solana On-chain Achievement & Ranking) is a standalone MagicBlock program deployed at `SoarNNzwQHMwcfdkdLc6kvbkoMSxcHy89gTHrjhJYkk` (same address on devnet + mainnet). We call it from TypeScript — **no Rust/Anchor changes needed**.

Our existing XP/leaderboard/achievement systems stay untouched. SOAR mirrors them on-chain as a parallel write, following the same fire-and-forget pattern we use for Tapestry.

```
User action → Colyseus confirms → existing XP system updates
                                 → NEW: SOAR on-chain write (fire-and-forget)
```

## Architecture Decision: Client-Only vs Server-Side

**Problem:** `submitScore` and `unlockAchievement` require a **game authority signature** (not the player's wallet). The SOAR program enforces this — players cannot self-report scores.

**Options:**

| Approach | Pros | Cons |
|----------|------|------|
| **A: Server-side** (authority keypair on Railway) | Correct security model, scores are server-validated | Adds server dependency, new endpoints, keypair management |
| **B: Client-side** (authority keypair embedded) | Simpler, no server changes | Authority key in app bundle (insecure for prod, fine for hackathon devnet demo) |

**Decision: Option B (client-side) for hackathon.** We're on devnet, scores are already validated by Colyseus before the client receives `claim_result`/`charge_result`, and the authority key only controls a SOAR game registration (not funds). For production, move to Option A.

> If we later want Option A: add a `POST /api/soar/score` endpoint to `apps/server/src/index.ts` that takes `{ wallet, score }`, validates the caller is authenticated, and signs with the authority keypair server-side.

---

## Prerequisites

### 1. Generate Game Authority Keypair

```bash
# One-time setup — generate a dedicated keypair for SOAR game management
solana-keygen new --outfile ~/.config/solana/soar-authority.json --no-bip39-passphrase

# Fund it on devnet (needs SOL for game registration txs)
solana airdrop 2 $(solana-keygen pubkey ~/.config/solana/soar-authority.json) --url devnet

# Print the pubkey — you'll need this
solana-keygen pubkey ~/.config/solana/soar-authority.json
```

### 2. Register Game + Leaderboard + Achievements On-Chain

Run this **once** via a setup script. Create `apps/mobile/scripts/setup-soar.ts`:

```typescript
import { Connection, Keypair } from "@solana/web3.js";
import { SoarProgram, GameType, Genre } from "@magicblock-labs/soar-sdk";
import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import fs from "fs";

const RPC = "https://api.devnet.solana.com";

async function main() {
  // Load authority keypair
  const authoritySecret = JSON.parse(
    fs.readFileSync(process.env.SOAR_AUTHORITY_PATH || "~/.config/solana/soar-authority.json", "utf-8")
  );
  const authority = Keypair.fromSecretKey(Uint8Array.from(authoritySecret));

  const connection = new Connection(RPC, "confirmed");
  const wallet = {
    publicKey: authority.publicKey,
    signTransaction: async (tx: any) => { tx.sign(authority); return tx; },
    signAllTransactions: async (txs: any[]) => { txs.forEach(tx => tx.sign(authority)); return txs; },
  } as anchor.Wallet;

  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });

  const soar = SoarProgram.get(provider);

  // --- 1. Register Game ---
  const gameKp = Keypair.generate();
  console.log("Game address:", gameKp.publicKey.toBase58());

  const { transaction: initGameTx } = await soar.initializeNewGame(
    gameKp.publicKey,
    "The Monolith",
    "r/Place meets DeFi in 3D — stake, claim, compete",
    Genre.Casual,          // Genre enum from SOAR SDK
    GameType.Mobile,       // GameType enum from SOAR SDK
    anchor.web3.PublicKey.default, // nftMeta (none)
    [authority.publicKey],         // authorities list
  );

  initGameTx.feePayer = authority.publicKey;
  initGameTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  initGameTx.sign(authority, gameKp);
  const gameSig = await connection.sendRawTransaction(initGameTx.serialize());
  await connection.confirmTransaction(gameSig, "confirmed");
  console.log("Game registered:", gameSig);

  // --- 2. Add XP Leaderboard ---
  const { newLeaderBoard, transaction: lbTx } = await soar.addNewGameLeaderBoard(
    gameKp.publicKey,
    authority.publicKey,
    "XP Leaderboard",
    anchor.web3.PublicKey.default, // nftMeta
    10,             // scoresToRetain — keep top 10 on-chain
    false,          // isAscending — false = highest first (descending)
    0,              // decimals
    new BN(0),      // minScore
    new BN(100_000), // maxScore (100K XP ceiling)
    false,          // allowMultipleScores — one score per player (latest)
  );

  console.log("Leaderboard address:", newLeaderBoard.toBase58());
  lbTx.feePayer = authority.publicKey;
  lbTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  lbTx.sign(authority);
  const lbSig = await connection.sendRawTransaction(lbTx.serialize());
  await connection.confirmTransaction(lbSig, "confirmed");
  console.log("Leaderboard created:", lbSig);

  // --- 3. Add Achievements ---
  const achievements = [
    { title: "First Claim",      desc: "Claimed your first block on the tower" },
    { title: "3-Day Streak",     desc: "Charged your block 3 days in a row" },
    { title: "Week Warrior",     desc: "7-day charge streak" },
    { title: "Fortnight Force",  desc: "14-day charge streak" },
    { title: "Monthly Legend",   desc: "30-day charge streak" },
    { title: "Top 10",           desc: "Reached the top 10 on the leaderboard" },
    { title: "Empire Builder",   desc: "Own 3 or more blocks" },
  ];

  const achievementAddresses: string[] = [];
  for (const ach of achievements) {
    const { newAchievement, transaction: achTx } = await soar.addNewGameAchievement(
      gameKp.publicKey,
      authority.publicKey,
      ach.title,
      ach.desc,
      anchor.web3.PublicKey.default, // nftMeta
    );
    achievementAddresses.push(newAchievement.toBase58());
    console.log(`Achievement "${ach.title}":`, newAchievement.toBase58());

    achTx.feePayer = authority.publicKey;
    achTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    achTx.sign(authority);
    const achSig = await connection.sendRawTransaction(achTx.serialize());
    await connection.confirmTransaction(achSig, "confirmed");
    console.log(`  tx: ${achSig}`);

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  // --- 4. Output config ---
  const config = {
    gameAddress: gameKp.publicKey.toBase58(),
    leaderboardAddress: newLeaderBoard.toBase58(),
    achievements: achievements.map((a, i) => ({
      id: a.title.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_"),
      title: a.title,
      address: achievementAddresses[i],
    })),
    authorityPublicKey: authority.publicKey.toBase58(),
  };

  console.log("\n=== SOAR CONFIG (paste into soar-constants.ts) ===\n");
  console.log(JSON.stringify(config, null, 2));

  // Also write to file for reference
  fs.writeFileSync(
    "soar-config.json",
    JSON.stringify(config, null, 2)
  );
  console.log("\nWritten to soar-config.json");
}

main().catch(console.error);
```

Run with:
```bash
cd apps/mobile
npx ts-node --esm scripts/setup-soar.ts
```

This outputs a JSON config with all addresses. Paste them into the constants file (next step).

### 3. Install SDK

```bash
cd apps/mobile
pnpm add @magicblock-labs/soar-sdk
```

**Potential issue:** The SDK depends on `@coral-xyz/anchor@^0.27.0`. Our project uses Anchor 0.31.1. If there are type conflicts, add a `pnpm.overrides` in the mobile `package.json`:
```json
{
  "pnpm": {
    "overrides": {
      "@magicblock-labs/soar-sdk>@coral-xyz/anchor": "0.31.1"
    }
  }
}
```

If the Metaplex transitive dependencies cause bundling issues (we don't use NFT rewards), we can stub them. Cross that bridge if we hit it.

---

## Implementation — 4 Files

### File 1: `apps/mobile/services/soar-constants.ts` (NEW)

Hardcoded addresses from the setup script output.

```typescript
import { PublicKey } from "@solana/web3.js";

// --- Paste from setup-soar.ts output ---
export const SOAR_PROGRAM_ID = new PublicKey("SoarNNzwQHMwcfdkdLc6kvbkoMSxcHy89gTHrjhJYkk");
export const SOAR_GAME_ADDRESS = new PublicKey("<from setup output>");
export const SOAR_LEADERBOARD_ADDRESS = new PublicKey("<from setup output>");
export const SOAR_AUTHORITY_PUBKEY = new PublicKey("<from setup output>");

// Achievement addresses — map to our existing achievement IDs
export const SOAR_ACHIEVEMENTS: Record<string, PublicKey> = {
  first_claim:  new PublicKey("<from setup output>"),
  streak_3:     new PublicKey("<from setup output>"),
  streak_7:     new PublicKey("<from setup output>"),
  streak_14:    new PublicKey("<from setup output>"),
  streak_30:    new PublicKey("<from setup output>"),
  top_10:       new PublicKey("<from setup output>"),
  multi_block:  new PublicKey("<from setup output>"),
};

// HACKATHON ONLY: Authority keypair for client-side score submission.
// In production, this moves server-side behind POST /api/soar/score.
// This is a SOAR-game-only key (no funds at risk).
export const SOAR_AUTHORITY_SECRET = new Uint8Array([
  // Paste the secret key bytes from: cat ~/.config/solana/soar-authority.json
]);
```

### File 2: `apps/mobile/utils/soar.ts` (NEW, ~150 lines)

The SOAR wrapper. All methods are fire-and-forget safe.

```typescript
/**
 * SOAR on-chain leaderboard & achievements — MagicBlock integration.
 *
 * Fire-and-forget pattern (same as tapestry.ts):
 * - Never blocks gameplay
 * - Errors logged, never thrown to callers
 * - All writes are idempotent (safe to retry)
 *
 * Removal: delete this file + soar-constants.ts + 4 call sites in useBlockActions.ts
 */

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { SoarProgram } from "@magicblock-labs/soar-sdk";
import BN from "bn.js";
import {
  SOAR_GAME_ADDRESS,
  SOAR_LEADERBOARD_ADDRESS,
  SOAR_AUTHORITY_PUBKEY,
  SOAR_AUTHORITY_SECRET,
  SOAR_ACHIEVEMENTS,
} from "../services/soar-constants";

// Devnet RPC — same one we use everywhere
const DEVNET_RPC = "https://api.devnet.solana.com";

let _soar: SoarProgram | null = null;
let _authority: Keypair | null = null;

function getSoar(walletPubkey: PublicKey): SoarProgram {
  // getFromConnection creates a SimpleProvider — no Anchor wallet needed
  // We recreate if wallet changes (cheap, just sets defaultPayer)
  _soar = SoarProgram.getFromConnection(
    new Connection(DEVNET_RPC, "confirmed"),
    walletPubkey,
  );
  return _soar;
}

function getAuthority(): Keypair {
  if (!_authority) {
    _authority = Keypair.fromSecretKey(SOAR_AUTHORITY_SECRET);
  }
  return _authority;
}

// Track initialized players to avoid redundant inits
const initializedPlayers = new Set<string>();

/**
 * Ensure the player has a SOAR profile + leaderboard registration.
 * Idempotent — safe to call on every action. Uses local Set to skip
 * redundant calls within the same session.
 */
export async function ensureSoarPlayer(
  walletPubkey: PublicKey,
  username: string,
): Promise<void> {
  const key = walletPubkey.toBase58();
  if (initializedPlayers.has(key)) return;

  const soar = getSoar(walletPubkey);
  const connection = soar.provider.connection;
  const authority = getAuthority();

  // 1. Check if player account exists
  const [playerPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("player"), walletPubkey.toBuffer()],
    soar.programId,
  );

  const playerAccount = await connection.getAccountInfo(playerPda);

  if (!playerAccount) {
    // Initialize player — player signs (but we're using authority as payer)
    // Since player can't sign via MWA here (fire-and-forget),
    // we use authority as both payer and rely on the fact that
    // initializePlayerAccount just needs a payer signature.
    //
    // ACTUALLY: initializePlayerAccount requires the USER to sign.
    // For hackathon: we skip player init and only do score submission
    // (which only needs authority). Players who want their SOAR profile
    // can init it from a dedicated "Register On-Chain" button.
    console.log("[SOAR] Player not initialized on-chain, skipping score submit");
    return;
  }

  // 2. Check if registered to leaderboard
  const [scoresListPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("player-scores-list"), playerPda.toBuffer(), SOAR_LEADERBOARD_ADDRESS.toBuffer()],
    soar.programId,
  );

  const scoresAccount = await connection.getAccountInfo(scoresListPda);
  if (!scoresAccount) {
    // Same issue — registerPlayerEntry requires user signature.
    // Must be done from UI with MWA.
    console.log("[SOAR] Player not registered to leaderboard");
    return;
  }

  initializedPlayers.add(key);
}

/**
 * Submit the player's total XP to the on-chain leaderboard.
 *
 * IMPORTANT: Requires player to have been initialized + registered first
 * (via initSoarPlayer from UI). If not registered, this silently no-ops.
 *
 * Authority signs — no MWA popup.
 */
export async function submitScore(
  walletPubkey: PublicKey,
  totalXp: number,
): Promise<string | null> {
  const soar = getSoar(walletPubkey);
  const connection = soar.provider.connection;
  const authority = getAuthority();

  // Check if player is registered (fast local check first)
  const key = walletPubkey.toBase58();
  if (!initializedPlayers.has(key)) {
    await ensureSoarPlayer(walletPubkey, "");
    if (!initializedPlayers.has(key)) return null; // Not registered
  }

  const { transaction } = await soar.submitScoreToLeaderBoard(
    walletPubkey,
    authority.publicKey,
    SOAR_LEADERBOARD_ADDRESS,
    new BN(totalXp),
  );

  transaction.feePayer = authority.publicKey;
  transaction.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;
  transaction.sign(authority);

  const sig = await connection.sendRawTransaction(transaction.serialize());
  console.log("[SOAR] Score submitted:", totalXp, "XP, tx:", sig);
  return sig;
}

/**
 * Unlock an achievement on-chain.
 * Authority signs — no MWA popup.
 */
export async function unlockAchievement(
  walletPubkey: PublicKey,
  achievementId: string,
): Promise<string | null> {
  const achievementAddress = SOAR_ACHIEVEMENTS[achievementId];
  if (!achievementAddress) {
    console.warn("[SOAR] Unknown achievement:", achievementId);
    return null;
  }

  const key = walletPubkey.toBase58();
  if (!initializedPlayers.has(key)) {
    await ensureSoarPlayer(walletPubkey, "");
    if (!initializedPlayers.has(key)) return null;
  }

  const soar = getSoar(walletPubkey);
  const connection = soar.provider.connection;
  const authority = getAuthority();

  const { transaction } = await soar.unlockPlayerAchievement(
    walletPubkey,
    authority.publicKey,
    achievementAddress,
    SOAR_LEADERBOARD_ADDRESS,
    SOAR_GAME_ADDRESS,
  );

  transaction.feePayer = authority.publicKey;
  transaction.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;
  transaction.sign(authority);

  const sig = await connection.sendRawTransaction(transaction.serialize());
  console.log("[SOAR] Achievement unlocked:", achievementId, "tx:", sig);
  return sig;
}

/**
 * Initialize a player's SOAR profile + register to leaderboard.
 * This DOES require the player's MWA signature — call from UI only.
 * Returns a Transaction[] to sign via MWA.
 */
export async function buildPlayerInitTransactions(
  walletPubkey: PublicKey,
  username: string,
): Promise<Transaction[]> {
  const soar = getSoar(walletPubkey);
  const connection = soar.provider.connection;
  const txs: Transaction[] = [];

  // 1. Init player account
  const [playerPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("player"), walletPubkey.toBuffer()],
    soar.programId,
  );

  const playerAccount = await connection.getAccountInfo(playerPda);
  if (!playerAccount) {
    const { transaction } = await soar.initializePlayerAccount(
      walletPubkey,
      username || "monolith_player",
      PublicKey.default,
    );
    txs.push(transaction);
  }

  // 2. Register to leaderboard
  const [scoresListPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("player-scores-list"), playerPda.toBuffer(), SOAR_LEADERBOARD_ADDRESS.toBuffer()],
    soar.programId,
  );

  const scoresAccount = await connection.getAccountInfo(scoresListPda);
  if (!scoresAccount) {
    const { transaction } = await soar.registerPlayerEntryForLeaderBoard(
      walletPubkey,
      SOAR_LEADERBOARD_ADDRESS,
    );
    txs.push(transaction);
  }

  return txs;
}

/**
 * Fetch the on-chain top 10 from SOAR leaderboard.
 * Read-only, no signing needed.
 */
export async function fetchSoarLeaderboard(): Promise<
  Array<{ wallet: string; score: number; timestamp: number }>
> {
  try {
    const connection = new Connection(DEVNET_RPC, "confirmed");
    const soar = SoarProgram.getFromConnection(connection, PublicKey.default);

    // Derive TopEntries PDA
    const [topEntriesPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("top-scores"), SOAR_LEADERBOARD_ADDRESS.toBuffer()],
      soar.programId,
    );

    const topEntries = await soar.fetchLeaderBoardTopEntriesAccount(topEntriesPda);
    if (!topEntries) return [];

    return topEntries.topScores
      .filter((e: any) => !e.player.equals(PublicKey.default))
      .map((e: any) => ({
        wallet: e.player.toBase58(),
        score: e.entry.score.toNumber(),
        timestamp: e.entry.timestamp.toNumber(),
      }));
  } catch (err) {
    console.warn("[SOAR] Failed to fetch leaderboard:", err);
    return [];
  }
}
```

### File 3: Modify `apps/mobile/hooks/useBlockActions.ts` (4 insertion points)

Add SOAR fire-and-forget calls at the same points where XP is awarded. **Every call follows the Tapestry pattern: `.catch(console.warn)`, never awaited.**

```typescript
// --- At top of file, add import ---
import { submitScore, unlockAchievement } from "../utils/soar";

// --- Helper (next to postTapestryContent) ---
/** Fire-and-forget SOAR score submission. Never blocks gameplay. */
function recordSoarScore(wallet: string, totalXp: number): void {
  try {
    const pk = new PublicKey(wallet);
    submitScore(pk, totalXp).catch(console.warn);
  } catch { /* invalid pubkey in demo mode */ }
}

/** Fire-and-forget SOAR achievement unlock. Never blocks gameplay. */
function recordSoarAchievement(wallet: string, achievementId: string): void {
  try {
    const pk = new PublicKey(wallet);
    unlockAchievement(pk, achievementId).catch(console.warn);
  } catch { /* invalid pubkey in demo mode */ }
}
```

**Insertion Point 1: Claim Result (multiplayer)** — after `pStore.addPoints()` in `onClaimResult`:
```typescript
// ~line 334, after addPoints call
recordSoarScore(wallet, result.totalXp);
if (result.isFirstBlock) {
  recordSoarAchievement(wallet, "first_claim");
}
```

**Insertion Point 2: Charge Result (multiplayer)** — after `pStore.addPoints()` in `onChargeResult`:
```typescript
// ~line 309, after addPoints call
recordSoarScore(wallet, result.totalXp);
if (result.streak && [3, 7, 14, 30].includes(result.streak)) {
  recordSoarAchievement(wallet, `streak_${result.streak}`);
}
```

**Insertion Point 3: Poke Result (multiplayer)** — after `pStore.addPoints()` in `onPokeResult`:
```typescript
// ~line 379, after addPoints call
recordSoarScore(wallet, result.totalXp);
```

**Insertion Point 4: Offline claim** — after local XP award in `handleClaim`:
```typescript
// ~line 153, after addPoints call
recordSoarScore(wallet, pStore.xp + pts);
if (isFirst) {
  recordSoarAchievement(wallet, "first_claim");
}
```

### File 4: Modify `apps/mobile/components/board/BoardContent.tsx` (optional, adds "On-Chain" badge)

Add a small indicator showing the score is also tracked on-chain. Minimal change:

```typescript
// At the top, add import
import { fetchSoarLeaderboard } from "../../utils/soar";

// In the XP leaderboard section, add an "On-Chain Verified" badge
// next to the tab header or as a subtle subtitle:
// <Text style={styles.onChainBadge}>Verified on Solana via SOAR</Text>
```

This is cosmetic — the leaderboard data still comes from Supabase (faster, more complete). The SOAR on-chain data serves as verifiable proof for judges.

---

## Player Registration Flow

Players must register with SOAR before scores can be submitted. Two options:

### Option A: Auto-register on wallet connect (recommended for hackathon)

In `apps/mobile/hooks/useBlockActions.ts` or `apps/mobile/app/_layout.tsx`, after wallet connect succeeds:

```typescript
// After MWA wallet connect succeeds and we have a publicKey:
const soarTxs = await buildPlayerInitTransactions(publicKey, username || "");
if (soarTxs.length > 0) {
  // Sign all via MWA in one batch
  for (const tx of soarTxs) {
    await signAndSendTransaction(tx); // existing MWA signing
  }
}
```

This adds 1-2 extra transactions on first connect. The wallet approval dialog will show.

### Option B: Dedicated "Register On-Chain" button in Settings

Less intrusive — player opts in. Add a button in SettingsContent:

```typescript
<Button
  title="Register On-Chain Leaderboard"
  variant="secondary"
  onPress={async () => {
    const txs = await buildPlayerInitTransactions(publicKey, username);
    for (const tx of txs) {
      await signAndSendTransaction(tx);
    }
    // Show toast: "Registered on SOAR!"
  }}
/>
```

---

## Complete File Manifest

| File | Action | Lines Changed |
|------|--------|---------------|
| `apps/mobile/services/soar-constants.ts` | **NEW** | ~30 lines |
| `apps/mobile/utils/soar.ts` | **NEW** | ~150 lines |
| `apps/mobile/hooks/useBlockActions.ts` | **MODIFY** | +25 lines (4 insertion points) |
| `apps/mobile/components/board/BoardContent.tsx` | **MODIFY** | +5 lines (optional badge) |
| `apps/mobile/scripts/setup-soar.ts` | **NEW** | ~120 lines (one-time setup, not shipped) |
| `apps/mobile/package.json` | **MODIFY** | +1 dependency |

**Total: ~3 new files, ~2 modified files, ~200 lines of new code.**

---

## Rollback Procedure (10 minutes)

```bash
# 1. Delete new files
rm apps/mobile/services/soar-constants.ts
rm apps/mobile/utils/soar.ts
rm apps/mobile/scripts/setup-soar.ts

# 2. Revert modifications
git checkout apps/mobile/hooks/useBlockActions.ts
git checkout apps/mobile/components/board/BoardContent.tsx

# 3. Remove dependency
cd apps/mobile && pnpm remove @magicblock-labs/soar-sdk
```

Or just: `git checkout feat/soar-integration -- .` and `pnpm install`.

---

## Execution Checklist

- [ ] Generate SOAR authority keypair + fund on devnet
- [ ] Run `setup-soar.ts` to register game/leaderboard/achievements
- [ ] Paste addresses into `soar-constants.ts`
- [ ] Create `utils/soar.ts` wrapper
- [ ] Wire 4 call sites in `useBlockActions.ts`
- [ ] Add player registration (Option A or B)
- [ ] Test: claim a block → check explorer for SOAR tx
- [ ] Test: charge → check score updated on-chain
- [ ] Optional: add "On-Chain" badge to BoardContent
- [ ] Verify rollback: `git stash`, confirm app works without SOAR

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| SDK Anchor version conflict | Medium | `pnpm.overrides` to force our version |
| Metaplex deps break RN bundler | Low-Medium | We don't use NFT rewards; stub if needed |
| Devnet rate limits on SOAR txs | Low | Fire-and-forget pattern means failures don't block gameplay |
| Authority key in app bundle | Accepted | Devnet only, key controls nothing of value |
| `submitScore` fails for unregistered players | Expected | `ensureSoarPlayer` check, silently no-ops |

---

## What Judges See

1. **On-chain leaderboard** — SOAR program calls visible on Solana Explorer
2. **On-chain achievements** — 7 achievement unlocks as verifiable on-chain accounts
3. **MagicBlock SDK integration** — `@magicblock-labs/soar-sdk` in package.json
4. **Clean architecture** — fire-and-forget pattern, zero disruption to core game loop
5. **Game registered on SOAR** — publicly queryable game account with our metadata

This checks the "build financialized games on Solana using MagicBlock's infrastructure" box with minimal scope creep.

---

## SDK Reference

- **npm:** `@magicblock-labs/soar-sdk`
- **Program:** `SoarNNzwQHMwcfdkdLc6kvbkoMSxcHy89gTHrjhJYkk` (devnet + mainnet)
- **Docs:** https://docs.magicblock.gg/pages/tools/open-source-programs/SOAR.md
- **GitHub:** https://github.com/magicblock-labs/SOAR
- **TypeDoc API:** https://magicblock-labs.github.io/SOAR/
- **Key classes:** `SoarProgram.getFromConnection()`, `GameClient`, `InstructionBuilder`
- **Signing model:** Player inits self-sign (MWA), score/achievement submits authority-sign (server or embedded key)
