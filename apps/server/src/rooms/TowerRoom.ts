import { Room, Client } from "colyseus";
import { TowerRoomState, BlockSchema } from "../schema/TowerState.js";
import { seedTower, startBotSimulation, isBotOwner } from "../utils/seed-tower.js";
import { MAX_ENERGY } from "@monolith/common";
import type { ClaimMessage, ChargeMessage, CustomizeMessage } from "@monolith/common";
import {
  loadPlayerBlocks,
  upsertBlock,
  bulkUpsertBlocks,
  insertEvent,
  loadOrCreatePlayer,
  updatePlayerXp,
} from "../utils/supabase.js";
import {
  computeXp,
  computeLevel,
  incrementCombo,
  getComboCount,
  type XpAction,
} from "../utils/xp.js";

// Game constants (match client)
const DECAY_AMOUNT = 1;
const DECAY_INTERVAL_MS = 60_000;
const CHARGE_COOLDOWN_MS = 30_000;
const BASE_CHARGE_AMOUNT = 20;
const STATE_BROADCAST_INTERVAL_MS = 15_000;
const PERSISTENCE_INTERVAL_MS = 60_000;
const DORMANT_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

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

/** Check if a block is dormant (0 energy, non-bot, 3+ days since last charge) */
function isDormant(block: BlockSchema): boolean {
  if (!block.owner || isBotOwner(block.owner)) return false;
  if (block.energy > 0) return false;
  if (!block.lastChargeTime) return true;
  return Date.now() - block.lastChargeTime > DORMANT_THRESHOLD_MS;
}

/** Serialize a BlockSchema to a plain JSON object */
function serializeBlock(block: BlockSchema) {
  return {
    id: block.id,
    layer: block.layer,
    index: block.index,
    energy: block.energy,
    owner: block.owner,
    ownerColor: block.ownerColor,
    stakedAmount: block.stakedAmount,
    lastChargeTime: block.lastChargeTime,
    streak: block.streak,
    lastStreakDate: block.lastStreakDate,
    imageIndex: block.imageIndex,
    appearance: {
      color: block.appearance.color,
      emoji: block.appearance.emoji,
      name: block.appearance.name,
      style: block.appearance.style,
      textureId: block.appearance.textureId,
    },
  };
}

/** Convert BlockSchema to persistence format */
function blockToRow(block: BlockSchema) {
  return {
    id: block.id,
    layer: block.layer,
    index: block.index,
    energy: block.energy,
    owner: block.owner,
    owner_color: block.ownerColor,
    staked_amount: block.stakedAmount,
    last_charge_time: block.lastChargeTime,
    streak: block.streak,
    last_streak_date: block.lastStreakDate,
    appearance: {
      color: block.appearance.color,
      emoji: block.appearance.emoji,
      name: block.appearance.name,
      style: block.appearance.style,
      textureId: block.appearance.textureId,
    },
  };
}

// In-memory player state (XP, level, stats)
interface PlayerState {
  xp: number;
  level: number;
  totalClaims: number;
  totalCharges: number;
  comboBest: number;
}

export class TowerRoom extends Room<TowerRoomState> {
  private decayInterval!: ReturnType<typeof setInterval>;
  private broadcastInterval!: ReturnType<typeof setInterval>;
  private persistenceInterval!: ReturnType<typeof setInterval>;
  private stopBotSim!: () => void;
  private players = new Map<string, PlayerState>();
  private chargesToday = 0;
  private lastResetDate = new Date().toISOString().slice(0, 10);

  async onCreate() {
    this.setState(new TowerRoomState());

    // Seed tower with bots
    seedTower(this.state.blocks);

    // Overlay persisted player blocks from Supabase
    try {
      const saved = await loadPlayerBlocks();
      for (const row of saved) {
        const block = this.state.blocks.get(row.id);
        if (block) {
          block.owner = row.owner;
          block.ownerColor = row.owner_color || "";
          block.energy = row.energy;
          block.stakedAmount = row.staked_amount;
          block.lastChargeTime = row.last_charge_time;
          block.streak = row.streak;
          block.lastStreakDate = row.last_streak_date;
          if (row.appearance) {
            const a = row.appearance as any;
            if (a.color) block.appearance.color = a.color;
            if (a.emoji) block.appearance.emoji = a.emoji;
            if (a.name) block.appearance.name = a.name;
            if (a.style != null) block.appearance.style = a.style;
            if (a.textureId != null) block.appearance.textureId = a.textureId;
          }
        }
      }
      if (saved.length > 0) {
        console.log(`[TowerRoom] Loaded ${saved.length} player blocks from Supabase`);
      }
    } catch (err) {
      console.error("[TowerRoom] Failed to load from Supabase:", err);
    }

    this.recomputeStats();

    // Start bot simulation
    this.stopBotSim = startBotSimulation(this.state.blocks);

    // Start decay loop
    this.decayInterval = setInterval(() => {
      try {
        this.state.blocks.forEach((block) => {
          if (block.owner) {
            block.energy = Math.max(0, block.energy - DECAY_AMOUNT);
          }
        });
        this.state.tick++;

        // Reset daily counter at UTC midnight
        const today = new Date().toISOString().slice(0, 10);
        if (today !== this.lastResetDate) {
          this.chargesToday = 0;
          this.lastResetDate = today;
        }
      } catch (err) {
        console.error("[TowerRoom] Decay tick error:", err);
      }
    }, DECAY_INTERVAL_MS);

    // Periodic full-state broadcast
    this.broadcastInterval = setInterval(() => {
      try {
        this.broadcastFullState();
      } catch (err) {
        console.error("[TowerRoom] Broadcast error:", err);
      }
    }, STATE_BROADCAST_INTERVAL_MS);

    // Periodic persistence (save player-owned blocks)
    this.persistenceInterval = setInterval(() => {
      try {
        this.persistPlayerBlocks();
      } catch (err) {
        console.error("[TowerRoom] Persistence error:", err);
      }
    }, PERSISTENCE_INTERVAL_MS);

    // ─── Message Handlers ─────────────────────────

    this.onMessage("request_state", (client: Client) => {
      try {
        client.send("tower_state", this.buildFullState());
      } catch (err) {
        console.error("[TowerRoom] request_state error:", err);
        client.send("error", { message: "Failed to get state" });
      }
    });

    this.onMessage("claim", async (client: Client, msg: ClaimMessage) => {
      try {
        const block = this.state.blocks.get(msg.blockId);
        if (!block) {
          client.send("error", { message: "Block not found" });
          return;
        }

        // Allow claiming unclaimed, bot-owned, or dormant blocks
        const canClaim = !block.owner || isBotOwner(block.owner) || isDormant(block);
        if (!canClaim) {
          client.send("error", { message: "Block already claimed by a player" });
          return;
        }

        const wasReclaim = isDormant(block);

        block.owner = msg.wallet;
        block.ownerColor = msg.color;
        block.energy = MAX_ENERGY;
        block.stakedAmount = msg.amount;
        block.lastChargeTime = Date.now();
        block.streak = 0;
        block.lastStreakDate = "";
        block.appearance.color = msg.color;

        this.recomputeStats();

        // XP computation
        const player = await this.getOrCreatePlayer(msg.wallet);
        const isFirstBlock = player.totalClaims === 0;
        const comboCount = incrementCombo(msg.wallet);
        const pointsEarned = computeXp("claim", { isFirstBlock, comboCount: comboCount - 1 });
        player.xp += pointsEarned;
        player.totalClaims++;
        const oldLevel = player.level;
        player.level = computeLevel(player.xp);
        const levelUp = player.level > oldLevel;

        // Persist (fire-and-forget, errors logged internally)
        upsertBlock(blockToRow(block));
        updatePlayerXp(msg.wallet, player.xp, player.level, {
          total_claims: player.totalClaims,
          combo_best: Math.max(player.comboBest, comboCount),
        });
        insertEvent(wasReclaim ? "reclaim" : "claim", msg.blockId, msg.wallet, {
          pointsEarned,
          layer: block.layer,
          index: block.index,
        });

        if (levelUp) {
          insertEvent("level_up", undefined, msg.wallet, {
            newLevel: player.level,
          });
        }

        // Response to claiming client
        client.send("claim_result", {
          success: true,
          blockId: msg.blockId,
          pointsEarned,
          combo: comboCount,
          totalXp: player.xp,
          level: player.level,
          levelUp,
        });

        // Broadcast to ALL clients with eventType
        this.broadcast("block_update", {
          ...serializeBlock(block),
          eventType: "claim",
        });

        console.log(`[TowerRoom] ${msg.wallet.slice(0, 8)}... ${wasReclaim ? "reclaimed" : "claimed"} ${msg.blockId}`);
      } catch (err) {
        console.error("[TowerRoom] Claim error:", err);
        client.send("error", { message: "Claim failed" });
      }
    });

    this.onMessage("charge", async (client: Client, msg: ChargeMessage) => {
      try {
        const block = this.state.blocks.get(msg.blockId);
        if (!block) {
          client.send("error", { message: "Block not found" });
          return;
        }

        // Ownership enforcement
        if (msg.wallet && block.owner !== msg.wallet) {
          client.send("error", { message: "Not your block" });
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
        this.chargesToday++;

        // XP computation
        const wallet = msg.wallet || block.owner;
        const player = await this.getOrCreatePlayer(wallet);
        const comboCount = incrementCombo(wallet);
        const pointsEarned = computeXp("charge", {
          streak: newStreak,
          comboCount: comboCount - 1,
        });
        player.xp += pointsEarned;
        player.totalCharges++;
        const oldLevel = player.level;
        player.level = computeLevel(player.xp);
        const levelUp = player.level > oldLevel;

        if (comboCount > player.comboBest) {
          player.comboBest = comboCount;
        }

        // Persist (fire-and-forget, errors logged internally)
        upsertBlock(blockToRow(block));
        updatePlayerXp(wallet, player.xp, player.level, {
          total_charges: player.totalCharges,
          combo_best: player.comboBest,
        });
        insertEvent("charge", msg.blockId, wallet);

        if (levelUp) {
          insertEvent("level_up", undefined, wallet, {
            newLevel: player.level,
          });
        }

        client.send("charge_result", {
          success: true,
          streak: newStreak,
          multiplier,
          chargeAmount,
          pointsEarned,
          combo: comboCount,
          totalXp: player.xp,
          level: player.level,
          levelUp,
        });

        // Broadcast to ALL clients with eventType
        this.broadcast("block_update", {
          ...serializeBlock(block),
          eventType: "charge",
        });
      } catch (err) {
        console.error("[TowerRoom] Charge error:", err);
        client.send("error", { message: "Charge failed" });
      }
    });

    this.onMessage("customize", async (client: Client, msg: CustomizeMessage) => {
      try {
        const block = this.state.blocks.get(msg.blockId);
        if (!block) {
          client.send("error", { message: "Block not found" });
          return;
        }

        // Ownership enforcement
        if (msg.wallet && block.owner !== msg.wallet) {
          client.send("error", { message: "Not your block" });
          return;
        }

        const changes = msg.changes;
        if (changes.color !== undefined) {
          block.ownerColor = changes.color;
          block.appearance.color = changes.color;
        }
        if (changes.emoji !== undefined) block.appearance.emoji = changes.emoji;
        if (changes.name !== undefined) block.appearance.name = changes.name;
        if (changes.style !== undefined) block.appearance.style = changes.style;
        if (changes.textureId !== undefined) block.appearance.textureId = changes.textureId;

        // XP for customization
        const wallet = msg.wallet || block.owner;
        if (wallet) {
          const player = await this.getOrCreatePlayer(wallet);
          const comboCount = incrementCombo(wallet);
          const pointsEarned = computeXp("customize", { comboCount: comboCount - 1 });
          player.xp += pointsEarned;
          const oldLevel = player.level;
          player.level = computeLevel(player.xp);
          const levelUp = player.level > oldLevel;

          updatePlayerXp(wallet, player.xp, player.level);
          insertEvent("customize", msg.blockId, wallet);

          client.send("customize_result", {
            success: true,
            pointsEarned,
            combo: comboCount,
            totalXp: player.xp,
            level: player.level,
            levelUp,
          });
        }

        // Persist block (fire-and-forget)
        upsertBlock(blockToRow(block));

        // Broadcast to ALL clients with eventType
        this.broadcast("block_update", {
          ...serializeBlock(block),
          eventType: "customize",
        });
      } catch (err) {
        console.error("[TowerRoom] Customize error:", err);
        client.send("error", { message: "Customize failed" });
      }
    });

    console.log(`[TowerRoom] Created with ${this.state.blocks.size} blocks`);
  }

  async onJoin(client: Client, options?: { wallet?: string }) {
    // Send full tower state
    client.send("tower_state", this.buildFullState());
    this.recomputeStats();

    // Send player sync if wallet provided
    if (options?.wallet) {
      try {
        const player = await this.getOrCreatePlayer(options.wallet);
        client.send("player_sync", {
          xp: player.xp,
          level: player.level,
          totalClaims: player.totalClaims,
          totalCharges: player.totalCharges,
          comboBest: player.comboBest,
        });
      } catch (err) {
        console.error("[TowerRoom] player_sync error:", err);
      }
    }

    console.log(`[TowerRoom] Client joined: ${client.sessionId}, sent ${this.state.blocks.size} blocks`);
  }

  async onLeave(client: Client, consented: boolean) {
    console.log(`[TowerRoom] Client leaving: ${client.sessionId} (consented: ${consented})`);
    this.recomputeStats();
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
    clearInterval(this.broadcastInterval);
    clearInterval(this.persistenceInterval);
    this.stopBotSim();

    // Final persistence save
    this.persistPlayerBlocks();

    console.log("[TowerRoom] Disposed");
  }

  /** Get or create in-memory player state, loading from Supabase on first access */
  private async getOrCreatePlayer(wallet: string): Promise<PlayerState> {
    let player = this.players.get(wallet);
    if (player) return player;

    const row = await loadOrCreatePlayer(wallet);
    player = {
      xp: row.xp,
      level: row.level,
      totalClaims: row.total_claims,
      totalCharges: row.total_charges,
      comboBest: row.combo_best,
    };
    this.players.set(wallet, player);
    return player;
  }

  /** Save all player-owned blocks to Supabase */
  private persistPlayerBlocks() {
    const playerBlocks: ReturnType<typeof blockToRow>[] = [];
    this.state.blocks.forEach((block) => {
      if (block.owner && !isBotOwner(block.owner)) {
        playerBlocks.push(blockToRow(block));
      }
    });
    if (playerBlocks.length > 0) {
      bulkUpsertBlocks(playerBlocks);
    }
  }

  /** Serialize full tower state to plain JSON */
  private buildFullState() {
    const blocks: ReturnType<typeof serializeBlock>[] = [];
    this.state.blocks.forEach((block) => {
      blocks.push(serializeBlock(block));
    });

    return {
      blocks,
      stats: {
        totalBlocks: this.state.stats.totalBlocks,
        occupiedBlocks: this.state.stats.occupiedBlocks,
        activeUsers: this.clients.length,
        averageEnergy: this.state.stats.averageEnergy,
        chargesToday: this.chargesToday,
      },
      tick: this.state.tick,
    };
  }

  /** Broadcast full state to all connected clients */
  private broadcastFullState() {
    this.recomputeStats();
    this.broadcast("tower_state", this.buildFullState());
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
    this.state.stats.activeUsers = this.clients.length;
    this.state.stats.averageEnergy = occupied > 0 ? totalEnergy / occupied : 0;
  }
}
