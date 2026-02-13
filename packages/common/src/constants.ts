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

/** Height of each tower layer in world units */
export const LAYER_HEIGHT = 1.3;

/** Block size at layer 0 */
export const BLOCK_SIZE = 0.85;

/** Gap between blocks */
export const BLOCK_GAP = 0.06;

/** Extra scale multiplier per layer (higher = slightly bigger blocks) */
export const BLOCK_SCALE_PER_LAYER = 0.01;

/** Layer index where the spire (converging crown) begins */
export const SPIRE_START_LAYER = 14;

// Legacy aliases (kept for any external references)
export const BASE_RADIUS = MONOLITH_HALF_W;
export const TOP_RADIUS = 1;

/**
 * Generate a monolith tower config.
 *
 * Body layers (0 to spireStart-1): consistent block count per layer
 * Spire layers (spireStart to layerCount-1): tapering to 1 block at the top
 *
 * Each "body" layer has blocks on 4 rectangular faces:
 *   Front/Back faces: blocksWide per face
 *   Left/Right faces: blocksDeep per face
 *   (blocks sit ON the surface, not inside)
 *
 * Target: ~600-800 total blocks (single InstancedMesh = 1 draw call)
 */
export function generateTowerConfig(layerCount: number = 18): TowerConfig {
  const blocksPerLayer: number[] = [];

  // Body: each layer has blocks on 4 faces
  const bodyBlocksWide = 12; // blocks along width face (front & back)
  const bodyBlocksDeep = 8;  // blocks along depth face (left & right)
  const bodyBlocksPerLayer = 2 * bodyBlocksWide + 2 * bodyBlocksDeep; // 40

  for (let i = 0; i < layerCount; i++) {
    if (i < SPIRE_START_LAYER) {
      // Body layer — consistent rectangular ring
      blocksPerLayer.push(bodyBlocksPerLayer);
    } else {
      // Spire layer — taper down
      const spireProgress =
        (i - SPIRE_START_LAYER) / (layerCount - 1 - SPIRE_START_LAYER); // 0→1
      const spireBlocks = Math.max(
        1,
        Math.round(bodyBlocksPerLayer * (1 - spireProgress * 0.88)),
      );
      blocksPerLayer.push(spireBlocks);
    }
  }

  return {
    layerCount,
    blocksPerLayer,
    totalBlocks: blocksPerLayer.reduce((sum, n) => sum + n, 0),
    shape: "monolith",
  };
}

/** Default tower: 18 layers, ~650+ blocks */
export const DEFAULT_TOWER_CONFIG = generateTowerConfig(18);

// ─── LOD Distances ────────────────────────────────────────
/** Distance thresholds for Level of Detail tiers */
export const LOD_DISTANCES = {
  high: 50, // < 50 units: Full geometry, textures, glow
  medium: 200, // 50-200 units: Simple cube, solid color
  low: Infinity, // > 200 units: Point/billboard
} as const;

// ─── Block Customization ──────────────────────────────────
/** Available block colors (curated neon/cyberpunk palette) */
export const BLOCK_COLORS = [
  "#00ffff", // Cyan
  "#ff00ff", // Magenta
  "#ff6600", // Neon Orange
  "#00ff66", // Neon Green
  "#6600ff", // Electric Purple
  "#ffff00", // Yellow
  "#ff0066", // Hot Pink
  "#0066ff", // Electric Blue
  "#ff3300", // Red-Orange
  "#33ff00", // Lime
  "#ff0099", // Fuschia
  "#00ccff", // Sky Cyan
  "#ff6699", // Salmon
  "#9900ff", // Violet
  "#00ff99", // Mint
  "#ffcc00", // Gold
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
