/**
 * Season definitions — 8-week recurring content seasons.
 *
 * Season 1: "Genesis" — tracks player progress over the first season.
 * Free track: 10 rewards (XP boosts, common loot, streak freeze at level 5)
 * Premium track: 20 rewards (exclusive cosmetics, extra freezes, loot crates)
 *
 * Season XP sources:
 *   - Daily charge: 10 XP
 *   - Quest completion: quest XP (already tracked)
 *   - Poke: 5 XP
 */

export interface SeasonReward {
  id: string;
  level: number;         // Season level at which this reward unlocks
  type: "xp_boost" | "loot_crate" | "streak_freeze" | "color" | "style" | "emoji" | "badge";
  label: string;
  icon: string;
  value?: number;        // For xp_boost: multiplier (1.2 = 20% boost). For streak_freeze: count.
}

export interface Season {
  id: number;
  name: string;
  tagline: string;
  startDate: string;     // ISO date string
  endDate: string;       // ISO date string
  xpPerLevel: number;    // Season XP needed per level
  freeTrack: SeasonReward[];
  premiumTrack: SeasonReward[];
}

// Season 1: "Genesis" — 8 weeks from March 16 to May 11, 2026
export const SEASON_1: Season = {
  id: 1,
  name: "Genesis",
  tagline: "The tower rises.",
  startDate: "2026-03-16",
  endDate: "2026-05-11",
  xpPerLevel: 100,

  freeTrack: [
    { id: "free_1", level: 1, type: "loot_crate", label: "Common Crate", icon: "📦" },
    { id: "free_2", level: 3, type: "xp_boost", label: "XP Boost 1.1x", icon: "⚡", value: 1.1 },
    { id: "free_3", level: 5, type: "streak_freeze", label: "Streak Freeze", icon: "❄️", value: 1 },
    { id: "free_4", level: 7, type: "loot_crate", label: "Common Crate", icon: "📦" },
    { id: "free_5", level: 10, type: "xp_boost", label: "XP Boost 1.2x", icon: "⚡", value: 1.2 },
    { id: "free_6", level: 13, type: "loot_crate", label: "Rare Crate", icon: "🎁" },
    { id: "free_7", level: 16, type: "streak_freeze", label: "Streak Freeze", icon: "❄️", value: 1 },
    { id: "free_8", level: 19, type: "loot_crate", label: "Common Crate", icon: "📦" },
    { id: "free_9", level: 22, type: "xp_boost", label: "XP Boost 1.3x", icon: "⚡", value: 1.3 },
    { id: "free_10", level: 25, type: "badge", label: "Genesis Badge", icon: "🏅" },
  ],

  premiumTrack: [
    { id: "prem_1", level: 1, type: "loot_crate", label: "Rare Crate", icon: "🎁" },
    { id: "prem_2", level: 2, type: "color", label: "Crimson Red", icon: "🔴" },
    { id: "prem_3", level: 4, type: "loot_crate", label: "Rare Crate", icon: "🎁" },
    { id: "prem_4", level: 5, type: "streak_freeze", label: "Streak Freeze ×2", icon: "❄️", value: 2 },
    { id: "prem_5", level: 6, type: "emoji", label: "Crown Emoji", icon: "👑" },
    { id: "prem_6", level: 8, type: "loot_crate", label: "Epic Crate", icon: "💎" },
    { id: "prem_7", level: 9, type: "style", label: "Gold Frame", icon: "✨" },
    { id: "prem_8", level: 11, type: "color", label: "Void Black", icon: "⬛" },
    { id: "prem_9", level: 12, type: "loot_crate", label: "Rare Crate", icon: "🎁" },
    { id: "prem_10", level: 14, type: "streak_freeze", label: "Streak Freeze", icon: "❄️", value: 1 },
    { id: "prem_11", level: 15, type: "loot_crate", label: "Epic Crate", icon: "💎" },
    { id: "prem_12", level: 17, type: "xp_boost", label: "XP Boost 1.5x", icon: "⚡", value: 1.5 },
    { id: "prem_13", level: 18, type: "emoji", label: "Fire Emoji", icon: "🔥" },
    { id: "prem_14", level: 20, type: "loot_crate", label: "Legendary Crate", icon: "🌟" },
    { id: "prem_15", level: 21, type: "color", label: "Solar Gold", icon: "🌟" },
    { id: "prem_16", level: 22, type: "streak_freeze", label: "Streak Freeze ×3", icon: "❄️", value: 3 },
    { id: "prem_17", level: 23, type: "loot_crate", label: "Epic Crate", icon: "💎" },
    { id: "prem_18", level: 24, type: "style", label: "Holographic", icon: "🌈" },
    { id: "prem_19", level: 25, type: "badge", label: "Genesis Founder", icon: "🏆" },
    { id: "prem_20", level: 30, type: "badge", label: "Pillar of Genesis", icon: "🗿" },
  ],
};

/** Get the current active season */
export function getCurrentSeason(): Season {
  return SEASON_1;
}

/** Compute season level from XP */
export function computeSeasonLevel(xp: number, xpPerLevel: number): number {
  return Math.floor(xp / xpPerLevel);
}

/** Compute season XP within current level */
export function computeSeasonLevelXp(xp: number, xpPerLevel: number): number {
  return xp % xpPerLevel;
}
