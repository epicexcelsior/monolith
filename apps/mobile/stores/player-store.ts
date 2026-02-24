/**
 * Player XP/level/combo state (Zustand).
 *
 * Tracks XP, level, combo multiplier, and triggers for
 * floating points and level-up celebration animations.
 */

import { create } from "zustand";

interface PlayerStore {
  // ─── State ────────────────────────────────
  xp: number;
  level: number;
  combo: number;
  lastPointsEarned: number | null;
  lastCombo: number | null;
  levelUp: number | null; // the new level, or null
  totalClaims: number;
  totalCharges: number;
  comboBest: number;
  username: string | null;

  // ─── Actions ──────────────────────────────
  addPoints: (data: {
    pointsEarned: number;
    combo?: number;
    totalXp?: number;
    level?: number;
    levelUp?: boolean;
  }) => void;
  setFromServer: (data: {
    xp: number;
    level: number;
    totalClaims?: number;
    totalCharges?: number;
    comboBest?: number;
    username?: string | null;
  }) => void;
  setUsername: (username: string) => void;
  clearPoints: () => void;
  clearLevelUp: () => void;
}

let pointsClearTimer: ReturnType<typeof setTimeout> | null = null;
let levelUpClearTimer: ReturnType<typeof setTimeout> | null = null;

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  xp: 0,
  level: 1,
  combo: 0,
  lastPointsEarned: null,
  lastCombo: null,
  levelUp: null,
  totalClaims: 0,
  totalCharges: 0,
  comboBest: 0,
  username: null,

  addPoints: (data) => {
    // Clear any pending timers
    if (pointsClearTimer) clearTimeout(pointsClearTimer);
    if (data.levelUp && levelUpClearTimer) clearTimeout(levelUpClearTimer);

    set({
      lastPointsEarned: data.pointsEarned,
      lastCombo: data.combo ?? null,
      combo: data.combo ?? get().combo,
      ...(data.totalXp != null ? { xp: data.totalXp } : {}),
      ...(data.level != null ? { level: data.level } : {}),
      ...(data.levelUp ? { levelUp: data.level ?? get().level } : {}),
    });

    // Auto-clear floating points after 2s
    pointsClearTimer = setTimeout(() => {
      set({ lastPointsEarned: null, lastCombo: null });
    }, 2000);

    // Auto-clear level-up after 3s
    if (data.levelUp) {
      levelUpClearTimer = setTimeout(() => {
        set({ levelUp: null });
      }, 3000);
    }
  },

  setFromServer: (data) => {
    set({
      xp: data.xp,
      level: data.level,
      totalClaims: data.totalClaims ?? get().totalClaims,
      totalCharges: data.totalCharges ?? get().totalCharges,
      comboBest: data.comboBest ?? get().comboBest,
      username: data.username ?? get().username,
    });
  },

  setUsername: (username) => set({ username }),

  clearPoints: () => set({ lastPointsEarned: null, lastCombo: null }),
  clearLevelUp: () => set({ levelUp: null }),
}));
