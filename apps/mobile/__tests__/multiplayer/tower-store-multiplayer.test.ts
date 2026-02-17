/**
 * Tests for tower-store multiplayer mode.
 *
 * Validates that multiplayerMode flag correctly controls behavior,
 * and that setDemoBlocks works for server-provided state.
 */

// Must define __DEV__ before any React Native module loads
(globalThis as any).__DEV__ = true;

// Mock native modules that tower-store transitively imports
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "/mock/",
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  readAsStringAsync: jest.fn().mockResolvedValue(""),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
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

// Reset store between tests
beforeEach(() => {
  useTowerStore.setState({
    demoBlocks: [],
    multiplayerMode: false,
    initialized: false,
    onboardingDone: false,
  });
});

describe("tower-store multiplayer mode", () => {
  it("starts with multiplayerMode false", () => {
    expect(useTowerStore.getState().multiplayerMode).toBe(false);
  });

  it("setMultiplayerMode toggles the flag", () => {
    useTowerStore.getState().setMultiplayerMode(true);
    expect(useTowerStore.getState().multiplayerMode).toBe(true);

    useTowerStore.getState().setMultiplayerMode(false);
    expect(useTowerStore.getState().multiplayerMode).toBe(false);
  });

  it("setDemoBlocks replaces all blocks (simulates server sync)", () => {
    const serverBlocks = [
      {
        id: "block-0-0",
        layer: 0,
        index: 0,
        energy: 85,
        ownerColor: "#ff0000",
        owner: "SolWhale.sol",
        stakedAmount: 100_000_000,
        position: { x: 0, y: 0, z: 0 },
        emoji: "🐋",
        name: "SolWhale.sol",
      },
      {
        id: "block-0-1",
        layer: 0,
        index: 1,
        energy: 0,
        ownerColor: "#00ffff",
        owner: null,
        stakedAmount: 0,
        position: { x: 0, y: 0, z: 0 },
      },
    ];

    useTowerStore.getState().setDemoBlocks(serverBlocks);

    const blocks = useTowerStore.getState().demoBlocks;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].owner).toBe("SolWhale.sol");
    expect(blocks[0].energy).toBe(85);
    expect(blocks[1].owner).toBeNull();
  });

  it("getDemoBlockById works with server-provided blocks", () => {
    useTowerStore.getState().setDemoBlocks([
      {
        id: "block-5-3",
        layer: 5,
        index: 3,
        energy: 42,
        ownerColor: "#00ff00",
        owner: "TestPlayer",
        stakedAmount: 50_000_000,
        position: { x: 0, y: 0, z: 0 },
      },
    ]);

    const block = useTowerStore.getState().getDemoBlockById("block-5-3");
    expect(block).toBeDefined();
    expect(block!.energy).toBe(42);
    expect(block!.owner).toBe("TestPlayer");
  });

  it("multiple setDemoBlocks calls replace previous state", () => {
    useTowerStore.getState().setDemoBlocks([
      { id: "a", layer: 0, index: 0, energy: 10, ownerColor: "#000", owner: null, stakedAmount: 0, position: { x: 0, y: 0, z: 0 } },
      { id: "b", layer: 0, index: 1, energy: 20, ownerColor: "#000", owner: null, stakedAmount: 0, position: { x: 0, y: 0, z: 0 } },
    ]);
    expect(useTowerStore.getState().demoBlocks).toHaveLength(2);

    useTowerStore.getState().setDemoBlocks([
      { id: "c", layer: 1, index: 0, energy: 50, ownerColor: "#fff", owner: "Bob", stakedAmount: 0, position: { x: 0, y: 0, z: 0 } },
    ]);
    expect(useTowerStore.getState().demoBlocks).toHaveLength(1);
    expect(useTowerStore.getState().demoBlocks[0].id).toBe("c");
  });

  it("initTower in multiplayer mode skips local seed", async () => {
    useTowerStore.getState().setMultiplayerMode(true);
    await useTowerStore.getState().initTower();

    // Should be initialized but have NO blocks (server provides them)
    expect(useTowerStore.getState().initialized).toBe(true);
    expect(useTowerStore.getState().demoBlocks).toHaveLength(0);
  });

  it("initTower in local mode seeds the tower", async () => {
    useTowerStore.getState().setMultiplayerMode(false);
    await useTowerStore.getState().initTower();

    expect(useTowerStore.getState().initialized).toBe(true);
    // Should have seeded ~540+ blocks (fewer per layer with exponential scaling)
    expect(useTowerStore.getState().demoBlocks.length).toBeGreaterThan(500);
  });
});
