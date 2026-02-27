/**
 * One-shot SOAR setup script.
 *
 * Generates authority keypair, funds on devnet, registers game + leaderboard + 7 achievements.
 * Outputs JSON config to paste into soar-constants.ts.
 *
 * Usage:
 *   cd apps/mobile
 *   npx ts-node --esm scripts/setup-soar.ts
 *
 * Or with existing keypair:
 *   SOAR_AUTHORITY_PATH=~/.config/solana/soar-authority.json npx ts-node --esm scripts/setup-soar.ts
 */

import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SoarProgram, GameType, Genre } from "@magicblock-labs/soar-sdk";
import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import fs from "fs";
import path from "path";
import os from "os";

const RPC = "https://api.devnet.solana.com";
const AUTHORITY_PATH =
  process.env.SOAR_AUTHORITY_PATH ||
  path.join(os.homedir(), ".config/solana/soar-authority.json");

async function airdrop(connection: Connection, pubkey: anchor.web3.PublicKey, amount: number) {
  console.log(`Airdropping ${amount} SOL to ${pubkey.toBase58()}...`);
  const sig = await connection.requestAirdrop(pubkey, amount * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
  console.log("Airdrop confirmed:", sig);
}

async function main() {
  const connection = new Connection(RPC, "confirmed");

  // --- 1. Load or generate authority keypair ---
  let authority: Keypair;
  if (fs.existsSync(AUTHORITY_PATH)) {
    console.log("Loading existing authority from:", AUTHORITY_PATH);
    const secret = JSON.parse(fs.readFileSync(AUTHORITY_PATH, "utf-8"));
    authority = Keypair.fromSecretKey(Uint8Array.from(secret));
  } else {
    console.log("Generating new authority keypair...");
    authority = Keypair.generate();
    const dir = path.dirname(AUTHORITY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AUTHORITY_PATH, JSON.stringify(Array.from(authority.secretKey)));
    console.log("Saved to:", AUTHORITY_PATH);
  }
  console.log("Authority pubkey:", authority.publicKey.toBase58());

  // Check balance (don't auto-airdrop — rate limits are unreliable)
  const balance = await connection.getBalance(authority.publicKey);
  console.log(`Authority balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.error("Insufficient SOL. Fund with: solana transfer --url devnet", authority.publicKey.toBase58(), "2 --allow-unfunded-recipient");
    process.exit(1);
  }

  // --- 2. Set up SOAR provider ---
  const wallet = {
    publicKey: authority.publicKey,
    signTransaction: async (tx: any) => {
      tx.sign(authority);
      return tx;
    },
    signAllTransactions: async (txs: any[]) => {
      txs.forEach((tx) => tx.sign(authority));
      return txs;
    },
  } as anchor.Wallet;

  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });

  const soar = SoarProgram.get(provider);

  // --- 3. Register Game ---
  const gameKp = Keypair.generate();
  console.log("\nGame address:", gameKp.publicKey.toBase58());

  const { transaction: initGameTx } = await soar.initializeNewGame(
    gameKp.publicKey,
    "The Monolith",
    "r/Place meets DeFi in 3D — stake, claim, compete",
    Genre.Casual,
    GameType.Mobile,
    anchor.web3.PublicKey.default, // nftMeta (none)
    [authority.publicKey],
  );

  initGameTx.feePayer = authority.publicKey;
  initGameTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  initGameTx.sign(authority, gameKp);
  const gameSig = await connection.sendRawTransaction(initGameTx.serialize());
  await connection.confirmTransaction(gameSig, "confirmed");
  console.log("Game registered:", gameSig);

  // --- 4. Add XP Leaderboard ---
  const { newLeaderBoard, transaction: lbTx } = await soar.addNewGameLeaderBoard(
    gameKp.publicKey,
    authority.publicKey,
    "XP Leaderboard",
    anchor.web3.PublicKey.default,
    10,      // scoresToRetain — top 10
    false,   // isAscending — highest first
    0,       // decimals
    new BN(0),
    new BN(100_000), // max 100K XP
    false,   // allowMultipleScores
  );

  console.log("\nLeaderboard address:", newLeaderBoard.toBase58());
  lbTx.feePayer = authority.publicKey;
  lbTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  lbTx.sign(authority);
  const lbSig = await connection.sendRawTransaction(lbTx.serialize());
  await connection.confirmTransaction(lbSig, "confirmed");
  console.log("Leaderboard created:", lbSig);

  // --- 5. Add Achievements ---
  const achievements = [
    { title: "First Claim", desc: "Claimed your first block on the tower" },
    { title: "3-Day Streak", desc: "Charged your block 3 days in a row" },
    { title: "Week Warrior", desc: "7-day charge streak" },
    { title: "Fortnight Force", desc: "14-day charge streak" },
    { title: "Monthly Legend", desc: "30-day charge streak" },
    { title: "Top 10", desc: "Reached the top 10 on the leaderboard" },
    { title: "Empire Builder", desc: "Own 3 or more blocks" },
  ];

  const achievementAddresses: string[] = [];
  for (const ach of achievements) {
    const { newAchievement, transaction: achTx } = await soar.addNewGameAchievement(
      gameKp.publicKey,
      authority.publicKey,
      ach.title,
      ach.desc,
      anchor.web3.PublicKey.default,
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
    await new Promise((r) => setTimeout(r, 500));
  }

  // --- 6. Output config ---
  const config = {
    gameAddress: gameKp.publicKey.toBase58(),
    leaderboardAddress: newLeaderBoard.toBase58(),
    achievements: achievements.map((a, i) => ({
      id: a.title.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_"),
      title: a.title,
      address: achievementAddresses[i],
    })),
    authorityPublicKey: authority.publicKey.toBase58(),
    authoritySecretKey: Array.from(authority.secretKey),
  };

  console.log("\n=== SOAR CONFIG ===\n");
  console.log(JSON.stringify(config, null, 2));

  // Write to file
  const outPath = path.resolve(process.cwd(), "soar-config.json");
  fs.writeFileSync(outPath, JSON.stringify(config, null, 2));
  console.log("\nWritten to", outPath);
  console.log("\nNext: paste addresses into services/soar-constants.ts");
  console.log("Next: paste authority secret key bytes into SOAR_AUTHORITY_SECRET");
}

main().catch(console.error);
