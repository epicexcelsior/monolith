import { Room, Client } from "colyseus";
import { TowerRoomState, BlockSchema } from "../schema/TowerState.js";
import { seedTower, startBotSimulation, isBotOwner } from "../utils/seed-tower.js";
import { MAX_ENERGY, rollChargeAmount, getEvolutionTier, getStreakMultiplier, isNextDay, TESTING_MODE, GHOST_BLOCK_LIMIT, GHOST_DECAY_MULTIPLIER, GHOST_CHARGE_CAP, GHOST_BLOCK_LAYERS, MAX_PACTS_PER_BLOCK, PACT_BONUS_ENERGY, PACT_REQUEST_EXPIRY_MS, PACT_MISS_LIMIT, STREAK_FREEZE_EARN_INTERVAL, STREAK_FREEZE_MAX } from "@monolith/common";
import type { ClaimMessage, ChargeMessage, CustomizeMessage, PokeMessage, ChargeQuality, Pact } from "@monolith/common";
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
import { resolveSkrName } from "../utils/skr-resolver.js";
import {
  sendPlayerNotification,
} from "../utils/notifications.js";
import {
  generateNonce,
  consumeNonce,
  verifyWalletSignature,
} from "../utils/auth.js";
import {
  recordLayerCharge,
  checkWeeklyReset,
  getFloorLeaderboard,
  getWinningFloor,
  getWeeklyCharges,
} from "../utils/floor-competition.js";
import {
  checkQuestProgress,
  getQuestState,
} from "../utils/quests.js";
import {
  getCurrentEvent,
  getChargeEventMultiplier,
} from "../utils/weekly-events.js";

// ─── Input Validation ────────────────────────────────────
const BLOCK_ID_RE = /^block-\d+-\d+$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_NAME_LENGTH = 30;
const MAX_EMOJI_LENGTH = 4;
const HTML_TAG_RE = /<[^>]*>/;

function isValidBlockId(id: unknown): id is string {
  return typeof id === "string" && BLOCK_ID_RE.test(id);
}
function isValidColor(c: unknown): c is string {
  return typeof c === "string" && COLOR_RE.test(c);
}
function isValidName(n: unknown): n is string {
  return typeof n === "string" && n.length <= MAX_NAME_LENGTH && !HTML_TAG_RE.test(n);
}
function isValidEmoji(e: unknown): e is string {
  return typeof e === "string" && e.length <= MAX_EMOJI_LENGTH;
}
function isValidStyle(s: unknown): s is number {
  return typeof s === "number" && Number.isInteger(s) && s >= 0 && s <= 10;
}
function isValidTextureId(t: unknown): t is number {
  return typeof t === "number" && Number.isInteger(t) && t >= 0 && t <= 6;
}
function isValidPersonality(p: unknown): p is number {
  return typeof p === "number" && Number.isInteger(p) && p >= -1 && p <= 4;
}

// Game constants (match client)
const DECAY_AMOUNT = 1;
const DECAY_INTERVAL_MS = 60_000;
const CHARGE_COOLDOWN_MS = TESTING_MODE ? 5_000 : 30_000;
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
export function serializeBlock(block: BlockSchema, ownerName?: string) {
  return {
    id: block.id,
    layer: block.layer,
    index: block.index,
    energy: block.energy,
    owner: block.owner,
    ownerName: ownerName || undefined,
    ownerColor: block.ownerColor,
    stakedAmount: block.stakedAmount,
    lastChargeTime: block.lastChargeTime,
    streak: block.streak,
    lastStreakDate: block.lastStreakDate,
    imageIndex: block.imageIndex,
    totalCharges: block.totalCharges,
    bestStreak: block.bestStreak,
    evolutionTier: block.evolutionTier,
    isGhost: block.isGhost || false,
    freezes: block.freezes || 0,
    appearance: {
      color: block.appearance.color,
      emoji: block.appearance.emoji,
      name: block.appearance.name,
      style: block.appearance.style,
      textureId: block.appearance.textureId,
      imageUrl: block.appearance.imageUrl || undefined,
      personality: block.appearance.personality ?? -1,
    },
  };
}

/** Convert BlockSchema to persistence format */
export function blockToRow(block: BlockSchema) {
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
    is_ghost: block.isGhost || false,
    appearance: {
      color: block.appearance.color,
      emoji: block.appearance.emoji,
      name: block.appearance.name,
      style: block.appearance.style,
      textureId: block.appearance.textureId,
      imageUrl: block.appearance.imageUrl || undefined,
      personality: block.appearance.personality ?? -1,
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
  skrName: string | null;
}

/** Active room reference for Blink pokes to access directly */
let activeRoom: TowerRoom | null = null;
export function getActiveRoom(): TowerRoom | null {
  return activeRoom;
}

/** One-time upload tokens: token → { wallet, blockId, expires } */
const uploadTokens = new Map<string, { wallet: string; blockId: string; expires: number }>();
const UPLOAD_TOKEN_TTL_MS = 60_000; // 60 seconds

export function validateUploadToken(token: string, blockId: string): string | null {
  const entry = uploadTokens.get(token);
  if (!entry) return null;
  uploadTokens.delete(token); // one-time use
  if (Date.now() > entry.expires) return null;
  if (entry.blockId !== blockId) return null;
  return entry.wallet;
}

function generateToken(): string {
  return require("crypto").randomBytes(24).toString("base64url");
}

export class TowerRoom extends Room<TowerRoomState> {
  private decayInterval!: ReturnType<typeof setInterval>;
  private broadcastInterval!: ReturnType<typeof setInterval>;
  private persistenceInterval!: ReturnType<typeof setInterval>;
  private stopBotSim!: () => void;
  private players = new Map<string, PlayerState>();
  private pokeCooldowns = new Map<string, number>(); // key: "${poker}:${blockId}" → timestamp
  private pacts = new Map<string, Pact>(); // key: sorted pair of block IDs
  private pactRequests = new Map<string, { from: string; to: string; fromOwner: string; toOwner: string; expires: number }>();
  private chargesToday = 0;
  private lastResetDate = new Date().toISOString().slice(0, 10);

  /** Get the verified wallet address bound to this client session (set on join). */
  private getSessionWallet(client: Client): string | null {
    return (client as any)._wallet || null;
  }

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
            if (a.imageUrl) block.appearance.imageUrl = a.imageUrl;
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

    // Pre-resolve .skr names for all block owners (background, non-blocking)
    const ownerWallets = new Set<string>();
    this.state.blocks.forEach((block) => {
      if (block.owner && !isBotOwner(block.owner)) {
        ownerWallets.add(block.owner);
      }
    });
    if (ownerWallets.size > 0) {
      Promise.all(
        Array.from(ownerWallets).map(async (wallet) => {
          const player = await this.getOrCreatePlayer(wallet);
          // skrName is resolved in background by getOrCreatePlayer
          return player;
        }),
      ).then(() => {
        console.log(`[TowerRoom] Pre-resolved names for ${ownerWallets.size} block owners`);
      }).catch((err) => {
        console.error("[TowerRoom] SKR pre-resolve error:", err);
      });
    }

    // Start bot simulation
    this.stopBotSim = startBotSimulation(this.state.blocks);

    // Start decay loop with state-transition notifications
    this.decayInterval = setInterval(() => {
      try {
        const today = new Date().toISOString().slice(0, 10);

        this.state.blocks.forEach((block) => {
          if (!block.owner || isBotOwner(block.owner)) return;

          const prevEnergy = block.energy;
          const decay = block.isGhost ? DECAY_AMOUNT * GHOST_DECAY_MULTIPLIER : DECAY_AMOUNT;
          block.energy = Math.max(0, block.energy - decay);

          // State-transition: crossed 20% threshold (fading)
          if (prevEnergy > 20 && block.energy <= 20 && block.energy > 0) {
            sendPlayerNotification(
              block.owner,
              "energy_low",
              "Your block is fading!",
              `Block on floor ${block.layer + 1} is at ${Math.round(block.energy)}% energy. Charge it!`,
              { blockId: block.id },
            );
          }

          // State-transition: block just hit 0 (dormant)
          if (prevEnergy > 0 && block.energy === 0) {
            sendPlayerNotification(
              block.owner,
              "block_dormant",
              "Your block went dormant!",
              `Your block on floor ${block.layer + 1} lost all energy. Charge it before someone reclaims it!`,
              { blockId: block.id },
            );
          }

          // Streak reminder: once per day after 18:00 UTC
          const hour = new Date().getUTCHours();
          if (hour >= 18 && block.streak >= 3 && block.lastStreakDate && block.lastStreakDate !== today) {
            sendPlayerNotification(
              block.owner,
              "streak_reminder",
              "Keep your streak alive!",
              `Your ${block.streak}-day streak on floor ${block.layer + 1} is at risk!`,
              { blockId: block.id },
            );
          }
        });
        this.state.tick++;

        // Reset daily counter at UTC midnight
        if (today !== this.lastResetDate) {
          this.chargesToday = 0;
          this.lastResetDate = today;
        }

        // Weekly floor competition reset (Monday UTC)
        const weeklyWinner = checkWeeklyReset();
        if (weeklyWinner) {
          this.broadcast("floor_winner", weeklyWinner);
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

    this.onMessage("auth_response", async (client: Client, msg: { wallet: string; signature: number[] }) => {
      try {
        if (!msg.wallet || !msg.signature) {
          client.send("auth_failure", { message: "Missing wallet or signature" });
          return;
        }

        const nonce = consumeNonce(client.sessionId);
        if (!nonce) {
          client.send("auth_failure", { message: "Nonce expired or already used" });
          return;
        }

        const signature = new Uint8Array(msg.signature);
        if (!verifyWalletSignature(msg.wallet, nonce, signature)) {
          client.send("auth_failure", { message: "Invalid signature" });
          return;
        }

        // Auth verified — bind wallet to session
        (client as any)._wallet = msg.wallet;
        client.send("auth_success", { wallet: msg.wallet });

        // Send player sync now that auth is verified
        try {
          const player = await this.getOrCreatePlayer(msg.wallet);
          client.send("player_sync", {
            xp: player.xp,
            level: player.level,
            totalClaims: player.totalClaims,
            totalCharges: player.totalCharges,
            comboBest: player.comboBest,
            username: player.username,
            skrName: player.skrName,
          });
        } catch (err) {
          console.error("[TowerRoom] player_sync error after auth:", err);
        }

        console.log(`[TowerRoom] Wallet verified: ${msg.wallet.slice(0, 8)}...`);
      } catch (err) {
        console.error("[TowerRoom] auth_response error:", err);
        client.send("auth_failure", { message: "Authentication failed" });
      }
    });

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
        if (!isValidBlockId(msg.blockId)) {
          client.send("error", { message: "Invalid blockId" });
          return;
        }
        if (msg.color !== undefined && !isValidColor(msg.color)) {
          client.send("error", { message: "Invalid color" });
          return;
        }

        const wallet = this.getSessionWallet(client);
        if (!wallet) {
          client.send("error", { message: "Not authenticated" });
          return;
        }

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

        block.owner = wallet;
        block.ownerColor = msg.color;
        block.energy = MAX_ENERGY;
        block.stakedAmount = msg.amount;
        block.lastChargeTime = Date.now();
        block.streak = 0;
        block.lastStreakDate = "";
        block.appearance.color = msg.color;

        this.recomputeStats();

        // XP computation
        const player = await this.getOrCreatePlayer(wallet);
        const isFirstBlock = player.totalClaims === 0;
        const comboCount = incrementCombo(wallet);
        const pointsEarned = computeXp("claim", { isFirstBlock, comboCount: comboCount - 1 });
        player.xp += pointsEarned;
        player.totalClaims++;
        const oldLevel = player.level;
        player.level = computeLevel(player.xp);
        const levelUp = player.level > oldLevel;

        // Persist (fire-and-forget, errors logged internally)
        upsertBlock(blockToRow(block));
        updatePlayerXp(wallet, player.xp, player.level, {
          total_claims: player.totalClaims,
          combo_best: Math.max(player.comboBest, comboCount),
        });
        insertEvent(wasReclaim ? "reclaim" : "claim", msg.blockId, wallet, {
          pointsEarned,
          layer: block.layer,
          index: block.index,
        });

        if (levelUp) {
          insertEvent("level_up", undefined, wallet, {
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
          ...serializeBlock(block, this.getOwnerName(block.owner)),
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
            neighbor.owner !== wallet
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

        console.log(`[TowerRoom] ${wallet.slice(0, 8)}... ${wasReclaim ? "reclaimed" : "claimed"} ${msg.blockId}`);
      } catch (err) {
        console.error("[TowerRoom] Claim error:", err);
        client.send("error", { message: "Claim failed" });
      }
    });

    this.onMessage("ghost_claim", async (client: Client, msg: { blockId: string; color?: string }) => {
      try {
        if (!isValidBlockId(msg.blockId)) {
          client.send("error", { message: "Invalid blockId" });
          return;
        }

        const block = this.state.blocks.get(msg.blockId);
        if (!block) {
          client.send("error", { message: "Block not found" });
          return;
        }

        // Ghost blocks only on eligible layers
        if (!GHOST_BLOCK_LAYERS.includes(block.layer)) {
          client.send("error", { message: "Ghost blocks only on bottom 6 layers" });
          return;
        }

        // Block must be unclaimed, bot-owned, or dormant
        const canClaim = !block.owner || isBotOwner(block.owner) || isDormant(block);
        if (!canClaim) {
          client.send("error", { message: "Block already claimed" });
          return;
        }

        // Check ghost limit per session (use wallet if available, else sessionId)
        const wallet = this.getSessionWallet(client) || client.sessionId;
        let ghostCount = 0;
        this.state.blocks.forEach((b) => {
          if (b.isGhost && b.owner === wallet) ghostCount++;
        });
        if (ghostCount >= GHOST_BLOCK_LIMIT) {
          client.send("error", { message: `Max ${GHOST_BLOCK_LIMIT} ghost block(s)` });
          return;
        }

        block.owner = wallet;
        block.ownerColor = msg.color || "#00ffff";
        block.energy = GHOST_CHARGE_CAP;
        block.stakedAmount = 0;
        block.lastChargeTime = Date.now();
        block.streak = 0;
        block.lastStreakDate = "";
        block.isGhost = true;
        if (msg.color) block.appearance.color = msg.color;

        this.recomputeStats();

        // Persist
        upsertBlock(blockToRow(block));
        insertEvent("claim", msg.blockId, wallet, { ghost: true });

        client.send("claim_result", {
          success: true,
          blockId: msg.blockId,
          pointsEarned: 10,
          combo: 1,
          totalXp: 10,
          level: 1,
          levelUp: false,
        });

        this.broadcast("block_update", {
          ...serializeBlock(block),
          eventType: "claim",
        });

        console.log(`[TowerRoom] Ghost claim: ${wallet.slice(0, 8)}... claimed ${msg.blockId}`);
      } catch (err) {
        console.error("[TowerRoom] ghost_claim error:", err);
        client.send("error", { message: "Ghost claim failed" });
      }
    });

    this.onMessage("upgrade_ghost", async (client: Client, msg: { blockId: string; amount: number }) => {
      try {
        if (!isValidBlockId(msg.blockId)) {
          client.send("error", { message: "Invalid blockId" });
          return;
        }

        const wallet = this.getSessionWallet(client);
        if (!wallet) {
          client.send("error", { message: "Not authenticated" });
          return;
        }

        const block = this.state.blocks.get(msg.blockId);
        if (!block) {
          client.send("error", { message: "Block not found" });
          return;
        }

        if (block.owner !== wallet) {
          client.send("error", { message: "Not your block" });
          return;
        }

        if (!block.isGhost) {
          client.send("error", { message: "Block is not a ghost block" });
          return;
        }

        // Upgrade: remove ghost flag, set staked amount, restore full energy cap
        block.isGhost = false;
        block.stakedAmount = msg.amount || 0;
        block.energy = MAX_ENERGY;

        upsertBlock(blockToRow(block));
        insertEvent("upgrade_ghost", msg.blockId, wallet);

        client.send("upgrade_result", { success: true, blockId: msg.blockId });

        this.broadcast("block_update", {
          ...serializeBlock(block, this.getOwnerName(block.owner)),
          eventType: "claim",
        });

        console.log(`[TowerRoom] Ghost upgraded: ${wallet.slice(0, 8)}... upgraded ${msg.blockId}`);
      } catch (err) {
        console.error("[TowerRoom] upgrade_ghost error:", err);
        client.send("error", { message: "Upgrade failed" });
      }
    });

    this.onMessage("pact_request", (client: Client, msg: { blockId: string; targetBlockId: string }) => {
      try {
        const wallet = this.getSessionWallet(client);
        if (!wallet) { client.send("error", { message: "Not authenticated" }); return; }
        if (!isValidBlockId(msg.blockId) || !isValidBlockId(msg.targetBlockId)) {
          client.send("error", { message: "Invalid block ID" }); return;
        }

        const myBlock = this.state.blocks.get(msg.blockId);
        const targetBlock = this.state.blocks.get(msg.targetBlockId);
        if (!myBlock || !targetBlock) { client.send("error", { message: "Block not found" }); return; }
        if (myBlock.owner !== wallet) { client.send("error", { message: "Not your block" }); return; }
        if (!targetBlock.owner || isBotOwner(targetBlock.owner)) { client.send("error", { message: "Target has no player owner" }); return; }

        // Check adjacency (same layer, adjacent index)
        if (myBlock.layer !== targetBlock.layer || Math.abs(myBlock.index - targetBlock.index) > 1) {
          client.send("error", { message: "Blocks must be adjacent" }); return;
        }

        // Check pact limits
        const pactKey = [msg.blockId, msg.targetBlockId].sort().join(":");
        if (this.pacts.has(pactKey)) { client.send("error", { message: "Pact already exists" }); return; }

        let myPactCount = 0;
        this.pacts.forEach((p) => { if (p.blockA === msg.blockId || p.blockB === msg.blockId) myPactCount++; });
        if (myPactCount >= MAX_PACTS_PER_BLOCK) { client.send("error", { message: "Max pacts reached" }); return; }

        this.pactRequests.set(pactKey, {
          from: msg.blockId, to: msg.targetBlockId,
          fromOwner: wallet, toOwner: targetBlock.owner,
          expires: Date.now() + PACT_REQUEST_EXPIRY_MS,
        });

        // Notify target owner if online
        for (const otherClient of this.clients) {
          if ((otherClient as any)._wallet === targetBlock.owner) {
            otherClient.send("pact_request_received", {
              fromBlockId: msg.blockId, targetBlockId: msg.targetBlockId,
              fromOwner: this.getOwnerName(wallet) || wallet.slice(0, 8) + "...",
            });
          }
        }

        client.send("pact_request_sent", { success: true });
      } catch (err) {
        console.error("[TowerRoom] pact_request error:", err);
        client.send("error", { message: "Pact request failed" });
      }
    });

    this.onMessage("pact_accept", (client: Client, msg: { blockId: string; fromBlockId: string }) => {
      try {
        const wallet = this.getSessionWallet(client);
        if (!wallet) { client.send("error", { message: "Not authenticated" }); return; }

        const pactKey = [msg.blockId, msg.fromBlockId].sort().join(":");
        const request = this.pactRequests.get(pactKey);
        if (!request || Date.now() > request.expires) {
          this.pactRequests.delete(pactKey);
          client.send("error", { message: "Pact request expired" }); return;
        }

        const block = this.state.blocks.get(msg.blockId);
        if (!block || block.owner !== wallet) { client.send("error", { message: "Not your block" }); return; }

        this.pactRequests.delete(pactKey);

        const pact: Pact = {
          id: pactKey,
          blockA: request.from, blockB: request.to,
          ownerA: request.fromOwner, ownerB: wallet,
          createdAt: Date.now(),
          lastBothChargedDate: "",
          consecutiveMisses: 0,
        };
        this.pacts.set(pactKey, pact);

        // Notify both parties
        client.send("pact_formed", { pact });
        for (const otherClient of this.clients) {
          if ((otherClient as any)._wallet === request.fromOwner) {
            otherClient.send("pact_formed", { pact });
          }
        }

        console.log(`[TowerRoom] Pact formed: ${request.from} ↔ ${request.to}`);
      } catch (err) {
        console.error("[TowerRoom] pact_accept error:", err);
        client.send("error", { message: "Pact accept failed" });
      }
    });

    this.onMessage("charge", async (client: Client, msg: ChargeMessage) => {
      try {
        if (!isValidBlockId(msg.blockId)) {
          client.send("error", { message: "Invalid blockId" });
          return;
        }

        const wallet = this.getSessionWallet(client);
        if (!wallet) {
          client.send("error", { message: "Not authenticated" });
          return;
        }

        const block = this.state.blocks.get(msg.blockId);
        if (!block) {
          client.send("error", { message: "Block not found" });
          return;
        }

        // Ownership enforcement
        if (block.owner !== wallet) {
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
        let freezeUsed = false;
        if (lastStreakDate === today) {
          newStreak = currentStreak;
        } else if (lastStreakDate && isNextDay(new Date(lastStreakDate).getTime(), now)) {
          newStreak = currentStreak + 1;
        } else if (lastStreakDate === "") {
          newStreak = 1;
        } else {
          // Gap day — try streak freeze
          if (block.freezes > 0) {
            block.freezes--;
            newStreak = currentStreak; // keep streak, don't increment
            freezeUsed = true;
            client.send("streak_freeze_used", {
              blockId: msg.blockId,
              streak: currentStreak,
              freezesRemaining: block.freezes,
            });
          } else {
            newStreak = 1;
          }
        }

        // Award streak freeze at 7-day milestones
        if (newStreak > 0 && newStreak % STREAK_FREEZE_EARN_INTERVAL === 0 && lastStreakDate !== today) {
          block.freezes = Math.min(block.freezes + 1, STREAK_FREEZE_MAX);
          client.send("streak_freeze_earned", {
            blockId: msg.blockId,
            freezes: block.freezes,
          });
        }

        const multiplier = getStreakMultiplier(newStreak);
        // Variable charge: random 15-35 base, then multiplied by streak + event bonus
        const { amount: baseAmount, quality: chargeQuality } = rollChargeAmount();
        const eventMultiplier = getChargeEventMultiplier();
        const chargeAmount = Math.round(baseAmount * multiplier * eventMultiplier);

        const energyCap = block.isGhost ? GHOST_CHARGE_CAP : MAX_ENERGY;
        block.energy = Math.min(energyCap, block.energy + chargeAmount);
        block.lastChargeTime = now;
        block.streak = newStreak;
        block.lastStreakDate = today;
        block.totalCharges++;
        block.bestStreak = Math.max(block.bestStreak, newStreak);
        // Evolution tier never regresses (ratchet)
        block.evolutionTier = Math.max(block.evolutionTier, getEvolutionTier(block.totalCharges, block.bestStreak));
        this.chargesToday++;
        recordLayerCharge(block.layer);

        // Pact bonus: if both pact partners charged today, award bonus energy to each
        this.pacts.forEach((pact) => {
          if (pact.blockA !== msg.blockId && pact.blockB !== msg.blockId) return;
          const partnerBlockId = pact.blockA === msg.blockId ? pact.blockB : pact.blockA;
          const partnerBlock = this.state.blocks.get(partnerBlockId);
          if (partnerBlock?.lastStreakDate === today && pact.lastBothChargedDate !== today) {
            pact.lastBothChargedDate = today;
            pact.consecutiveMisses = 0;
            // Award bonus to both blocks
            const cap = block.isGhost ? GHOST_CHARGE_CAP : MAX_ENERGY;
            block.energy = Math.min(cap, block.energy + PACT_BONUS_ENERGY);
            const partnerCap = partnerBlock.isGhost ? GHOST_CHARGE_CAP : MAX_ENERGY;
            partnerBlock.energy = Math.min(partnerCap, partnerBlock.energy + PACT_BONUS_ENERGY);
          }
        });

        // XP computation
        // wallet already extracted from session above
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

        // Quest progress
        const questResult = checkQuestProgress(wallet, "charge");
        if (chargeQuality === "great") checkQuestProgress(wallet, "great_charge");
        if (block.energy >= MAX_ENERGY) checkQuestProgress(wallet, "full_charge");
        if (newStreak > 0 && block.lastStreakDate === today) checkQuestProgress(wallet, "streak");
        if (questResult.xpEarned > 0) {
          player.xp += questResult.xpEarned;
          player.level = computeLevel(player.xp);
        }
        // Send quest update
        client.send("quest_update", { quests: getQuestState(wallet) });

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
          ...serializeBlock(block, this.getOwnerName(block.owner)),
          eventType: "charge",
        });
      } catch (err) {
        console.error("[TowerRoom] Charge error:", err);
        client.send("error", { message: "Charge failed" });
      }
    });

    this.onMessage("customize", async (client: Client, msg: CustomizeMessage) => {
      try {
        if (!isValidBlockId(msg.blockId)) {
          client.send("error", { message: "Invalid blockId" });
          return;
        }

        const changes = msg.changes;
        if (!changes || typeof changes !== "object") {
          client.send("error", { message: "Missing changes" });
          return;
        }
        if (changes.color !== undefined && !isValidColor(changes.color)) {
          client.send("error", { message: "Invalid color" });
          return;
        }
        if (changes.emoji !== undefined && !isValidEmoji(changes.emoji)) {
          client.send("error", { message: "Invalid emoji" });
          return;
        }
        if (changes.name !== undefined && !isValidName(changes.name)) {
          client.send("error", { message: "Invalid name (max 30 chars, no HTML)" });
          return;
        }
        if (changes.style !== undefined && !isValidStyle(changes.style)) {
          client.send("error", { message: "Invalid style" });
          return;
        }
        if (changes.textureId !== undefined && !isValidTextureId(changes.textureId)) {
          client.send("error", { message: "Invalid textureId" });
          return;
        }
        if (changes.personality !== undefined && !isValidPersonality(changes.personality)) {
          client.send("error", { message: "Invalid personality" });
          return;
        }

        const wallet = this.getSessionWallet(client);
        if (!wallet) {
          client.send("error", { message: "Not authenticated" });
          return;
        }

        const block = this.state.blocks.get(msg.blockId);
        if (!block) {
          client.send("error", { message: "Block not found" });
          return;
        }

        // Ownership enforcement
        if (block.owner !== wallet) {
          client.send("error", { message: "Not your block" });
          return;
        }
        if (changes.color !== undefined) {
          block.ownerColor = changes.color;
          block.appearance.color = changes.color;
        }
        if (changes.emoji !== undefined) block.appearance.emoji = changes.emoji;
        if (changes.name !== undefined) block.appearance.name = changes.name;
        if (changes.style !== undefined) block.appearance.style = changes.style;
        if (changes.textureId !== undefined) block.appearance.textureId = changes.textureId;
        if (changes.personality !== undefined) block.appearance.personality = changes.personality;

        // No XP for customization — was farmable by repeated changes
        insertEvent("customize", msg.blockId, wallet);
        checkQuestProgress(wallet, "customize");
        client.send("quest_update", { quests: getQuestState(wallet) });
        client.send("customize_result", { success: true });

        // Persist block (fire-and-forget)
        upsertBlock(blockToRow(block));

        // Broadcast to ALL clients with eventType
        this.broadcast("block_update", {
          ...serializeBlock(block, this.getOwnerName(block.owner)),
          eventType: "customize",
        });
      } catch (err) {
        console.error("[TowerRoom] Customize error:", err);
        client.send("error", { message: "Customize failed" });
      }
    });

    this.onMessage("poke", async (client: Client, msg: PokeMessage) => {
      try {
        if (!isValidBlockId(msg.blockId)) {
          client.send("error", { message: "Invalid blockId" });
          return;
        }

        const wallet = this.getSessionWallet(client);
        if (!wallet) {
          client.send("error", { message: "Not authenticated" });
          return;
        }

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
        if (block.owner === wallet) {
          client.send("error", { message: "You can't poke your own block" });
          return;
        }

        // Cooldown: 1 poke per block per 24h per poker
        const cooldownKey = `${wallet}:${msg.blockId}`;
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
        const player = await this.getOrCreatePlayer(wallet);
        const comboCount = incrementCombo(wallet);
        const pointsEarned = 15;
        player.xp += pointsEarned;
        const oldLevel = player.level;
        player.level = computeLevel(player.xp);
        const levelUp = player.level > oldLevel;

        updatePlayerXp(wallet, player.xp, player.level);
        insertEvent("poke", msg.blockId, wallet, {
          targetOwner: block.owner,
          energyAdded: energyBoost,
        });

        // Quest progress
        checkQuestProgress(wallet, "poke");
        client.send("quest_update", { quests: getQuestState(wallet) });

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
          ...serializeBlock(block, this.getOwnerName(block.owner)),
          eventType: "charge", // Show as charge effect visually
        });

        // Send poke_received to pokee if online
        const pokerPlayer = this.players.get(wallet);
        const pokerName = pokerPlayer?.skrName || pokerPlayer?.username || wallet.slice(0, 8) + "...";

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
            { blockId: block.id, from: wallet },
          );
        }

        console.log(`[TowerRoom] ${wallet.slice(0, 8)}... poked ${msg.blockId} (owner: ${block.owner.slice(0, 8)}...)`);
      } catch (err) {
        console.error("[TowerRoom] Poke error:", err);
        client.send("error", { message: "Poke failed" });
      }
    });

    this.onMessage("set_username", async (client: Client, msg: { wallet: string; username: string }) => {
      try {
        const wallet = this.getSessionWallet(client);
        if (!wallet) {
          client.send("error", { message: "Not authenticated" });
          return;
        }

        if (!msg.username) {
          client.send("error", { message: "Username required" });
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
        for (const [existingWallet, playerState] of this.players) {
          if (existingWallet !== wallet && playerState.username?.toLowerCase() === username.toLowerCase()) {
            client.send("error", { message: "Username already taken" });
            return;
          }
        }

        // Persist to Supabase
        const result = await setPlayerUsername(wallet, username);
        if (!result.success) {
          client.send("error", { message: result.error || "Failed to set username" });
          return;
        }

        // Update in-memory state
        const player = await this.getOrCreatePlayer(wallet);
        player.username = username;

        client.send("username_result", { success: true, username });
        console.log(`[TowerRoom] ${wallet.slice(0, 8)}... set username to "${username}"`);
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

    this.onMessage("get_quests", (client: Client) => {
      try {
        const wallet = this.getSessionWallet(client);
        if (!wallet) { client.send("error", { message: "Not authenticated" }); return; }
        client.send("quest_update", { quests: getQuestState(wallet) });
      } catch (err) {
        console.error("[TowerRoom] get_quests error:", err);
      }
    });

    this.onMessage("get_floor_leaderboard", (client: Client) => {
      try {
        client.send("floor_leaderboard", {
          leaderboard: getFloorLeaderboard(),
          lastWeekWinner: getWinningFloor(),
        });
      } catch (err) {
        console.error("[TowerRoom] get_floor_leaderboard error:", err);
      }
    });

    this.onMessage("register_push_token", (client: Client, msg: { wallet: string; token: string }) => {
      try {
        const wallet = this.getSessionWallet(client);
        if (!wallet || !msg.token) return;
        upsertPushToken(wallet, msg.token);
        console.log(`[TowerRoom] Push token registered for ${wallet.slice(0, 8)}...`);
      } catch (err) {
        console.error("[TowerRoom] register_push_token error:", err);
      }
    });

    this.onMessage("request_upload_token", (client: Client, msg: { blockId: string }) => {
      try {
        if (!isValidBlockId(msg.blockId)) {
          client.send("error", { message: "Invalid blockId" });
          return;
        }
        const wallet = this.getSessionWallet(client);
        if (!wallet) {
          client.send("error", { message: "Not authenticated" });
          return;
        }
        const block = this.state.blocks.get(msg.blockId);
        if (!block) {
          client.send("error", { message: "Block not found" });
          return;
        }
        if (block.owner !== wallet) {
          client.send("error", { message: "Not your block" });
          return;
        }
        const token = generateToken();
        uploadTokens.set(token, { wallet, blockId: msg.blockId, expires: Date.now() + UPLOAD_TOKEN_TTL_MS });
        client.send("upload_token", { token, blockId: msg.blockId });
      } catch (err) {
        console.error("[TowerRoom] request_upload_token error:", err);
        client.send("error", { message: "Failed to generate upload token" });
      }
    });

    console.log(`[TowerRoom] Created with ${this.state.blocks.size} blocks`);
  }

  async onJoin(client: Client, options?: { wallet?: string }) {
    // Send full tower state (read-only, no auth required)
    client.send("tower_state", this.buildFullState());
    this.recomputeStats();

    // If wallet provided, send auth challenge (don't trust wallet directly)
    if (options?.wallet) {
      const nonce = generateNonce(client.sessionId);
      client.send("auth_challenge", { nonce });
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
      skrName: null,
    };
    this.players.set(wallet, player);

    // Resolve .skr name in background (don't block player creation)
    resolveSkrName(wallet).then((name) => {
      if (name) player!.skrName = name;
    }).catch(() => {});

    return player;
  }

  /** Get display name for a wallet: .skr name → custom username → null */
  private getOwnerName(wallet: string | null): string | undefined {
    if (!wallet) return undefined;
    const player = this.players.get(wallet);
    if (!player) return undefined;
    return player.skrName || player.username || undefined;
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
      name: this.getOwnerName(e.wallet) || e.wallet.slice(0, 8) + "...",
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
      blocks.push(serializeBlock(block, this.getOwnerName(block.owner)));
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
      weeklyFloorCharges: getWeeklyCharges(),
      activeEvent: getCurrentEvent(),
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
