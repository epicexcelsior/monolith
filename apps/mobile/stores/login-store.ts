/**
 * Daily Login Calendar store — 7-day rolling login reward cycle.
 *
 * Cumulative: missing a day does NOT reset progress.
 * When all 7 days collected, cycle restarts.
 * Persisted to expo-secure-store.
 */

import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { LOGIN_REWARDS } from "@monolith/common";
import { usePlayerStore } from "./player-store";

const STORAGE_KEY = "monolith_login_calendar";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface LoginState {
  currentDay: number; // 1-7 in current cycle
  collectedDays: boolean[]; // length 7, true if that day's reward was collected
  lastCollectedDate: string; // ISO date string YYYY-MM-DD
  showCalendar: boolean;

  collectToday(): void;
  shouldShowCalendar(): boolean;
  hydrate(): Promise<void>;
  dismissCalendar(): void;
}

export const useLoginStore = create<LoginState>((set, get) => ({
  currentDay: 1,
  collectedDays: [false, false, false, false, false, false, false],
  lastCollectedDate: "",
  showCalendar: false,

  collectToday: () => {
    const { currentDay, collectedDays, lastCollectedDate } = get();
    const today = todayISO();

    // Already collected today
    if (lastCollectedDate === today) return;

    // Mark current day as collected
    const newCollected = [...collectedDays];
    newCollected[currentDay - 1] = true;

    // Award the reward
    const reward = LOGIN_REWARDS[currentDay - 1];
    if (reward.type === "xp") {
      usePlayerStore.getState().addPoints({
        pointsEarned: reward.amount,
        label: `Day ${currentDay} Login`,
      });
    }
    // loot and freeze rewards are visual-only for now (server would handle actual grants)

    // Check if all 7 collected — if so, reset cycle
    const allCollected = newCollected.every((d) => d);
    if (allCollected) {
      set({
        currentDay: 1,
        collectedDays: [false, false, false, false, false, false, false],
        lastCollectedDate: today,
        showCalendar: false,
      });
    } else {
      set({
        currentDay: currentDay + 1,
        collectedDays: newCollected,
        lastCollectedDate: today,
      });
    }

    // Persist
    const state = get();
    SecureStore.setItemAsync(
      STORAGE_KEY,
      JSON.stringify({
        currentDay: state.currentDay,
        collectedDays: state.collectedDays,
        lastCollectedDate: state.lastCollectedDate,
      }),
    ).catch(() => {});
  },

  shouldShowCalendar: () => {
    const { lastCollectedDate } = get();
    return lastCollectedDate !== todayISO();
  },

  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          currentDay: parsed.currentDay ?? 1,
          collectedDays: parsed.collectedDays ?? [false, false, false, false, false, false, false],
          lastCollectedDate: parsed.lastCollectedDate ?? "",
        });
      }
    } catch {
      /* ignore */
    }
  },

  dismissCalendar: () => set({ showCalendar: false }),
}));
