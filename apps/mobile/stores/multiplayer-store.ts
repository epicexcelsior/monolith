import { create } from "zustand";
import { Client, Room } from "colyseus.js";
import { GAME_SERVER_URL } from "@/constants/network";
import { useTowerStore } from "@/stores/tower-store";
import type { DemoBlock } from "@/stores/tower-store";
import type { ClaimMessage, ChargeMessage, CustomizeMessage } from "@monolith/common";

interface MultiplayerStore {
  connected: boolean;
  error: string | null;
  connecting: boolean;

  connect: () => Promise<boolean>;
  disconnect: () => void;
  sendClaim: (msg: ClaimMessage) => void;
  sendCharge: (msg: ChargeMessage) => void;
  sendCustomize: (msg: CustomizeMessage) => void;
}

// Module-level refs — single connection shared across all consumers
let client: Client | null = null;
let room: Room | null = null;

function syncState(state: any) {
  const blocks: DemoBlock[] = [];
  state.blocks.forEach((block: any) => {
    blocks.push({
      id: block.id,
      layer: block.layer,
      index: block.index,
      energy: block.energy,
      ownerColor: block.ownerColor || "#00ffff",
      owner: block.owner || null,
      stakedAmount: block.stakedAmount,
      position: { x: 0, y: 0, z: 0 },
      emoji: block.appearance?.emoji || undefined,
      name: block.appearance?.name || undefined,
      style: block.appearance?.style || 0,
      textureId: block.appearance?.textureId || 0,
      lastChargeTime: block.lastChargeTime || undefined,
      streak: block.streak || 0,
      lastStreakDate: block.lastStreakDate || undefined,
    });
  });
  useTowerStore.getState().setDemoBlocks(blocks);
}

export const useMultiplayerStore = create<MultiplayerStore>((set, get) => ({
  connected: false,
  error: null,
  connecting: false,

  connect: async () => {
    if (get().connected || get().connecting) return get().connected;

    set({ connecting: true, error: null });

    try {
      client = new Client(GAME_SERVER_URL);
      room = await client.joinOrCreate("tower");

      room.onStateChange(syncState);

      room.onError((code, message) => {
        console.warn(`[Multiplayer] Room error: ${code} ${message}`);
        set({ error: message || "Connection error" });
      });

      room.onLeave((code) => {
        console.log(`[Multiplayer] Left room: code ${code}`);
        room = null;
        set({ connected: false });
      });

      set({ connected: true, connecting: false });
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
    room?.leave(true).catch(() => {});
    room = null;
    client = null;
    set({ connected: false });
  },

  sendClaim: (msg) => room?.send("claim", msg),
  sendCharge: (msg) => room?.send("charge", msg),
  sendCustomize: (msg) => room?.send("customize", msg),
}));

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
