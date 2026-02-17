/**
 * seed-tower.ts — Deterministic bot seeder + live simulation for the tower.
 *
 * Creates a lively tower with ~70% bot-owned blocks at varied energy levels,
 * complete with personas (names, emoji, colors, streaks), neighborhood clusters,
 * and a lightweight simulation loop that makes bots "play" in real time.
 *
 * ## Quick start
 *   import { generateSeedTower, BOT_CONFIG } from "@/utils/seed-tower";
 *
 *   // Disable bots entirely:
 *   BOT_CONFIG.enabled = false;
 *
 *   // Generate tower:
 *   const blocks = generateSeedTower(42);
 *
 *   // Start live simulation (bots charge/fade over time):
 *   const stop = startBotSimulation(blocks, onUpdate);
 *
 * ## Configuration
 *   See BOT_CONFIG below — all knobs are documented.
 *
 * @module seed-tower
 */

import {
  DEFAULT_TOWER_CONFIG,
  BLOCK_COLORS,
  MONOLITH_HALF_W,
  MONOLITH_HALF_D,
  SPIRE_START_LAYER,
  BLOCK_ICONS,
  computeBodyLayerPositions,
  computeSpireLayerPositions,
} from "@monolith/common";
import type { DemoBlock } from "@/stores/tower-store";

// ─── Seeded PRNG (mulberry32) ─────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Configuration ────────────────────────────────────────

/**
 * Master configuration for the bot simulation system.
 * Mutate this object before calling generateSeedTower() to tune behavior.
 */
export const BOT_CONFIG = {
  /** Master switch — set false to generate an empty tower (all blocks claimable) */
  enabled: true,

  /** PRNG seed — same seed = same tower layout on every device */
  seed: 42,

  /** Fraction of blocks that start as bot-owned (0.0–1.0) */
  botDensity: 0.7,

  /**
   * Energy distribution for bot blocks.
   * Values are cumulative thresholds — must sum to 1.0.
   * Controls how "alive" the tower looks at first launch.
   */
  energyDistribution: {
    blazing: 0.15,  // 15% at 80-100 energy (bright & active)
    thriving: 0.30, // 30% at 50-79 energy (healthy)
    fading: 0.25,   // 25% at 20-49 energy (dimming)
    flickering: 0.20, // 20% at 1-19 energy (danger zone)
    dormant: 0.10,  // 10% at 0 energy (dark, claimable)
  },

  /** How many neighborhoods (clusters of same-persona blocks) to create */
  neighborhoodCount: 6,

  /** Radius of neighborhood clusters (in block indices within a layer) */
  neighborhoodRadius: 4,

  /**
   * Live simulation settings.
   * When enabled, bots periodically "charge" their blocks, creating
   * visible energy changes that make the tower feel alive.
   */
  simulation: {
    /** Enable live bot activity (bots charge their blocks periodically) */
    enabled: true,

    /** How often to run the simulation tick (ms) */
    tickIntervalMs: 15_000, // every 15 seconds

    /** Chance a bot charges its block each tick (0.0–1.0) */
    chargeChance: 0.03,

    /** Energy restored when a bot charges */
    chargeAmount: 15,

    /** Chance a bot's block gets a small random energy bump (ambient life) */
    ambientFlickerChance: 0.08,

    /** Range of ambient energy fluctuation (+/-) */
    ambientFlickerRange: 5,
  },
} as const satisfies BotConfigShape;

/** Type for BOT_CONFIG — allows mutation while keeping shape */
type BotConfigShape = {
  enabled: boolean;
  seed: number;
  botDensity: number;
  energyDistribution: {
    blazing: number;
    thriving: number;
    fading: number;
    flickering: number;
    dormant: number;
  };
  neighborhoodCount: number;
  neighborhoodRadius: number;
  simulation: {
    enabled: boolean;
    tickIntervalMs: number;
    chargeChance: number;
    chargeAmount: number;
    ambientFlickerChance: number;
    ambientFlickerRange: number;
  };
};

// Mutable runtime copy (BOT_CONFIG is the default, this is what gets used)
let _config: BotConfigShape = { ...BOT_CONFIG };

/** Override bot config at runtime. Merges with defaults. */
export function configureBots(overrides: Partial<BotConfigShape>): void {
  _config = {
    ..._config,
    ...overrides,
    energyDistribution: {
      ..._config.energyDistribution,
      ...(overrides.energyDistribution ?? {}),
    },
    simulation: {
      ..._config.simulation,
      ...(overrides.simulation ?? {}),
    },
  };
}

/** Reset bot config to defaults */
export function resetBotConfig(): void {
  _config = { ...BOT_CONFIG };
}

/** Get current bot config (read-only snapshot) */
export function getBotConfig(): Readonly<BotConfigShape> {
  return _config;
}

// ─── Bot Personas ─────────────────────────────────────────
// Each persona represents a "type" of player with distinct visual identity.
// Grouped by archetype for natural clustering.

export interface BotPersona {
  /** Display name shown on block */
  name: string;
  /** Block color (hex) */
  color: string;
  /** Emoji displayed on block */
  emoji: string;
  /** Archetype — personas of the same archetype cluster together */
  archetype: "whale" | "degen" | "builder" | "artist" | "explorer" | "competitor";
  /** Typical stake range [min, max] in USDC */
  stakeRange: [number, number];
  /** How active this bot type is (0-1, higher = charges more often) */
  activityLevel: number;
}

const BOT_PERSONAS: BotPersona[] = [
  // ── Whales: High stakes, steady, reliable
  { name: "SolWhale.sol", color: "#5B8FB9", emoji: "🐋", archetype: "whale", stakeRange: [200, 2000], activityLevel: 0.9 },
  { name: "VaultMaxi", color: "#D4A847", emoji: "🏦", archetype: "whale", stakeRange: [500, 5000], activityLevel: 0.95 },
  { name: "DiamondHodl", color: "#2E8B6A", emoji: "💎", archetype: "whale", stakeRange: [100, 1000], activityLevel: 0.85 },

  // ── Degens: Volatile, high energy, wild stakes
  { name: "DeFiDegen", color: "#E8843C", emoji: "🎰", archetype: "degen", stakeRange: [1, 500], activityLevel: 0.6 },
  { name: "ApeMode", color: "#C4572A", emoji: "🦍", archetype: "degen", stakeRange: [5, 200], activityLevel: 0.4 },
  { name: "YoloStake", color: "#A85C38", emoji: "🔥", archetype: "degen", stakeRange: [1, 100], activityLevel: 0.3 },
  { name: "GigaBrain", color: "#6B4C8A", emoji: "🧠", archetype: "degen", stakeRange: [10, 300], activityLevel: 0.5 },

  // ── Builders: Consistent, medium stakes, high streaks
  { name: "BuilderDAO", color: "#5B8FB9", emoji: "🏗️", archetype: "builder", stakeRange: [10, 100], activityLevel: 0.95 },
  { name: "StakeGuru", color: "#7BAE4E", emoji: "🧘", archetype: "builder", stakeRange: [20, 200], activityLevel: 0.9 },
  { name: "CyberMonk", color: "#F0BC5E", emoji: "⚡", archetype: "builder", stakeRange: [5, 50], activityLevel: 0.85 },
  { name: "SolPilot", color: "#B08A30", emoji: "🚀", archetype: "builder", stakeRange: [10, 150], activityLevel: 0.8 },

  // ── Artists: Expressive, varied, love customization
  { name: "PixelVault", color: "#6B4C8A", emoji: "🎨", archetype: "artist", stakeRange: [1, 50], activityLevel: 0.7 },
  { name: "NeonDreams", color: "#D4763C", emoji: "🌈", archetype: "artist", stakeRange: [1, 30], activityLevel: 0.65 },
  { name: "GlitchArt", color: "#C9A96E", emoji: "🎭", archetype: "artist", stakeRange: [2, 40], activityLevel: 0.6 },

  // ── Explorers: Scattered, curious, lower commitment
  { name: "ChainGhost", color: "#3D7A5F", emoji: "👻", archetype: "explorer", stakeRange: [1, 20], activityLevel: 0.4 },
  { name: "WanderSOL", color: "#E8D4A0", emoji: "🧭", archetype: "explorer", stakeRange: [1, 15], activityLevel: 0.35 },
  { name: "CosmicDust", color: "#4A6B5A", emoji: "🌌", archetype: "explorer", stakeRange: [1, 25], activityLevel: 0.3 },

  // ── Competitors: Status-obsessed, high activity, mid-high stakes
  { name: "AlphaGrind", color: "#D4A847", emoji: "🏆", archetype: "competitor", stakeRange: [50, 500], activityLevel: 0.95 },
  { name: "SkylineKing", color: "#8B6D42", emoji: "👑", archetype: "competitor", stakeRange: [100, 1000], activityLevel: 0.9 },
  { name: "RankHunter", color: "#E8843C", emoji: "🎯", archetype: "competitor", stakeRange: [20, 300], activityLevel: 0.85 },
];

// Position helpers now imported from @monolith/common (computeBodyLayerPositions, computeSpireLayerPositions)

// ─── Neighborhood Generation ─────────────────────────────

interface Neighborhood {
  /** Which persona archetype dominates this neighborhood */
  archetype: BotPersona["archetype"];
  /** Center layer of the cluster */
  centerLayer: number;
  /** Center index within the layer */
  centerIndex: number;
  /** Radius in block indices */
  radius: number;
}

function generateNeighborhoods(
  rng: () => number,
  config: typeof DEFAULT_TOWER_CONFIG,
): Neighborhood[] {
  const archetypes: BotPersona["archetype"][] = [
    "whale", "degen", "builder", "artist", "explorer", "competitor",
  ];

  const neighborhoods: Neighborhood[] = [];
  const count = _config.neighborhoodCount;

  for (let i = 0; i < count; i++) {
    const layer = Math.floor(rng() * config.layerCount);
    const maxIndex = config.blocksPerLayer[layer];
    const index = Math.floor(rng() * maxIndex);
    const archetype = archetypes[i % archetypes.length];

    neighborhoods.push({
      archetype,
      centerLayer: layer,
      centerIndex: index,
      radius: _config.neighborhoodRadius,
    });
  }

  return neighborhoods;
}

function findNearestNeighborhood(
  layer: number,
  index: number,
  neighborhoods: Neighborhood[],
): Neighborhood | null {
  let nearest: Neighborhood | null = null;
  let minDist = Infinity;

  for (const n of neighborhoods) {
    const layerDist = Math.abs(layer - n.centerLayer);
    const indexDist = Math.abs(index - n.centerIndex);
    const dist = layerDist * 2 + indexDist; // weight layer distance more
    if (dist < minDist && dist <= n.radius * 3) {
      minDist = dist;
      nearest = n;
    }
  }

  return nearest;
}

// ─── Energy Assignment ────────────────────────────────────

function rollEnergy(rng: () => number, activityLevel: number): number {
  const dist = _config.energyDistribution;
  const roll = rng();

  // Higher activity bots skew toward higher energy
  const activityBoost = activityLevel * 0.3; // up to +30% chance of higher energy

  if (roll < dist.blazing + activityBoost) {
    return 80 + rng() * 20;
  } else if (roll < dist.blazing + dist.thriving + activityBoost * 0.5) {
    return 50 + rng() * 30;
  } else if (roll < dist.blazing + dist.thriving + dist.fading) {
    return 20 + rng() * 30;
  } else if (roll < dist.blazing + dist.thriving + dist.fading + dist.flickering) {
    return 1 + rng() * 19;
  } else {
    return 0;
  }
}

function rollStreak(rng: () => number, activityLevel: number): number {
  // Active bots have longer streaks
  if (rng() > activityLevel) return 0; // no streak

  const maxStreak = Math.floor(activityLevel * 45); // up to 45 days for very active
  return Math.floor(rng() * maxStreak);
}

function rollStake(rng: () => number, persona: BotPersona): number {
  const [min, max] = persona.stakeRange;
  return Math.floor((min + rng() * (max - min)) * 1_000_000); // USDC 6 decimals
}

// ─── Main Generator ──────────────────────────────────────

/**
 * Generate a complete tower with bot-owned blocks and empty claimable slots.
 *
 * The tower is deterministic: same seed = same layout.
 * Bot density, energy distribution, and neighborhoods are all configurable
 * via BOT_CONFIG (or configureBots()).
 *
 * @param seed - PRNG seed for deterministic generation (default: from config)
 * @returns Array of DemoBlock objects ready for the tower store
 */
export function generateSeedTower(seed: number = _config.seed): DemoBlock[] {
  const rng = mulberry32(seed);
  const config = DEFAULT_TOWER_CONFIG;
  const blocks: DemoBlock[] = [];

  // If bots are disabled, return all-empty tower
  if (!_config.enabled) {
    for (let layer = 0; layer < config.layerCount; layer++) {
      const count = config.blocksPerLayer[layer];
      const isSpire = layer >= SPIRE_START_LAYER;
      const positions = isSpire
        ? computeSpireLayerPositions(layer, count, config.layerCount)
        : computeBodyLayerPositions(layer, count, MONOLITH_HALF_W, MONOLITH_HALF_D, config.layerCount);

      const usable = positions.slice(0, count);
      for (let i = 0; i < usable.length; i++) {
        blocks.push({
          id: `block-${layer}-${i}`,
          layer,
          index: i,
          energy: 0,
          ownerColor: BLOCK_COLORS[0],
          owner: null,
          stakedAmount: 0,
          position: usable[i],
        });
      }
    }
    return blocks;
  }

  // Generate neighborhoods for organic clustering
  const neighborhoods = generateNeighborhoods(rng, config);

  for (let layer = 0; layer < config.layerCount; layer++) {
    const count = config.blocksPerLayer[layer];
    const isSpire = layer >= SPIRE_START_LAYER;

    const positions = isSpire
      ? computeSpireLayerPositions(layer, count, config.layerCount)
      : computeBodyLayerPositions(layer, count, MONOLITH_HALF_W, MONOLITH_HALF_D, config.layerCount);

    const usable = positions.slice(0, count);

    // Higher layers have slightly lower bot density (more premium = more empty)
    const layerProgress = layer / (config.layerCount - 1);
    const layerDensity = _config.botDensity * (1 - layerProgress * 0.3);

    for (let i = 0; i < usable.length; i++) {
      const roll = rng();
      const isEmpty = roll >= layerDensity;

      if (isEmpty) {
        blocks.push({
          id: `block-${layer}-${i}`,
          layer,
          index: i,
          energy: 0,
          ownerColor: BLOCK_COLORS[0],
          owner: null,
          stakedAmount: 0,
          position: usable[i],
        });
        continue;
      }

      // Pick persona — prefer neighborhood archetype if nearby
      const nearestHood = findNearestNeighborhood(layer, i, neighborhoods);
      let persona: BotPersona;

      if (nearestHood && rng() < 0.65) {
        // 65% chance to use the neighborhood's archetype
        const archetypePersonas = BOT_PERSONAS.filter(
          (p) => p.archetype === nearestHood.archetype,
        );
        persona = archetypePersonas[Math.floor(rng() * archetypePersonas.length)];
      } else {
        // Random persona
        persona = BOT_PERSONAS[Math.floor(rng() * BOT_PERSONAS.length)];
      }

      const energy = rollEnergy(rng, persona.activityLevel);
      const streak = rollStreak(rng, persona.activityLevel);
      const stakedAmount = rollStake(rng, persona);

      // Generate a plausible last charge time
      // Active bots charged recently, inactive ones charged long ago
      const hoursAgo = energy > 50
        ? rng() * 6  // charged within last 6 hours
        : energy > 20
          ? 6 + rng() * 18 // 6-24 hours ago
          : 24 + rng() * 72; // 1-4 days ago

      const lastChargeTime = Date.now() - Math.floor(hoursAgo * 3_600_000);

      // Streak date — if they have a streak, last charge was today or yesterday
      let lastStreakDate: string | undefined;
      if (streak > 0) {
        const d = new Date(lastChargeTime);
        lastStreakDate = d.toISOString().slice(0, 10);
      }

      blocks.push({
        id: `block-${layer}-${i}`,
        layer,
        index: i,
        energy: Math.round(energy * 100) / 100,
        ownerColor: persona.color,
        owner: persona.name,
        stakedAmount,
        position: usable[i],
        emoji: persona.emoji,
        name: persona.name,
        lastChargeTime,
        streak,
        lastStreakDate,
      });
    }
  }

  return blocks;
}

// ─── Live Bot Simulation ──────────────────────────────────

/**
 * Starts a live simulation loop that makes bot blocks periodically
 * change energy — some charge up, others flicker. Creates visible
 * movement on the tower so it never looks static.
 *
 * @param getBlocks - Function to get current blocks (e.g., from store)
 * @param updateBlock - Function to update a single block (e.g., store action)
 * @returns Cleanup function to stop the simulation
 */
export function startBotSimulation(
  getBlocks: () => DemoBlock[],
  updateBlock: (blockId: string, changes: Partial<DemoBlock>) => void,
): () => void {
  if (!_config.simulation.enabled) {
    return () => {}; // noop cleanup
  }

  const sim = _config.simulation;

  // Use a non-deterministic RNG for simulation (should feel organic)
  let simSeed = Date.now();
  const simRng = () => {
    simSeed = (simSeed * 16807 + 0) % 2147483647;
    return (simSeed & 0x7fffffff) / 2147483647;
  };

  const interval = setInterval(() => {
    const blocks = getBlocks();

    for (const block of blocks) {
      // Only simulate bot-owned blocks (not player blocks)
      if (!block.owner || !isBotOwner(block.owner)) continue;

      const persona = BOT_PERSONAS.find((p) => p.name === block.owner);
      if (!persona) continue;

      // Bot charges their block
      if (simRng() < sim.chargeChance * persona.activityLevel) {
        const newEnergy = Math.min(100, block.energy + sim.chargeAmount);
        updateBlock(block.id, {
          energy: newEnergy,
          lastChargeTime: Date.now(),
        });
        continue;
      }

      // Ambient energy flicker (small random fluctuation)
      if (simRng() < sim.ambientFlickerChance) {
        const delta = (simRng() - 0.4) * sim.ambientFlickerRange; // slight bias toward decay
        const newEnergy = Math.max(0, Math.min(100, block.energy + delta));
        updateBlock(block.id, {
          energy: Math.round(newEnergy * 100) / 100,
        });
      }
    }
  }, sim.tickIntervalMs);

  return () => clearInterval(interval);
}

/** Check if an owner name belongs to a bot (vs. a real wallet address) */
export function isBotOwner(owner: string): boolean {
  return BOT_PERSONAS.some((p) => p.name === owner);
}

// ─── Stats Helpers ────────────────────────────────────────

/** Get summary stats about the bot population in a set of blocks */
export function getBotStats(blocks: DemoBlock[]): {
  totalBots: number;
  totalEmpty: number;
  totalPlayerOwned: number;
  avgBotEnergy: number;
  archetypeCounts: Record<string, number>;
  energyDistribution: Record<string, number>;
} {
  let totalBots = 0;
  let totalEmpty = 0;
  let totalPlayerOwned = 0;
  let totalBotEnergy = 0;
  const archetypeCounts: Record<string, number> = {};
  const energyBuckets = { blazing: 0, thriving: 0, fading: 0, flickering: 0, dormant: 0 };

  for (const block of blocks) {
    if (!block.owner) {
      totalEmpty++;
      continue;
    }

    const persona = BOT_PERSONAS.find((p) => p.name === block.owner);
    if (!persona) {
      totalPlayerOwned++;
      continue;
    }

    totalBots++;
    totalBotEnergy += block.energy;
    archetypeCounts[persona.archetype] = (archetypeCounts[persona.archetype] || 0) + 1;

    if (block.energy >= 80) energyBuckets.blazing++;
    else if (block.energy >= 50) energyBuckets.thriving++;
    else if (block.energy >= 20) energyBuckets.fading++;
    else if (block.energy > 0) energyBuckets.flickering++;
    else energyBuckets.dormant++;
  }

  return {
    totalBots,
    totalEmpty,
    totalPlayerOwned,
    avgBotEnergy: totalBots > 0 ? Math.round(totalBotEnergy / totalBots) : 0,
    archetypeCounts,
    energyDistribution: energyBuckets,
  };
}

/** Get all unique bot persona names present in the tower */
export function getActiveBotNames(blocks: DemoBlock[]): string[] {
  const names = new Set<string>();
  for (const block of blocks) {
    if (block.owner && isBotOwner(block.owner)) {
      names.add(block.owner);
    }
  }
  return Array.from(names).sort();
}
