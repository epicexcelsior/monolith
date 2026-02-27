/**
 * Apply a Blink poke to the live game room.
 *
 * When someone pokes via a Blink, we want the in-game effect to happen
 * immediately (energy boost, broadcast, push notification) — not just
 * create an on-chain memo that nobody detects.
 *
 * Uses Colyseus matchMaker to find the active tower room and simulate
 * the poke as if it came from a connected client.
 */

import { matchMaker } from "colyseus";
import { MAX_ENERGY } from "@monolith/common";
import { getBlockById, insertEvent } from "./supabase.js";
import { sendPlayerNotification } from "./notifications.js";
import { isBotOwner } from "./seed-tower.js";

/**
 * Apply a poke from a Blink interaction.
 * Fire-and-forget — errors are logged, not thrown to the caller.
 */
export async function applyBlinkPoke(
  blockId: string,
  pokerWallet: string,
): Promise<void> {
  const block = await getBlockById(blockId);
  if (!block || !block.owner) return;

  // Don't let someone poke their own block
  if (block.owner === pokerWallet) return;

  const energyBoost = Math.round(MAX_ENERGY * 0.1);
  const truncatedPoker =
    pokerWallet.length > 8
      ? `${pokerWallet.slice(0, 4)}..${pokerWallet.slice(-4)}`
      : pokerWallet;

  // Try to apply poke through the live Colyseus room
  try {
    const rooms = await matchMaker.query({ name: "tower" });
    if (rooms.length > 0) {
      const room = await matchMaker.getRoomById(rooms[0].roomId);
      if (room) {
        // Access the room's state directly to apply the poke
        const roomState = (room as any).state;
        const roomBlock = roomState?.blocks?.get(blockId);
        if (roomBlock) {
          roomBlock.energy = Math.min(MAX_ENERGY, roomBlock.energy + energyBoost);

          // Broadcast the update to all connected clients
          (room as any).broadcast("block_update", {
            id: roomBlock.id,
            layer: roomBlock.layer,
            index: roomBlock.index,
            energy: roomBlock.energy,
            owner: roomBlock.owner,
            ownerColor: roomBlock.ownerColor,
            stakedAmount: roomBlock.stakedAmount,
            lastChargeTime: roomBlock.lastChargeTime,
            streak: roomBlock.streak,
            lastStreakDate: roomBlock.lastStreakDate,
            eventType: "poke",
          });

          // Send poke_received to the block owner if online
          for (const client of (room as any).clients) {
            if ((client as any)._wallet === block.owner) {
              client.send("poke_received", {
                fromName: `${truncatedPoker} (via Blink)`,
                blockId,
                energyAdded: energyBoost,
              });
            }
          }

          console.log(
            `[Blinks] Poke applied: ${truncatedPoker} → ${blockId} (+${energyBoost}% energy)`,
          );
        }
      }
    }
  } catch (err) {
    console.warn("[Blinks] Could not apply poke to live room:", err);
  }

  // Always log the event to Supabase (even if room broadcast failed)
  insertEvent("blink_poke", blockId, pokerWallet, {
    energyAdded: energyBoost,
    source: "blink",
  });

  // Push notification to block owner
  if (!isBotOwner(block.owner)) {
    sendPlayerNotification(
      block.owner,
      "poke",
      "Blink poke!",
      `${truncatedPoker} poked your block via a Solana Blink! +${energyBoost}% energy`,
      { blockId, from: pokerWallet, source: "blink" },
    );
  }
}
