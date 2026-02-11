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

// ─── Tower Configuration ──────────────────────────────────
/**
 * Generate a cylindrical tower config.
 * Base has the most blocks, top has the fewest.
 * Total capacity scales to ~1000+ blocks.
 */
export function generateTowerConfig(layerCount: number = 10): TowerConfig {
  const blocksPerLayer: number[] = [];
  const baseBlocks = 160;
  const topBlocks = 20;

  for (let i = 0; i < layerCount; i++) {
    const t = i / (layerCount - 1); // 0 (base) → 1 (top)
    const count = Math.round(baseBlocks - t * (baseBlocks - topBlocks));
    blocksPerLayer.push(count);
  }

  return {
    layerCount,
    blocksPerLayer,
    totalBlocks: blocksPerLayer.reduce((sum, n) => sum + n, 0),
    shape: "cylinder",
  };
}

/** Default tower: 10 layers, ~1000 blocks */
export const DEFAULT_TOWER_CONFIG = generateTowerConfig(10);

// ─── Visual / 3D Constants ────────────────────────────────
/** Spacing between block centers */
export const BLOCK_SIZE = 1.0;

/** Gap between blocks */
export const BLOCK_GAP = 0.05;

/** Height of each tower layer */
export const LAYER_HEIGHT = 1.2;

/** Radius of the cylinder at the base layer */
export const BASE_RADIUS = 25;

/** Radius of the cylinder at the top layer */
export const TOP_RADIUS = 5;

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
