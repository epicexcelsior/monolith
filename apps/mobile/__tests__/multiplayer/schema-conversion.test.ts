/**
 * Tests for server schema → DemoBlock conversion logic.
 *
 * The useMultiplayer hook converts Colyseus state (with empty-string owners,
 * nested appearance, no position) into DemoBlock[] for the tower store.
 * These tests validate that conversion without needing a real Colyseus connection.
 */

import type { DemoBlock } from "@/stores/tower-store";

/**
 * Mirrors the conversion logic from useMultiplayer.syncState.
 * Extracted here so we can test it in isolation.
 */
function convertServerBlock(block: {
  id: string;
  layer: number;
  index: number;
  energy: number;
  ownerColor: string;
  owner: string;
  stakedAmount: number;
  lastChargeTime: number;
  streak: number;
  lastStreakDate: string;
  appearance: {
    emoji: string;
    name: string;
    color: string;
    style: number;
    textureId: number;
  };
}): DemoBlock {
  return {
    id: block.id,
    layer: block.layer,
    index: block.index,
    energy: block.energy,
    ownerColor: block.ownerColor || "#00ffff",
    owner: block.owner || null, // empty string → null
    stakedAmount: block.stakedAmount,
    position: { x: 0, y: 0, z: 0 }, // placeholder, TowerGrid computes real position
    emoji: block.appearance?.emoji || undefined,
    name: block.appearance?.name || undefined,
    style: block.appearance?.style || 0,
    textureId: block.appearance?.textureId || 0,
    lastChargeTime: block.lastChargeTime || undefined,
    streak: block.streak || 0,
    lastStreakDate: block.lastStreakDate || undefined,
  };
}

describe("schema → DemoBlock conversion", () => {
  it("converts a bot-owned block correctly", () => {
    const serverBlock = {
      id: "block-3-7",
      layer: 3,
      index: 7,
      energy: 72.5,
      ownerColor: "#5B8FB9",
      owner: "SolWhale.sol",
      stakedAmount: 500_000_000,
      lastChargeTime: 1708000000000,
      streak: 12,
      lastStreakDate: "2026-02-15",
      appearance: {
        emoji: "🐋",
        name: "SolWhale.sol",
        color: "#5B8FB9",
        style: 0,
        textureId: 0,
      },
    };

    const demo = convertServerBlock(serverBlock);

    expect(demo.id).toBe("block-3-7");
    expect(demo.layer).toBe(3);
    expect(demo.index).toBe(7);
    expect(demo.energy).toBe(72.5);
    expect(demo.owner).toBe("SolWhale.sol");
    expect(demo.ownerColor).toBe("#5B8FB9");
    expect(demo.emoji).toBe("🐋");
    expect(demo.name).toBe("SolWhale.sol");
    expect(demo.streak).toBe(12);
    expect(demo.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("converts unclaimed block: empty string owner → null", () => {
    const serverBlock = {
      id: "block-0-5",
      layer: 0,
      index: 5,
      energy: 0,
      ownerColor: "",
      owner: "", // Colyseus schema uses "" instead of null
      stakedAmount: 0,
      lastChargeTime: 0,
      streak: 0,
      lastStreakDate: "",
      appearance: {
        emoji: "",
        name: "",
        color: "",
        style: 0,
        textureId: 0,
      },
    };

    const demo = convertServerBlock(serverBlock);

    expect(demo.owner).toBeNull();
    expect(demo.ownerColor).toBe("#00ffff"); // default fallback
    expect(demo.emoji).toBeUndefined();
    expect(demo.name).toBeUndefined();
    expect(demo.lastChargeTime).toBeUndefined();
    expect(demo.lastStreakDate).toBeUndefined();
  });

  it("converts a customized block with style and texture", () => {
    const serverBlock = {
      id: "block-10-2",
      layer: 10,
      index: 2,
      energy: 100,
      ownerColor: "#ff00ff",
      owner: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      stakedAmount: 10_000_000,
      lastChargeTime: Date.now(),
      streak: 5,
      lastStreakDate: "2026-02-16",
      appearance: {
        emoji: "🔥",
        name: "My Block",
        color: "#ff00ff",
        style: 5, // Fire
        textureId: 6, // Carbon
      },
    };

    const demo = convertServerBlock(serverBlock);

    expect(demo.style).toBe(5);
    expect(demo.textureId).toBe(6);
    expect(demo.emoji).toBe("🔥");
    expect(demo.name).toBe("My Block");
  });

  it("handles zero energy and zero streak", () => {
    const serverBlock = {
      id: "block-14-0",
      layer: 14,
      index: 0,
      energy: 0,
      ownerColor: "#E8843C",
      owner: "DeFiDegen",
      stakedAmount: 1_000_000,
      lastChargeTime: 0,
      streak: 0,
      lastStreakDate: "",
      appearance: {
        emoji: "🎰",
        name: "DeFiDegen",
        color: "#E8843C",
        style: 0,
        textureId: 0,
      },
    };

    const demo = convertServerBlock(serverBlock);

    expect(demo.energy).toBe(0);
    expect(demo.streak).toBe(0);
    expect(demo.owner).toBe("DeFiDegen");
  });
});
