// ============================================================
// @monolith/common — Game Types
// ============================================================
// All shared types for blocks, tower state, players, and events.
// These are used by both mobile app and game server.
// ============================================================

/**
 * Visual energy state of a block.
 * Determines glow intensity, particles, and shader effects.
 */
export type BlockState = "blazing" | "thriving" | "fading" | "dying" | "dead";

/**
 * A single block in the tower.
 * This is the core game entity — each block represents a user's staked position.
 */
export interface Block {
  /** Unique block identifier (matches on-chain PDA) */
  id: string;

  /** Position within the tower grid */
  position: BlockPosition;

  /** Owner's Solana wallet address. Null if unclaimed. */
  owner: string | null;

  /** Amount of USDC staked (in lamports / smallest unit) */
  stakedAmount: number;

  /** Current energy level (0-100). Determines visual state. */
  energy: number;

  /** Visual state derived from energy level */
  state: BlockState;

  /** Whether this is a ghost block (free claim, limited power) */
  isGhost?: boolean;

  /** Custom appearance set by owner */
  appearance: BlockAppearance;

  /** Timestamp of last entropy tick */
  lastTickAt: number;

  /** Current entropy (burn) rate multiplier */
  entropyRate: number;
}

/**
 * Block position in 3D tower space.
 * Layer 0 = base (most accessible), higher layers = more exclusive.
 */
export interface BlockPosition {
  /** Tower layer (0 = base, increasing = higher) */
  layer: number;

  /** Position index within the layer */
  index: number;

  /** Computed 3D world position (set by renderer) */
  worldX?: number;
  worldY?: number;
  worldZ?: number;
}

/**
 * User-customizable block appearance.
 */
export interface BlockAppearance {
  /** Primary color (hex) */
  color: string;

  /** Optional emoji/icon overlay */
  icon?: string;

  /** Optional text label */
  label?: string;

  /** Optional image URL (Supabase storage) */
  imageUrl?: string;

  /** Optional NFT mint address for texture */
  nftMint?: string;

  /** Face personality (0-4). undefined = hash-based. */
  personality?: number;
}

/**
 * Complete tower state — the entire game world.
 */
export interface TowerState {
  /** All blocks in the tower */
  blocks: Block[];

  /** Tower configuration */
  config: TowerConfig;

  /** Global stats */
  stats: TowerStats;
}

/**
 * Tower shape and layer configuration.
 * Defines how many blocks per layer and the tower's geometry.
 */
export interface TowerConfig {
  /** Total number of layers */
  layerCount: number;

  /** Number of blocks per layer (array, index = layer) */
  blocksPerLayer: number[];

  /** Total block capacity */
  totalBlocks: number;

  /** Shape type for rendering */
  shape: "cylinder" | "hexagonal" | "ziggurat" | "monolith" | "custom";
}

/**
 * Tower-wide statistics for leaderboard / UI.
 */
export interface TowerStats {
  totalStaked: number;
  totalBlocks: number;
  occupiedBlocks: number;
  activeUsers: number;
  averageEnergy: number;
}

/**
 * A player / user in the game.
 */
export interface Player {
  /** Solana wallet address */
  walletAddress: string;

  /** Display name (optional) */
  displayName?: string;

  /** Blocks owned by this player */
  blockIds: string[];

  /** Total USDC staked across all blocks */
  totalStaked: number;

  /** Player ranking (by total staked) */
  rank: number;
}

/**
 * Events emitted by the game server for real-time sync.
 */
export type GameEvent =
  | { type: "block_claimed"; block: Block }
  | { type: "block_updated"; blockId: string; changes: Partial<Block> }
  | { type: "block_died"; blockId: string }
  | {
    type: "entropy_tick";
    updates: Array<{ blockId: string; energy: number; state: BlockState }>;
  }
  | { type: "sonar_pulse"; originBlockId: string; dyingBlockIds: string[] }
  | { type: "player_joined"; player: Player }
  | { type: "stats_updated"; stats: TowerStats };

// ─── Multiplayer Message Types ────────────────────────────
// Used by both Colyseus server and client for type-safe messaging.

export interface ClaimMessage {
  blockId: string;
  wallet: string;
  amount: number;
  color: string;
}

export interface ChargeMessage {
  blockId: string;
  wallet: string;
}

export interface CustomizeMessage {
  blockId: string;
  wallet: string;
  changes: {
    color?: string;
    emoji?: string;
    name?: string;
    style?: number;
    textureId?: number;
    personality?: number;
  };
}

export interface PokeMessage {
  blockId: string;
  wallet: string;
}

/** Pact between two adjacent block owners */
export interface Pact {
  id: string;
  blockA: string;
  blockB: string;
  ownerA: string;
  ownerB: string;
  createdAt: number;
  lastBothChargedDate: string;
  consecutiveMisses: number;
}

/** Pact-related messages */
export interface PactMessage {
  blockId: string;
  targetBlockId: string;
}

/** Activity event for real-time feed */
export interface ActivityEvent {
  id: string;
  type: "claim" | "charge" | "customize" | "poke";
  blockId: string;
  owner: string;
  ownerColor?: string;
  timestamp: number;
  message?: string;
  data?: Record<string, any>;
}

/** Leaderboard entry */
export interface LeaderboardEntry {
  rank: number;
  name: string;
  emoji: string;
  color: string;
  score: number;
  blocksOwned: number;
  bestStreak: number;
  avgEnergy: number;
}
