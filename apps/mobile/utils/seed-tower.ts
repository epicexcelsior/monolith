/**
 * seed-tower.ts — Deterministic bot seeder for the tower.
 *
 * Generates ~100 bot-owned blocks with varied charge levels,
 * plus ~30% empty (claimable) slots. Uses a seeded PRNG
 * so the tower looks the same on every fresh install.
 */

import {
  DEFAULT_TOWER_CONFIG,
  BLOCK_COLORS,
  BLOCK_SIZE,
  BLOCK_GAP,
  LAYER_HEIGHT,
  MONOLITH_HALF_W,
  MONOLITH_HALF_D,
  SPIRE_START_LAYER,
  BLOCK_SCALE_PER_LAYER,
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

// ─── Bot Personas ─────────────────────────────────────────
const BOT_PERSONAS = [
  { name: "SolWhale.sol", color: "#00ffff" },
  { name: "CryptoVibe", color: "#ff00ff" },
  { name: "DeFiDegen", color: "#ff6600" },
  { name: "AnonStaker", color: "#00ff66" },
  { name: "NeonKing", color: "#6600ff" },
  { name: "VaultMaxi", color: "#ffff00" },
  { name: "DiamondHodl", color: "#ff0066" },
  { name: "BlockPunk", color: "#0066ff" },
  { name: "StakeGuru", color: "#ff3300" },
  { name: "SolPilot", color: "#33ff00" },
  { name: "ChainGhost", color: "#ff0099" },
  { name: "CyberMonk", color: "#00ccff" },
  { name: "PixelVault", color: "#9900ff" },
  { name: "MintLord", color: "#00ff99" },
  { name: "GoldRush", color: "#ffcc00" },
  { name: "ShadowDAO", color: "#ff6699" },
] as const;

// ─── Position Helpers (mirrors TowerGrid logic) ───────────

function computeBodyLayerPositions(
  layer: number,
  blockCount: number,
  halfW: number,
  halfD: number,
): { x: number; y: number; z: number }[] {
  const results: { x: number; y: number; z: number }[] = [];
  const y = layer * LAYER_HEIGHT;
  const step = BLOCK_SIZE + BLOCK_GAP;
  const layerScale = 1 + layer * BLOCK_SCALE_PER_LAYER;

  const perimeterUnits = 2 * halfW + 2 * halfD;
  const frontBack = Math.round((halfW / perimeterUnits) * blockCount);
  const leftRight = Math.round((halfD / perimeterUnits) * blockCount);

  const totalCalc = 2 * frontBack + 2 * leftRight;
  let fCount = frontBack;
  if (totalCalc !== blockCount) {
    fCount = frontBack + Math.round((blockCount - totalCalc) / 4);
  }
  const sCount = leftRight;

  for (let i = 0; i < fCount; i++) {
    const x = (i - (fCount - 1) / 2) * step * layerScale;
    results.push({ x, y, z: halfD + BLOCK_SIZE * 0.5 });
  }
  for (let i = 0; i < fCount; i++) {
    const x = (i - (fCount - 1) / 2) * step * layerScale;
    results.push({ x, y, z: -halfD - BLOCK_SIZE * 0.5 });
  }
  for (let i = 0; i < sCount; i++) {
    const z = (i - (sCount - 1) / 2) * step * layerScale;
    results.push({ x: halfW + BLOCK_SIZE * 0.5, y, z });
  }
  for (let i = 0; i < sCount; i++) {
    const z = (i - (sCount - 1) / 2) * step * layerScale;
    results.push({ x: -halfW - BLOCK_SIZE * 0.5, y, z });
  }

  return results;
}

function computeSpireLayerPositions(
  layer: number,
  blockCount: number,
  totalLayers: number,
): { x: number; y: number; z: number }[] {
  const spireProgress =
    (layer - SPIRE_START_LAYER) / (totalLayers - 1 - SPIRE_START_LAYER);
  const shrink = 1 - spireProgress * 0.9;
  const hw = MONOLITH_HALF_W * shrink;
  const hd = MONOLITH_HALF_D * shrink;

  if (blockCount <= 1) {
    return [{ x: 0, y: layer * LAYER_HEIGHT, z: 0 }];
  }

  return computeBodyLayerPositions(layer, blockCount, hw, hd);
}

// ─── Seed the Tower ───────────────────────────────────────

export function generateSeedTower(seed: number = 42): DemoBlock[] {
  const rng = mulberry32(seed);
  const config = DEFAULT_TOWER_CONFIG;
  const blocks: DemoBlock[] = [];

  for (let layer = 0; layer < config.layerCount; layer++) {
    const count = config.blocksPerLayer[layer];
    const isSpire = layer >= SPIRE_START_LAYER;

    const positions = isSpire
      ? computeSpireLayerPositions(layer, count, config.layerCount)
      : computeBodyLayerPositions(layer, count, MONOLITH_HALF_W, MONOLITH_HALF_D);

    const usable = positions.slice(0, count);

    for (let i = 0; i < usable.length; i++) {
      const roll = rng();

      // ~30% empty/claimable, ~70% bot-owned
      const isEmpty = roll < 0.3;

      let energy = 0;
      let owner: string | null = null;
      let ownerColor: string = BLOCK_COLORS[0];
      let stakedAmount = 0;
      let emoji: string | undefined;
      let name: string | undefined;

      if (!isEmpty) {
        // Pick a bot persona deterministically
        const persona = BOT_PERSONAS[Math.floor(rng() * BOT_PERSONAS.length)];
        owner = persona.name;
        ownerColor = persona.color;

        // Varied charge levels: 10% blazing, 30% thriving, 30% fading, 20% dying, 10% dead
        const chargeRoll = rng();
        if (chargeRoll < 0.1) {
          energy = 80 + rng() * 20; // blazing (80-100)
        } else if (chargeRoll < 0.4) {
          energy = 50 + rng() * 30; // thriving (50-80)
        } else if (chargeRoll < 0.7) {
          energy = 20 + rng() * 30; // fading (20-50)
        } else if (chargeRoll < 0.9) {
          energy = 1 + rng() * 19; // dying (1-20)
        } else {
          energy = 0; // dead
        }

        stakedAmount = Math.floor((10 + rng() * 990) * 1_000_000); // 10-1000 USDC
      }

      blocks.push({
        id: `block-${layer}-${i}`,
        layer,
        index: i,
        energy: Math.round(energy * 100) / 100,
        ownerColor,
        owner,
        stakedAmount,
        position: usable[i],
        emoji,
        name,
        lastChargeTime: isEmpty ? 0 : Date.now() - Math.floor(rng() * 86400000),
      });
    }
  }

  return blocks;
}
