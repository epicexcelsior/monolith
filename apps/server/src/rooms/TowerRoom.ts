import { Room, Client } from "colyseus";
import { TowerRoomState, BlockSchema } from "../schema/TowerState.js";
import { seedTower, startBotSimulation, isBotOwner } from "../utils/seed-tower.js";
import { MAX_ENERGY, rollChargeAmount, getEvolutionTier, getStreakMultiplier, isNextDay } from "@monolith/common";
import type { ClaimMessage, ChargeMessage, CustomizeMessage, PokeMessage, ChargeQuality } from "@monolith/common";
import {
  loadPlayerBlocks,
  upsertBlock,
  bulkUpsertBlocks,
  insertEvent,
  loadOrCreatePlayer,
  updatePlayerXp,
  setPlayerUsername,
} from "../utils/supabase.js";
import {
  computeXp,
  computeLevel,
  incrementCombo,
  getComboCount,
  type XpAction,
} from "../utils/xp.js";
import { upsertPushToken } from "../utils/push-tokens.js";
import {
  sendPlayerNotification,
  isBlockDormant,
  shouldNotifyEnergyLow,
} from "../utils/notifications.js";

// Game constants (match client)
const DECAY_AMOUNT = 1;
const DECAY_INTERVAL_MS = 60_000;
const CHARGE_COOLDOWN_MS = 30_000;
const STATE_BROADCAST_INTERVAL_MS = 15_000;
const PERSISTENCE_INTERVAL_MS = 60_000;
const DORMANT_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

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
    totalCharges: block.totalCharges,
    bestStreak: block.bestStreak,
    evolutionTier: block.evolutionTier,
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
    total_charges: block.totalCharges,
    best_streak: block.bestStreak,
    evolution_tier: block.evolutionTier,
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
  username: string | null;
}

/** Active room reference for Blink pokes to access directly */
let activeRoom: TowerRoom | null = null;
export function getActiveRoom(): TowerRoom | null {
  return activeRoom;
}

export class TowerRoom extends Room<TowerRoomState> {
  private decayInterval!: ReturnType<typeof setInterval>;
  private broadcastInterval!: ReturnType<typeof setInterval>;
  private persistenceInterval!: ReturnType<typeof setInterval>;
  private stopBotSim!: () => void;
  private players = new Map<string, PlayerState>();
  private pokeCooldowns = new Map<string, number>(); // key: "${poker}:${blockId}" → timestamp
  private chargesToday = 0;
  private lastResetDate = new Date().toISOString().slice(0, 10);
  private decayTickCounter = 0;

  async onCreate() {
    activeRoom = this;
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
          block.totalCharges = row.total_charges ?? 0;
          block.bestStreak = row.best_streak ?? 0;
          block.evolutionTier = row.evolution_tier ?? 0;
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

        // Hourly notification check (every 60 decay ticks = ~1 hour at 60s interval)
        this.decayTickCounter++;
        if (this.decayTickCounter % 60 === 0) {
          this.runHourlyNotificationCheck();
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
        const previousOwner = block.owner;

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

        // Notify previous owner if reclaimed
        if (wasReclaim && previousOwner && !isBotOwner(previousOwner)) {
          sendPlayerNotification(
            previousOwner,
            "block_reclaimed",
            "Your block was reclaimed!",
            `Someone took your dormant block on floor ${block.layer + 1}. Claim a new one!`,
            { blockId: block.id },
          );
        }

        // Notify adjacent neighbors
        const leftId = `block-${block.layer}-${block.index - 1}`;
        const rightId = `block-${block.layer}-${block.index + 1}`;
        for (const neighborId of [leftId, rightId]) {
          const neighbor = this.state.blocks.get(neighborId);
          if (
            neighbor &&
            neighbor.owner &&
            !isBotOwner(neighbor.owner) &&
            neighbor.owner !== msg.wallet
          ) {
            sendPlayerNotification(
              neighbor.owner,
              "new_neighbor",
              "New neighbor!",
              `Someone claimed the block next to yours on floor ${block.layer + 1}!`,
              { blockId: block.id },
            );
          }
        }

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
        // Variable charge: random 15-35 base, then multiplied by streak
        const { amount: baseAmount, quality: chargeQuality } = rollChargeAmount();
        const chargeAmount = Math.round(baseAmount * multiplier);

        block.energy = Math.min(MAX_ENERGY, block.energy + chargeAmount);
        block.lastChargeTime = now;
        block.streak = newStreak;
        block.lastStreakDate = today;
        block.totalCharges++;
        block.bestStreak = Math.max(block.bestStreak, newStreak);
        // Evolution tier never regresses (ratchet)
        block.evolutionTier = Math.max(block.evolutionTier, getEvolutionTier(block.totalCharges, block.bestStreak));
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
          chargeQuality,
          totalCharges: block.totalCharges,
          evolutionTier: block.evolutionTier,
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

        // No XP for customization — was farmable by repeated changes
        insertEvent("customize", msg.blockId, msg.wallet || block.owner);
        client.send("customize_result", { success: true });

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

    this.onMessage("poke", async (client: Client, msg: PokeMessage) => {
      try {
        const block = this.state.blocks.get(msg.blockId);
        if (!block) {
          client.send("error", { message: "Block not found" });
          return;
        }

        if (!block.owner) {
          client.send("error", { message: "Block has no owner to poke" });
          return;
        }

        // Cannot poke own block
        if (block.owner === msg.wallet) {
          client.send("error", { message: "You can't poke your own block" });
          return;
        }

        // Cooldown: 1 poke per block per 24h per poker
        const cooldownKey = `${msg.wallet}:${msg.blockId}`;
        const lastPoke = this.pokeCooldowns.get(cooldownKey);
        const now = Date.now();
        const POKE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

        if (lastPoke && now - lastPoke < POKE_COOLDOWN_MS) {
          const remainingMs = POKE_COOLDOWN_MS - (now - lastPoke);
          client.send("error", { message: `Already poked this block. Try again in ${Math.ceil(remainingMs / 3600000)}h` });
          return;
        }

        // Apply poke: +10% energy (capped at MAX_ENERGY)
        const energyBoost = Math.round(MAX_ENERGY * 0.1);
        block.energy = Math.min(MAX_ENERGY, block.energy + energyBoost);

        // Record cooldown
        this.pokeCooldowns.set(cooldownKey, now);

        // XP for poker (15 XP)
        const player = await this.getOrCreatePlayer(msg.wallet);
        const comboCount = incrementCombo(msg.wallet);
        const pointsEarned = 15;
        player.xp += pointsEarned;
        const oldLevel = player.level;
        player.level = computeLevel(player.xp);
        const levelUp = player.level > oldLevel;

        updatePlayerXp(msg.wallet, player.xp, player.level);
        insertEvent("poke", msg.blockId, msg.wallet, {
          targetOwner: block.owner,
          energyAdded: energyBoost,
        });

        // Persist block
        upsertBlock(blockToRow(block));

        // Send result to poker
        client.send("poke_result", {
          success: true,
          blockId: msg.blockId,
          energyAdded: energyBoost,
          pointsEarned,
          combo: comboCount,
          totalXp: player.xp,
          level: player.level,
          levelUp,
        });

        // Broadcast block update
        this.broadcast("block_update", {
          ...serializeBlock(block),
          eventType: "charge", // Show as charge effect visually
        });

        // Send poke_received to pokee if online
        const pokerPlayer = this.players.get(msg.wallet);
        const pokerName = pokerPlayer?.username || msg.wallet.slice(0, 8) + "...";

        // Find pokee's client
        for (const otherClient of this.clients) {
          if ((otherClient as any)._wallet === block.owner) {
            otherClient.send("poke_received", {
              fromName: pokerName,
              blockId: msg.blockId,
              energyAdded: energyBoost,
            });
          }
        }

        // Push notification to pokee
        if (!isBotOwner(block.owner)) {
          sendPlayerNotification(
            block.owner,
            "poke",
            "You got poked!",
            `${pokerName} poked your block on floor ${block.layer + 1}! +${energyBoost}% energy`,
            { blockId: block.id, from: msg.wallet },
          );
        }

        console.log(`[TowerRoom] ${msg.wallet.slice(0, 8)}... poked ${msg.blockId} (owner: ${block.owner.slice(0, 8)}...)`);
      } catch (err) {
        console.error("[TowerRoom] Poke error:", err);
        client.send("error", { message: "Poke failed" });
      }
    });

    this.onMessage("set_username", async (client: Client, msg: { wallet: string; username: string }) => {
      try {
        if (!msg.wallet || !msg.username) {
          client.send("error", { message: "Wallet and username required" });
          return;
        }

        const username = msg.username.trim();

        // Validate: 3-20 chars, alphanumeric + underscore only
        if (username.length < 3 || username.length > 20) {
          client.send("error", { message: "Username must be 3-20 characters" });
          return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          client.send("error", { message: "Username can only contain letters, numbers, and underscores" });
          return;
        }

        // Check in-memory for duplicate (quick check before Supabase)
        for (const [wallet, playerState] of this.players) {
          if (wallet !== msg.wallet && playerState.username?.toLowerCase() === username.toLowerCase()) {
            client.send("error", { message: "Username already taken" });
            return;
          }
        }

        // Persist to Supabase
        const result = await setPlayerUsername(msg.wallet, username);
        if (!result.success) {
          client.send("error", { message: result.error || "Failed to set username" });
          return;
        }

        // Update in-memory state
        const player = await this.getOrCreatePlayer(msg.wallet);
        player.username = username;

        client.send("username_result", { success: true, username });
        console.log(`[TowerRoom] ${msg.wallet.slice(0, 8)}... set username to "${username}"`);
      } catch (err) {
        console.error("[TowerRoom] set_username error:", err);
        client.send("error", { message: "Failed to set username" });
      }
    });

    this.onMessage("get_leaderboard", (client: Client, msg: { tab?: string; limit?: number }) => {
      try {
        const tab = msg.tab || "xp";
        const limit = Math.min(msg.limit || 20, 50);
        const entries = this.buildLeaderboard(tab, limit);
        client.send("leaderboard_snapshot", { tab, entries });
      } catch (err) {
        console.error("[TowerRoom] get_leaderboard error:", err);
        client.send("leaderboard_snapshot", { tab: msg.tab || "xp", entries: [] });
      }
    });

    this.onMessage("register_push_token", (client: Client, msg: { wallet: string; token: string }) => {
      try {
        if (!msg.wallet || !msg.token) return;
        upsertPushToken(msg.wallet, msg.token);
        console.log(`[TowerRoom] Push token registered for ${msg.wallet.slice(0, 8)}...`);
      } catch (err) {
        console.error("[TowerRoom] register_push_token error:", err);
      }
    });

    console.log(`[TowerRoom] Created with ${this.state.blocks.size} blocks`);
  }

  async onJoin(client: Client, options?: { wallet?: string }) {
    // Store wallet on client for poke_received targeting
    if (options?.wallet) {
      (client as any)._wallet = options.wallet;
    }

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
          username: player.username,
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
    activeRoom = null;
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
      username: row.username ?? null,
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

  /** Build leaderboard from in-memory state */
  private buildLeaderboard(tab: string, limit: number) {
    // Collect per-wallet stats from blocks
    const walletStats = new Map<string, {
      wallet: string;
      username: string | null;
      blocksOwned: number;
      totalEnergy: number;
      bestStreak: number;
      xp: number;
      level: number;
      color: string;
      emoji: string;
    }>();

    this.state.blocks.forEach((block) => {
      if (!block.owner || isBotOwner(block.owner)) return;
      let stats = walletStats.get(block.owner);
      if (!stats) {
        const player = this.players.get(block.owner);
        stats = {
          wallet: block.owner,
          username: player?.username ?? null,
          blocksOwned: 0,
          totalEnergy: 0,
          bestStreak: 0,
          xp: player?.xp ?? 0,
          level: player?.level ?? 1,
          color: block.ownerColor || "#ffffff",
          emoji: block.appearance?.emoji || "",
        };
        walletStats.set(block.owner, stats);
      }
      stats.blocksOwned++;
      stats.totalEnergy += block.energy;
      stats.bestStreak = Math.max(stats.bestStreak, block.streak ?? 0);
    });

    const entries = Array.from(walletStats.values());

    // Sort by tab
    switch (tab) {
      case "energy":
        entries.sort((a, b) => b.totalEnergy - a.totalEnergy);
        break;
      case "streak":
        entries.sort((a, b) => b.bestStreak - a.bestStreak);
        break;
      case "xp":
      default:
        entries.sort((a, b) => b.xp - a.xp);
        break;
    }

    return entries.slice(0, limit).map((e, i) => ({
      rank: i + 1,
      name: e.username || e.wallet.slice(0, 8) + "...",
      emoji: e.emoji,
      color: e.color,
      score: tab === "energy" ? Math.round(e.totalEnergy) : tab === "streak" ? e.bestStreak : e.xp,
      blocksOwned: e.blocksOwned,
      bestStreak: e.bestStreak,
      avgEnergy: e.blocksOwned > 0 ? Math.round(e.totalEnergy / e.blocksOwned) : 0,
      wallet: e.wallet,
    }));
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

  /** Run hourly notification checks (energy low, dormant, streak reminder) */
  private runHourlyNotificationCheck(): void {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const now = Date.now();

      this.state.blocks.forEach((block) => {
        if (!block.owner || isBotOwner(block.owner)) return;

        // Energy low notification
        if (shouldNotifyEnergyLow(block.energy)) {
          sendPlayerNotification(
            block.owner,
            "energy_low",
            "Your block is fading!",
            `Block on floor ${block.layer + 1} is at ${block.energy}% energy. Charge it before it goes dormant!`,
            { blockId: block.id, layer: block.layer, index: block.index },
          );
        }

        // Dormant notification (energy 0, crossed threshold in this hour window)
        if (block.lastChargeTime && isBlockDormant(block.energy, block.lastChargeTime, now)) {
          sendPlayerNotification(
            block.owner,
            "block_dormant",
            "Your block went dormant!",
            `Your block on floor ${block.layer + 1} has been dormant for 3 days and can now be reclaimed by anyone.`,
            { blockId: block.id },
          );
        }

        // Streak reminder (streak >= 3, not charged today)
        if (block.streak >= 3 && block.lastStreakDate && block.lastStreakDate !== today) {
          sendPlayerNotification(
            block.owner,
            "streak_reminder",
            "Keep your streak alive!",
            `Your ${block.streak}-day streak on floor ${block.layer + 1} is at risk! Charge your block today.`,
            { blockId: block.id },
          );
        }
      });
    } catch (err) {
      console.error("[TowerRoom] Hourly notification check error:", err);
    }
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
