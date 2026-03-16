/**
 * Session tracking store — tracks app open/close times.
 * Used for "While you were away" return summary.
 */

import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const LAST_SESSION_KEY = "monolith_last_session";
const AWAY_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface AwaySummary {
  energyDelta: number;
  pokesReceived: number;
  neighborChanges: number;
  streakAtRisk: boolean;
  lowestEnergyBlockId: string;
}

interface SessionStore {
  lastSessionTimestamp: number | null;
  awaySummary: AwaySummary | null;
  showAwaySummary: boolean;
  initialized: boolean;

  init: () => Promise<void>;
  recordSession: () => void;
  setAwaySummary: (summary: AwaySummary) => void;
  dismissAwaySummary: () => void;
  shouldShowAwaySummary: () => boolean;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  lastSessionTimestamp: null,
  awaySummary: null,
  showAwaySummary: false,
  initialized: false,

  init: async () => {
    try {
      const raw = await SecureStore.getItemAsync(LAST_SESSION_KEY);
      const ts = raw ? parseInt(raw, 10) : null;
      set({ lastSessionTimestamp: ts, initialized: true });
    } catch {
      set({ initialized: true });
    }
  },

  recordSession: () => {
    const now = Date.now();
    set({ lastSessionTimestamp: now });
    SecureStore.setItemAsync(LAST_SESSION_KEY, now.toString()).catch(() => {});
  },

  setAwaySummary: (summary) => {
    set({ awaySummary: summary, showAwaySummary: true });
  },

  dismissAwaySummary: () => {
    set({ showAwaySummary: false, awaySummary: null });
  },

  shouldShowAwaySummary: () => {
    const { lastSessionTimestamp } = get();
    if (!lastSessionTimestamp) return false;
    return Date.now() - lastSessionTimestamp > AWAY_THRESHOLD_MS;
  },
}));
