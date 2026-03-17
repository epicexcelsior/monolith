/**
 * Tests for the login calendar store — 7-day rolling login rewards.
 */

const mockSecureStore: Record<string, string> = {};
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore[key] ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStore[key] = value;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete mockSecureStore[key];
  }),
}));

import { useLoginStore } from "@/stores/login-store";

beforeEach(() => {
  Object.keys(mockSecureStore).forEach((k) => delete mockSecureStore[k]);
  useLoginStore.setState({
    currentDay: 1,
    collectedDays: [false, false, false, false, false, false, false],
    lastCollectedDate: "",
    showCalendar: false,
  });
});

describe("login-store", () => {
  it("starts with day 1 and no collected days", () => {
    const { currentDay, collectedDays } = useLoginStore.getState();
    expect(currentDay).toBe(1);
    expect(collectedDays).toEqual([false, false, false, false, false, false, false]);
  });

  it("collectToday marks the current day and advances currentDay", () => {
    useLoginStore.getState().collectToday();
    const { currentDay, collectedDays, lastCollectedDate } = useLoginStore.getState();
    expect(collectedDays[0]).toBe(true);
    expect(currentDay).toBe(2);
    expect(lastCollectedDate).toBe(new Date().toISOString().slice(0, 10));
  });

  it("collectToday does nothing if already collected today", () => {
    const today = new Date().toISOString().slice(0, 10);
    useLoginStore.setState({ lastCollectedDate: today });
    useLoginStore.getState().collectToday();
    const { currentDay, collectedDays } = useLoginStore.getState();
    expect(currentDay).toBe(1);
    expect(collectedDays[0]).toBe(false);
  });

  it("shouldShowCalendar returns true when today is not collected", () => {
    expect(useLoginStore.getState().shouldShowCalendar()).toBe(true);
  });

  it("shouldShowCalendar returns false after collecting today", () => {
    useLoginStore.getState().collectToday();
    expect(useLoginStore.getState().shouldShowCalendar()).toBe(false);
  });

  it("7-day cycle resets after all 7 collected", () => {
    // Simulate 6 days already collected, currently on day 7
    useLoginStore.setState({
      currentDay: 7,
      collectedDays: [true, true, true, true, true, true, false],
      lastCollectedDate: "2026-01-01", // Not today
    });

    useLoginStore.getState().collectToday();
    const { currentDay, collectedDays } = useLoginStore.getState();
    // All collected → cycle resets
    expect(currentDay).toBe(1);
    expect(collectedDays).toEqual([false, false, false, false, false, false, false]);
  });

  it("hydrate restores state from SecureStore", async () => {
    const stored = {
      currentDay: 4,
      collectedDays: [true, true, true, false, false, false, false],
      lastCollectedDate: "2026-03-15",
    };
    mockSecureStore["monolith_login_calendar"] = JSON.stringify(stored);

    await useLoginStore.getState().hydrate();

    const { currentDay, collectedDays, lastCollectedDate } = useLoginStore.getState();
    expect(currentDay).toBe(4);
    expect(collectedDays).toEqual([true, true, true, false, false, false, false]);
    expect(lastCollectedDate).toBe("2026-03-15");
  });

  it("hydrate handles missing data gracefully", async () => {
    await useLoginStore.getState().hydrate();
    // Should remain at defaults
    const { currentDay, collectedDays } = useLoginStore.getState();
    expect(currentDay).toBe(1);
    expect(collectedDays).toEqual([false, false, false, false, false, false, false]);
  });

  it("hydrate handles corrupt data gracefully", async () => {
    mockSecureStore["monolith_login_calendar"] = "not-json";
    await useLoginStore.getState().hydrate();
    // Should remain at defaults (error caught)
    const { currentDay } = useLoginStore.getState();
    expect(currentDay).toBe(1);
  });

  it("collectToday persists state to SecureStore", () => {
    useLoginStore.getState().collectToday();
    const stored = JSON.parse(mockSecureStore["monolith_login_calendar"]);
    expect(stored.currentDay).toBe(2);
    expect(stored.collectedDays[0]).toBe(true);
  });

  it("dismissCalendar sets showCalendar to false", () => {
    useLoginStore.setState({ showCalendar: true });
    useLoginStore.getState().dismissCalendar();
    expect(useLoginStore.getState().showCalendar).toBe(false);
  });

  it("cumulative progress: skipping days does not reset", () => {
    // User collected day 1, then "skipped" some days (lastCollectedDate is in the past)
    useLoginStore.setState({
      currentDay: 2,
      collectedDays: [true, false, false, false, false, false, false],
      lastCollectedDate: "2026-01-01",
    });

    useLoginStore.getState().collectToday();
    const { currentDay, collectedDays } = useLoginStore.getState();
    expect(currentDay).toBe(3);
    expect(collectedDays[1]).toBe(true);
    // Day 1 still collected
    expect(collectedDays[0]).toBe(true);
  });
});
