/**
 * Tests for tower store event fields (recentlyChargedId, recentlyClaimedId).
 */

(globalThis as any).__DEV__ = true;

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

import { useTowerStore } from "@/stores/tower-store";

beforeEach(() => {
  useTowerStore.setState({
    recentlyClaimedId: null,
    recentlyChargedId: null,
  });
});

describe("tower store event fields", () => {
  it("has null recentlyChargedId initially", () => {
    expect(useTowerStore.getState().recentlyChargedId).toBeNull();
  });

  it("setRecentlyChargedId sets and clearRecentlyCharged clears", () => {
    useTowerStore.getState().setRecentlyChargedId("block-5-3");
    expect(useTowerStore.getState().recentlyChargedId).toBe("block-5-3");

    useTowerStore.getState().clearRecentlyCharged();
    expect(useTowerStore.getState().recentlyChargedId).toBeNull();
  });

  it("setRecentlyClaimedId sets and clearRecentlyClaimed clears", () => {
    useTowerStore.getState().setRecentlyClaimedId("block-2-1");
    expect(useTowerStore.getState().recentlyClaimedId).toBe("block-2-1");

    useTowerStore.getState().clearRecentlyClaimed();
    expect(useTowerStore.getState().recentlyClaimedId).toBeNull();
  });

  it("recentlyClaimedId and recentlyChargedId are independent", () => {
    useTowerStore.getState().setRecentlyClaimedId("block-1-0");
    useTowerStore.getState().setRecentlyChargedId("block-2-0");

    expect(useTowerStore.getState().recentlyClaimedId).toBe("block-1-0");
    expect(useTowerStore.getState().recentlyChargedId).toBe("block-2-0");

    useTowerStore.getState().clearRecentlyClaimed();
    expect(useTowerStore.getState().recentlyClaimedId).toBeNull();
    expect(useTowerStore.getState().recentlyChargedId).toBe("block-2-0");
  });
});
