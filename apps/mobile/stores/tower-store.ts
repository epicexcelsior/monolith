import { create } from "zustand";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import type {
  Block,
  TowerStats,
  TowerConfig,
  Player,
} from "@monolith/common";
import { DEFAULT_TOWER_CONFIG, MAX_ENERGY } from "@monolith/common";
import { generateSeedTower } from "@/utils/seed-tower";

// ─── Storage Helpers ──────────────────────────────────────
// Uses expo-file-system for large tower data (650+ blocks JSON)
// Uses expo-secure-store for small flags (onboarding)

const TOWER_FILE = `${FileSystem.documentDirectory}tower-state.json`;
const ONBOARDING_KEY = "monolith_onboarding_done";

async function readTowerFile(): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(TOWER_FILE);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(TOWER_FILE);
  } catch {
    return null;
  }
}

async function writeTowerFile(data: string): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(TOWER_FILE, data);
  } catch (err) {
    console.error("[TowerStore] writeTowerFile error:", err);
  }
}

async function getOnboardingFlag(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(ONBOARDING_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

async function setOnboardingFlag(): Promise<void> {
  try {
    await SecureStore.setItemAsync(ONBOARDING_KEY, "true");
  } catch {
    // Ignore
  }
}

// ─── Demo Mode Constants ──────────────────────────────────
const DEMO_DECAY_AMOUNT = 1;
const DEMO_DECAY_INTERVAL_MS = 60_000;
const CHARGE_AMOUNT = 20;
const DEMO_CHARGE_COOLDOWN_MS = 30_000;

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
  emoji?: string;
  name?: string;
  lastChargeTime?: number;
}

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
  recentlyClaimedId: string | null;
  onboardingDone: boolean;
  initialized: boolean;

  // ─── Actions ──────────────────────────────
  setBlocks: (blocks: Block[]) => void;
  setDemoBlocks: (blocks: DemoBlock[]) => void;
  updateBlock: (blockId: string, changes: Partial<Block>) => void;
  updateDemoBlock: (blockId: string, changes: Partial<DemoBlock>) => void;
  setCurrentPlayer: (player: Player | null) => void;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  selectBlock: (blockId: string | null) => void;
  updateStats: (stats: TowerStats) => void;
  setFocusedLayer: (layer: number) => void;
  setZoomTier: (tier: "overview" | "neighborhood" | "block") => void;
  setGestureActive: (active: boolean) => void;

  // ─── Game Actions ─────────────────────────
  initTower: () => Promise<void>;
  persistBlocks: () => Promise<void>;
  claimBlock: (blockId: string, wallet: string, amount: number, color: string) => void;
  chargeBlock: (blockId: string) => { success: boolean; cooldownRemaining?: number };
  customizeBlock: (blockId: string, changes: { color?: string; emoji?: string; name?: string }) => void;
  decayTick: () => void;
  startDecayLoop: () => () => void;
  clearRecentlyClaimed: () => void;
  completeOnboarding: () => void;

  // ─── Computed ─────────────────────────────
  getBlockById: (id: string) => Block | undefined;
  getDemoBlockById: (id: string) => DemoBlock | undefined;
  getBlocksByOwner: (owner: string) => Block[];
  getDemoBlocksByOwner: (owner: string) => DemoBlock[];
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
  recentlyClaimedId: null,
  onboardingDone: false,
  initialized: false,

  // ─── Actions ──────────────────────────────
  setBlocks: (blocks) => set({ blocks }),
  setDemoBlocks: (demoBlocks) => set({ demoBlocks }),

  updateBlock: (blockId, changes) =>
    set((state) => ({
      blocks: state.blocks.map((b) =>
        b.id === blockId ? { ...b, ...changes } : b,
      ),
    })),

  updateDemoBlock: (blockId, changes) =>
    set((state) => ({
      demoBlocks: state.demoBlocks.map((b) =>
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

  // ─── Game Actions ─────────────────────────

  initTower: async () => {
    try {
      const onboardingFlag = await getOnboardingFlag();

      const stored = await readTowerFile();
      if (stored) {
        const parsed = JSON.parse(stored) as DemoBlock[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          set({
            demoBlocks: parsed,
            initialized: true,
            onboardingDone: onboardingFlag,
          });
          return;
        }
      }

      // First launch: seed the tower
      const seeded = generateSeedTower(42);
      set({
        demoBlocks: seeded,
        initialized: true,
        onboardingDone: onboardingFlag,
      });
      await writeTowerFile(JSON.stringify(seeded));
    } catch (err) {
      console.error("[TowerStore] initTower error:", err);
      const seeded = generateSeedTower(42);
      set({ demoBlocks: seeded, initialized: true });
    }
  },

  persistBlocks: async () => {
    try {
      const { demoBlocks } = get();
      await writeTowerFile(JSON.stringify(demoBlocks));
    } catch (err) {
      console.error("[TowerStore] persistBlocks error:", err);
    }
  },

  claimBlock: (blockId, wallet, amount, color) => {
    set((state) => ({
      demoBlocks: state.demoBlocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              owner: wallet,
              ownerColor: color,
              energy: MAX_ENERGY,
              stakedAmount: amount,
              lastChargeTime: Date.now(),
            }
          : b,
      ),
      recentlyClaimedId: blockId,
    }));
    get().persistBlocks();
  },

  chargeBlock: (blockId) => {
    const block = get().demoBlocks.find((b) => b.id === blockId);
    if (!block) return { success: false };

    const now = Date.now();
    const lastCharge = block.lastChargeTime || 0;
    const cooldownRemaining = DEMO_CHARGE_COOLDOWN_MS - (now - lastCharge);

    if (cooldownRemaining > 0) {
      return { success: false, cooldownRemaining };
    }

    set((state) => ({
      demoBlocks: state.demoBlocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              energy: Math.min(MAX_ENERGY, b.energy + CHARGE_AMOUNT),
              lastChargeTime: now,
            }
          : b,
      ),
    }));
    get().persistBlocks();
    return { success: true };
  },

  customizeBlock: (blockId, changes) => {
    set((state) => ({
      demoBlocks: state.demoBlocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              ...(changes.color !== undefined && { ownerColor: changes.color }),
              ...(changes.emoji !== undefined && { emoji: changes.emoji }),
              ...(changes.name !== undefined && { name: changes.name }),
            }
          : b,
      ),
    }));
    get().persistBlocks();
  },

  decayTick: () => {
    set((state) => ({
      demoBlocks: state.demoBlocks.map((b) =>
        b.owner
          ? { ...b, energy: Math.max(0, b.energy - DEMO_DECAY_AMOUNT) }
          : b,
      ),
    }));
    get().persistBlocks();
  },

  startDecayLoop: () => {
    const interval = setInterval(() => {
      get().decayTick();
    }, DEMO_DECAY_INTERVAL_MS);
    return () => clearInterval(interval);
  },

  clearRecentlyClaimed: () => set({ recentlyClaimedId: null }),

  completeOnboarding: () => {
    set({ onboardingDone: true });
    setOnboardingFlag();
  },

  // ─── Computed ─────────────────────────────
  getBlockById: (id) => get().blocks.find((b) => b.id === id),
  getDemoBlockById: (id) => get().demoBlocks.find((b) => b.id === id),
  getBlocksByOwner: (owner) => get().blocks.filter((b) => b.owner === owner),
  getDemoBlocksByOwner: (owner) =>
    get().demoBlocks.filter((b) => b.owner === owner),
  getOccupiedCount: () => get().blocks.filter((b) => b.owner !== null).length,
}));
