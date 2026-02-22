import {
  DEFAULT_TOWER_CONFIG,
  SPIRE_START_LAYER,
  MONOLITH_HALF_W,
  MONOLITH_HALF_D,
  BLOCK_COLORS,
} from "@monolith/common";
import {
  computeBodyLayerPositions,
  computeSpireLayerPositions,
} from "@monolith/common";
import type { LayoutPosition } from "@monolith/common";

export interface VideoBlock {
  id: string;
  layer: number;
  index: number;
  color: string;
  energy: number;
  position: LayoutPosition;
  style: number;       // 0-6: Default, Holographic, Neon, Matte, Glass, Fire, Ice
  textureId: number;   // 0-6: None, Bricks, Circuits, Scales, Camo, Marble, Carbon
  imageIndex: number;  // -1 = no image, 1-6 = atlas slot
}

// Solarpunk palette — warm golds, teals, sage greens, terracotta
const SOLARPUNK_COLORS = [
  "#c98042", // Bronze
  "#6b9e7a", // Sage Green
  "#5b8fb9", // Steel Blue
  "#d4a055", // Honey
  "#7c9a92", // Teal Stone
  "#b5784a", // Amber Clay
  "#7a8f6e", // Moss
  "#cc6644", // Copper Rust
  "#b8860b", // Dark Goldenrod
  "#a5736e", // Rosewood
  "#8a7e72", // Warm Stone
  "#9e7c5a", // Driftwood
  ...BLOCK_COLORS,
];

/** Deterministic pseudo-random from seed */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generate procedural block data for the full tower.
 * Uses deterministic seeding so the tower looks the same every render.
 */
export function generateBlocks(seed = 42): VideoBlock[] {
  const rand = seededRandom(seed);
  const config = DEFAULT_TOWER_CONFIG;
  const blocks: VideoBlock[] = [];

  for (let layer = 0; layer < config.layerCount; layer++) {
    const count = config.blocksPerLayer[layer];
    if (count === 0) continue;

    const positions =
      layer < SPIRE_START_LAYER
        ? computeBodyLayerPositions(
            layer,
            count,
            MONOLITH_HALF_W,
            MONOLITH_HALF_D,
            config.layerCount,
          )
        : computeSpireLayerPositions(layer, count, config.layerCount);

    for (let i = 0; i < positions.length; i++) {
      const colorIdx = Math.floor(rand() * SOLARPUNK_COLORS.length);

      // Key layers are always high-energy for mechanic camera shots
      const KEY_LAYERS = new Set([5, 8, 12, 16, 20]);
      const energyRoll = rand();
      let energy: number;
      if (KEY_LAYERS.has(layer)) {
        // Mechanic showcase layers — mostly blazing with a few fading
        energy = energyRoll < 0.2 ? 30 + rand() * 30 : 60 + rand() * 40;
      } else if (energyRoll < 0.45) {
        energy = rand() * 10; // 45% dead/dormant blocks (near-black)
      } else if (energyRoll < 0.75) {
        energy = 10 + rand() * 25; // 30% fading embers
      } else {
        energy = 35 + rand() * 40; // 25% active (capped lower for mystery)
      }

      // Style: mostly default, some special
      const styleRoll = rand();
      let style: number;
      if (styleRoll < 0.50) style = 0;       // 50% Default
      else if (styleRoll < 0.60) style = 1;  // 10% Holographic
      else if (styleRoll < 0.70) style = 2;  // 10% Neon
      else if (styleRoll < 0.78) style = 3;  // 8% Matte
      else if (styleRoll < 0.86) style = 4;  // 8% Glass
      else if (styleRoll < 0.93) style = 5;  // 7% Fire
      else style = 6;                         // 7% Ice

      // Texture: mostly smooth
      const texRoll = rand();
      let textureId: number;
      if (texRoll < 0.55) textureId = 0;      // 55% smooth
      else textureId = 1 + Math.floor(rand() * 6); // 45% patterned

      // Image: rare — only ~12% of blocks have window images
      const imageIndex = rand() < 0.12 ? 1 + Math.floor(rand() * 6) : -1;

      blocks.push({
        id: `block-${layer}-${i}`,
        layer,
        index: i,
        color: SOLARPUNK_COLORS[colorIdx],
        energy,
        position: positions[i],
        style,
        textureId,
        imageIndex,
      });
    }
  }

  return blocks;
}
