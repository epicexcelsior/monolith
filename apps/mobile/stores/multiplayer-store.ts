import { create } from "zustand";
import { Client, Room } from "colyseus.js";
import { GAME_SERVER_URL } from "@/constants/network";
import { useTowerStore } from "@/stores/tower-store";
import type { DemoBlock } from "@/stores/tower-store";
import type { ClaimMessage, ChargeMessage, CustomizeMessage, ActivityEvent } from "@monolith/common";
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
  appearance: {
    color: string;
    emoji: string;
    name: string;
    style: number;
    textureId: number;
  };
  eventType?: "claim" | "charge" | "customize";
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
let errorCallback: ((error: { message: string }) => void) | null = null;
let playerSyncCallback: ((data: any) => void) | null = null;

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
  const store = useTowerStore.getState();
  const towerStore = useTowerStore.getState();
  const updated = serverBlockToDemo(serverBlock);
  const existing = store.demoBlocks;

  const key = cacheKey(serverBlock.layer, serverBlock.index);
  const idx = existing.findIndex(
    (b) => cacheKey(b.layer, b.index) === key,
  );

  if (idx >= 0) {
    const cur = existing[idx];
    if (
      cur.energy === updated.energy &&
      cur.owner === updated.owner &&
      cur.ownerColor === updated.ownerColor &&
      cur.stakedAmount === updated.stakedAmount &&
      cur.streak === updated.streak &&
      cur.style === updated.style &&
      cur.textureId === updated.textureId
    ) {
      return;
    }

    const newBlocks = existing.slice();
    newBlocks[idx] = updated;
    store.setDemoBlocks(newBlocks);
  }

  // Trigger visual effects based on eventType
  if (serverBlock.eventType === "claim") {
    towerStore.setRecentlyClaimedId(serverBlock.id);
  } else if (serverBlock.eventType === "charge") {
    towerStore.setRecentlyChargedId(serverBlock.id);
  }

  // Push to recent events
  if (serverBlock.eventType) {
    const event: ActivityEvent = {
      id: `${serverBlock.id}-${Date.now()}`,
      type: serverBlock.eventType,
      blockId: serverBlock.id,
      owner: serverBlock.owner || "Unknown",
      ownerColor: serverBlock.ownerColor,
      timestamp: Date.now(),
    };
    const mpStore = useMultiplayerStore.getState();
    const events = [event, ...mpStore.recentEvents].slice(0, MAX_RECENT_EVENTS);
    useMultiplayerStore.setState({ recentEvents: events });
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
      room = await client.joinOrCreate("tower");

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

      room.onMessage("player_sync", (data: any) => {
        playerSyncCallback?.(data);
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

/** Register a server error callback (replaces previous) */
export function onServerError(callback: (error: { message: string }) => void) {
  errorCallback = callback;
}

/** Register a player_sync callback (replaces previous) */
export function onPlayerSync(callback: (data: any) => void) {
  playerSyncCallback = callback;
}
