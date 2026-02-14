import { create } from "zustand";
import type {
  Block,
  TowerStats,
  TowerConfig,
  Player,
} from "@monolith/common";
import { DEFAULT_TOWER_CONFIG } from "@monolith/common";

/** Lightweight block info for demo mode (no server needed) */
export interface DemoBlock {
  id: string;
  layer: number;
  index: number;
  energy: number;
  ownerColor: string;
  owner: string | null;
  stakedAmount: number;
  position: { x: number; y: number; z: number };
}

/**
 * Zustand Tower Store — Global game state.
 *
 * This is the single source of truth for the tower's state
 * on the client side. The game server pushes updates here
 * via WebSocket, and the R3F scene reads from here to render.
 *
 * IMPORTANT: Zustand updates are batched automatically.
 * The R3F useFrame loop reads from this store every frame,
 * so we only update when data actually changes (from server).
 */

interface TowerStore {
  // ─── State ────────────────────────────────
  blocks: Block[];
  demoBlocks: DemoBlock[];
  config: TowerConfig;
  stats: TowerStats;
  currentPlayer: Player | null;
  isConnected: boolean;
  isLoading: boolean;
  selectedBlockId: string | null;
  focusedLayer: number;
  zoomTier: "overview" | "neighborhood" | "block";
  isGestureActive: boolean;

  // ─── Actions ──────────────────────────────
  setBlocks: (blocks: Block[]) => void;
  setDemoBlocks: (blocks: DemoBlock[]) => void;
  updateBlock: (blockId: string, changes: Partial<Block>) => void;
  setCurrentPlayer: (player: Player | null) => void;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  selectBlock: (blockId: string | null) => void;
  updateStats: (stats: TowerStats) => void;
  setFocusedLayer: (layer: number) => void;
  setZoomTier: (tier: "overview" | "neighborhood" | "block") => void;
  setGestureActive: (active: boolean) => void;

  // ─── Computed ─────────────────────────────
  getBlockById: (id: string) => Block | undefined;
  getDemoBlockById: (id: string) => DemoBlock | undefined;
  getBlocksByOwner: (owner: string) => Block[];
  getOccupiedCount: () => number;
}

export const useTowerStore = create<TowerStore>((set, get) => ({
  // ─── Initial State ────────────────────────
  blocks: [],
  demoBlocks: [],
  config: DEFAULT_TOWER_CONFIG,
  stats: {
    totalStaked: 0,
    totalBlocks: DEFAULT_TOWER_CONFIG.totalBlocks,
    occupiedBlocks: 0,
    activeUsers: 0,
    averageEnergy: 0,
  },
  currentPlayer: null,
  isConnected: false,
  isLoading: false,
  selectedBlockId: null,
  focusedLayer: Math.floor(DEFAULT_TOWER_CONFIG.layerCount / 2),
  zoomTier: "overview" as const,
  isGestureActive: false,

  // ─── Actions ──────────────────────────────
  setBlocks: (blocks) => set({ blocks }),
  setDemoBlocks: (demoBlocks) => set({ demoBlocks }),

  updateBlock: (blockId, changes) =>
    set((state) => ({
      blocks: state.blocks.map((b) =>
        b.id === blockId ? { ...b, ...changes } : b,
      ),
    })),

  setCurrentPlayer: (player) => set({ currentPlayer: player }),
  setConnected: (connected) => set({ isConnected: connected }),
  setLoading: (loading) => set({ isLoading: loading }),
  selectBlock: (blockId) => set({ selectedBlockId: blockId }),
  updateStats: (stats) => set({ stats }),
  setFocusedLayer: (layer) => set({ focusedLayer: layer }),
  setZoomTier: (tier) => set({ zoomTier: tier }),
  setGestureActive: (active) => set({ isGestureActive: active }),

  // ─── Computed ─────────────────────────────
  getBlockById: (id) => get().blocks.find((b) => b.id === id),
  getDemoBlockById: (id) => get().demoBlocks.find((b) => b.id === id),
  getBlocksByOwner: (owner) => get().blocks.filter((b) => b.owner === owner),
  getOccupiedCount: () => get().blocks.filter((b) => b.owner !== null).length,
}));
