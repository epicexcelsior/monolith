import { create } from "zustand";
import { Client, Room } from "colyseus.js";
import { GAME_SERVER_URL } from "@/constants/network";
import { useTowerStore } from "@/stores/tower-store";
import type { DemoBlock } from "@/stores/tower-store";
import type { ClaimMessage, ChargeMessage, CustomizeMessage } from "@monolith/common";

// ─── Reconnection Config ──────────────────────────────────
const RECONNECT_MAX_RETRIES = 10;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30_000;

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

// Module-level refs — single connection shared across all consumers
let client: Client | null = null;
let room: Room | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;

/**
 * Convert Colyseus room state → DemoBlock[] and push to tower store.
 * Colyseus MapSchema.forEach passes (value, key).
 */
function syncState(state: any) {
  const blocks: DemoBlock[] = [];

  state.blocks.forEach((block: any, _key: string) => {
    blocks.push({
      id: block.id,
      layer: block.layer,
      index: block.index,
      energy: block.energy,
      ownerColor: block.ownerColor || "#00ffff",
      owner: block.owner || null, // "" → null (Schema uses "" for unclaimed)
      stakedAmount: block.stakedAmount || 0,
      position: { x: 0, y: 0, z: 0 }, // TowerGrid computes from layout, ignores this
      emoji: block.appearance?.emoji || undefined,
      name: block.appearance?.name || undefined,
      style: block.appearance?.style || 0,
      textureId: block.appearance?.textureId || 0,
      lastChargeTime: block.lastChargeTime || undefined,
      streak: block.streak || 0,
      lastStreakDate: block.lastStreakDate || undefined,
    });
  });

  if (blocks.length > 0) {
    useTowerStore.getState().setDemoBlocks(blocks);
  }
}

/** Clear reconnect timer */
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

      // ─── Process initial state IMMEDIATELY ──────────────
      // joinOrCreate resolves after initial state is received.
      // onStateChange only fires on SUBSEQUENT changes, so we
      // must manually sync the initial state here.
      console.log(`[Multiplayer] Room joined, ${room.state.blocks.size} blocks in initial state`);
      syncState(room.state);

      // ─── Subscribe to future state changes ──────────────
      room.onStateChange(syncState);

      room.onError((code, message) => {
        console.warn(`[Multiplayer] Room error: ${code} ${message}`);
        set({ error: message || "Connection error" });
      });

      room.onLeave((code) => {
        console.log(`[Multiplayer] Left room: code ${code}`);
        const wasConnected = get().connected;
        room = null;
        set({ connected: false, playerCount: 0 });

        // Auto-reconnect on unexpected disconnects (code >= 1000 is abnormal or server-side)
        // Code 4000 = consented leave (user called disconnect), don't reconnect
        if (wasConnected && code !== 4000) {
          scheduleReconnect(set, get);
        }
      });

      // Track player count from room metadata
      if (room.state.stats) {
        set({ playerCount: room.state.stats.activeUsers || 0 });
      }

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
    // Code 4000 = consented leave (prevents auto-reconnect)
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
    if (get().connected) return; // Already reconnected
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
