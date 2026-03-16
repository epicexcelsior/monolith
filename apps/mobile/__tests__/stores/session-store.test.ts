/**
 * Tests for the session store — "While You Were Away" functionality.
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

import { useSessionStore } from "@/stores/session-store";
import type { AwaySummary } from "@/stores/session-store";

const mockSummary: AwaySummary = {
  energyDelta: -15,
  pokesReceived: 2,
  neighborChanges: 1,
  streakAtRisk: true,
  lowestEnergyBlockId: "block-42",
};

beforeEach(() => {
  Object.keys(mockSecureStore).forEach((k) => delete mockSecureStore[k]);
  useSessionStore.setState({
    lastSessionTimestamp: null,
    awaySummary: null,
    showAwaySummary: false,
    initialized: false,
  });
});

describe("session-store", () => {
  it("starts with no summary", () => {
    const { awaySummary, showAwaySummary } = useSessionStore.getState();
    expect(awaySummary).toBeNull();
    expect(showAwaySummary).toBe(false);
  });

  it("setAwaySummary shows the modal", () => {
    useSessionStore.getState().setAwaySummary(mockSummary);
    const { awaySummary, showAwaySummary } = useSessionStore.getState();
    expect(awaySummary).toEqual(mockSummary);
    expect(showAwaySummary).toBe(true);
  });

  it("dismissAwaySummary clears the flag and summary", () => {
    useSessionStore.getState().setAwaySummary(mockSummary);
    useSessionStore.getState().dismissAwaySummary();
    const { awaySummary, showAwaySummary } = useSessionStore.getState();
    expect(awaySummary).toBeNull();
    expect(showAwaySummary).toBe(false);
  });

  it("shouldShowAwaySummary returns false with no last session", () => {
    const result = useSessionStore.getState().shouldShowAwaySummary();
    expect(result).toBe(false);
  });

  it("shouldShowAwaySummary returns false if session was recent", () => {
    useSessionStore.setState({ lastSessionTimestamp: Date.now() - 60_000 }); // 1 minute ago
    const result = useSessionStore.getState().shouldShowAwaySummary();
    expect(result).toBe(false);
  });

  it("shouldShowAwaySummary returns true if session was 4+ hours ago", () => {
    useSessionStore.setState({ lastSessionTimestamp: Date.now() - 5 * 60 * 60 * 1000 }); // 5 hours ago
    const result = useSessionStore.getState().shouldShowAwaySummary();
    expect(result).toBe(true);
  });

  it("recordSession updates lastSessionTimestamp", () => {
    useSessionStore.getState().recordSession();
    const { lastSessionTimestamp } = useSessionStore.getState();
    expect(lastSessionTimestamp).toBeGreaterThan(0);
    expect(lastSessionTimestamp).toBeLessThanOrEqual(Date.now());
  });
});
