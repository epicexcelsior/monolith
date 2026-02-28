import {
  DEFAULT_TOWER_CONFIG,
  SPIRE_START_LAYER,
  MONOLITH_HALF_W,
  MONOLITH_HALF_D,
} from "@monolith/common";
import {
  computeBodyLayerPositions,
  computeSpireLayerPositions,
} from "@monolith/common";
import type { VideoBlock } from "./generateBlocks";

// BONK palette — blazing oranges, golds, ambers
const BONK_COLORS = [
  "#FF6600", // BONK Orange
  "#FF8800", // Amber
  "#FFAA00", // Gold
  "#FF5500", // Deep Orange
  "#FFCC00", // Bright Gold
  "#CC5500", // Burnt Orange
  "#FF7711", // Tangerine
  "#E87400", // Marigold
  "#FFB833", // Honey
  "#CC4400", // Rust
  "#FF9933", // Peach Fire
  "#FFDD44", // Warm Yellow
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
 * BONK tower variant — all blazing, all fire/neon, all orange.
 */
export function generateBonkBlocks(seed = 69): VideoBlock[] {
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
      const colorIdx = Math.floor(rand() * BONK_COLORS.length);

      // All blocks blazing energy (80-100%)
      const energy = 80 + rand() * 20;

      // Mostly fire and neon styles
      const styleRoll = rand();
      let style: number;
      if (styleRoll < 0.45) style = 5; // 45% Fire
      else if (styleRoll < 0.75) style = 2; // 30% Neon
      else if (styleRoll < 0.85) style = 1; // 10% Holographic
      else if (styleRoll < 0.95) style = 0; // 10% Default
      else style = 4; // 5% Glass

      const texRoll = rand();
      const textureId = texRoll < 0.6 ? 0 : 1 + Math.floor(rand() * 6);
      // 40% of blocks show BONK image in their windows (slot 1 = the only atlas slot)
      const imageIndex = rand() < 0.40 ? 1 : -1;

      blocks.push({
        id: `block-${layer}-${i}`,
        layer,
        index: i,
        color: BONK_COLORS[colorIdx],
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
