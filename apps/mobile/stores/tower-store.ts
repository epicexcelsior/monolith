import { create } from "zustand";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import type {
  Block,
  TowerStats,
  TowerConfig,
  Player,
} from "@monolith/common";
import { DEFAULT_TOWER_CONFIG, MAX_ENERGY, rollChargeAmount, getEvolutionTier, getEvolutionTierInfo, getStreakMultiplier, isNextDay } from "@monolith/common";
import type { ChargeQuality } from "@monolith/common";
import { generateSeedTower, startBotSimulation as startBotSim, isBotOwner, getBotConfig } from "@/utils/seed-tower";
import { useAchievementStore } from "@/stores/achievement-store";
import { SECURE_STORE_KEYS } from "@/services/mwa";

// ─── Storage Helpers ──────────────────────────────────────
// Uses expo-file-system for large tower data (650+ blocks JSON)
// Uses expo-secure-store for small flags (onboarding)

const TOWER_FILE = `${FileSystem.documentDirectory}tower-state.json`;
const TOWER_VERSION_KEY = "monolith_tower_version";
const ONBOARDING_KEY = SECURE_STORE_KEYS.HAS_COMPLETED_ONBOARDING;

// Bump this whenever the seed algorithm changes to force a re-seed.
// Users who already have persisted data will get the new bots on next launch.
const CURRENT_TOWER_VERSION = "16";

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
const DEMO_CHARGE_COOLDOWN_MS = 30_000;

// Re-export for consumers that import from tower-store
export { getStreakMultiplier, getNextStreakMilestone } from "@monolith/common";

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
  style?: number; // 0=Default, 1=Holographic, 2=Neon, 3=Matte, 4=Glass, 5=Fire, 6=Ice
  textureId?: number; // 0=None, 1=Bricks, 2=Circuits, 3=Scales, 4=Camo, 5=Marble, 6=Carbon
  imageIndex?: number; // 0=None, 1-5=atlas slot (solana, dogecoin, quicknode, toly, mike)
  imageUrl?: string; // User-uploaded image URL (Supabase Storage)
  personality?: number; // 0=Happy, 1=Cool, 2=Sleepy, 3=Fierce, 4=Derp. undefined=hash
  lastChargeTime?: number;
  streak?: number;
  lastStreakDate?: string; // ISO date string (YYYY-MM-DD)
  totalCharges?: number;     // cumulative charges (drives evolution)
  bestStreak?: number;       // all-time best streak (never decreases)
  evolutionTier?: number;    // 0-4 (Spark, Ember, Flame, Blaze, Beacon) — denormalized from getEvolutionTier()
}

/** Mutable ref state for claim celebration, readable by useFrame loops */
export interface ClaimCelebrationState {
  active: boolean;
  startTime: number;         // performance.now() / 1000
  duration: number;          // seconds
  blockPosition: { x: number; y: number; z: number };
  blockIndex: number;
  blockId?: string;          // store block ID for reliable glow-up trigger
  isFirstClaim: boolean;
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
  recentlyChargedId: string | null;
  recentlyChargedQuality: ChargeQuality | null;
  recentlyPokedId: string | null;
  glowUpBlockId: string | null;
  onboardingDone: boolean;
  initialized: boolean;
  cameraStateRef: React.MutableRefObject<any> | null;
  claimCelebrationRef: React.MutableRefObject<ClaimCelebrationState | null> | null;
  cinematicMode: boolean;
  multiplayerMode: boolean;
  revealProgress: number;
  revealComplete: boolean;
  /** @deprecated Use block.personality instead */
  devFaceOverride: number;
  justEvolved: string | null; // tier name when evolution just happened (cleared by consumer)

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
  setCameraStateRef: (ref: React.MutableRefObject<any>) => void;
  setClaimCelebrationRef: (ref: React.MutableRefObject<ClaimCelebrationState | null>) => void;
  setCinematicMode: (active: boolean) => void;
  setMultiplayerMode: (enabled: boolean) => void;
  setRevealProgress: (progress: number) => void;
  setRevealComplete: (complete: boolean) => void;

  // ─── Game Actions ─────────────────────────
  initTower: () => Promise<void>;
  persistBlocks: () => Promise<void>;
  claimBlock: (blockId: string, wallet: string, amount: number, color: string) => void;
  chargeBlock: (blockId: string) => { success: boolean; cooldownRemaining?: number; streak?: number; multiplier?: number; chargeAmount?: number; chargeQuality?: ChargeQuality; totalCharges?: number; evolutionTier?: number };
  customizeBlock: (blockId: string, changes: { color?: string; emoji?: string; name?: string; style?: number; textureId?: number; imageUrl?: string; personality?: number }) => void;
  decayTick: () => void;
  startDecayLoop: () => () => void;
  startBotSimulation: () => () => void;
  resetTower: () => Promise<void>;
  clearRecentlyClaimed: () => void;
  setRecentlyClaimedId: (id: string | null) => void;
  setRecentlyChargedId: (id: string | null, quality?: ChargeQuality) => void;
  clearRecentlyCharged: () => void;
  setRecentlyPokedId: (id: string | null) => void;
  clearRecentlyPoked: () => void;
  setGlowUpBlockId: (id: string | null) => void;
  clearGlowUpBlock: () => void;
  clearJustEvolved: () => void;
  completeOnboarding: () => void;
  resetOnboardingFlag: () => Promise<void>;

  // ─── Ghost Block Actions (onboarding tutorial) ─────
  ghostClaimBlock: (blockId: string) => void;
  ghostChargeBlock: (blockId: string) => { success: boolean; chargeAmount?: number };
  ghostDecayBlock: (blockId: string, amount?: number) => void;
  ghostCustomizeBlock: (blockId: string, changes: { color?: string; emoji?: string; style?: number; personality?: number }) => void;
  clearGhostBlock: () => void;

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
  recentlyChargedId: null,
  recentlyChargedQuality: null,
  recentlyPokedId: null,
  glowUpBlockId: null,
  onboardingDone: false,
  initialized: false,
  cameraStateRef: null,
  claimCelebrationRef: null,
  cinematicMode: false,
  multiplayerMode: false,
  revealProgress: 0,
  revealComplete: false,
  devFaceOverride: -1,
  justEvolved: null,

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
  setCameraStateRef: (ref) => set({ cameraStateRef: ref }),
  setClaimCelebrationRef: (ref) => set({ claimCelebrationRef: ref }),
  setCinematicMode: (active) => set({ cinematicMode: active }),
  setMultiplayerMode: (enabled) => set({ multiplayerMode: enabled }),
  setRevealProgress: (progress) => set({ revealProgress: progress }),
  setRevealComplete: (complete) => set({ revealComplete: complete }),

  // ─── Game Actions ─────────────────────────

  initTower: async () => {
    // In multiplayer mode, server provides state — skip local load/seed
    if (get().multiplayerMode) {
      const onboardingFlag = await getOnboardingFlag();
      set({ initialized: true, onboardingDone: onboardingFlag });
      return;
    }

    try {
      const onboardingFlag = await getOnboardingFlag();

      // Check if persisted tower matches current seed version.
      // If the bot system was upgraded, we re-seed to get new personas/neighborhoods.
      let storedVersion: string | null = null;
      try {
        storedVersion = await SecureStore.getItemAsync(TOWER_VERSION_KEY);
      } catch { /* ignore */ }

      const needsReseed = storedVersion !== CURRENT_TOWER_VERSION;

      if (!needsReseed) {
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
      }

      // First launch or version bump: seed the tower with enhanced bots
      if (typeof __DEV__ !== "undefined" && __DEV__) console.log(`[TowerStore] Seeding tower (version ${CURRENT_TOWER_VERSION})`);
      const seeded = generateSeedTower();
      set({
        demoBlocks: seeded,
        initialized: true,
        onboardingDone: onboardingFlag,
      });
      await writeTowerFile(JSON.stringify(seeded));
      try {
        await SecureStore.setItemAsync(TOWER_VERSION_KEY, CURRENT_TOWER_VERSION);
      } catch { /* ignore */ }
    } catch (err) {
      console.error("[TowerStore] initTower error:", err);
      const seeded = generateSeedTower();
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
            imageIndex: 0,
          }
          : b,
      ),
      recentlyClaimedId: blockId,
    }));
    get().persistBlocks();
    useAchievementStore.getState().checkAndUnlock("first_claim");
    // Check multi_block achievement (3+ blocks owned)
    const ownedCount = get().demoBlocks.filter((b) => b.owner === wallet).length;
    if (ownedCount >= 3) useAchievementStore.getState().checkAndUnlock("multi_block");
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

    // ─── Streak tracking ─────────────────────────
    const today = new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD
    const lastStreakDate = block.lastStreakDate || "";
    const currentStreak = block.streak || 0;

    let newStreak: number;
    if (lastStreakDate === today) {
      // Same day: no streak change, just charge
      newStreak = currentStreak;
    } else if (lastStreakDate && isNextDay(new Date(lastStreakDate).getTime(), now)) {
      // Next day: streak continues!
      newStreak = currentStreak + 1;
    } else if (lastStreakDate === "") {
      // First ever charge
      newStreak = 1;
    } else {
      // Missed a day: streak resets
      newStreak = 1;
    }

    const multiplier = getStreakMultiplier(newStreak);
    // Variable charge: random 15-35 base, then multiplied by streak
    const { amount: baseAmount, quality: chargeQuality } = rollChargeAmount();
    const chargeAmount = Math.round(baseAmount * multiplier);
    const newTotalCharges = (block.totalCharges ?? 0) + 1;
    const newBestStreak = Math.max(block.bestStreak ?? 0, newStreak);
    // Evolution tier never regresses (ratchet)
    const oldEvolutionTier = block.evolutionTier ?? 0;
    const newEvolutionTier = Math.max(oldEvolutionTier, getEvolutionTier(newTotalCharges, newBestStreak));

    // Auto-assign style based on evolution tier (Flame=Crystal(8), Blaze=Aurora(7), Beacon=Lava(9))
    const TIER_STYLES = [0, 0, 8, 7, 9];
    const autoStyle = newEvolutionTier >= 2 ? TIER_STYLES[newEvolutionTier] ?? 0 : undefined;

    // Detect evolution tier-up
    const evolved = newEvolutionTier > oldEvolutionTier;

    set((state) => ({
      demoBlocks: state.demoBlocks.map((b) =>
        b.id === blockId
          ? {
            ...b,
            energy: Math.min(MAX_ENERGY, b.energy + chargeAmount),
            lastChargeTime: now,
            streak: newStreak,
            lastStreakDate: today,
            totalCharges: newTotalCharges,
            bestStreak: newBestStreak,
            evolutionTier: newEvolutionTier,
            ...(autoStyle !== undefined && { style: autoStyle }),
          }
          : b,
      ),
      ...(evolved && { justEvolved: getEvolutionTierInfo(newEvolutionTier).name }),
    }));
    get().persistBlocks();
    // Unlock streak achievements on milestone days
    if (newStreak >= 3)  useAchievementStore.getState().checkAndUnlock("streak_3");
    if (newStreak >= 7)  useAchievementStore.getState().checkAndUnlock("streak_7");
    if (newStreak >= 14) useAchievementStore.getState().checkAndUnlock("streak_14");
    if (newStreak >= 30) useAchievementStore.getState().checkAndUnlock("streak_30");
    return { success: true, streak: newStreak, multiplier, chargeAmount, chargeQuality, totalCharges: newTotalCharges, evolutionTier: newEvolutionTier };
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
            ...(changes.style !== undefined && { style: changes.style }),
            ...(changes.textureId !== undefined && { textureId: changes.textureId }),
            ...(changes.imageUrl !== undefined && { imageUrl: changes.imageUrl }),
            ...(changes.personality !== undefined && { personality: changes.personality }),
          }
          : b,
      ),
    }));
    get().persistBlocks();
  },

  decayTick: () => {
    const blocks = get().demoBlocks;
    // PERF: Mutate energy in-place, only create new array ref to trigger React.
    // Blocks that didn't change keep same object reference → downstream === checks skip them.
    let anyChanged = false;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.owner && b.energy > 0) {
        b.energy = Math.max(0, b.energy - DEMO_DECAY_AMOUNT);
        anyChanged = true;
      }
    }
    if (!anyChanged) return;

    set({ demoBlocks: [...blocks] });
    get().persistBlocks();
  },

  startDecayLoop: () => {
    const interval = setInterval(() => {
      get().decayTick();
    }, DEMO_DECAY_INTERVAL_MS);
    return () => clearInterval(interval);
  },

  startBotSimulation: () => {
    if (!getBotConfig().simulation.enabled) return () => { };
    return startBotSim(
      () => get().demoBlocks,
      (blockId, changes) => get().updateDemoBlock(blockId, changes),
      // PERF: batch-update path — 1 store update per tick instead of ~50
      (blocks) => set({ demoBlocks: blocks }),
    );
  },

  resetTower: async () => {
    const seeded = generateSeedTower();
    set({ demoBlocks: seeded });
    await writeTowerFile(JSON.stringify(seeded));
    try {
      await SecureStore.setItemAsync(TOWER_VERSION_KEY, CURRENT_TOWER_VERSION);
    } catch { /* ignore */ }
  },

  clearRecentlyClaimed: () => set({ recentlyClaimedId: null }),
  setRecentlyClaimedId: (id) => set({ recentlyClaimedId: id }),
  setRecentlyChargedId: (id, quality) => set({ recentlyChargedId: id, recentlyChargedQuality: quality ?? null }),
  clearRecentlyCharged: () => set({ recentlyChargedId: null, recentlyChargedQuality: null }),
  setRecentlyPokedId: (id) => set({ recentlyPokedId: id }),
  clearRecentlyPoked: () => set({ recentlyPokedId: null }),
  setGlowUpBlockId: (id) => set({ glowUpBlockId: id }),
  clearGlowUpBlock: () => set({ glowUpBlockId: null }),
  clearJustEvolved: () => set({ justEvolved: null }),

  completeOnboarding: () => {
    set({ onboardingDone: true });
    setOnboardingFlag();
  },

  resetOnboardingFlag: async () => {
    set({ onboardingDone: false, revealComplete: false, revealProgress: 0 });
    try {
      await SecureStore.deleteItemAsync(ONBOARDING_KEY);
    } catch { /* ignore */ }
  },

  // ─── Ghost Block Actions (onboarding tutorial) ─────

  ghostClaimBlock: (blockId) => {
    set((state) => ({
      demoBlocks: state.demoBlocks.map((b) =>
        b.id === blockId
          ? {
            ...b,
            owner: "__ghost__",
            ownerColor: "#FFB800",
            energy: 60, // Start at 60% so charge step is meaningful
            stakedAmount: 1,
            streak: 1,
            personality: 0, // Default to Happy
          }
          : b,
      ),
      recentlyClaimedId: blockId,
    }));
  },

  ghostChargeBlock: (blockId) => {
    const block = get().demoBlocks.find((b) => b.id === blockId);
    if (!block) return { success: false };

    const chargeAmount = 25; // Fixed amount for onboarding tutorial
    set((state) => ({
      demoBlocks: state.demoBlocks.map((b) =>
        b.id === blockId
          ? { ...b, energy: Math.min(MAX_ENERGY, b.energy + chargeAmount) }
          : b,
      ),
    }));
    return { success: true, chargeAmount };
  },

  ghostDecayBlock: (blockId, amount = 50) => {
    set((state) => ({
      demoBlocks: state.demoBlocks.map((b) =>
        b.id === blockId
          ? { ...b, energy: Math.max(0, b.energy - amount) }
          : b,
      ),
    }));
  },

  ghostCustomizeBlock: (blockId, changes) => {
    set((state) => ({
      demoBlocks: state.demoBlocks.map((b) =>
        b.id === blockId
          ? {
            ...b,
            ...(changes.color !== undefined && { ownerColor: changes.color }),
            ...(changes.emoji !== undefined && { emoji: changes.emoji }),
            ...(changes.style !== undefined && { style: changes.style }),
            ...(changes.personality !== undefined && { personality: changes.personality }),
          }
          : b,
      ),
    }));
  },

  clearGhostBlock: () => {
    set((state) => ({
      demoBlocks: state.demoBlocks.map((b) =>
        b.owner === "__ghost__"
          ? { ...b, owner: null, energy: 0, stakedAmount: 0, streak: 0 }
          : b,
      ),
      recentlyClaimedId: null,
    }));
  },

  // ─── Computed ─────────────────────────────
  getBlockById: (id) => get().blocks.find((b) => b.id === id),
  getDemoBlockById: (id) => get().demoBlocks.find((b) => b.id === id),
  getBlocksByOwner: (owner) => get().blocks.filter((b) => b.owner === owner),
  getDemoBlocksByOwner: (owner) =>
    get().demoBlocks.filter((b) => b.owner === owner),
  getOccupiedCount: () => get().blocks.filter((b) => b.owner !== null).length,
}));
