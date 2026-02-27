/**
 * Memo transaction builder for Solana Blinks.
 *
 * Creates unsigned memo transactions that wallets sign via the Actions spec.
 * RPC-agnostic: set BLINKS_RPC_URL env var to swap providers.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

let connection: Connection | null = null;

function getConnection(): Connection {
  if (connection) return connection;

  const rpcUrl =
    process.env.BLINKS_RPC_URL ||
    "https://solana-devnet.g.alchemy.com/v2/iZggasNITBS_glMXEkk8u";
  connection = new Connection(rpcUrl, "confirmed");
  console.log(`[Blinks] RPC connected → ${rpcUrl.split("?")[0]}`);
  return connection;
}

/**
 * Build an unsigned memo transaction.
 *
 * - User is fee payer (required by Actions spec)
 * - Memo instruction carries the poke data (e.g. "monolith:poke:block-5-3")
 * - Memo text includes "monolith:" prefix for future on-chain detection
 *
 * Note: SPL Memo v2 requires ALL accounts in keys to be signers.
 * Only the user pubkey is included (no extra read-only accounts).
 */
export async function createMemoTransaction(
  userPubkey: PublicKey,
  memo: string,
): Promise<Transaction> {
  const conn = getConnection();
  const { blockhash, lastValidBlockHeight } =
    await conn.getLatestBlockhash("confirmed");

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = userPubkey;

  tx.add(
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [
        { pubkey: userPubkey, isSigner: true, isWritable: true },
      ],
      data: Buffer.from(memo, "utf-8"),
    }),
  );

  return tx;
}
