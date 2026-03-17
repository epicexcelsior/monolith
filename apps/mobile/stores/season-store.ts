/**
 * Season store — client-side season pass state.
 *
 * Season XP is updated via `season_update` messages from the server.
 * Premium status tracked locally (server validates purchase).
 */

import { create } from "zustand";

export interface SeasonReward {
  id: string;
  level: number;
  type: "xp_boost" | "loot_crate" | "streak_freeze" | "color" | "style" | "emoji" | "badge";
  label: string;
  icon: string;
  value?: number;
}

export interface SeasonInfo {
  id: number;
  name: string;
  tagline: string;
  startDate: string;
  endDate: string;
  xpPerLevel: number;
  freeTrack: SeasonReward[];
  premiumTrack: SeasonReward[];
}

interface SeasonStore {
  currentSeason: SeasonInfo | null;
  seasonXP: number;
  seasonLevel: number;
  seasonLevelXP: number;   // XP within current level
  isPremium: boolean;
  claimedRewards: string[];
  showSeasonPass: boolean;

  // Actions
  setSeasonData(data: {
    season?: SeasonInfo;
    seasonXP: number;
    seasonLevel: number;
    seasonLevelXP: number;
    isPremium?: boolean;
    claimedRewards?: string[];
  }): void;
  addSeasonXP(amount: number): void;
  openSeasonPass(): void;
  closeSeasonPass(): void;
  markRewardClaimed(rewardId: string): void;
  setPremium(value: boolean): void;
}

export const useSeasonStore = create<SeasonStore>((set, get) => ({
  currentSeason: null,
  seasonXP: 0,
  seasonLevel: 0,
  seasonLevelXP: 0,
  isPremium: false,
  claimedRewards: [],
  showSeasonPass: false,

  setSeasonData: (data) => set({
    ...(data.season ? { currentSeason: data.season } : {}),
    seasonXP: data.seasonXP,
    seasonLevel: data.seasonLevel,
    seasonLevelXP: data.seasonLevelXP,
    ...(data.isPremium !== undefined ? { isPremium: data.isPremium } : {}),
    ...(data.claimedRewards !== undefined ? { claimedRewards: data.claimedRewards } : {}),
  }),

  addSeasonXP: (amount) => {
    const { currentSeason, seasonXP } = get();
    const xpPerLevel = currentSeason?.xpPerLevel ?? 100;
    const newXP = seasonXP + amount;
    const newLevel = Math.floor(newXP / xpPerLevel);
    const newLevelXP = newXP % xpPerLevel;
    set({ seasonXP: newXP, seasonLevel: newLevel, seasonLevelXP: newLevelXP });
  },

  openSeasonPass: () => set({ showSeasonPass: true }),
  closeSeasonPass: () => set({ showSeasonPass: false }),

  markRewardClaimed: (rewardId) =>
    set((state) => ({
      claimedRewards: state.claimedRewards.includes(rewardId)
        ? state.claimedRewards
        : [...state.claimedRewards, rewardId],
    })),

  setPremium: (value) => set({ isPremium: value }),
}));
