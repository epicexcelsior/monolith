import { Room, Client } from "colyseus";
import { TowerRoomState, BlockSchema } from "../schema/TowerState.js";
import { seedTower, startBotSimulation, isBotOwner } from "../utils/seed-tower.js";
import { MAX_ENERGY } from "@monolith/common";
import type { ClaimMessage, ChargeMessage, CustomizeMessage } from "@monolith/common";

// Game constants (match client)
const DECAY_AMOUNT = 1;
const DECAY_INTERVAL_MS = 60_000;
const CHARGE_COOLDOWN_MS = 30_000;
const BASE_CHARGE_AMOUNT = 20;

/** Streak multiplier tiers (identical to client) */
function getStreakMultiplier(streak: number): number {
  if (streak >= 30) return 3.0;
  if (streak >= 7) return 2.0;
  if (streak >= 5) return 1.75;
  if (streak >= 3) return 1.5;
  return 1.0;
}

/** Check if ts2 is exactly the next calendar day after ts1 */
function isNextDay(ts1: number, ts2: number): boolean {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return d2.getTime() - d1.getTime() === 86400000;
}

export class TowerRoom extends Room<TowerRoomState> {
  private decayInterval!: ReturnType<typeof setInterval>;
  private stopBotSim!: () => void;

  onCreate() {
    this.setState(new TowerRoomState());

    // Seed tower with bots
    seedTower(this.state.blocks);
    this.recomputeStats();

    // Start bot simulation
    this.stopBotSim = startBotSimulation(this.state.blocks);

    // Start decay loop
    this.decayInterval = setInterval(() => {
      this.state.blocks.forEach((block) => {
        if (block.owner) {
          block.energy = Math.max(0, block.energy - DECAY_AMOUNT);
        }
      });
      this.state.tick++;
    }, DECAY_INTERVAL_MS);

    // ─── Message Handlers ─────────────────────────

    this.onMessage("claim", (client: Client, msg: ClaimMessage) => {
      const block = this.state.blocks.get(msg.blockId);
      if (!block) {
        client.send("error", { message: "Block not found" });
        return;
      }
      if (block.owner && !isBotOwner(block.owner)) {
        client.send("error", { message: "Block already claimed by a player" });
        return;
      }

      block.owner = msg.wallet;
      block.ownerColor = msg.color;
      block.energy = MAX_ENERGY;
      block.stakedAmount = msg.amount;
      block.lastChargeTime = Date.now();
      block.streak = 0;
      block.lastStreakDate = "";
      block.appearance.color = msg.color;

      this.recomputeStats();
      console.log(`[TowerRoom] ${msg.wallet.slice(0, 8)}... claimed ${msg.blockId}`);
    });

    this.onMessage("charge", (client: Client, msg: ChargeMessage) => {
      const block = this.state.blocks.get(msg.blockId);
      if (!block) {
        client.send("error", { message: "Block not found" });
        return;
      }

      const now = Date.now();
      const cooldownRemaining = CHARGE_COOLDOWN_MS - (now - block.lastChargeTime);

      if (cooldownRemaining > 0) {
        client.send("charge_result", {
          success: false,
          cooldownRemaining,
        });
        return;
      }

      // Streak tracking
      const today = new Date(now).toISOString().slice(0, 10);
      const lastStreakDate = block.lastStreakDate || "";
      const currentStreak = block.streak || 0;

      let newStreak: number;
      if (lastStreakDate === today) {
        newStreak = currentStreak;
      } else if (lastStreakDate && isNextDay(new Date(lastStreakDate).getTime(), now)) {
        newStreak = currentStreak + 1;
      } else if (lastStreakDate === "") {
        newStreak = 1;
      } else {
        newStreak = 1;
      }

      const multiplier = getStreakMultiplier(newStreak);
      const chargeAmount = Math.round(BASE_CHARGE_AMOUNT * multiplier);

      block.energy = Math.min(MAX_ENERGY, block.energy + chargeAmount);
      block.lastChargeTime = now;
      block.streak = newStreak;
      block.lastStreakDate = today;

      client.send("charge_result", {
        success: true,
        streak: newStreak,
        multiplier,
        chargeAmount,
      });
    });

    this.onMessage("customize", (client: Client, msg: CustomizeMessage) => {
      const block = this.state.blocks.get(msg.blockId);
      if (!block) {
        client.send("error", { message: "Block not found" });
        return;
      }

      const changes = msg.changes;
      if (changes.color !== undefined) {
        block.ownerColor = changes.color;
        block.appearance.color = changes.color;
      }
      if (changes.emoji !== undefined) {
        block.appearance.emoji = changes.emoji;
      }
      if (changes.name !== undefined) {
        block.appearance.name = changes.name;
      }
      if (changes.style !== undefined) {
        block.appearance.style = changes.style;
      }
      if (changes.textureId !== undefined) {
        block.appearance.textureId = changes.textureId;
      }
    });

    console.log(`[TowerRoom] Created with ${this.state.blocks.size} blocks`);
  }

  onJoin(client: Client) {
    this.recomputeStats();
    console.log(`[TowerRoom] Client joined: ${client.sessionId}`);
  }

  async onLeave(client: Client, consented: boolean) {
    console.log(`[TowerRoom] Client leaving: ${client.sessionId} (consented: ${consented})`);
    if (!consented) {
      try {
        await this.allowReconnection(client, 60);
        console.log(`[TowerRoom] Client reconnected: ${client.sessionId}`);
      } catch {
        // Reconnection timed out
      }
    }
  }

  onDispose() {
    clearInterval(this.decayInterval);
    this.stopBotSim();
    console.log("[TowerRoom] Disposed");
  }

  private recomputeStats() {
    let occupied = 0;
    let totalEnergy = 0;
    const players = new Set<string>();

    this.state.blocks.forEach((block) => {
      if (block.owner) {
        occupied++;
        totalEnergy += block.energy;
        if (!isBotOwner(block.owner)) {
          players.add(block.owner);
        }
      }
    });

    this.state.stats.totalBlocks = this.state.blocks.size;
    this.state.stats.occupiedBlocks = occupied;
    this.state.stats.activeUsers = players.size;
    this.state.stats.averageEnergy = occupied > 0 ? totalEnergy / occupied : 0;
  }
}
