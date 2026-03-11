/**
 * Loot inventory store — tracks collected cosmetic rewards.
 *
 * Client-side only, persisted to expo-secure-store.
 * Triggered by charge actions via rollAndStore().
 */

import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { LootItem } from "../constants/loot-table";
import { rollLoot } from "../constants/loot-table";

const STORAGE_KEY = "loot_inventory";

interface LootState {
  inventory: string[]; // Item IDs collected
  pendingReveal: LootItem | null; // Item waiting for reveal UI
  totalDrops: number;

  rollAndStore: (streak: number) => void;
  clearPendingReveal: () => void;
  hydrate: () => Promise<void>;
}

export const useLootStore = create<LootState>((set, get) => ({
  inventory: [],
  pendingReveal: null,
  totalDrops: 0,

  rollAndStore: (streak: number) => {
    const item = rollLoot(streak);
    if (!item) return;

    const { inventory } = get();
    const newInventory = [...inventory, item.id];
    set({
      inventory: newInventory,
      pendingReveal: item,
      totalDrops: get().totalDrops + 1,
    });
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newInventory)).catch(() => {});
  },

  clearPendingReveal: () => set({ pendingReveal: null }),

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      if (stored) {
        const inventory = JSON.parse(stored) as string[];
        set({ inventory, totalDrops: inventory.length });
      }
    } catch { /* ignore */ }
  },
}));
