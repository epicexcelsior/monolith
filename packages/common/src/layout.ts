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
  /** Per-face tile scale: stretches/shrinks the block along the face so blocks tile perfectly (1.0 = no change) */
  tileScale: number;
}

/**
 * Tile `n` blocks perfectly across a face of `faceWidth`.
 * Each block occupies exactly faceWidth/n, so there are zero gaps and
 * zero overlaps. Returns center positions + a tileScale factor that
 * adjusts the block visual width to match the tile pitch.
 */
function distributeOnFace(
  n: number,
  faceWidth: number,
  blockWidth: number,
): { positions: number[]; tileScale: number } {
  if (n <= 0) return { positions: [], tileScale: 1.0 };
  if (n === 1) return { positions: [0], tileScale: faceWidth / blockWidth };
  // Perfect tiling: n equal-width tiles fill the face exactly
  const tileWidth = faceWidth / n;
  const tileScale = tileWidth / blockWidth;
  const positions: number[] = [];
  for (let i = 0; i < n; i++) {
    positions.push(-faceWidth / 2 + tileWidth / 2 + i * tileWidth);
  }
  return { positions, tileScale };
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

  // Spire layers: snap face dimensions to exact multiples of blockWidth
  // so blocks tile at tileScale=1.0 (perfect cubes). Body layers keep
  // original dims (tileScale ≤8%, imperceptible).
  const isSpire = layer >= SPIRE_START_LAYER;
  const adjHalfW = isSpire ? (fCount * blockWidth) / 2 : halfW;
  const adjHalfD = isSpire ? (sCount * blockWidth) / 2 : halfD;
  const adjFaceW = 2 * adjHalfW;
  const adjFaceD = 2 * adjHalfD;

  const front = distributeOnFace(fCount, adjFaceW, blockWidth);
  const side = distributeOnFace(sCount, adjFaceD, blockWidth);

  // Front face (+Z)
  for (const x of front.positions) {
    results.push({ x, y, z: adjHalfD + blockHalf, rotY: 0, tileScale: front.tileScale });
  }
  // Back face (-Z)
  for (const x of front.positions) {
    results.push({ x, y, z: -adjHalfD - blockHalf, rotY: Math.PI, tileScale: front.tileScale });
  }
  // Right face (+X)
  for (const z of side.positions) {
    results.push({ x: adjHalfW + blockHalf, y, z, rotY: Math.PI / 2, tileScale: side.tileScale });
  }
  // Left face (-X)
  for (const z of side.positions) {
    results.push({ x: -adjHalfW - blockHalf, y, z, rotY: -Math.PI / 2, tileScale: side.tileScale });
  }

  // Corner blocks — fill the 4 rectangular prism corners.
  // Positioned exactly at blockHalf outside each face edge so they sit
  // flush against face blocks without gap or overlap.
  // Corners are cubes (tileScale=1) — they bridge two faces at the natural block size.
  if (fCount > 0 && sCount > 0) {
    results.push({ x:  adjHalfW + blockHalf, y, z:  adjHalfD + blockHalf, rotY: 0, tileScale: 1.0 }); // front-right
    results.push({ x: -adjHalfW - blockHalf, y, z:  adjHalfD + blockHalf, rotY: 0, tileScale: 1.0 }); // front-left
    results.push({ x:  adjHalfW + blockHalf, y, z: -adjHalfD - blockHalf, rotY: 0, tileScale: 1.0 }); // back-right
    results.push({ x: -adjHalfW - blockHalf, y, z: -adjHalfD - blockHalf, rotY: 0, tileScale: 1.0 }); // back-left
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
    return [{ x: 0, y, z: 0, rotY: 0, tileScale: 1.0 }];
  }

  return computeBodyLayerPositions(layer, 0, hw, hd, totalLayers);
}
