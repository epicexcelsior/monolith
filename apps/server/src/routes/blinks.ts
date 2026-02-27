/**
 * Solana Blinks routes — shareable URLs that let anyone poke a block
 * from Twitter/web via a memo transaction, no app install needed.
 *
 * Self-contained Express router. Can be extracted to a standalone
 * service with zero impact on the rest of the server.
 */

import { Router, type Request, type Response } from "express";
import { PublicKey } from "@solana/web3.js";
import {
  createActionHeaders,
  createPostResponse,
} from "@solana/actions";
import { getBlockById, insertEvent } from "../utils/supabase.js";
import { createMemoTransaction } from "../utils/memo-tx.js";
import { applyBlinkPoke } from "../utils/blink-poke.js";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────

const SERVER_URL =
  process.env.SERVER_URL ||
  "https://monolith-server-production.up.railway.app";

// Full spec-compliant headers including X-Action-Version + X-Blockchain-Ids
// Required by dial.to and wallet clients to validate the Action
const ACTION_HEADERS = createActionHeaders({
  chainId: "devnet",
  actionVersion: "2.2.1",
});

function setCorsHeaders(res: Response): void {
  for (const [key, value] of Object.entries(ACTION_HEADERS)) {
    res.setHeader(key, value);
  }
}

function truncateWallet(wallet: string): string {
  return wallet.length > 8
    ? `${wallet.slice(0, 4)}..${wallet.slice(-4)}`
    : wallet;
}

// ─── actions.json (Action Discovery) ─────────────────────

router.get("/actions.json", (_req: Request, res: Response) => {
  setCorsHeaders(res);
  res.json({
    rules: [
      {
        pathPattern: "/api/actions/block/*",
        apiPath: "/api/actions/block/*",
      },
    ],
  });
});

// ─── CORS preflight for all blinks paths ─────────────────

router.options("/api/actions/*", (_req: Request, res: Response) => {
  setCorsHeaders(res);
  res.sendStatus(204);
});

// ─── GET block metadata card ─────────────────────────────

router.get(
  "/api/actions/block/:blockId",
  async (req: Request, res: Response) => {
    setCorsHeaders(res);

    const blockId = req.params.blockId as string;
    const block = await getBlockById(blockId);

    if (!block) {
      // Return a disabled action for unknown blocks
      res.json({
        icon: `${SERVER_URL}/static/blink-icon.png`,
        title: "Unknown Block",
        description: "This block doesn't exist on The Monolith.",
        label: "Not Found",
        disabled: true,
      });
      return;
    }

    const isUnclaimed = !block.owner;
    const energy = Math.round(block.energy);
    const ownerLabel = isUnclaimed
      ? "Unclaimed"
      : truncateWallet(block.owner);

    if (isUnclaimed) {
      res.json({
        icon: `${SERVER_URL}/static/blink-icon.png`,
        title: `Unclaimed Block — Layer ${block.layer}`,
        description: `This block is waiting for a keeper. Install The Monolith app to claim it!`,
        label: "Install App to Claim",
        disabled: true,
      });
      return;
    }

    res.json({
      icon: `${SERVER_URL}/static/blink-icon.png`,
      title: `${ownerLabel}'s Block`,
      description: `Layer ${block.layer} | ${energy}% Energy | Streak: ${block.streak} days`,
      label: "Poke This Block",
      links: {
        actions: [
          {
            label: "Poke This Block",
            href: `${SERVER_URL}/api/actions/block/${blockId}/poke`,
            type: "transaction",
          },
        ],
      },
    });
  },
);

// ─── POST poke transaction ───────────────────────────────

router.post(
  "/api/actions/block/:blockId/poke",
  async (req: Request, res: Response) => {
    setCorsHeaders(res);

    const blockId = req.params.blockId as string;
    const { account } = req.body;

    if (!account) {
      res.status(400).json({ error: "Missing account in request body" });
      return;
    }

    let userPubkey: PublicKey;
    try {
      userPubkey = new PublicKey(account);
    } catch {
      res.status(400).json({ error: "Invalid account public key" });
      return;
    }

    try {
      const memo = `monolith:poke:${blockId}`;
      const tx = await createMemoTransaction(userPubkey, memo);

      // Fire-and-forget: apply poke in-game (energy boost + event + push notif)
      applyBlinkPoke(blockId, account).catch((err) =>
        console.error("[Blinks] applyBlinkPoke error:", err),
      );

      const response = await createPostResponse({
        fields: {
          type: "transaction",
          transaction: tx,
          message: "Poke sent! The keeper will feel that.",
        },
      });

      res.json(response);
    } catch (err) {
      console.error("[Blinks] POST poke error:", err);
      res.status(500).json({ error: "Failed to create poke transaction" });
    }
  },
);

export default router;
