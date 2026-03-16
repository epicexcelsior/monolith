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
const PITY_KEY = "loot_pity";

interface PityState {
  chargesSinceEpic: number;
  chargesSinceLegendary: number;
}

interface LootState {
  inventory: string[]; // Item IDs collected
  pendingReveal: LootItem | null; // Item waiting for reveal UI
  totalDrops: number;
  chargesSinceEpic: number;
  chargesSinceLegendary: number;

  rollAndStore: (streak: number) => void;
  clearPendingReveal: () => void;
  hydrate: () => Promise<void>;
  getUniqueCount: () => number;
}

export const useLootStore = create<LootState>((set, get) => ({
  inventory: [],
  pendingReveal: null,
  totalDrops: 0,
  chargesSinceEpic: 0,
  chargesSinceLegendary: 0,

  rollAndStore: (streak: number) => {
    const { chargesSinceEpic, chargesSinceLegendary } = get();
    const item = rollLoot(streak, chargesSinceEpic, chargesSinceLegendary);

    // Update pity counters
    let newSinceEpic = chargesSinceEpic + 1;
    let newSinceLegendary = chargesSinceLegendary + 1;
    if (item) {
      if (item.rarity === "epic" || item.rarity === "legendary") newSinceEpic = 0;
      if (item.rarity === "legendary") newSinceLegendary = 0;
    }
    // Persist pity counters
    SecureStore.setItemAsync(PITY_KEY, JSON.stringify({ chargesSinceEpic: newSinceEpic, chargesSinceLegendary: newSinceLegendary })).catch(() => {});

    if (!item) {
      set({ chargesSinceEpic: newSinceEpic, chargesSinceLegendary: newSinceLegendary });
      return;
    }

    const { inventory } = get();
    const newInventory = [...inventory, item.id];
    set({
      inventory: newInventory,
      pendingReveal: item,
      totalDrops: get().totalDrops + 1,
      chargesSinceEpic: newSinceEpic,
      chargesSinceLegendary: newSinceLegendary,
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
      const pityStored = await SecureStore.getItemAsync(PITY_KEY);
      if (pityStored) {
        const pity = JSON.parse(pityStored) as PityState;
        set({ chargesSinceEpic: pity.chargesSinceEpic, chargesSinceLegendary: pity.chargesSinceLegendary });
      }
    } catch { /* ignore */ }
  },

  getUniqueCount: () => new Set(get().inventory).size,
}));
