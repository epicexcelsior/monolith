import { create } from "zustand";
import { Client, Room } from "colyseus.js";
import { GAME_SERVER_URL } from "@/constants/network";
import { useTowerStore } from "@/stores/tower-store";
import type { DemoBlock } from "@/stores/tower-store";
import { useActivityStore } from "@/stores/activity-store";
import type { ClaimMessage, ChargeMessage, CustomizeMessage, PokeMessage, ActivityEvent, ChargeQuality } from "@monolith/common";
import { registerForPushNotifications } from "@/utils/notifications";
import { useWalletStore } from "@/stores/wallet-store";
import { hapticButtonPress } from "@/utils/haptics";
import { playPokeReceive } from "@/utils/audio";
import {
  DEFAULT_TOWER_CONFIG,
  MONOLITH_HALF_W,
  MONOLITH_HALF_D,
  SPIRE_START_LAYER,
  computeBodyLayerPositions,
  computeSpireLayerPositions,
} from "@monolith/common";

// ─── Reconnection Config ──────────────────────────────────
const RECONNECT_MAX_RETRIES = 10;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30_000;
const MAX_RECENT_EVENTS = 10;

/** Server block shape (JSON message, not Colyseus schema) */
interface ServerBlock {
  id: string;
  layer: number;
  index: number;
  energy: number;
  owner: string;
  ownerColor: string;
  stakedAmount: number;
  lastChargeTime: number;
  streak: number;
  lastStreakDate: string;
  imageIndex: number;
  totalCharges: number;
  bestStreak: number;
  evolutionTier: number;
  appearance: {
    color: string;
    emoji: string;
    name: string;
    style: number;
    textureId: number;
  };
  eventType?: "claim" | "charge" | "customize" | "poke";
}

interface ServerState {
  blocks: ServerBlock[];
  stats: {
    totalBlocks: number;
    occupiedBlocks: number;
    activeUsers: number;
    averageEnergy: number;
    chargesToday?: number;
  };
  tick: number;
}

/** Charge result from server (enhanced with XP) */
export interface ChargeResult {
  success: boolean;
  cooldownRemaining?: number;
  streak?: number;
  multiplier?: number;
  chargeAmount?: number;
  chargeQuality?: ChargeQuality;
  totalCharges?: number;
  evolutionTier?: number;
  pointsEarned?: number;
  combo?: number;
  totalXp?: number;
  level?: number;
  levelUp?: boolean;
}

/** Claim result from server */
export interface ClaimResult {
  success: boolean;
  blockId?: string;
  pointsEarned?: number;
  combo?: number;
  totalXp?: number;
  level?: number;
  levelUp?: boolean;
}

/** Customize result from server */
export interface CustomizeResult {
  success: boolean;
  pointsEarned?: number;
  combo?: number;
  totalXp?: number;
  level?: number;
  levelUp?: boolean;
}

/** Poke result from server */
export interface PokeResult {
  success: boolean;
  blockId?: string;
  energyAdded?: number;
  pointsEarned?: number;
  combo?: number;
  totalXp?: number;
  level?: number;
  levelUp?: boolean;
}

/** Poke received notification */
export interface PokeReceived {
  fromName: string;
  blockId: string;
  energyAdded: number;
}

interface MultiplayerStore {
  connected: boolean;
  error: string | null;
  connecting: boolean;
  reconnecting: boolean;
  playerCount: number;
  chargesToday: number;
  recentEvents: ActivityEvent[];

  connect: () => Promise<boolean>;
  disconnect: () => void;
  sendClaim: (msg: ClaimMessage) => void;
  sendCharge: (msg: ChargeMessage) => void;
  sendCustomize: (msg: CustomizeMessage) => void;
  sendPoke: (msg: PokeMessage) => void;
  sendSetUsername: (msg: { wallet: string; username: string }) => void;
}

// Module-level refs
let client: Client | null = null;
let room: Room | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let lastAppliedTick = -1;

// Callback refs for listener cleanup
let chargeResultCallback: ((result: ChargeResult) => void) | null = null;
let claimResultCallback: ((result: ClaimResult) => void) | null = null;
let customizeResultCallback: ((result: CustomizeResult) => void) | null = null;
let pokeResultCallback: ((result: PokeResult) => void) | null = null;
let pokeReceivedCallback: ((data: PokeReceived) => void) | null = null;
let errorCallback: ((error: { message: string }) => void) | null = null;
let playerSyncCallback: ((data: any) => void) | null = null;
let usernameResultCallback: ((data: { success: boolean; username?: string }) => void) | null = null;

// ─── Position cache (computed once from shared layout) ───────
const positionCache = new Map<number, { x: number; y: number; z: number }>();
let cacheBuilt = false;
const ORIGIN = { x: 0, y: 0, z: 0 } as const;
const warnedMissing = new Set<number>();

function cacheKey(layer: number, index: number) {
  return layer * 1000 + index;
}

function buildPositionCache() {
  if (cacheBuilt) return;
  cacheBuilt = true;

  const config = DEFAULT_TOWER_CONFIG;
  for (let layer = 0; layer < config.layerCount; layer++) {
    const count = config.blocksPerLayer[layer];
    const isSpire = layer >= SPIRE_START_LAYER;
    const positions = isSpire
      ? computeSpireLayerPositions(layer, count, config.layerCount)
      : computeBodyLayerPositions(layer, count, MONOLITH_HALF_W, MONOLITH_HALF_D, config.layerCount);

    const limit = Math.min(positions.length, count);
    for (let i = 0; i < limit; i++) {
      const p = positions[i];
      positionCache.set(cacheKey(layer, i), { x: p.x, y: p.y, z: p.z });
    }
  }

  if (__DEV__) {
    console.log(`[PositionCache] Built: ${positionCache.size} blocks`);
  }
}

function getBlockPosition(layer: number, index: number): { x: number; y: number; z: number } {
  buildPositionCache();
  const pos = positionCache.get(cacheKey(layer, index));
  if (pos) return pos;

  if (__DEV__) {
    const key = cacheKey(layer, index);
    if (!warnedMissing.has(key)) {
      warnedMissing.add(key);
      console.warn(`[PositionCache] Missing: ${layer}-${index}`);
    }
  }
  return ORIGIN;
}

/** Convert a server block to a DemoBlock for the tower store */
function serverBlockToDemo(block: ServerBlock): DemoBlock {
  return {
    id: block.id,
    layer: block.layer,
    index: block.index,
    energy: block.energy,
    ownerColor: block.ownerColor || "#00ffff",
    owner: block.owner || null,
    stakedAmount: block.stakedAmount || 0,
    position: getBlockPosition(block.layer, block.index),
    emoji: block.appearance?.emoji || undefined,
    name: block.appearance?.name || undefined,
    style: block.appearance?.style || 0,
    textureId: block.appearance?.textureId || 0,
    imageIndex: block.imageIndex || 0,
    lastChargeTime: block.lastChargeTime || undefined,
    streak: block.streak || 0,
    lastStreakDate: block.lastStreakDate || undefined,
    totalCharges: block.totalCharges ?? 0,
    bestStreak: block.bestStreak ?? 0,
    evolutionTier: block.evolutionTier ?? 0,
  };
}

/** Apply full tower state from server — diffs to avoid unnecessary re-renders */
function applyFullState(data: ServerState) {
  if (data.tick != null && data.tick === lastAppliedTick) return;
  lastAppliedTick = data.tick ?? -1;

  if (!data.blocks || data.blocks.length === 0) return;

  const store = useTowerStore.getState();
  const existing = store.demoBlocks;

  if (existing.length === 0) {
    const blocks = data.blocks.map(serverBlockToDemo);
    store.setDemoBlocks(blocks);
    if (__DEV__) console.log(`[Multiplayer] Initial state: ${blocks.length} blocks, tick ${data.tick}`);
    return;
  }

  const existingMap = new Map<number, number>();
  for (let i = 0; i < existing.length; i++) {
    existingMap.set(cacheKey(existing[i].layer, existing[i].index), i);
  }

  let changed = false;
  const updated = existing.slice();

  for (const serverBlock of data.blocks) {
    const key = cacheKey(serverBlock.layer, serverBlock.index);
    const idx = existingMap.get(key);
    if (idx == null) {
      updated.push(serverBlockToDemo(serverBlock));
      changed = true;
      continue;
    }

    const cur = existing[idx];
    if (
      cur.energy !== serverBlock.energy ||
      cur.owner !== (serverBlock.owner || null) ||
      cur.ownerColor !== (serverBlock.ownerColor || "#00ffff") ||
      cur.stakedAmount !== (serverBlock.stakedAmount || 0) ||
      cur.streak !== (serverBlock.streak || 0) ||
      cur.style !== (serverBlock.appearance?.style || 0) ||
      cur.textureId !== (serverBlock.appearance?.textureId || 0) ||
      cur.imageIndex !== (serverBlock.imageIndex || 0) ||
      cur.emoji !== (serverBlock.appearance?.emoji || undefined) ||
      cur.name !== (serverBlock.appearance?.name || undefined)
    ) {
      updated[idx] = serverBlockToDemo(serverBlock);
      changed = true;
    }
  }

  if (changed) {
    store.setDemoBlocks(updated);
    if (__DEV__) console.log(`[Multiplayer] Diff state: tick ${data.tick} (changed)`);
  } else {
    if (__DEV__) console.log(`[Multiplayer] Diff state: tick ${data.tick} (no changes)`);
  }
}

/** Apply a single block update from server */
function applySingleBlockUpdate(serverBlock: ServerBlock) {
  const towerStore = useTowerStore.getState();
  const updated = serverBlockToDemo(serverBlock);
  const existing = towerStore.demoBlocks;

  const key = cacheKey(serverBlock.layer, serverBlock.index);
  const idx = existing.findIndex(
    (b) => cacheKey(b.layer, b.index) === key,
  );

  if (idx >= 0) {
    const cur = existing[idx];
    const dataChanged = !(
      cur.energy === updated.energy &&
      cur.owner === updated.owner &&
      cur.ownerColor === updated.ownerColor &&
      cur.stakedAmount === updated.stakedAmount &&
      cur.streak === updated.streak &&
      cur.style === updated.style &&
      cur.textureId === updated.textureId &&
      cur.emoji === updated.emoji &&
      cur.name === updated.name
    );

    if (dataChanged) {
      const newBlocks = existing.slice();
      newBlocks[idx] = updated;
      towerStore.setDemoBlocks(newBlocks);
    } else if (!serverBlock.eventType) {
      // No data changed AND no event — skip entirely
      return;
    }
  }

  // Trigger visual effects based on eventType (always, even if data didn't change)
  // Skip claim flash if cinematic mode is active — local player already triggered celebration VFX
  if (serverBlock.eventType === "claim") {
    if (!towerStore.cinematicMode) {
      towerStore.setRecentlyClaimedId(serverBlock.id);
    }
  } else if (serverBlock.eventType === "charge") {
    towerStore.setRecentlyChargedId(serverBlock.id);
  } else if (serverBlock.eventType === "poke") {
    towerStore.setRecentlyPokedId(serverBlock.id);
    // SFX + haptic if this is our block
    const myWallet = useWalletStore.getState().publicKey?.toBase58();
    if (myWallet && serverBlock.owner === myWallet) {
      hapticButtonPress();
      playPokeReceive();
    }
  }

  // Push to recent events + activity feed
  if (serverBlock.eventType) {
    const ownerName = serverBlock.appearance?.name || serverBlock.owner || "Unknown";
    const truncatedOwner = ownerName.length > 12 ? ownerName.slice(0, 8) + "..." : ownerName;
    const layerNum = serverBlock.layer + 1;

    let message: string;
    switch (serverBlock.eventType) {
      case "claim":
        message = `${truncatedOwner} claimed a block on Layer ${layerNum}!`;
        break;
      case "charge":
        message = `${truncatedOwner} charged their block on Layer ${layerNum}`;
        break;
      case "customize":
        message = `${truncatedOwner} customized their block on Layer ${layerNum}`;
        break;
      case "poke":
        message = `Someone poked ${truncatedOwner}'s block on Layer ${layerNum}! ⚡`;
        break;
      default:
        message = `${truncatedOwner} updated a block on Layer ${layerNum}`;
    }

    const event: ActivityEvent = {
      id: `${serverBlock.id}-${Date.now()}`,
      type: serverBlock.eventType,
      blockId: serverBlock.id,
      owner: serverBlock.owner || "Unknown",
      ownerColor: serverBlock.ownerColor,
      timestamp: Date.now(),
      message,
    };
    const mpStore = useMultiplayerStore.getState();
    const events = [event, ...mpStore.recentEvents].slice(0, MAX_RECENT_EVENTS);
    useMultiplayerStore.setState({ recentEvents: events });

    // Dispatch to activity-store for ActivityFeed component
    useActivityStore.getState().addEvent(event);
  }
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

export const useMultiplayerStore = create<MultiplayerStore>((set, get) => ({
  connected: false,
  error: null,
  connecting: false,
  reconnecting: false,
  playerCount: 0,
  chargesToday: 0,
  recentEvents: [],

  connect: async () => {
    if (get().connected || get().connecting) return get().connected;

    set({ connecting: true, error: null });
    clearReconnectTimer();
    lastAppliedTick = -1;

    try {
      client = new Client(GAME_SERVER_URL);
      const wallet = useWalletStore.getState().publicKey?.toBase58();
      room = await client.joinOrCreate("tower", wallet ? { wallet } : undefined);

      // ─── JSON message handlers ────

      room.onMessage("tower_state", (data: ServerState) => {
        applyFullState(data);
        if (data.stats) {
          set({
            playerCount: data.stats.activeUsers || 0,
            chargesToday: data.stats.chargesToday || 0,
          });
        }
      });

      room.onMessage("block_update", (data: ServerBlock) => {
        applySingleBlockUpdate(data);
      });

      // Result handlers — use callback refs so they can be updated without stacking
      room.onMessage("charge_result", (data: ChargeResult) => {
        chargeResultCallback?.(data);
      });

      room.onMessage("claim_result", (data: ClaimResult) => {
        claimResultCallback?.(data);
      });

      room.onMessage("customize_result", (data: CustomizeResult) => {
        customizeResultCallback?.(data);
      });

      room.onMessage("poke_result", (data: PokeResult) => {
        pokeResultCallback?.(data);
      });

      room.onMessage("poke_received", (data: PokeReceived) => {
        pokeReceivedCallback?.(data);
      });

      room.onMessage("player_sync", (data: any) => {
        playerSyncCallback?.(data);
      });

      room.onMessage("username_result", (data: { success: boolean; username?: string }) => {
        usernameResultCallback?.(data);
      });

      room.onMessage("error", (data: { message: string }) => {
        errorCallback?.(data);
      });

      room.onError((code, message) => {
        if (__DEV__) console.warn(`[Multiplayer] Room error: ${code} ${message}`);
        set({ error: message || "Connection error" });
      });

      room.onLeave((code) => {
        if (__DEV__) console.log(`[Multiplayer] Left room: code ${code}`);
        const wasConnected = get().connected;
        room = null;
        set({ connected: false, playerCount: 0 });

        if (wasConnected && code !== 4000) {
          scheduleReconnect(set, get);
        }
      });

      reconnectAttempt = 0;
      set({ connected: true, connecting: false, reconnecting: false });
      if (__DEV__) console.log(`[Multiplayer] Connected to ${GAME_SERVER_URL}, room ${room.roomId}`);

      // Register push notification token (fire-and-forget)
      registerForPushNotifications().then((token) => {
        if (token && room) {
          const wallet = useWalletStore.getState().publicKey?.toBase58();
          if (wallet) {
            room.send("register_push_token", { wallet, token });
          }
        }
      }).catch(() => {});

      return true;
    } catch (err: any) {
      if (__DEV__) console.warn("[Multiplayer] Connection failed:", err.message);
      client = null;
      room = null;
      set({ connected: false, connecting: false, error: err.message });
      return false;
    }
  },

  disconnect: () => {
    clearReconnectTimer();
    reconnectAttempt = 0;
    lastAppliedTick = -1;
    room?.leave(true).catch(() => {});
    room = null;
    client = null;
    set({ connected: false, reconnecting: false, playerCount: 0, chargesToday: 0 });
  },

  sendClaim: (msg) => room?.send("claim", msg),
  sendCharge: (msg) => room?.send("charge", msg),
  sendCustomize: (msg) => room?.send("customize", msg),
  sendPoke: (msg) => room?.send("poke", msg),
  sendSetUsername: (msg) => room?.send("set_username", msg),
}));

/** Exponential backoff reconnect */
function scheduleReconnect(
  set: (partial: Partial<MultiplayerStore>) => void,
  get: () => MultiplayerStore,
) {
  if (reconnectAttempt >= RECONNECT_MAX_RETRIES) {
    if (__DEV__) console.warn("[Multiplayer] Max reconnect attempts reached");
    set({ reconnecting: false, error: "Connection lost" });
    return;
  }

  const delay = Math.min(
    RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempt),
    RECONNECT_MAX_DELAY_MS,
  );
  reconnectAttempt++;
  set({ reconnecting: true });
  if (__DEV__) console.log(`[Multiplayer] Reconnecting in ${delay}ms (attempt ${reconnectAttempt}/${RECONNECT_MAX_RETRIES})`);

  reconnectTimer = setTimeout(async () => {
    if (get().connected) return;
    const ok = await get().connect();
    if (!ok && reconnectAttempt < RECONNECT_MAX_RETRIES) {
      scheduleReconnect(set, get);
    }
  }, delay);
}

/** Register a charge_result callback (replaces previous) */
export function onChargeResult(callback: (result: ChargeResult) => void) {
  chargeResultCallback = callback;
}

/** Register a claim_result callback (replaces previous) */
export function onClaimResult(callback: (result: ClaimResult) => void) {
  claimResultCallback = callback;
}

/** Register a customize_result callback (replaces previous) */
export function onCustomizeResult(callback: (result: CustomizeResult) => void) {
  customizeResultCallback = callback;
}

/** Register a poke_result callback (replaces previous) */
export function onPokeResult(callback: (result: PokeResult) => void) {
  pokeResultCallback = callback;
}

/** Register a poke_received callback (replaces previous) */
export function onPokeReceived(callback: (data: PokeReceived) => void) {
  pokeReceivedCallback = callback;
}

/** Register a username_result callback (replaces previous) */
export function onUsernameResult(callback: (data: { success: boolean; username?: string }) => void) {
  usernameResultCallback = callback;
}

/** Register a server error callback (replaces previous) */
export function onServerError(callback: (error: { message: string }) => void) {
  errorCallback = callback;
}

/** Register a player_sync callback (replaces previous) */
export function onPlayerSync(callback: (data: any) => void) {
  playerSyncCallback = callback;
}
