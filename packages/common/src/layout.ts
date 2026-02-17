// ============================================================
// @monolith/common — Shared Tower Layout Functions
// ============================================================
// Single source of truth for block positioning on the tower.
// Used by both TowerGrid.tsx (rendering) and seed-tower.ts (seeding).
//
// Key invariant: blocks are positioned EDGE-TO-EDGE on each face.
// The first and last block on a face sit exactly at the face edges,
// guaranteeing a flush, symmetric monolith at every layer scale.
// Corner blocks fill the 4 rectangular prism corners per layer.
// ============================================================

import {
  BLOCK_SIZE,
  BLOCK_GAP,
  MONOLITH_HALF_W,
  MONOLITH_HALF_D,
  SPIRE_START_LAYER,
  getLayerScale,
  getLayerY,
  computeBlocksForFace,
  getSpireDimensions,
} from "./constants";

export interface LayoutPosition {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

/**
 * Position `n` blocks edge-to-edge along a line of length `faceWidth`.
 * Returns center positions from -faceWidth/2 to +faceWidth/2.
 * Blocks are flush: first block's outer edge aligns with -faceWidth/2,
 * last block's outer edge aligns with +faceWidth/2.
 */
function distributeOnFace(n: number, faceWidth: number, blockWidth: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0]; // single block centered
  const half = blockWidth / 2;
  const first = -faceWidth / 2 + half;
  const last = faceWidth / 2 - half;
  const step = (last - first) / (n - 1);
  const positions: number[] = [];
  for (let i = 0; i < n; i++) {
    positions.push(first + i * step);
  }
  return positions;
}

/**
 * Compute block positions for a body layer (rectangular ring on 4 faces + 4 corners).
 * Block counts per face are computed from what fits at the current scale,
 * ensuring edge-to-edge alignment regardless of block size.
 */
export function computeBodyLayerPositions(
  layer: number,
  _blockCount: number, // kept for API compat — actual count computed from face fitting
  halfW: number,
  halfD: number,
  totalLayers: number,
): LayoutPosition[] {
  const results: LayoutPosition[] = [];
  const y = getLayerY(layer, totalLayers);
  const scale = getLayerScale(layer, totalLayers);
  const blockWidth = BLOCK_SIZE * scale;
  const blockHalf = blockWidth / 2;

  const faceW = 2 * halfW;
  const faceD = 2 * halfD;
  const fCount = computeBlocksForFace(faceW, scale);
  const sCount = computeBlocksForFace(faceD, scale);

  const frontPositions = distributeOnFace(fCount, faceW, blockWidth);
  const sidePositions = distributeOnFace(sCount, faceD, blockWidth);

  // Front face (+Z)
  for (const x of frontPositions) {
    results.push({ x, y, z: halfD + blockHalf, rotY: 0 });
  }
  // Back face (-Z)
  for (const x of frontPositions) {
    results.push({ x, y, z: -halfD - blockHalf, rotY: Math.PI });
  }
  // Right face (+X)
  for (const z of sidePositions) {
    results.push({ x: halfW + blockHalf, y, z, rotY: Math.PI / 2 });
  }
  // Left face (-X)
  for (const z of sidePositions) {
    results.push({ x: -halfW - blockHalf, y, z, rotY: -Math.PI / 2 });
  }

  // Corner blocks — fill the 4 rectangular prism corners
  // Each corner sits where the front/back and left/right face blocks meet
  if (fCount > 0 && sCount > 0) {
    results.push({ x:  halfW + blockHalf, y, z:  halfD + blockHalf, rotY: 0 }); // front-right
    results.push({ x: -halfW - blockHalf, y, z:  halfD + blockHalf, rotY: 0 }); // front-left
    results.push({ x:  halfW + blockHalf, y, z: -halfD - blockHalf, rotY: 0 }); // back-right
    results.push({ x: -halfW - blockHalf, y, z: -halfD - blockHalf, rotY: 0 }); // back-left
  }

  return results;
}

/**
 * Compute block positions for a spire layer (tapering crown).
 * Uses the same edge-to-edge logic on shrinking face dimensions.
 */
export function computeSpireLayerPositions(
  layer: number,
  _blockCount: number,
  totalLayers: number,
): LayoutPosition[] {
  const { hw, hd } = getSpireDimensions(layer, totalLayers);
  const scale = getLayerScale(layer, totalLayers);
  const blockWidth = BLOCK_SIZE * scale;

  // If faces are too small for blocks, place a single centered block
  if (2 * hw < blockWidth * 0.5 && 2 * hd < blockWidth * 0.5) {
    const y = getLayerY(layer, totalLayers);
    return [{ x: 0, y, z: 0, rotY: 0 }];
  }

  return computeBodyLayerPositions(layer, 0, hw, hd, totalLayers);
}
