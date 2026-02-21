/**
 * Tests for the player XP/level/combo store.
 */

(globalThis as any).__DEV__ = true;

// Mock expo modules
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "/mock/",
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  readAsStringAsync: jest.fn().mockResolvedValue(""),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/services/mwa", () => ({
  SECURE_STORE_KEYS: {
    AUTH_TOKEN: "mwa_auth_token",
    BASE64_ADDRESS: "mwa_base64_address",
    WALLET_URI_BASE: "mwa_wallet_uri_base",
    HAS_COMPLETED_ONBOARDING: "monolith_onboarding_complete",
  },
}));

import { usePlayerStore } from "@/stores/player-store";

beforeEach(() => {
  jest.useFakeTimers();
  usePlayerStore.setState({
    xp: 0,
    level: 1,
    combo: 0,
    lastPointsEarned: null,
    lastCombo: null,
    levelUp: null,
    totalClaims: 0,
    totalCharges: 0,
    comboBest: 0,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("player store", () => {
  it("has correct initial state", () => {
    const state = usePlayerStore.getState();
    expect(state.xp).toBe(0);
    expect(state.level).toBe(1);
    expect(state.lastPointsEarned).toBeNull();
    expect(state.levelUp).toBeNull();
  });

  it("addPoints updates state correctly", () => {
    usePlayerStore.getState().addPoints({
      pointsEarned: 100,
      combo: 2,
      totalXp: 100,
      level: 2,
    });

    const state = usePlayerStore.getState();
    expect(state.lastPointsEarned).toBe(100);
    expect(state.lastCombo).toBe(2);
    expect(state.xp).toBe(100);
    expect(state.level).toBe(2);
    expect(state.levelUp).toBeNull(); // levelUp not set
  });

  it("addPoints with levelUp triggers celebration", () => {
    usePlayerStore.getState().addPoints({
      pointsEarned: 100,
      totalXp: 100,
      level: 2,
      levelUp: true,
    });

    expect(usePlayerStore.getState().levelUp).toBe(2);
  });

  it("lastPointsEarned auto-clears after 2s", () => {
    usePlayerStore.getState().addPoints({
      pointsEarned: 50,
      totalXp: 50,
      level: 1,
    });

    expect(usePlayerStore.getState().lastPointsEarned).toBe(50);

    jest.advanceTimersByTime(2000);
    expect(usePlayerStore.getState().lastPointsEarned).toBeNull();
  });

  it("levelUp auto-clears after 3s", () => {
    usePlayerStore.getState().addPoints({
      pointsEarned: 100,
      totalXp: 100,
      level: 2,
      levelUp: true,
    });

    expect(usePlayerStore.getState().levelUp).toBe(2);

    jest.advanceTimersByTime(3000);
    expect(usePlayerStore.getState().levelUp).toBeNull();
  });

  it("setFromServer hydrates state", () => {
    usePlayerStore.getState().setFromServer({
      xp: 500,
      level: 4,
      totalClaims: 5,
      totalCharges: 20,
      comboBest: 8,
    });

    const state = usePlayerStore.getState();
    expect(state.xp).toBe(500);
    expect(state.level).toBe(4);
    expect(state.totalClaims).toBe(5);
    expect(state.totalCharges).toBe(20);
    expect(state.comboBest).toBe(8);
  });

  it("clearPoints clears floating state", () => {
    usePlayerStore.getState().addPoints({
      pointsEarned: 100,
      totalXp: 100,
      level: 1,
    });

    usePlayerStore.getState().clearPoints();
    expect(usePlayerStore.getState().lastPointsEarned).toBeNull();
    expect(usePlayerStore.getState().lastCombo).toBeNull();
  });

  it("clearLevelUp clears level up state", () => {
    usePlayerStore.getState().addPoints({
      pointsEarned: 100,
      totalXp: 100,
      level: 2,
      levelUp: true,
    });

    usePlayerStore.getState().clearLevelUp();
    expect(usePlayerStore.getState().levelUp).toBeNull();
  });

  it("combo tracking via addPoints", () => {
    usePlayerStore.getState().addPoints({
      pointsEarned: 25,
      combo: 3,
      totalXp: 75,
      level: 1,
    });

    expect(usePlayerStore.getState().combo).toBe(3);
    expect(usePlayerStore.getState().lastCombo).toBe(3);
  });
});
