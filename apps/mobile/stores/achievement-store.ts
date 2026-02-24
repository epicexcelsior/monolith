import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
}

const ACHIEVEMENT_DEFS: Record<string, Achievement> = {
  first_claim: { id: "first_claim", title: "First Claim", description: "Claimed your first block on the tower", icon: "🏗️" },
  streak_3:    { id: "streak_3",    title: "3-Day Streak",    description: "Charged your block 3 days in a row", icon: "🔥" },
  streak_7:    { id: "streak_7",    title: "Week Warrior",    description: "7-day charge streak — 2x multiplier!", icon: "⚡" },
  streak_14:   { id: "streak_14",   title: "Fortnight Force", description: "14-day streak — unstoppable!", icon: "💪" },
  streak_30:   { id: "streak_30",   title: "Monthly Legend",  description: "30-day streak — maximum 3x charge", icon: "👑" },
  top_10:      { id: "top_10",      title: "Top 10",          description: "Reached the top 10 leaderboard", icon: "🏆" },
  multi_block: { id: "multi_block", title: "Empire Builder",  description: "Own 3 or more blocks", icon: "🏰" },
};

interface AchievementStore {
  unlocked: string[];
  pendingToast: Achievement | null;
  initialized: boolean;
  init: () => Promise<void>;
  checkAndUnlock: (id: string) => boolean;
  dismissToast: () => void;
}

const STORAGE_KEY = "monolith_achievements";

export const useAchievementStore = create<AchievementStore>((set, get) => ({
  unlocked: [],
  pendingToast: null,
  initialized: false,

  init: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) {
        set({ unlocked: JSON.parse(raw), initialized: true });
      } else {
        set({ initialized: true });
      }
    } catch {
      set({ initialized: true });
    }
  },

  checkAndUnlock: (id: string) => {
    const { unlocked } = get();
    if (unlocked.includes(id)) return false;

    const def = ACHIEVEMENT_DEFS[id];
    if (!def) return false;

    const newUnlocked = [...unlocked, id];
    set({ unlocked: newUnlocked, pendingToast: def });

    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(newUnlocked)).catch(() => {});
    return true;
  },

  dismissToast: () => set({ pendingToast: null }),
}));
