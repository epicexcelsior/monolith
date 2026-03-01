/**
 * SOAR on-chain leaderboard & achievements — MagicBlock integration.
 *
 * Fire-and-forget pattern (same as tapestry.ts):
 * - Never blocks gameplay
 * - Errors logged, never thrown to callers
 * - All writes are idempotent (safe to retry)
 *
 * Removal: delete this file + soar-constants.ts + call sites in useBlockActions.ts + useAuthorization.ts
 */

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { SoarProgram } from "@magicblock-labs/soar-sdk";
import BN from "bn.js";
import {
  SOAR_GAME_ADDRESS,
  SOAR_LEADERBOARD_ADDRESS,
  SOAR_AUTHORITY_SECRET,
  SOAR_ACHIEVEMENTS,
  SOAR_ENABLED,
} from "../services/soar-constants";

// Devnet RPC — same one we use everywhere
const DEVNET_RPC = "https://api.devnet.solana.com";

let _authority: Keypair | null = null;

// Authority-based SoarProgram — used for score/achievement submission.
// The authority is BOTH the payer and signer, so no MWA popup needed.
let _soarAuthority: SoarProgram | null = null;

// Player-based SoarProgram — used for buildPlayerInitTransactions
// where the player must sign via MWA.
let _soarPlayer: SoarProgram | null = null;
let _lastPlayerWallet: string | null = null;

function getAuthority(): Keypair {
  if (!_authority) {
    _authority = Keypair.fromSecretKey(SOAR_AUTHORITY_SECRET);
  }
  return _authority;
}

/** SoarProgram with authority as provider wallet (for score/achievement — authority pays + signs). */
function getSoarForAuthority(): SoarProgram {
  if (!_soarAuthority) {
    const authority = getAuthority();
    _soarAuthority = SoarProgram.getFromConnection(
      new Connection(DEVNET_RPC, "confirmed"),
      authority.publicKey,
    );
  }
  return _soarAuthority;
}

/** SoarProgram with player as provider wallet (for init txs — player signs via MWA). */
function getSoarForPlayer(walletPubkey: PublicKey): SoarProgram {
  const key = walletPubkey.toBase58();
  if (!_soarPlayer || _lastPlayerWallet !== key) {
    _soarPlayer = SoarProgram.getFromConnection(
      new Connection(DEVNET_RPC, "confirmed"),
      walletPubkey,
    );
    _lastPlayerWallet = key;
  }
  return _soarPlayer;
}

// Track initialized players to avoid redundant on-chain checks
const initializedPlayers = new Set<string>();

/**
 * Ensure the player has a SOAR profile + leaderboard registration.
 * Idempotent — safe to call on every action. Uses local Set to skip
 * redundant calls within the same session.
 */
export async function ensureSoarPlayer(walletPubkey: PublicKey): Promise<boolean> {
  if (!SOAR_ENABLED) return false;

  const key = walletPubkey.toBase58();
  if (initializedPlayers.has(key)) return true;

  try {
    const soar = getSoarForAuthority();
    const connection = soar.provider.connection;

    // Check if player account exists
    const [playerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("player"), walletPubkey.toBuffer()],
      soar.utils.programId,
    );

    const playerAccount = await connection.getAccountInfo(playerPda);
    if (!playerAccount) {
      if (__DEV__) console.log("[SOAR] Player not initialized on-chain — needs registration");
      return false;
    }

    // Check if registered to leaderboard
    const [scoresListPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("player-scores-list"), playerPda.toBuffer(), SOAR_LEADERBOARD_ADDRESS.toBuffer()],
      soar.utils.programId,
    );

    const scoresAccount = await connection.getAccountInfo(scoresListPda);
    if (!scoresAccount) {
      if (__DEV__) console.log("[SOAR] Player not registered to leaderboard");
      return false;
    }

    initializedPlayers.add(key);
    return true;
  } catch (err) {
    console.warn("[SOAR] ensureSoarPlayer error:", err);
    return false;
  }
}

/**
 * Submit the player's total XP to the on-chain leaderboard.
 *
 * Requires player to have been initialized + registered first
 * (via buildPlayerInitTransactions from UI). If not registered, silently no-ops.
 *
 * Authority signs — no MWA popup.
 */
export async function submitScore(
  walletPubkey: PublicKey,
  totalXp: number,
): Promise<string | null> {
  if (!SOAR_ENABLED) return null;

  try {
    const key = walletPubkey.toBase58();
    if (!initializedPlayers.has(key)) {
      const ready = await ensureSoarPlayer(walletPubkey);
      if (!ready) return null;
    }

    const soar = getSoarForAuthority();
    const connection = soar.provider.connection;
    const authority = getAuthority();

    // Authority is both payer (from provider) and game authority signer.
    // Player pubkey is used only to derive the player PDA (not a signer).
    const { transaction } = await soar.submitScoreToLeaderBoard(
      walletPubkey,
      authority.publicKey,
      SOAR_LEADERBOARD_ADDRESS,
      new BN(totalXp),
    );

    transaction.feePayer = authority.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.sign(authority);

    const sig = await connection.sendRawTransaction(transaction.serialize());
    if (__DEV__) console.log("[SOAR] Score submitted:", totalXp, "XP, tx:", sig);
    return sig;
  } catch (err) {
    console.warn("[SOAR] submitScore error:", err);
    return null;
  }
}

/**
 * Unlock an achievement on-chain.
 * Authority signs — no MWA popup.
 */
export async function unlockAchievement(
  walletPubkey: PublicKey,
  achievementId: string,
): Promise<string | null> {
  if (!SOAR_ENABLED) return null;

  const achievementAddress = SOAR_ACHIEVEMENTS[achievementId];
  if (!achievementAddress) {
    console.warn("[SOAR] Unknown achievement:", achievementId);
    return null;
  }

  try {
    const key = walletPubkey.toBase58();
    if (!initializedPlayers.has(key)) {
      const ready = await ensureSoarPlayer(walletPubkey);
      if (!ready) return null;
    }

    const soar = getSoarForAuthority();
    const connection = soar.provider.connection;
    const authority = getAuthority();

    // Authority is both payer and game authority signer.
    const { transaction } = await soar.unlockPlayerAchievement(
      walletPubkey,
      authority.publicKey,
      achievementAddress,
      SOAR_LEADERBOARD_ADDRESS,
      SOAR_GAME_ADDRESS,
    );

    transaction.feePayer = authority.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.sign(authority);

    const sig = await connection.sendRawTransaction(transaction.serialize());
    if (__DEV__) console.log("[SOAR] Achievement unlocked:", achievementId, "tx:", sig);
    return sig;
  } catch (err) {
    console.warn("[SOAR] unlockAchievement error:", err);
    return null;
  }
}

/**
 * Build transactions to initialize a player's SOAR profile + register to leaderboard.
 * This DOES require the player's MWA signature — call from UI only.
 * Returns Transaction[] to sign via MWA.
 */
export async function buildPlayerInitTransactions(
  walletPubkey: PublicKey,
  username: string,
): Promise<Transaction[]> {
  if (!SOAR_ENABLED) return [];

  try {
    const soar = getSoarForPlayer(walletPubkey);
    const connection = soar.provider.connection;
    const txs: Transaction[] = [];

    // 1. Init player account
    const [playerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("player"), walletPubkey.toBuffer()],
      soar.utils.programId,
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
      soar.utils.programId,
    );

    const scoresListAccount = await connection.getAccountInfo(scoresListPda);
    if (!scoresListAccount) {
      const { transaction } = await soar.registerPlayerEntryForLeaderBoard(
        walletPubkey,
        SOAR_LEADERBOARD_ADDRESS,
      );
      txs.push(transaction);
    }

    if (txs.length === 0) {
      // Already registered — mark as initialized
      initializedPlayers.add(walletPubkey.toBase58());
    }

    return txs;
  } catch (err) {
    console.warn("[SOAR] buildPlayerInitTransactions error:", err);
    return [];
  }
}

/**
 * Fetch the on-chain top 10 from SOAR leaderboard.
 * Read-only, no signing needed.
 */
export async function fetchSoarLeaderboard(): Promise<
  Array<{ wallet: string; score: number; timestamp: number }>
> {
  if (!SOAR_ENABLED) return [];

  try {
    const soar = getSoarForAuthority();

    const [topEntriesPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("top-scores"), SOAR_LEADERBOARD_ADDRESS.toBuffer()],
      soar.utils.programId,
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

/**
 * Mark a player as initialized in our local cache.
 * Call after successful MWA registration.
 */
export function markPlayerInitialized(walletPubkey: PublicKey): void {
  initializedPlayers.add(walletPubkey.toBase58());
}
