// ============================================================
// @monolith/common — Shared Tower Layout Functions
// ============================================================
// Single source of truth for block positioning on the tower.
// Used by both TowerGrid.tsx (rendering) and seed-tower.ts (seeding).
// ============================================================

import {
  BLOCK_SIZE,
  BLOCK_GAP,
  MONOLITH_HALF_W,
  MONOLITH_HALF_D,
  SPIRE_START_LAYER,
  getLayerScale,
  getLayerY,
} from "./constants";

export interface LayoutPosition {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

/**
 * Compute block positions for a body layer (rectangular ring on 4 faces).
 */
export function computeBodyLayerPositions(
  layer: number,
  blockCount: number,
  halfW: number,
  halfD: number,
  totalLayers: number,
): LayoutPosition[] {
  const results: LayoutPosition[] = [];
  const y = getLayerY(layer, totalLayers);
  const step = BLOCK_SIZE + BLOCK_GAP;
  const layerScale = getLayerScale(layer, totalLayers);

  const perimeterUnits = 2 * halfW + 2 * halfD;
  const frontBack = Math.round((halfW / perimeterUnits) * blockCount);
  const leftRight = Math.round((halfD / perimeterUnits) * blockCount);

  const totalCalc = 2 * frontBack + 2 * leftRight;
  let fCount = frontBack;
  if (totalCalc !== blockCount) {
    fCount = frontBack + Math.round((blockCount - totalCalc) / 4);
  }
  const sCount = leftRight;

  // Front face
  for (let i = 0; i < fCount; i++) {
    const x = (i - (fCount - 1) / 2) * step * layerScale;
    results.push({ x, y, z: halfD + BLOCK_SIZE * 0.5, rotY: 0 });
  }
  // Back face
  for (let i = 0; i < fCount; i++) {
    const x = (i - (fCount - 1) / 2) * step * layerScale;
    results.push({ x, y, z: -halfD - BLOCK_SIZE * 0.5, rotY: Math.PI });
  }
  // Right face
  for (let i = 0; i < sCount; i++) {
    const z = (i - (sCount - 1) / 2) * step * layerScale;
    results.push({ x: halfW + BLOCK_SIZE * 0.5, y, z, rotY: Math.PI / 2 });
  }
  // Left face
  for (let i = 0; i < sCount; i++) {
    const z = (i - (sCount - 1) / 2) * step * layerScale;
    results.push({ x: -halfW - BLOCK_SIZE * 0.5, y, z, rotY: -Math.PI / 2 });
  }

  return results;
}

/**
 * Compute block positions for a spire layer (tapering crown).
 */
export function computeSpireLayerPositions(
  layer: number,
  blockCount: number,
  totalLayers: number,
): LayoutPosition[] {
  const spireProgress =
    (layer - SPIRE_START_LAYER) / (totalLayers - 1 - SPIRE_START_LAYER);
  const shrink = 1 - spireProgress * 0.9;
  const hw = MONOLITH_HALF_W * shrink;
  const hd = MONOLITH_HALF_D * shrink;

  if (blockCount <= 1) {
    const y = getLayerY(layer, totalLayers);
    return [{ x: 0, y, z: 0, rotY: 0 }];
  }

  return computeBodyLayerPositions(layer, blockCount, hw, hd, totalLayers);
}
