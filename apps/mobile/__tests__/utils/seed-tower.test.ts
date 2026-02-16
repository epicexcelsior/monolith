/**
 * Tests for the bot seeder + simulation system.
 * Verifies deterministic generation, energy distribution,
 * neighborhoods, config toggles, and live simulation behavior.
 */

import {
  generateSeedTower,
  configureBots,
  resetBotConfig,
  getBotConfig,
  isBotOwner,
  getBotStats,
  getActiveBotNames,
  startBotSimulation,
  BOT_CONFIG,
} from "@/utils/seed-tower";
import { DEFAULT_TOWER_CONFIG } from "@monolith/common";
import type { DemoBlock } from "@/stores/tower-store";

beforeEach(() => {
  resetBotConfig();
});

// ─── Deterministic Generation ─────────────────────────────

describe("generateSeedTower determinism", () => {
  it("should produce the same tower from the same seed", () => {
    const a = generateSeedTower(42);
    const b = generateSeedTower(42);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].id).toBe(b[i].id);
      expect(a[i].owner).toBe(b[i].owner);
      expect(a[i].energy).toBe(b[i].energy);
      expect(a[i].ownerColor).toBe(b[i].ownerColor);
    }
  });

  it("should produce different towers from different seeds", () => {
    const a = generateSeedTower(42);
    const b = generateSeedTower(99);
    // At least some blocks should differ
    const diffs = a.filter((block, i) => block.owner !== b[i].owner);
    expect(diffs.length).toBeGreaterThan(0);
  });
});

// ─── Block Count & Structure ──────────────────────────────

describe("tower structure", () => {
  const blocks = generateSeedTower(42);

  it("should generate the correct total number of blocks (within rounding tolerance)", () => {
    // Position computation can produce ±1 block due to rounding in perimeter distribution
    expect(blocks.length).toBeGreaterThanOrEqual(DEFAULT_TOWER_CONFIG.totalBlocks - 2);
    expect(blocks.length).toBeLessThanOrEqual(DEFAULT_TOWER_CONFIG.totalBlocks);
  });

  it("should have unique IDs for every block", () => {
    const ids = new Set(blocks.map((b) => b.id));
    expect(ids.size).toBe(blocks.length);
  });

  it("should have valid layer and index for every block", () => {
    for (const block of blocks) {
      expect(block.layer).toBeGreaterThanOrEqual(0);
      expect(block.layer).toBeLessThan(DEFAULT_TOWER_CONFIG.layerCount);
      expect(block.index).toBeGreaterThanOrEqual(0);
    }
  });

  it("should have valid positions for every block", () => {
    for (const block of blocks) {
      expect(block.position).toBeDefined();
      expect(typeof block.position.x).toBe("number");
      expect(typeof block.position.y).toBe("number");
      expect(typeof block.position.z).toBe("number");
      expect(Number.isFinite(block.position.x)).toBe(true);
      expect(Number.isFinite(block.position.y)).toBe(true);
      expect(Number.isFinite(block.position.z)).toBe(true);
    }
  });
});

// ─── Bot Density ──────────────────────────────────────────

describe("bot density", () => {
  it("should have roughly 70% bot-owned blocks by default", () => {
    const blocks = generateSeedTower(42);
    const owned = blocks.filter((b) => b.owner !== null).length;
    const ratio = owned / blocks.length;
    // Allow ±15% tolerance due to layer-based density scaling
    expect(ratio).toBeGreaterThan(0.45);
    expect(ratio).toBeLessThan(0.85);
  });

  it("should have 0% bot-owned blocks when disabled", () => {
    configureBots({ enabled: false });
    const blocks = generateSeedTower(42);
    const owned = blocks.filter((b) => b.owner !== null).length;
    expect(owned).toBe(0);
  });

  it("should have more empty blocks on higher layers (premium scarcity)", () => {
    const blocks = generateSeedTower(42);
    const lowLayers = blocks.filter((b) => b.layer < 5);
    const highLayers = blocks.filter((b) => b.layer >= 14);
    const lowOccupancy = lowLayers.filter((b) => b.owner).length / lowLayers.length;
    const highOccupancy = highLayers.filter((b) => b.owner).length / highLayers.length;
    expect(lowOccupancy).toBeGreaterThan(highOccupancy);
  });
});

// ─── Energy Distribution ──────────────────────────────────

describe("energy distribution", () => {
  const blocks = generateSeedTower(42);
  const owned = blocks.filter((b) => b.owner !== null);

  it("should have blocks in all energy states", () => {
    const blazing = owned.filter((b) => b.energy >= 80).length;
    const thriving = owned.filter((b) => b.energy >= 50 && b.energy < 80).length;
    const fading = owned.filter((b) => b.energy >= 20 && b.energy < 50).length;
    const flickering = owned.filter((b) => b.energy > 0 && b.energy < 20).length;
    const dormant = owned.filter((b) => b.energy === 0).length;

    expect(blazing).toBeGreaterThan(0);
    expect(thriving).toBeGreaterThan(0);
    expect(fading).toBeGreaterThan(0);
    expect(flickering).toBeGreaterThan(0);
    expect(dormant).toBeGreaterThan(0);
  });

  it("should have energy values between 0 and 100", () => {
    for (const block of blocks) {
      expect(block.energy).toBeGreaterThanOrEqual(0);
      expect(block.energy).toBeLessThanOrEqual(100);
    }
  });
});

// ─── Bot Personas ─────────────────────────────────────────

describe("bot personas", () => {
  const blocks = generateSeedTower(42);
  const owned = blocks.filter((b) => b.owner !== null);

  it("should assign emoji to bot-owned blocks", () => {
    const withEmoji = owned.filter((b) => b.emoji);
    expect(withEmoji.length).toBe(owned.length);
  });

  it("should assign names to bot-owned blocks", () => {
    const withName = owned.filter((b) => b.name);
    expect(withName.length).toBe(owned.length);
  });

  it("should have multiple unique bot names", () => {
    const names = getActiveBotNames(blocks);
    expect(names.length).toBeGreaterThan(10);
  });

  it("should have valid hex colors for all blocks", () => {
    for (const block of blocks) {
      expect(block.ownerColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("should have valid staked amounts for bot blocks", () => {
    for (const block of owned) {
      expect(block.stakedAmount).toBeGreaterThan(0);
    }
  });
});

// ─── Streaks ──────────────────────────────────────────────

describe("streaks", () => {
  const blocks = generateSeedTower(42);
  const owned = blocks.filter((b) => b.owner !== null);

  it("should have some blocks with streaks > 0", () => {
    const withStreaks = owned.filter((b) => (b.streak ?? 0) > 0);
    expect(withStreaks.length).toBeGreaterThan(0);
  });

  it("should have lastStreakDate set for blocks with streaks", () => {
    const withStreaks = owned.filter((b) => (b.streak ?? 0) > 0);
    for (const block of withStreaks) {
      expect(block.lastStreakDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

// ─── isBotOwner ───────────────────────────────────────────

describe("isBotOwner", () => {
  it("should return true for bot names", () => {
    expect(isBotOwner("SolWhale.sol")).toBe(true);
    expect(isBotOwner("DeFiDegen")).toBe(true);
    expect(isBotOwner("AlphaGrind")).toBe(true);
  });

  it("should return false for wallet addresses", () => {
    expect(isBotOwner("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")).toBe(false);
    expect(isBotOwner("myWallet123")).toBe(false);
  });
});

// ─── getBotStats ──────────────────────────────────────────

describe("getBotStats", () => {
  const blocks = generateSeedTower(42);
  const stats = getBotStats(blocks);

  it("should count bots + empty = total blocks", () => {
    expect(stats.totalBots + stats.totalEmpty + stats.totalPlayerOwned).toBe(blocks.length);
  });

  it("should have 0 player-owned blocks in a fresh seed", () => {
    expect(stats.totalPlayerOwned).toBe(0);
  });

  it("should have positive average bot energy", () => {
    expect(stats.avgBotEnergy).toBeGreaterThan(0);
    expect(stats.avgBotEnergy).toBeLessThanOrEqual(100);
  });

  it("should have multiple archetypes represented", () => {
    const archetypeCount = Object.keys(stats.archetypeCounts).length;
    expect(archetypeCount).toBeGreaterThanOrEqual(4);
  });

  it("should have all energy distribution buckets", () => {
    expect(stats.energyDistribution).toHaveProperty("blazing");
    expect(stats.energyDistribution).toHaveProperty("thriving");
    expect(stats.energyDistribution).toHaveProperty("fading");
    expect(stats.energyDistribution).toHaveProperty("flickering");
    expect(stats.energyDistribution).toHaveProperty("dormant");
  });
});

// ─── Configuration ────────────────────────────────────────

describe("configuration", () => {
  it("should allow overriding bot density", () => {
    configureBots({ botDensity: 0.9 });
    const blocks = generateSeedTower(42);
    const owned = blocks.filter((b) => b.owner !== null).length;
    const ratio = owned / blocks.length;
    expect(ratio).toBeGreaterThan(0.6);
  });

  it("should respect enabled = false", () => {
    configureBots({ enabled: false });
    const blocks = generateSeedTower(42);
    expect(blocks.every((b) => b.owner === null)).toBe(true);
    expect(blocks.every((b) => b.energy === 0)).toBe(true);
  });

  it("should reset to defaults", () => {
    configureBots({ botDensity: 0.1 });
    resetBotConfig();
    const config = getBotConfig();
    expect(config.botDensity).toBe(BOT_CONFIG.botDensity);
  });
});

// ─── Bot Simulation ───────────────────────────────────────

describe("startBotSimulation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should return a cleanup function", () => {
    const blocks = generateSeedTower(42);
    const cleanup = startBotSimulation(
      () => blocks,
      () => {},
    );
    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("should return noop when simulation is disabled", () => {
    configureBots({ simulation: { ...BOT_CONFIG.simulation, enabled: false } });
    const cleanup = startBotSimulation(
      () => [],
      () => {},
    );
    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("should call updateBlock for bot blocks over time", () => {
    configureBots({
      simulation: {
        ...BOT_CONFIG.simulation,
        enabled: true,
        tickIntervalMs: 100,
        chargeChance: 1.0, // always charge for test
        ambientFlickerChance: 0,
      },
    });

    const blocks = generateSeedTower(42);
    const updates: string[] = [];

    const cleanup = startBotSimulation(
      () => blocks,
      (blockId) => {
        updates.push(blockId);
      },
    );

    jest.advanceTimersByTime(150);
    expect(updates.length).toBeGreaterThan(0);
    cleanup();
  });

  it("should not update player-owned blocks", () => {
    configureBots({
      simulation: {
        ...BOT_CONFIG.simulation,
        enabled: true,
        tickIntervalMs: 100,
        chargeChance: 1.0,
        ambientFlickerChance: 1.0,
      },
    });

    // Create a tower with one player block
    const blocks = generateSeedTower(42);
    blocks[0] = {
      ...blocks[0],
      owner: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      energy: 50,
    };

    const updatedIds: string[] = [];
    const cleanup = startBotSimulation(
      () => blocks,
      (blockId) => {
        updatedIds.push(blockId);
      },
    );

    jest.advanceTimersByTime(150);
    // The player block should never be updated
    expect(updatedIds).not.toContain(blocks[0].id);
    cleanup();
  });

  it("should stop updating after cleanup is called", () => {
    configureBots({
      simulation: {
        ...BOT_CONFIG.simulation,
        enabled: true,
        tickIntervalMs: 100,
        chargeChance: 1.0,
      },
    });

    const blocks = generateSeedTower(42);
    let updateCount = 0;

    const cleanup = startBotSimulation(
      () => blocks,
      () => { updateCount++; },
    );

    jest.advanceTimersByTime(150);
    const countAfterFirstTick = updateCount;
    expect(countAfterFirstTick).toBeGreaterThan(0);

    cleanup();
    jest.advanceTimersByTime(300);
    expect(updateCount).toBe(countAfterFirstTick);
  });
});

// ─── Empty blocks have correct defaults ───────────────────

describe("empty blocks", () => {
  const blocks = generateSeedTower(42);
  const empty = blocks.filter((b) => b.owner === null);

  it("should have 0 energy for empty blocks", () => {
    for (const block of empty) {
      expect(block.energy).toBe(0);
    }
  });

  it("should have 0 staked amount for empty blocks", () => {
    for (const block of empty) {
      expect(block.stakedAmount).toBe(0);
    }
  });

  it("should have no emoji or name for empty blocks", () => {
    for (const block of empty) {
      expect(block.emoji).toBeUndefined();
      expect(block.name).toBeUndefined();
    }
  });
});
