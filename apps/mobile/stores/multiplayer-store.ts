import { create } from "zustand";
import { Client, Room } from "colyseus.js";
import { GAME_SERVER_URL } from "@/constants/network";
import { useTowerStore } from "@/stores/tower-store";
import type { DemoBlock } from "@/stores/tower-store";
import type { ClaimMessage, ChargeMessage, CustomizeMessage } from "@monolith/common";
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
  appearance: {
    color: string;
    emoji: string;
    name: string;
    style: number;
    textureId: number;
  };
}

interface ServerState {
  blocks: ServerBlock[];
  stats: {
    totalBlocks: number;
    occupiedBlocks: number;
    activeUsers: number;
    averageEnergy: number;
  };
  tick: number;
}

interface MultiplayerStore {
  connected: boolean;
  error: string | null;
  connecting: boolean;
  reconnecting: boolean;
  playerCount: number;

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

// ─── Position cache (computed once from shared layout) ───────
// Numeric key = layer * 1000 + index (avoids string allocation on lookups)
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

  // Warn once per missing key in dev
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
    lastChargeTime: block.lastChargeTime || undefined,
    streak: block.streak || 0,
    lastStreakDate: block.lastStreakDate || undefined,
  };
}

/** Apply full tower state from server */
function applyFullState(data: ServerState) {
  // Skip duplicate ticks (e.g. from Strict Mode double-mount)
  if (data.tick != null && data.tick === lastAppliedTick) return;
  lastAppliedTick = data.tick ?? -1;

  const blocks = data.blocks.map(serverBlockToDemo);
  if (blocks.length > 0) {
    useTowerStore.getState().setDemoBlocks(blocks);
    if (__DEV__) console.log(`[Multiplayer] Full state: ${blocks.length} blocks, tick ${data.tick}`);
  }
}

/** Apply a single block update from server */
function applySingleBlockUpdate(serverBlock: ServerBlock) {
  const store = useTowerStore.getState();
  const updated = serverBlockToDemo(serverBlock);
  const existing = store.demoBlocks;

  // Find and replace the matching block
  const idx = existing.findIndex(
    (b) => b.layer === updated.layer && b.index === updated.index,
  );

  if (idx >= 0) {
    const newBlocks = [...existing];
    newBlocks[idx] = updated;
    store.setDemoBlocks(newBlocks);
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

  connect: async () => {
    if (get().connected || get().connecting) return get().connected;

    set({ connecting: true, error: null });
    clearReconnectTimer();

    try {
      client = new Client(GAME_SERVER_URL);
      room = await client.joinOrCreate("tower");

      // ─── JSON message handlers (bypasses schema auto-sync) ────

      // Full state: sent on join + every 15s
      room.onMessage("tower_state", (data: ServerState) => {
        applyFullState(data);
        if (data.stats) {
          set({ playerCount: data.stats.activeUsers || 0 });
        }
      });

      // Single block update: sent on claim/charge/customize
      room.onMessage("block_update", (data: ServerBlock) => {
        applySingleBlockUpdate(data);
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

        // Auto-reconnect on unexpected disconnects
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
    set({ connected: false, reconnecting: false, playerCount: 0 });
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

/** Subscribe to charge_result messages from server */
export function onChargeResult(callback: (result: {
  success: boolean;
  cooldownRemaining?: number;
  streak?: number;
  multiplier?: number;
  chargeAmount?: number;
}) => void) {
  room?.onMessage("charge_result", callback);
}

/** Subscribe to error messages from server */
export function onServerError(callback: (error: { message: string }) => void) {
  room?.onMessage("error", callback);
}
