/**
 * Progression milestone store — derives unlock states from existing stores.
 *
 * ~15 milestones tracking the player's journey from first claim to legend.
 * All state is derived — no persistence needed.
 */

import { create } from "zustand";
import { usePlayerStore } from "@/stores/player-store";
import { useTowerStore } from "@/stores/tower-store";

export interface Milestone {
  id: string;
  name: string;
  description: string;
  flavorText: string;
  icon: string;
  isUnlocked: boolean;
}

const MILESTONE_DEFS = [
  { id: "first_claim", name: "First Claim", description: "Claim your first block", flavorText: "Your journey begins", icon: "🌟", check: (p: PlayerData) => p.totalClaims >= 1 },
  { id: "first_charge", name: "First Charge", description: "Charge a block for the first time", flavorText: "Keep the flame alive", icon: "⚡", check: (p: PlayerData) => p.totalCharges >= 1 },
  { id: "streak_3", name: "3-Day Streak", description: "Maintain a 3-day streak", flavorText: "Commitment unlocked", icon: "🔥", check: (p: PlayerData) => p.bestStreak >= 3 },
  { id: "ember_evo", name: "Ember Evolution", description: "Evolve to Ember tier", flavorText: "Warmth grows stronger", icon: "🟠", check: (p: PlayerData) => p.maxEvolutionTier >= 1 },
  { id: "first_poke", name: "First Poke", description: "Poke another player's block", flavorText: "Hello, neighbor!", icon: "👋", check: (p: PlayerData) => p.totalPokes >= 1 },
  { id: "blocks_5", name: "5 Blocks", description: "Own 5 blocks", flavorText: "Building an empire", icon: "🏗️", check: (p: PlayerData) => p.blocksOwned >= 5 },
  { id: "streak_7", name: "7-Day Streak", description: "Maintain a 7-day streak", flavorText: "One week strong", icon: "💪", check: (p: PlayerData) => p.bestStreak >= 7 },
  { id: "flame_evo", name: "Flame Evolution", description: "Evolve to Flame tier", flavorText: "Fire burns bright", icon: "🔴", check: (p: PlayerData) => p.maxEvolutionTier >= 2 },
  { id: "streak_10", name: "10-Day Streak", description: "Maintain a 10-day streak", flavorText: "True dedication", icon: "🏆", check: (p: PlayerData) => p.bestStreak >= 10 },
  { id: "blaze_evo", name: "Blaze Evolution", description: "Evolve to Blaze tier", flavorText: "Unstoppable force", icon: "🟡", check: (p: PlayerData) => p.maxEvolutionTier >= 3 },
  { id: "level_5", name: "Level 5", description: "Reach player level 5", flavorText: "Rising star", icon: "⭐", check: (p: PlayerData) => p.level >= 5 },
  { id: "charges_50", name: "50 Charges", description: "Charge 50 times total", flavorText: "Half century", icon: "💯", check: (p: PlayerData) => p.totalCharges >= 50 },
  { id: "beacon_evo", name: "Beacon Evolution", description: "Evolve to Beacon tier", flavorText: "A light for all to see", icon: "🟣", check: (p: PlayerData) => p.maxEvolutionTier >= 4 },
  { id: "level_10", name: "Level 10", description: "Reach player level 10", flavorText: "Master keeper", icon: "👑", check: (p: PlayerData) => p.level >= 10 },
  { id: "legend", name: "Legend", description: "Max level + Beacon tier + 30-day streak", flavorText: "Eternal guardian", icon: "🌌", check: (p: PlayerData) => p.level >= 10 && p.maxEvolutionTier >= 4 && p.bestStreak >= 30 },
] as const;

interface PlayerData {
  totalClaims: number;
  totalCharges: number;
  totalPokes: number;
  bestStreak: number;
  blocksOwned: number;
  maxEvolutionTier: number;
  level: number;
}

interface ProgressionStore {
  milestones: Milestone[];
  refreshMilestones: () => void;
}

function gatherPlayerData(): PlayerData {
  const player = usePlayerStore.getState();
  const blocks = useTowerStore.getState().demoBlocks;

  let blocksOwned = 0;
  let maxEvolutionTier = 0;
  let bestStreak = 0;

  // Scan blocks for ownership stats (using demo mode data)
  for (const b of blocks) {
    if (b.owner) {
      // In demo mode, count all owned blocks
      blocksOwned++;
      maxEvolutionTier = Math.max(maxEvolutionTier, b.evolutionTier ?? 0);
      bestStreak = Math.max(bestStreak, b.bestStreak ?? b.streak ?? 0);
    }
  }

  return {
    totalClaims: player.totalClaims ?? 0,
    totalCharges: player.totalCharges ?? 0,
    totalPokes: 0, // Not tracked in player store currently
    bestStreak: Math.max(bestStreak, player.comboBest ?? 0),
    blocksOwned,
    maxEvolutionTier,
    level: player.level ?? 1,
  };
}

export const useProgressionStore = create<ProgressionStore>((set) => ({
  milestones: MILESTONE_DEFS.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    flavorText: d.flavorText,
    icon: d.icon,
    isUnlocked: false,
  })),

  refreshMilestones: () => {
    const data = gatherPlayerData();
    set({
      milestones: MILESTONE_DEFS.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        flavorText: d.flavorText,
        icon: d.icon,
        isUnlocked: d.check(data),
      })),
    });
  },
}));
