import { create } from "zustand";
import type { ActivityEvent, LeaderboardEntry } from "@monolith/common";
import { useAchievementStore } from "@/stores/achievement-store";

interface ActivityStore {
  events: ActivityEvent[];
  leaderboard: LeaderboardEntry[];
  myRank: number | null;
  addEvent: (event: ActivityEvent) => void;
  addEvents: (events: ActivityEvent[]) => void;
  setLeaderboard: (lb: LeaderboardEntry[], myName?: string) => void;
}

const MAX_EVENTS = 100;

export const useActivityStore = create<ActivityStore>((set, get) => ({
  events: [],
  leaderboard: [],
  myRank: null,

  addEvent: (event) =>
    set((state) => {
      if (state.events.some((e) => e.id === event.id)) return state;
      const events = [...state.events, event];
      if (events.length > MAX_EVENTS) events.shift();
      return { events };
    }),

  addEvents: (newEvents) =>
    set((state) => {
      const existingIds = new Set(state.events.map((e) => e.id));
      const fresh = newEvents.filter((e) => !existingIds.has(e.id));
      if (fresh.length === 0) return state;
      const events = [...state.events, ...fresh];
      while (events.length > MAX_EVENTS) events.shift();
      return { events };
    }),

  setLeaderboard: (lb, myName) => {
    const myEntry = myName ? lb.find((e) => e.name === myName) : null;
    const rank = myEntry?.rank ?? null;
    set({ leaderboard: lb, myRank: rank });

    if (rank !== null && rank <= 10) {
      useAchievementStore.getState().checkAndUnlock("top_10");
    }
  },
}));
