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
  lastPointsLabel: string | null; // Custom label for FloatingPoints (e.g. "Daily Charge ✓")
  levelUp: number | null; // the new level, or null
  totalClaims: number;
  totalCharges: number;
  comboBest: number;
  username: string | null;
  lastChargeDateLocal: string | null; // ISO date string (YYYY-MM-DD) for daily first-charge tracking

  // ─── Actions ──────────────────────────────
  addPoints: (data: {
    pointsEarned: number;
    combo?: number;
    totalXp?: number;
    level?: number;
    levelUp?: boolean;
    label?: string;
  }) => void;
  /** Check if today's first charge has been done */
  isFirstChargeToday: () => boolean;
  /** Mark today's charge as done */
  markChargeToday: () => void;
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
  lastPointsLabel: null,
  levelUp: null,
  totalClaims: 0,
  totalCharges: 0,
  comboBest: 0,
  username: null,
  lastChargeDateLocal: null,

  addPoints: (data) => {
    // Clear any pending timers
    if (pointsClearTimer) clearTimeout(pointsClearTimer);
    if (data.levelUp && levelUpClearTimer) clearTimeout(levelUpClearTimer);

    set({
      lastPointsEarned: data.pointsEarned,
      lastCombo: data.combo ?? null,
      lastPointsLabel: data.label ?? null,
      combo: data.combo ?? get().combo,
      ...(data.totalXp != null ? { xp: data.totalXp } : {}),
      ...(data.level != null ? { level: data.level } : {}),
      ...(data.levelUp ? { levelUp: data.level ?? get().level } : {}),
    });

    // Auto-clear floating points after 2s
    pointsClearTimer = setTimeout(() => {
      set({ lastPointsEarned: null, lastCombo: null, lastPointsLabel: null });
    }, 2000);

    // Auto-clear level-up after 3s
    if (data.levelUp) {
      levelUpClearTimer = setTimeout(() => {
        set({ levelUp: null });
      }, 3000);
    }
  },

  isFirstChargeToday: () => {
    const today = new Date().toISOString().slice(0, 10);
    return get().lastChargeDateLocal !== today;
  },

  markChargeToday: () => {
    const today = new Date().toISOString().slice(0, 10);
    set({ lastChargeDateLocal: today });
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

  clearPoints: () => set({ lastPointsEarned: null, lastCombo: null, lastPointsLabel: null }),
  clearLevelUp: () => set({ levelUp: null }),
}));
