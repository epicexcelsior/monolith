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

// ─── Streak System ───────────────────────────────────────
/** Streak multiplier tiers — shared between client and server */
export function getStreakMultiplier(streak: number): number {
  if (streak >= 30) return 3.0;
  if (streak >= 7) return 2.0;
  if (streak >= 5) return 1.75;
  if (streak >= 3) return 1.5;
  return 1.0;
}

/** Returns the next milestone day for streak display */
export function getNextStreakMilestone(streak: number): number {
  if (streak < 3) return 3;
  if (streak < 7) return 7;
  if (streak < 14) return 14;
  if (streak < 30) return 30;
  return streak + 1;
}

/** Check if ts2 is exactly the next calendar day after ts1 */
export function isNextDay(ts1: number, ts2: number): boolean {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  const diff = d2.getTime() - d1.getTime();
  return diff === 86400000; // exactly 1 day in ms
}

// ─── Variable Charge System ──────────────────────────────
/** Weighted random charge: each bracket has a probability weight and quality */
export const CHARGE_BRACKETS = [
  { min: 15, max: 19, weight: 25, quality: "normal" as const }, // Below average — 25%
  { min: 20, max: 25, weight: 40, quality: "normal" as const }, // Normal — 40%
  { min: 26, max: 30, weight: 25, quality: "good" as const },   // Good — 25%
  { min: 31, max: 35, weight: 10, quality: "great" as const },  // Great ("Lucky!") — 10%
] as const;

export type ChargeQuality = "normal" | "good" | "great";

/** Pre-computed total weight (CHARGE_BRACKETS is const) */
const CHARGE_TOTAL_WEIGHT = CHARGE_BRACKETS.reduce((s, b) => s + b.weight, 0);

/** Roll a variable charge amount using weighted random brackets */
export function rollChargeAmount(): { amount: number; quality: ChargeQuality } {
  let roll = Math.random() * CHARGE_TOTAL_WEIGHT;
  for (let i = 0; i < CHARGE_BRACKETS.length; i++) {
    roll -= CHARGE_BRACKETS[i].weight;
    if (roll <= 0) {
      const bracket = CHARGE_BRACKETS[i];
      const amount = bracket.min + Math.floor(Math.random() * (bracket.max - bracket.min + 1));
      return { amount, quality: bracket.quality };
    }
  }
  // Fallback (shouldn't happen)
  return { amount: 20, quality: "normal" };
}

// ─── Block Evolution System ──────────────────────────────

/** Testing mode: dramatically lower thresholds so testers see progression in one session */
export const TESTING_MODE =
  typeof __DEV__ !== "undefined"
    ? __DEV__ || process.env.EXPO_PUBLIC_TESTING_MODE === "true"
    : process.env.NODE_ENV !== "production" || process.env.EXPO_PUBLIC_TESTING_MODE === "true";

/** Production evolution tiers */
export const EVOLUTION_TIERS = [
  { name: "Spark",  charges: 0,   streakReq: 0,  glowMultiplier: 1.0 },
  { name: "Ember",  charges: 10,  streakReq: 0,  glowMultiplier: 1.2 },
  { name: "Flame",  charges: 30,  streakReq: 7,  glowMultiplier: 1.4 },
  { name: "Blaze",  charges: 75,  streakReq: 14, glowMultiplier: 1.6 },
  { name: "Beacon", charges: 150, streakReq: 30, glowMultiplier: 1.8 },
] as const;

/** Testing evolution tiers — reachable in a single session */
export const EVOLUTION_TIERS_TESTING = [
  { name: "Spark",  charges: 0,   streakReq: 0,  glowMultiplier: 1.0 },
  { name: "Ember",  charges: 3,   streakReq: 0,  glowMultiplier: 1.2 },
  { name: "Flame",  charges: 8,   streakReq: 0,  glowMultiplier: 1.4 },
  { name: "Blaze",  charges: 15,  streakReq: 0,  glowMultiplier: 1.6 },
  { name: "Beacon", charges: 25,  streakReq: 0,  glowMultiplier: 1.8 },
] as const;

/** Use this everywhere instead of EVOLUTION_TIERS directly */
export const ACTIVE_EVOLUTION_TIERS: readonly { name: string; charges: number; streakReq: number; glowMultiplier: number }[] =
  TESTING_MODE ? EVOLUTION_TIERS_TESTING : EVOLUTION_TIERS;

/** Compute evolution tier index (0-4) from totalCharges and best streak */
export function getEvolutionTier(totalCharges: number, bestStreak: number = 0): number {
  let tier = 0;
  for (let i = ACTIVE_EVOLUTION_TIERS.length - 1; i >= 0; i--) {
    if (totalCharges >= ACTIVE_EVOLUTION_TIERS[i].charges && bestStreak >= ACTIVE_EVOLUTION_TIERS[i].streakReq) {
      tier = i;
      break;
    }
  }
  return tier;
}

/** Get evolution tier info by index */
export function getEvolutionTierInfo(tier: number) {
  return ACTIVE_EVOLUTION_TIERS[Math.min(tier, ACTIVE_EVOLUTION_TIERS.length - 1)];
}

/** Charges needed to reach the next evolution tier (or 0 if max) */
export function chargesToNextTier(totalCharges: number, bestStreak: number = 0): { needed: number; nextTierName: string; progress: number } | null {
  const currentTier = getEvolutionTier(totalCharges, bestStreak);
  if (currentTier >= ACTIVE_EVOLUTION_TIERS.length - 1) return null;
  const next = ACTIVE_EVOLUTION_TIERS[currentTier + 1];
  const prev = ACTIVE_EVOLUTION_TIERS[currentTier];
  const needed = next.charges - totalCharges;
  const range = next.charges - prev.charges;
  const progress = range > 0 ? (totalCharges - prev.charges) / range : 0;
  return { needed: Math.max(0, needed), nextTierName: next.name, progress: Math.min(1, Math.max(0, progress)) };
}

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
export const SPIRE_START_LAYER = 16;

// Legacy aliases (kept for any external references)
export const BASE_RADIUS = MONOLITH_HALF_W;
export const TOP_RADIUS = 1;

/**
 * How many blocks fit on a single face of the given width at the given
 * layer scale. Uses Math.round for the best fit — the layout system
 * applies a per-face tileScale to eliminate any remaining gap/overlap.
 */
export function computeBlocksForFace(faceWidth: number, scale: number): number {
  const blockWidth = BLOCK_SIZE * scale;
  if (faceWidth < blockWidth * 0.5) return 0; // face too small
  return Math.max(1, Math.round(faceWidth / blockWidth));
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
  const shrink = Math.pow(1 - spireProgress, 1.5);
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
export function generateTowerConfig(layerCount: number = 25): TowerConfig {
  const blocksPerLayer: number[] = [];
  let pinnacleReached = false;

  for (let i = 0; i < layerCount; i++) {
    const scale = getLayerScale(i, layerCount);

    if (pinnacleReached) {
      // After the pinnacle, emit 0-block layers to preserve scale indexing
      blocksPerLayer.push(0);
      continue;
    }

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
      // Add corners only when faces are large enough — skip at spire tip
      // where blocks are wider than the face (corners would overlap face blocks)
      const blockWidth = BLOCK_SIZE * scale;
      const corners = (front > 0 && side > 0) ? 4 : 0;
      const count = Math.max(1, faceTotal + corners);

      if (count === 1) {
        // Single pinnacle block — crown of the tower
        blocksPerLayer.push(1);
        pinnacleReached = true;
      } else {
        blocksPerLayer.push(count);
      }
    }
  }

  return {
    layerCount,
    blocksPerLayer,
    totalBlocks: blocksPerLayer.reduce((sum, n) => sum + n, 0),
    shape: "monolith",
  };
}

/** Default tower: 25 layers (16 body + 9 spire tapering to 1 pinnacle block) */
export const DEFAULT_TOWER_CONFIG = generateTowerConfig(25);

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
  // Row 1: Pastels
  "#FFB5C2", // Blush Pink
  "#C8B6FF", // Lavender
  "#B8F3D4", // Mint
  "#FFD4B8", // Peach
  "#B8D4FF", // Sky Blue
  "#FFF3D4", // Cream
  "#C2D4B8", // Sage
  "#FF9B9B", // Coral
  // Row 2: Vibrant
  "#FF4D8D", // Hot Pink
  "#8B5CF6", // Purple
  "#14B8A6", // Teal
  "#D4AF55", // Gold
  "#DC2626", // Crimson
  "#16A34A", // Forest
  "#0284C7", // Ocean
  "#4A4A5A", // Charcoal
] as const;

/** Available block icons (emoji) */
export const BLOCK_ICONS = [
  "✨",
  "🔥",
  "💎",
  "⚡",
  "🌟",
  "🚀",
  "👑",
  "🌈",
  "🎮",
  "🎨",
  "🌙",
  "🦄",
  "🦋",
  "🌊",
  "🍀",
  "💫",
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

// ─── Customization Unlock Tiers ──────────────────────────
// Streak-gated unlocks. Higher streaks unlock more customization.
// Colors: first 8 = base, last 8 = premium (indices into BLOCK_COLORS)
// Emojis: first 20 = base, all 48 = full library
// Styles: 0-6 = base (Default..Ice), 7-10 = animated (Lava..Nature)
// Textures: all gated behind streak 14+

export const CUSTOMIZATION_TIERS = {
  /** Streak 0+: 8 base colors, 20 base emojis, 7 base styles, name */
  BASE_COLORS: 8,
  BASE_EMOJIS: 20,
  BASE_STYLES: 7,       // ids 0-6 (Default, Holo, Neon, Matte, Glass, Fire, Ice)
  /** All 16 colors — unlocked for testers (was streak 3) */
  PREMIUM_COLORS_STREAK: 0,
  /** Animated styles — unlocked for testers (was streak 7) */
  ANIMATED_STYLES_STREAK: 0,
  /** All textures — unlocked for testers (was streak 14) */
  TEXTURES_STREAK: 0,
  /** Full emoji library — unlocked for testers (was streak 30) */
  FULL_EMOJIS_STREAK: 0,
} as const;

/** Get the number of unlocked colors for a given streak */
export function getUnlockedColorCount(streak: number): number {
  return streak >= CUSTOMIZATION_TIERS.PREMIUM_COLORS_STREAK
    ? BLOCK_COLORS.length
    : CUSTOMIZATION_TIERS.BASE_COLORS;
}

/** Get the number of unlocked emojis for a given streak */
export function getUnlockedEmojiCount(streak: number): number {
  return streak >= CUSTOMIZATION_TIERS.FULL_EMOJIS_STREAK
    ? BLOCK_ICONS.length
    : CUSTOMIZATION_TIERS.BASE_EMOJIS;
}

/** Check if a style id is unlocked for a given streak */
export function isStyleUnlocked(styleId: number, streak: number): boolean {
  if (styleId < CUSTOMIZATION_TIERS.BASE_STYLES) return true;
  return streak >= CUSTOMIZATION_TIERS.ANIMATED_STYLES_STREAK;
}

/** Check if textures are unlocked for a given streak */
export function areTexturesUnlocked(streak: number): boolean {
  return streak >= CUSTOMIZATION_TIERS.TEXTURES_STREAK;
}

/** Get the streak required to unlock a given customization category */
export function getStreakRequirement(category: "premiumColors" | "animatedStyles" | "textures" | "fullEmojis"): number {
  switch (category) {
    case "premiumColors": return CUSTOMIZATION_TIERS.PREMIUM_COLORS_STREAK;
    case "animatedStyles": return CUSTOMIZATION_TIERS.ANIMATED_STYLES_STREAK;
    case "textures": return CUSTOMIZATION_TIERS.TEXTURES_STREAK;
    case "fullEmojis": return CUSTOMIZATION_TIERS.FULL_EMOJIS_STREAK;
  }
}

// ─── Layer-Based Pricing ─────────────────────────────────
// Higher floors cost more to claim. Gentle exponential curve.
// Layer 0: $0.10, Layer 12 (mid): ~$0.35, Layer 24 (top): ~$1.00

/**
 * Get the minimum stake price (in USD) for a given layer.
 * Uses a gentle quadratic curve: base + 0.90 * (layer/maxLayer)^2
 */
export function getLayerMinPrice(layer: number): number {
  const maxLayer = DEFAULT_TOWER_CONFIG.layerCount - 1;
  const ratio = Math.min(layer, maxLayer) / maxLayer;
  return Math.round((0.10 + 0.90 * ratio * ratio) * 100) / 100;
}

/**
 * Get a human-readable tier label for a layer's price tier.
 */
export function getLayerTierLabel(layer: number): string {
  const maxLayer = DEFAULT_TOWER_CONFIG.layerCount - 1;
  const ratio = layer / maxLayer;
  if (ratio < 0.33) return "Ground Floor";
  if (ratio < 0.66) return "Mid Tower";
  return "Penthouse";
}

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
