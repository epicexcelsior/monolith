/**
 * Apply a Blink poke to the live game room.
 *
 * When someone pokes via a Blink, we want the in-game effect to happen
 * immediately (energy boost, broadcast, push notification) — not just
 * create an on-chain memo that nobody detects.
 *
 * Uses a direct reference to the active TowerRoom instance (set in
 * onCreate, cleared in onDispose) to access state and broadcast.
 */

import { MAX_ENERGY } from "@monolith/common";
import { getBlockById, insertEvent } from "./supabase.js";
import { sendPlayerNotification } from "./notifications.js";
import { isBotOwner } from "./seed-tower.js";
import { getActiveRoom } from "../rooms/TowerRoom.js";

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

  // Apply poke through the live TowerRoom instance
  const room = getActiveRoom();
  if (room) {
    try {
      const roomBlock = room.state.blocks.get(blockId);
      if (roomBlock) {
        roomBlock.energy = Math.min(MAX_ENERGY, roomBlock.energy + energyBoost);

        // Broadcast the update to all connected clients
        room.broadcast("block_update", {
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
          imageIndex: roomBlock.imageIndex,
          appearance: {
            color: roomBlock.appearance?.color || "",
            emoji: roomBlock.appearance?.emoji || "",
            name: roomBlock.appearance?.name || "",
            style: roomBlock.appearance?.style || 0,
            textureId: roomBlock.appearance?.textureId || 0,
          },
          eventType: "poke",
        });

        // Send poke_received to the block owner if online
        for (const client of room.clients) {
          if ((client as any)._wallet === block.owner) {
            client.send("poke_received", {
              fromName: `${truncatedPoker} (via Blink)`,
              blockId,
              energyAdded: energyBoost,
            });
          }
        }

        console.log(
          `[Blinks] Poke applied to room: ${truncatedPoker} → ${blockId} (+${energyBoost}% energy) | clients: ${room.clients.length}, wallets: ${Array.from(room.clients).map((c: any) => c._wallet?.slice(0, 6) || "none").join(",")}`,
        );
      } else {
        console.warn(`[Blinks] Block ${blockId} not found in room state`);
      }
    } catch (err) {
      console.warn("[Blinks] Could not apply poke to live room:", err);
    }
  } else {
    console.warn("[Blinks] No active room — poke logged to Supabase only");
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
