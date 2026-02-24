/**
 * Tests for the multiplayer store — state management, message handling,
 * position computation, and reconnection logic.
 *
 * Mocks colyseus.js to test without a real server.
 */

// Must define __DEV__ before any React Native module loads
(globalThis as any).__DEV__ = true;

// ─── Mocks ────────────────────────────────────────────────

// Mock expo modules (tower-store imports these)
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

// Mock colyseus.js — capture message handlers so we can trigger them in tests
type MessageHandler = (data: any) => void;
const messageHandlers = new Map<string, MessageHandler>();
let onErrorHandler: ((code: number, message?: string) => void) | null = null;
let onLeaveHandler: ((code: number) => void) | null = null;

const mockRoom = {
  roomId: "test-room-123",
  onMessage: jest.fn((type: string, handler: MessageHandler) => {
    messageHandlers.set(type, handler);
  }),
  onError: jest.fn((handler: any) => {
    onErrorHandler = handler;
  }),
  onLeave: jest.fn((handler: any) => {
    onLeaveHandler = handler;
  }),
  send: jest.fn(),
  leave: jest.fn().mockResolvedValue(undefined),
};

const mockClient = {
  joinOrCreate: jest.fn().mockResolvedValue(mockRoom),
};

jest.mock("colyseus.js", () => ({
  Client: jest.fn().mockImplementation(() => mockClient),
  Room: jest.fn(),
}));

jest.mock("@/constants/network", () => ({
  GAME_SERVER_URL: "ws://localhost:2567",
}));

import { useTowerStore } from "@/stores/tower-store";
import { useMultiplayerStore } from "@/stores/multiplayer-store";
import {
  DEFAULT_TOWER_CONFIG,
  MONOLITH_HALF_W,
  MONOLITH_HALF_D,
  SPIRE_START_LAYER,
  computeBodyLayerPositions,
  computeSpireLayerPositions,
} from "@monolith/common";

// Reset stores between tests
beforeEach(() => {
  useTowerStore.setState({
    demoBlocks: [],
    multiplayerMode: false,
    initialized: false,
  });
  useMultiplayerStore.setState({
    connected: false,
    error: null,
    connecting: false,
    reconnecting: false,
    playerCount: 0,
  });
  messageHandlers.clear();
  onErrorHandler = null;
  onLeaveHandler = null;
  mockRoom.send.mockClear();
  mockRoom.leave.mockClear();
  mockRoom.onMessage.mockClear();
  mockRoom.onError.mockClear();
  mockRoom.onLeave.mockClear();
  mockClient.joinOrCreate.mockClear().mockResolvedValue(mockRoom);
});

// ─── Helper: Create a server block ─────────────────────────

function makeServerBlock(layer: number, index: number, overrides: Record<string, any> = {}) {
  return {
    id: `block-${layer}-${index}`,
    layer,
    index,
    energy: 75,
    owner: "TestBot",
    ownerColor: "#ff6600",
    stakedAmount: 100_000_000,
    lastChargeTime: Date.now(),
    streak: 5,
    lastStreakDate: "2026-02-17",
    appearance: {
      color: "#ff6600",
      emoji: "🔥",
      name: "TestBot",
      style: 0,
      textureId: 0,
    },
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────

describe("multiplayer store connection", () => {
  it("connects and sets connected state", async () => {
    const result = await useMultiplayerStore.getState().connect();
    expect(result).toBe(true);
    expect(useMultiplayerStore.getState().connected).toBe(true);
    expect(useMultiplayerStore.getState().connecting).toBe(false);
  });

  it("registers message handlers on connect", async () => {
    await useMultiplayerStore.getState().connect();
    expect(mockRoom.onMessage).toHaveBeenCalledWith("tower_state", expect.any(Function));
    expect(mockRoom.onMessage).toHaveBeenCalledWith("block_update", expect.any(Function));
    expect(mockRoom.onError).toHaveBeenCalled();
    expect(mockRoom.onLeave).toHaveBeenCalled();
  });

  it("does not connect when already connected", async () => {
    await useMultiplayerStore.getState().connect();
    mockClient.joinOrCreate.mockClear();
    await useMultiplayerStore.getState().connect();
    expect(mockClient.joinOrCreate).not.toHaveBeenCalled();
  });

  it("handles connection failure", async () => {
    mockClient.joinOrCreate.mockRejectedValueOnce(new Error("Connection refused"));
    const result = await useMultiplayerStore.getState().connect();
    expect(result).toBe(false);
    expect(useMultiplayerStore.getState().connected).toBe(false);
    expect(useMultiplayerStore.getState().error).toBe("Connection refused");
  });

  it("disconnect clears state", async () => {
    await useMultiplayerStore.getState().connect();
    useMultiplayerStore.getState().disconnect();
    expect(useMultiplayerStore.getState().connected).toBe(false);
    expect(useMultiplayerStore.getState().playerCount).toBe(0);
  });
});

describe("multiplayer state sync", () => {
  it("applies full tower state from server message", async () => {
    await useMultiplayerStore.getState().connect();
    const handler = messageHandlers.get("tower_state");
    expect(handler).toBeDefined();

    handler!({
      blocks: [
        makeServerBlock(0, 0),
        makeServerBlock(0, 1, { owner: "", energy: 0 }),
        makeServerBlock(1, 0),
      ],
      stats: {
        totalBlocks: 650,
        occupiedBlocks: 2,
        activeUsers: 3,
        averageEnergy: 37.5,
      },
      tick: 42,
    });

    const blocks = useTowerStore.getState().demoBlocks;
    expect(blocks).toHaveLength(3);
    expect(blocks[0].owner).toBe("TestBot");
    expect(blocks[1].owner).toBeNull(); // "" → null
    expect(useMultiplayerStore.getState().playerCount).toBe(3);
  });

  it("applies single block update from server message", async () => {
    await useMultiplayerStore.getState().connect();

    // First set initial state
    const fullHandler = messageHandlers.get("tower_state");
    fullHandler!({
      blocks: [
        makeServerBlock(0, 0, { energy: 50 }),
        makeServerBlock(0, 1, { energy: 30 }),
      ],
      stats: { totalBlocks: 2, occupiedBlocks: 2, activeUsers: 1, averageEnergy: 40 },
      tick: 1,
    });

    // Then apply a single block update
    const updateHandler = messageHandlers.get("block_update");
    updateHandler!(makeServerBlock(0, 0, { energy: 100, ownerColor: "#00ff00" }));

    const blocks = useTowerStore.getState().demoBlocks;
    expect(blocks[0].energy).toBe(100);
    expect(blocks[0].ownerColor).toBe("#00ff00");
    // Other block unchanged
    expect(blocks[1].energy).toBe(30);
  });
});

describe("multiplayer block position computation", () => {
  it("computes real positions from layout (not {0,0,0})", async () => {
    await useMultiplayerStore.getState().connect();
    const handler = messageHandlers.get("tower_state");

    handler!({
      blocks: [makeServerBlock(0, 0), makeServerBlock(5, 2)],
      stats: { totalBlocks: 2, occupiedBlocks: 2, activeUsers: 1, averageEnergy: 75 },
      tick: 100,
    });

    const blocks = useTowerStore.getState().demoBlocks;

    // Layer 0, index 0 should NOT be at origin
    const b0 = blocks[0];
    const isAtOrigin = b0.position.x === 0 && b0.position.y === 0 && b0.position.z === 0;
    expect(isAtOrigin).toBe(false);

    // Verify position matches the layout computation
    const config = DEFAULT_TOWER_CONFIG;
    const count0 = config.blocksPerLayer[0];
    const positions0 = computeBodyLayerPositions(0, count0, MONOLITH_HALF_W, MONOLITH_HALF_D, config.layerCount);
    expect(b0.position.x).toBeCloseTo(positions0[0].x, 5);
    expect(b0.position.y).toBeCloseTo(positions0[0].y, 5);
    expect(b0.position.z).toBeCloseTo(positions0[0].z, 5);
  });

  it("computes spire layer positions correctly", async () => {
    await useMultiplayerStore.getState().connect();
    const handler = messageHandlers.get("tower_state");

    // Use a spire layer (>= SPIRE_START_LAYER)
    const spireLayer = SPIRE_START_LAYER;
    handler!({
      blocks: [makeServerBlock(spireLayer, 0)],
      stats: { totalBlocks: 1, occupiedBlocks: 1, activeUsers: 1, averageEnergy: 75 },
      tick: 200,
    });

    const blocks = useTowerStore.getState().demoBlocks;
    const config = DEFAULT_TOWER_CONFIG;
    const count = config.blocksPerLayer[spireLayer];
    const positions = computeSpireLayerPositions(spireLayer, count, config.layerCount);

    expect(blocks[0].position.x).toBeCloseTo(positions[0].x, 5);
    expect(blocks[0].position.y).toBeCloseTo(positions[0].y, 5);
    expect(blocks[0].position.z).toBeCloseTo(positions[0].z, 5);
  });

  it("single block update preserves computed position", async () => {
    await useMultiplayerStore.getState().connect();
    const fullHandler = messageHandlers.get("tower_state");
    fullHandler!({
      blocks: [makeServerBlock(3, 0, { energy: 50 })],
      stats: { totalBlocks: 1, occupiedBlocks: 1, activeUsers: 1, averageEnergy: 50 },
      tick: 300,
    });

    const posBefore = { ...useTowerStore.getState().demoBlocks[0].position };

    // Update the same block
    const updateHandler = messageHandlers.get("block_update");
    updateHandler!(makeServerBlock(3, 0, { energy: 100 }));

    const posAfter = useTowerStore.getState().demoBlocks[0].position;
    expect(posAfter.x).toBeCloseTo(posBefore.x, 5);
    expect(posAfter.y).toBeCloseTo(posBefore.y, 5);
    expect(posAfter.z).toBeCloseTo(posBefore.z, 5);
  });
});

describe("multiplayer customization broadcast", () => {
  it("applies customize block update with emoji and name changes", async () => {
    await useMultiplayerStore.getState().connect();

    // Set initial state
    const fullHandler = messageHandlers.get("tower_state");
    fullHandler!({
      blocks: [
        makeServerBlock(0, 0, { energy: 50 }),
      ],
      stats: { totalBlocks: 1, occupiedBlocks: 1, activeUsers: 1, averageEnergy: 50 },
      tick: 1,
    });

    const blocksBefore = useTowerStore.getState().demoBlocks;
    expect(blocksBefore[0].emoji).toBe("🔥");
    expect(blocksBefore[0].name).toBe("TestBot");

    // Apply customize update — only emoji and name changed
    const updateHandler = messageHandlers.get("block_update");
    updateHandler!(makeServerBlock(0, 0, {
      energy: 50, // unchanged
      appearance: {
        color: "#ff6600",
        emoji: "🎨",
        name: "NewName",
        style: 0,
        textureId: 0,
      },
      eventType: "customize",
    }));

    const blocksAfter = useTowerStore.getState().demoBlocks;
    expect(blocksAfter[0].emoji).toBe("🎨");
    expect(blocksAfter[0].name).toBe("NewName");
  });

  it("applies customize block update with style and textureId changes", async () => {
    await useMultiplayerStore.getState().connect();

    const fullHandler = messageHandlers.get("tower_state");
    fullHandler!({
      blocks: [makeServerBlock(0, 0)],
      stats: { totalBlocks: 1, occupiedBlocks: 1, activeUsers: 1, averageEnergy: 75 },
      tick: 1,
    });

    const updateHandler = messageHandlers.get("block_update");
    updateHandler!(makeServerBlock(0, 0, {
      appearance: {
        color: "#ff6600",
        emoji: "🔥",
        name: "TestBot",
        style: 3,
        textureId: 2,
      },
      eventType: "customize",
    }));

    const blocks = useTowerStore.getState().demoBlocks;
    expect(blocks[0].style).toBe(3);
    expect(blocks[0].textureId).toBe(2);
  });
});

describe("multiplayer send actions", () => {
  it("sendClaim sends claim message to room", async () => {
    await useMultiplayerStore.getState().connect();
    const msg = { blockId: "block-0-0", wallet: "abc123", amount: 10_000_000, color: "#ff0000" };
    useMultiplayerStore.getState().sendClaim(msg);
    expect(mockRoom.send).toHaveBeenCalledWith("claim", msg);
  });

  it("sendCharge sends charge message to room", async () => {
    await useMultiplayerStore.getState().connect();
    const msg = { blockId: "block-5-3" };
    useMultiplayerStore.getState().sendCharge(msg);
    expect(mockRoom.send).toHaveBeenCalledWith("charge", msg);
  });

  it("sendCustomize sends customize message to room", async () => {
    await useMultiplayerStore.getState().connect();
    const msg = { blockId: "block-1-0", changes: { color: "#00ff00", emoji: "🎨" } };
    useMultiplayerStore.getState().sendCustomize(msg);
    expect(mockRoom.send).toHaveBeenCalledWith("customize", msg);
  });
});
