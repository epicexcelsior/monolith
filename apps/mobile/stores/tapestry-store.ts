/**
 * Tapestry social layer state.
 *
 * Uses plain arrays/objects (NOT Map/Set) for Zustand reactivity.
 * Zustand only triggers re-renders when references change.
 */

import { create } from "zustand";
import type { TapestryProfileData, TapestrySocialCounts, TapestryContent } from "@/utils/tapestry";

interface TapestryState {
  // Profile
  profileId: string | null;
  profile: TapestryProfileData | null;
  socialCounts: TapestrySocialCounts | null;

  // Following cache — plain array, NOT Set
  followingIds: string[];

  // Content cache (blockId → contentId) — plain object, NOT Map
  blockContentMap: Record<string, string>;

  // Feed cache
  feedItems: TapestryContent[];
  feedLoading: boolean;

  // Actions
  setProfile: (
    profileId: string,
    profile: TapestryProfileData,
    socialCounts: TapestrySocialCounts,
  ) => void;
  setSocialCounts: (counts: TapestrySocialCounts) => void;
  addFollowing: (profileId: string) => void;
  removeFollowing: (profileId: string) => void;
  setBlockContent: (blockId: string, contentId: string) => void;
  setFeed: (items: TapestryContent[]) => void;
  setFeedLoading: (loading: boolean) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  profileId: null,
  profile: null,
  socialCounts: null,
  followingIds: [],
  blockContentMap: {},
  feedItems: [],
  feedLoading: false,
};

export const useTapestryStore = create<TapestryState>((set) => ({
  ...INITIAL_STATE,

  setProfile: (profileId, profile, socialCounts) =>
    set({ profileId, profile, socialCounts }),

  setSocialCounts: (counts) => set({ socialCounts: counts }),

  addFollowing: (profileId) =>
    set((s) => ({
      followingIds: s.followingIds.includes(profileId)
        ? s.followingIds
        : [...s.followingIds, profileId],
    })),

  removeFollowing: (profileId) =>
    set((s) => ({
      followingIds: s.followingIds.filter((id) => id !== profileId),
    })),

  setBlockContent: (blockId, contentId) =>
    set((s) => ({
      blockContentMap: { ...s.blockContentMap, [blockId]: contentId },
    })),

  setFeed: (items) => set({ feedItems: items }),
  setFeedLoading: (loading) => set({ feedLoading: loading }),

  reset: () => set(INITIAL_STATE),
}));
