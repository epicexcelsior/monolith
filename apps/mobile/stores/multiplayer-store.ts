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
// Maps "layer-index" → {x,y,z} so camera fly-to works correctly.
const positionCache = new Map<string, { x: number; y: number; z: number }>();

function buildPositionCache() {
  if (positionCache.size > 0) return;

  const config = DEFAULT_TOWER_CONFIG;
  let totalCached = 0;
  let errorCount = 0;
  const cacheWarnings: string[] = [];

  for (let layer = 0; layer < config.layerCount; layer++) {
    const count = config.blocksPerLayer[layer];
    const isSpire = layer >= SPIRE_START_LAYER;

    try {
      const positions = isSpire
        ? computeSpireLayerPositions(layer, count, config.layerCount)
        : computeBodyLayerPositions(layer, count, MONOLITH_HALF_W, MONOLITH_HALF_D, config.layerCount);

      const usable = positions.slice(0, count);

      for (let i = 0; i < usable.length; i++) {
        const pos = usable[i];

        // Validate position structure
        if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number" || typeof pos.z !== "number") {
          errorCount++;
          cacheWarnings.push(`Layer ${layer}, index ${i}: Invalid position structure`);
          continue;
        }

        // Check for zero positions that would break camera
        const isZero = Math.abs(pos.x) < 0.001 && Math.abs(pos.y) < 0.001 && Math.abs(pos.z) < 0.001;
        if (isZero) {
          errorCount++;
          cacheWarnings.push(`Layer ${layer}, index ${i}: Zero position (camera can't focus)`);
          continue;
        }

        positionCache.set(`${layer}-${i}`, { x: pos.x, y: pos.y, z: pos.z });
        totalCached++;
      }
    } catch (err) {
      errorCount++;
      cacheWarnings.push(`Layer ${layer}: Layout generation failed - ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Log summary
  console.log(`[PositionCache] Built cache: ${totalCached} blocks cached, ${errorCount} errors`);
  if (cacheWarnings.length > 0) {
    console.warn(`[PositionCache] Warnings:`, cacheWarnings.slice(0, 10)); // Show first 10
    if (cacheWarnings.length > 10) {
      console.warn(`[PositionCache] ... and ${cacheWarnings.length - 10} more warnings`);
    }
  }
}

function getBlockPosition(layer: number, index: number): { x: number; y: number; z: number } {
  buildPositionCache();
  const pos = positionCache.get(`${layer}-${index}`);

  if (!pos) {
    console.warn(`[PositionCache] Missing position for block ${layer}-${index} (returning origin fallback)`);
    return { x: 0, y: 0, z: 0 };
  }

  return pos;
}

/** Convert a server block to a DemoBlock for the tower store */
function serverBlockToDemo(block: ServerBlock): DemoBlock {
  const position = getBlockPosition(block.layer, block.index);

  // Warn if position is origin (block can't be focused by camera)
  const isOrigin = position.x === 0 && position.y === 0 && position.z === 0;
  if (isOrigin && (block.layer !== undefined && block.index !== undefined)) {
    console.warn(
      `[ServerBlockConvert] Block ${block.id} (layer=${block.layer}, index=${block.index}) has origin position - camera can't focus`
    );
  }

  return {
    id: block.id,
    layer: block.layer,
    index: block.index,
    energy: block.energy,
    ownerColor: block.ownerColor || "#00ffff",
    owner: block.owner || null, // "" → null
    stakedAmount: block.stakedAmount || 0,
    position,
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
    console.log(`[Multiplayer] Applied full state: ${blocks.length} blocks, tick ${data.tick}`);
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
        console.warn(`[Multiplayer] Room error: ${code} ${message}`);
        set({ error: message || "Connection error" });
      });

      room.onLeave((code) => {
        console.log(`[Multiplayer] Left room: code ${code}`);
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
      console.log(`[Multiplayer] Connected to ${GAME_SERVER_URL}, room ${room.roomId}`);
      return true;
    } catch (err: any) {
      console.warn("[Multiplayer] Connection failed:", err.message);
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
    console.warn("[Multiplayer] Max reconnect attempts reached");
    set({ reconnecting: false, error: "Connection lost" });
    return;
  }

  const delay = Math.min(
    RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempt),
    RECONNECT_MAX_DELAY_MS,
  );
  reconnectAttempt++;
  set({ reconnecting: true });
  console.log(`[Multiplayer] Reconnecting in ${delay}ms (attempt ${reconnectAttempt}/${RECONNECT_MAX_RETRIES})`);

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
