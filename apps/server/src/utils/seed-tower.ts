/**
 * seed-tower.ts — Server-side deterministic bot seeder + live simulation.
 *
 * Ported from apps/mobile/utils/seed-tower.ts.
 * Populates a Colyseus MapSchema<BlockSchema> instead of returning DemoBlock[].
 * Position computation NOT needed — server only tracks layer/index.
 */

import { MapSchema } from "@colyseus/schema";
import { DEFAULT_TOWER_CONFIG, BLOCK_COLORS, SPIRE_START_LAYER } from "@monolith/common";
import { BlockSchema, BlockAppearanceSchema } from "../schema/TowerState.js";

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

// ─── Bot Personas ─────────────────────────────────────────

interface BotPersona {
  name: string;
  color: string;
  emoji: string;
  archetype: "whale" | "degen" | "builder" | "artist" | "explorer" | "competitor";
  stakeRange: [number, number];
  activityLevel: number;
}

const BOT_PERSONAS: BotPersona[] = [
  // Whales: High stakes, steady, reliable
  { name: "SolWhale.sol", color: "#5b8fb9", emoji: "🐋", archetype: "whale", stakeRange: [200, 2000], activityLevel: 0.9 },
  { name: "VaultMaxi", color: "#b8860b", emoji: "🏦", archetype: "whale", stakeRange: [500, 5000], activityLevel: 0.95 },
  { name: "DiamondHodl", color: "#7c9a92", emoji: "💎", archetype: "whale", stakeRange: [100, 1000], activityLevel: 0.85 },
  // Degens: Volatile, high energy, wild stakes
  { name: "DeFiDegen", color: "#cc6644", emoji: "🎰", archetype: "degen", stakeRange: [1, 500], activityLevel: 0.6 },
  { name: "ApeMode", color: "#a5736e", emoji: "🦍", archetype: "degen", stakeRange: [5, 200], activityLevel: 0.4 },
  { name: "YoloStake", color: "#c98042", emoji: "🔥", archetype: "degen", stakeRange: [1, 100], activityLevel: 0.3 },
  { name: "GigaBrain", color: "#7b6b8a", emoji: "🧠", archetype: "degen", stakeRange: [10, 300], activityLevel: 0.5 },
  // Builders: Consistent, medium stakes, high streaks
  { name: "BuilderDAO", color: "#6b9e7a", emoji: "🏗️", archetype: "builder", stakeRange: [10, 100], activityLevel: 0.95 },
  { name: "StakeGuru", color: "#7a8f6e", emoji: "🧘", archetype: "builder", stakeRange: [20, 200], activityLevel: 0.9 },
  { name: "CyberMonk", color: "#d4a055", emoji: "⚡", archetype: "builder", stakeRange: [5, 50], activityLevel: 0.85 },
  { name: "SolPilot", color: "#6e8898", emoji: "🚀", archetype: "builder", stakeRange: [10, 150], activityLevel: 0.8 },
  // Artists: Expressive, varied, love customization
  { name: "PixelVault", color: "#9a6b4c", emoji: "🎨", archetype: "artist", stakeRange: [1, 50], activityLevel: 0.7 },
  { name: "NeonDreams", color: "#b5784a", emoji: "🌈", archetype: "artist", stakeRange: [1, 30], activityLevel: 0.65 },
  { name: "GlitchArt", color: "#8a7e72", emoji: "🎭", archetype: "artist", stakeRange: [2, 40], activityLevel: 0.6 },
  // Explorers: Scattered, curious, lower commitment
  { name: "ChainGhost", color: "#9e7c5a", emoji: "👻", archetype: "explorer", stakeRange: [1, 20], activityLevel: 0.4 },
  { name: "WanderSOL", color: "#8b7355", emoji: "🧭", archetype: "explorer", stakeRange: [1, 15], activityLevel: 0.35 },
  { name: "CosmicDust", color: "#6e8898", emoji: "🌌", archetype: "explorer", stakeRange: [1, 25], activityLevel: 0.3 },
  // Competitors: Status-obsessed, high activity, mid-high stakes
  { name: "AlphaGrind", color: "#cc6644", emoji: "🏆", archetype: "competitor", stakeRange: [50, 500], activityLevel: 0.95 },
  { name: "SkylineKing", color: "#d4a055", emoji: "👑", archetype: "competitor", stakeRange: [100, 1000], activityLevel: 0.9 },
  { name: "RankHunter", color: "#a5736e", emoji: "🎯", archetype: "competitor", stakeRange: [20, 300], activityLevel: 0.85 },
];

/** Check if an owner name belongs to a bot */
export function isBotOwner(owner: string): boolean {
  return BOT_PERSONAS.some((p) => p.name === owner);
}

// ─── Configuration ────────────────────────────────────────

const BOT_CONFIG = {
  seed: 42,
  botDensity: 0.7,
  energyDistribution: {
    blazing: 0.15,
    thriving: 0.30,
    fading: 0.25,
    flickering: 0.20,
    dormant: 0.10,
  },
  neighborhoodCount: 6,
  neighborhoodRadius: 4,
  simulation: {
    tickIntervalMs: 15_000,
    chargeChance: 0.03,
    chargeAmount: 15,
    ambientFlickerChance: 0.08,
    ambientFlickerRange: 5,
  },
};

// ─── Neighborhood Generation ─────────────────────────────

interface Neighborhood {
  archetype: BotPersona["archetype"];
  centerLayer: number;
  centerIndex: number;
  radius: number;
}

function generateNeighborhoods(rng: () => number): Neighborhood[] {
  const archetypes: BotPersona["archetype"][] = [
    "whale", "degen", "builder", "artist", "explorer", "competitor",
  ];
  const config = DEFAULT_TOWER_CONFIG;
  const neighborhoods: Neighborhood[] = [];

  for (let i = 0; i < BOT_CONFIG.neighborhoodCount; i++) {
    const layer = Math.floor(rng() * config.layerCount);
    const maxIndex = config.blocksPerLayer[layer];
    const index = Math.floor(rng() * maxIndex);
    neighborhoods.push({
      archetype: archetypes[i % archetypes.length],
      centerLayer: layer,
      centerIndex: index,
      radius: BOT_CONFIG.neighborhoodRadius,
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
    const dist = layerDist * 2 + indexDist;
    if (dist < minDist && dist <= n.radius * 3) {
      minDist = dist;
      nearest = n;
    }
  }

  return nearest;
}

// ─── Energy / Streak / Stake Helpers ─────────────────────

function rollEnergy(rng: () => number, activityLevel: number): number {
  const dist = BOT_CONFIG.energyDistribution;
  const roll = rng();
  const activityBoost = activityLevel * 0.3;

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
  if (rng() > activityLevel) return 0;
  const maxStreak = Math.floor(activityLevel * 45);
  return Math.floor(rng() * maxStreak);
}

function rollStake(rng: () => number, persona: BotPersona): number {
  const [min, max] = persona.stakeRange;
  return Math.floor((min + rng() * (max - min)) * 1_000_000);
}

// ─── Main Seeder ──────────────────────────────────────────

/**
 * Seed the tower into a Colyseus MapSchema<BlockSchema>.
 * Same deterministic algorithm as the mobile client.
 */
export function seedTower(blocks: MapSchema<BlockSchema>): void {
  const rng = mulberry32(BOT_CONFIG.seed);
  const config = DEFAULT_TOWER_CONFIG;
  const neighborhoods = generateNeighborhoods(rng);

  for (let layer = 0; layer < config.layerCount; layer++) {
    const count = config.blocksPerLayer[layer];
    const layerProgress = layer / (config.layerCount - 1);
    const layerDensity = BOT_CONFIG.botDensity * (1 - layerProgress * 0.3);

    for (let i = 0; i < count; i++) {
      const blockId = `block-${layer}-${i}`;
      const block = new BlockSchema();
      block.id = blockId;
      block.layer = layer;
      block.index = i;

      const roll = rng();
      const isEmpty = roll >= layerDensity;

      if (isEmpty) {
        block.energy = 0;
        block.ownerColor = BLOCK_COLORS[0];
        block.owner = "";
        block.stakedAmount = 0;
        // 40% of unclaimed blocks show mike's image (slot 5)
        block.imageIndex = rng() < 0.4 ? 5 : 0;
      } else {
        // Pick persona
        const nearestHood = findNearestNeighborhood(layer, i, neighborhoods);
        let persona: BotPersona;

        if (nearestHood && rng() < 0.65) {
          const archetypePersonas = BOT_PERSONAS.filter(
            (p) => p.archetype === nearestHood.archetype,
          );
          persona = archetypePersonas[Math.floor(rng() * archetypePersonas.length)];
        } else {
          persona = BOT_PERSONAS[Math.floor(rng() * BOT_PERSONAS.length)];
        }

        const energy = rollEnergy(rng, persona.activityLevel);
        const streak = rollStreak(rng, persona.activityLevel);
        const stakedAmount = rollStake(rng, persona);

        const hoursAgo = energy > 50
          ? rng() * 6
          : energy > 20
            ? 6 + rng() * 18
            : 24 + rng() * 72;

        const lastChargeTime = Date.now() - Math.floor(hoursAgo * 3_600_000);

        block.energy = Math.round(energy * 100) / 100;
        block.ownerColor = persona.color;
        block.owner = persona.name;
        block.stakedAmount = stakedAmount;
        block.lastChargeTime = lastChargeTime;
        block.streak = streak;

        if (streak > 0) {
          block.lastStreakDate = new Date(lastChargeTime).toISOString().slice(0, 10);
        }

        block.appearance.emoji = persona.emoji;
        block.appearance.name = persona.name;
        block.appearance.color = persona.color;

        // 75% of owned blocks get a demo image (slots 1-5)
        block.imageIndex = rng() < 0.75 ? Math.floor(rng() * 5) + 1 : 0;
      }

      blocks.set(blockId, block);
    }
  }

  console.log(`[SeedTower] Seeded ${blocks.size} blocks`);
}

// ─── Live Bot Simulation ──────────────────────────────────

/**
 * Start a server-side bot simulation loop.
 * Mutates BlockSchema objects directly — Colyseus auto-syncs changes.
 * Returns cleanup function.
 */
export function startBotSimulation(blocks: MapSchema<BlockSchema>): () => void {
  const sim = BOT_CONFIG.simulation;

  let simSeed = Date.now();
  const simRng = () => {
    simSeed = (simSeed * 16807 + 0) % 2147483647;
    return (simSeed & 0x7fffffff) / 2147483647;
  };

  const interval = setInterval(() => {
    blocks.forEach((block) => {
      if (!block.owner || !isBotOwner(block.owner)) return;

      const persona = BOT_PERSONAS.find((p) => p.name === block.owner);
      if (!persona) return;

      // Bot charges their block
      if (simRng() < sim.chargeChance * persona.activityLevel) {
        block.energy = Math.min(100, block.energy + sim.chargeAmount);
        block.lastChargeTime = Date.now();
        return;
      }

      // Ambient energy flicker
      if (simRng() < sim.ambientFlickerChance) {
        const delta = (simRng() - 0.4) * sim.ambientFlickerRange;
        block.energy = Math.round(Math.max(0, Math.min(100, block.energy + delta)) * 100) / 100;
      }
    });
  }, sim.tickIntervalMs);

  console.log(`[BotSim] Started (tick every ${sim.tickIntervalMs}ms)`);
  return () => clearInterval(interval);
}
