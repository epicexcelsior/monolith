import { useCallback, useEffect, useRef, useState } from "react";
import { Client, Room } from "colyseus.js";
import { useTowerStore } from "@/stores/tower-store";
import type { DemoBlock } from "@/stores/tower-store";
import { GAME_SERVER_URL } from "@/constants/network";
import type { ClaimMessage, ChargeMessage, CustomizeMessage } from "@monolith/common";

/**
 * Multiplayer hook — connects to Colyseus TowerRoom and syncs state.
 *
 * When connected, server is the source of truth for all block state.
 * Schema changes are converted to DemoBlock[] and pushed to the tower store.
 */
export function useMultiplayer() {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<Client | null>(null);
  const roomRef = useRef<Room | null>(null);

  const setDemoBlocks = useTowerStore((s) => s.setDemoBlocks);

  // Convert server state to DemoBlock array
  const syncState = useCallback((state: any) => {
    const blocks: DemoBlock[] = [];
    state.blocks.forEach((block: any, key: string) => {
      blocks.push({
        id: block.id,
        layer: block.layer,
        index: block.index,
        energy: block.energy,
        ownerColor: block.ownerColor || "#00ffff",
        owner: block.owner || null, // convert empty string back to null
        stakedAmount: block.stakedAmount,
        // Position placeholder — TowerGrid computes real position from layer+index
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
    setDemoBlocks(blocks);
  }, [setDemoBlocks]);

  const connect = useCallback(async () => {
    try {
      setError(null);
      const client = new Client(GAME_SERVER_URL);
      clientRef.current = client;

      const room = await client.joinOrCreate("tower");
      roomRef.current = room;

      // Full state sync on every patch
      room.onStateChange((state) => {
        syncState(state);
      });

      room.onError((code, message) => {
        console.warn(`[Multiplayer] Room error: ${code} ${message}`);
        setError(message || "Connection error");
      });

      room.onLeave((code) => {
        console.log(`[Multiplayer] Left room: code ${code}`);
        setConnected(false);
        roomRef.current = null;
      });

      setConnected(true);
      console.log(`[Multiplayer] Connected to room ${room.roomId}`);
    } catch (err: any) {
      console.warn("[Multiplayer] Connection failed:", err.message);
      setError(err.message);
      setConnected(false);
    }
  }, [syncState]);

  const disconnect = useCallback(async () => {
    try {
      await roomRef.current?.leave();
    } catch {
      // Already disconnected
    }
    roomRef.current = null;
    clientRef.current = null;
    setConnected(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      roomRef.current?.leave(true).catch(() => {});
    };
  }, []);

  // ─── Message Senders ────────────────────────────

  const sendClaim = useCallback((msg: ClaimMessage) => {
    roomRef.current?.send("claim", msg);
  }, []);

  const sendCharge = useCallback((msg: ChargeMessage) => {
    roomRef.current?.send("charge", msg);
  }, []);

  const sendCustomize = useCallback((msg: CustomizeMessage) => {
    roomRef.current?.send("customize", msg);
  }, []);

  // ─── Message Listeners ─────────────────────────

  const onChargeResult = useCallback((callback: (result: {
    success: boolean;
    cooldownRemaining?: number;
    streak?: number;
    multiplier?: number;
    chargeAmount?: number;
  }) => void) => {
    roomRef.current?.onMessage("charge_result", callback);
  }, []);

  const onError = useCallback((callback: (err: { message: string }) => void) => {
    roomRef.current?.onMessage("error", callback);
  }, []);

  return {
    connected,
    error,
    connect,
    disconnect,
    sendClaim,
    sendCharge,
    sendCustomize,
    onChargeResult,
    onError,
    room: roomRef,
  };
}
