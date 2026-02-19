// ============================================================
// @monolith/common — Game Constants
// ============================================================
// Tunable game parameters. Change these to adjust game feel.
// All values documented for easy iteration.
// ============================================================

import type { TowerConfig } from "./types";

// ─── Energy System ────────────────────────────────────────
/** Maximum energy a block can hold */
export const MAX_ENERGY = 100;

/** Energy a new block starts with */
export const INITIAL_ENERGY = MAX_ENERGY;

/** How often entropy drains energy (in milliseconds) */
export const ENTROPY_TICK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Base energy drained per tick (before multipliers) */
export const BASE_ENTROPY_DRAIN = 2;

/** Extra drain per adjacent block owned by same player */
export const GRAVITY_TAX_PER_NEIGHBOR = 0.5;

/** Maximum entropy rate multiplier (caps the gravity tax) */
export const MAX_ENTROPY_MULTIPLIER = 3.0;

/** Minimum stake amount in USDC (6 decimals) to claim a block */
export const MIN_STAKE_USDC = 10_000_000; // 10 USDC

// ─── Energy → Visual State Thresholds ─────────────────────
export const ENERGY_THRESHOLDS = {
  blazing: 80, // 80-100: Brilliant glow + particles
  thriving: 50, // 50-79:  Steady glow
  fading: 20, // 20-49:  Dim, flickering
  dying: 1, // 1-19:   Dark, sparking
  dead: 0, // 0:      Black/cracked, claimable
} as const;

// ─── Monolith Tower Configuration ─────────────────────────
/**
 * Monolith tower: a rectangular skyscraper with 4 block-covered faces
 * topped by a converging spire (the "Penthouse" crown).
 *
 * Layout:
 *   - Body layers: Blocks arranged in a rectangular grid on each face
 *   - Spire layers: Progressively fewer blocks, converging to be a point
 *
 * Optimized for Seeker (Dimensity 7300): ~600-800 blocks via InstancedMesh (1 draw call)
 */

/** Half-width of the monolith on X axis (total width = 2 * MONOLITH_HALF_W) */
export const MONOLITH_HALF_W = 6;

/** Half-depth of the monolith on Z axis (total depth = 2 * MONOLITH_HALF_D) */
export const MONOLITH_HALF_D = 3.5;

/** Approximate height per layer (legacy — use getLayerY() for accurate positions) */
export const LAYER_HEIGHT = 1.3;

/** Block size at layer 0 */
export const BLOCK_SIZE = 0.85;

/** Gap between blocks (sub-pixel seam — ~1px on device) */
export const BLOCK_GAP = 0.005;

/**
 * Exponential scale factor per layer.
 * Bottom blocks ~1x, top blocks ~1.8x.
 * Formula: 1 + 0.8 * (layer / (totalLayers - 1))^2.0
 * Moderate growth — blocks get noticeably bigger without overwhelming the silhouette.
 */
export function getLayerScale(layer: number, totalLayers: number): number {
  if (totalLayers <= 1) return 1;
  const t = layer / (totalLayers - 1);
  return 1 + 0.8 * Math.pow(t, 2.0);
}

/**
 * Compute the Y position for a given layer by summing actual block heights + gap.
 * Each layer's block height = BLOCK_SIZE * getLayerScale(layer), so larger top blocks
 * stack correctly without overlapping or leaving gaps.
 */
export function getLayerY(layer: number, totalLayers: number): number {
  let y = 0;
  for (let i = 0; i < layer; i++) {
    const scale = getLayerScale(i, totalLayers);
    y += BLOCK_SIZE * scale + BLOCK_GAP;
  }
  return y;
}

/**
 * Total tower height (top of last layer's block).
 */
export function getTowerHeight(totalLayers: number): number {
  const lastY = getLayerY(totalLayers - 1, totalLayers);
  const lastScale = getLayerScale(totalLayers - 1, totalLayers);
  return lastY + BLOCK_SIZE * lastScale;
}

/** Layer index where the spire (converging crown) begins */
export const SPIRE_START_LAYER = 18;

// Legacy aliases (kept for any external references)
export const BASE_RADIUS = MONOLITH_HALF_W;
export const TOP_RADIUS = 1;

/**
 * How many blocks fit edge-to-edge on a single face of the given width
 * at the given layer scale. Uses Math.round so blocks tile tightly
 * (minor overlaps preferred over visible gaps for a solid monolith).
 */
export function computeBlocksForFace(faceWidth: number, scale: number): number {
  const blockWidth = BLOCK_SIZE * scale;
  if (faceWidth < blockWidth * 0.5) return 0; // face too small
  return Math.max(1, Math.round(faceWidth / (blockWidth + BLOCK_GAP)));
}

/**
 * Compute the spire shrink factor and half-dimensions for a spire layer.
 */
export function getSpireDimensions(
  layer: number,
  totalLayers: number,
  halfW: number = MONOLITH_HALF_W,
  halfD: number = MONOLITH_HALF_D,
): { hw: number; hd: number; shrink: number } {
  const spireProgress =
    (layer - SPIRE_START_LAYER) / (totalLayers - 1 - SPIRE_START_LAYER);
  const shrink = 1 - spireProgress * 0.75;
  return { hw: halfW * shrink, hd: halfD * shrink, shrink };
}

/**
 * Generate a monolith tower config.
 *
 * Block counts per layer are computed from what physically fits on the
 * 4 rectangular faces at each layer's scale. This guarantees the config
 * matches the layout positioning (edge-to-edge, no orphan gaps).
 *
 * Target: ~600-900 total blocks (single InstancedMesh = 1 draw call)
 */
export function generateTowerConfig(layerCount: number = 22): TowerConfig {
  const blocksPerLayer: number[] = [];

  for (let i = 0; i < layerCount; i++) {
    const scale = getLayerScale(i, layerCount);

    if (i < SPIRE_START_LAYER) {
      // Body layer — face-fitted count + 4 corner blocks
      const front = computeBlocksForFace(2 * MONOLITH_HALF_W, scale);
      const side = computeBlocksForFace(2 * MONOLITH_HALF_D, scale);
      blocksPerLayer.push(2 * front + 2 * side + 4);
    } else {
      // Spire layer — shrinking faces + corners (when faces are big enough)
      const { hw, hd } = getSpireDimensions(i, layerCount);
      const front = computeBlocksForFace(2 * hw, scale);
      const side = computeBlocksForFace(2 * hd, scale);
      const faceTotal = 2 * front + 2 * side;
      // Add corners only when there are blocks on both face directions
      const corners = (front > 0 && side > 0) ? 4 : 0;
      blocksPerLayer.push(Math.max(1, faceTotal + corners));
    }
  }

  return {
    layerCount,
    blocksPerLayer,
    totalBlocks: blocksPerLayer.reduce((sum, n) => sum + n, 0),
    shape: "monolith",
  };
}

/** Default tower: 22 layers (18 body + 4 spire), ~700+ blocks */
export const DEFAULT_TOWER_CONFIG = generateTowerConfig(22);

// ─── LOD Distances ────────────────────────────────────────
/** Distance thresholds for Level of Detail tiers */
export const LOD_DISTANCES = {
  high: 50, // < 50 units: Full geometry, textures, glow
  medium: 200, // 50-200 units: Simple cube, solid color
  low: Infinity, // > 200 units: Point/billboard
} as const;

// ─── Block Customization ──────────────────────────────────
/** Available block colors (desaturated jewel tones + warm earths) */
export const BLOCK_COLORS = [
  "#5b8fb9", // Steel Blue
  "#7b6b8a", // Dusty Plum
  "#6b9e7a", // Sage Green
  "#c98042", // Bronze
  "#cc6644", // Copper Rust
  "#8a7e72", // Warm Stone
  "#b8860b", // Dark Goldenrod
  "#9e7c5a", // Driftwood
  "#7a8f6e", // Moss
  "#a5736e", // Rosewood
  "#d4a055", // Honey
  "#6e8898", // Slate
  "#b5784a", // Amber Clay
  "#8b7355", // Khaki
  "#9a6b4c", // Sienna
  "#7c9a92", // Teal Stone
] as const;

/** Available block icons (emoji) */
export const BLOCK_ICONS = [
  "🏠",
  "🏰",
  "🗼",
  "💎",
  "⚡",
  "🔥",
  "✨",
  "🌟",
  "🎮",
  "🎯",
  "🚀",
  "💰",
  "🏆",
  "👑",
  "🎪",
  "🌈",
  "🔮",
  "💫",
  "🎭",
  "🎨",
  "🎵",
  "🌙",
  "☀️",
  "🌊",
  "🍀",
  "🦄",
  "🐉",
  "🦋",
  "🌺",
  "🍄",
  "🎃",
  "💀",
  "🤖",
  "👾",
  "🛸",
  "⚔️",
  "🛡️",
  "🏴‍☠️",
  "🔱",
  "⚓",
  "🧭",
  "🗺️",
  "🏔️",
  "🌋",
  "🏜️",
  "🌌",
  "🎆",
  "🎇",
] as const;

/** Available block textures (procedural patterns applied in shader) */
export const BLOCK_TEXTURES = [
  { id: 0, label: "Smooth", icon: "◻️" },
  { id: 1, label: "Bricks", icon: "🧱" },
  { id: 2, label: "Circuits", icon: "🔌" },
  { id: 3, label: "Scales", icon: "🐉" },
  { id: 4, label: "Camo", icon: "🌿" },
  { id: 5, label: "Marble", icon: "🪨" },
  { id: 6, label: "Carbon", icon: "⬛" },
] as const;

// ─── Network ──────────────────────────────────────────────
/** Default Solana RPC endpoint */
export const DEFAULT_RPC_URL = "https://api.devnet.solana.com";

/** Game server WebSocket port */
export const GAME_SERVER_PORT = 2567;

/** Supabase table names */
export const TABLES = {
  blocks: "blocks",
  players: "players",
  events: "events",
} as const;
