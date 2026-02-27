/**
 * Tapestry social layer state.
 *
 * Uses plain arrays/objects (NOT Map/Set) for Zustand reactivity.
 * Zustand only triggers re-renders when references change.
 */

import { create } from "zustand";
import type { TapestryProfileData, TapestrySocialCounts } from "@/utils/tapestry";

interface TapestryState {
  // Profile
  profileId: string | null;
  profile: TapestryProfileData | null;
  socialCounts: TapestrySocialCounts | null;

  // Actions
  setProfile: (
    profileId: string,
    profile: TapestryProfileData,
  ) => void;
  setSocialCounts: (counts: TapestrySocialCounts) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  profileId: null,
  profile: null,
  socialCounts: null,
};

export const useTapestryStore = create<TapestryState>((set) => ({
  ...INITIAL_STATE,

  setProfile: (profileId, profile) =>
    set({ profileId, profile }),

  setSocialCounts: (counts) => set({ socialCounts: counts }),

  reset: () => set(INITIAL_STATE),
}));
