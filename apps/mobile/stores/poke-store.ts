/**
 * Poke cooldown tracking store.
 * Tracks per-block cooldowns client-side to prevent spamming the server.
 * Cooldowns are in-memory only (reset on app restart — server enforces the real 24h limit).
 */

import { create } from "zustand";

const POKE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

interface PokeStore {
  /** Map of blockId → timestamp of last successful poke */
  cooldowns: Record<string, number>;

  /** Record a successful poke for a block */
  recordPoke: (blockId: string) => void;

  /** Check if a block is on cooldown. Returns remaining ms or 0 if not on cooldown. */
  getCooldownRemaining: (blockId: string) => number;

  /** Returns true if the block can be poked */
  canPoke: (blockId: string) => boolean;
}

export const usePokeStore = create<PokeStore>((set, get) => ({
  cooldowns: {},

  recordPoke: (blockId) => {
    set((state) => ({
      cooldowns: { ...state.cooldowns, [blockId]: Date.now() },
    }));
  },

  getCooldownRemaining: (blockId) => {
    const lastPoke = get().cooldowns[blockId];
    if (!lastPoke) return 0;
    const remaining = POKE_COOLDOWN_MS - (Date.now() - lastPoke);
    return Math.max(0, remaining);
  },

  canPoke: (blockId) => {
    return get().getCooldownRemaining(blockId) === 0;
  },
}));
