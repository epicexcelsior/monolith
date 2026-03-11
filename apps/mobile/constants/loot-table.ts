/**
 * Loot Drop System — cosmetic rewards on charge.
 *
 * 12 items across 4 rarity tiers. 30% base drop rate.
 * Streak multiplier increases odds up to 2x.
 * Client-side only — no server changes needed.
 */

export type LootRarity = "common" | "rare" | "epic" | "legendary";
export type LootType = "color" | "emoji" | "effect" | "style";

export interface LootItem {
  id: string;
  name: string;
  rarity: LootRarity;
  type: LootType;
  value: string; // hex color, emoji char, effect id, or style id
  description: string;
}

export const LOOT_TABLE: LootItem[] = [
  { id: "color_sunset", name: "Sunset Blush", rarity: "common", type: "color", value: "#FF8C69", description: "A warm sunset glow" },
  { id: "color_ocean", name: "Ocean Mist", rarity: "common", type: "color", value: "#4ECDC4", description: "Cool ocean breeze" },
  { id: "color_violet", name: "Violet Dream", rarity: "common", type: "color", value: "#A78BFA", description: "Soft purple haze" },
  { id: "color_midnight", name: "Midnight", rarity: "common", type: "color", value: "#1E1B4B", description: "Deep midnight blue" },
  { id: "emoji_crown", name: "Royal Crown", rarity: "rare", type: "emoji", value: "\u{1F451}", description: "A crown fit for a keeper" },
  { id: "emoji_diamond", name: "Diamond", rarity: "rare", type: "emoji", value: "\u{1F48E}", description: "Brilliant and rare" },
  { id: "emoji_lightning", name: "Lightning", rarity: "rare", type: "emoji", value: "\u{26A1}", description: "Pure energy" },
  { id: "effect_warm", name: "Warm Aura", rarity: "rare", type: "effect", value: "warm_aura", description: "Warm particle ring" },
  { id: "effect_frost", name: "Frost Aura", rarity: "rare", type: "effect", value: "frost_aura", description: "Cool blue glow ring" },
  { id: "effect_shimmer", name: "Gold Shimmer", rarity: "epic", type: "effect", value: "gold_shimmer", description: "Your block shimmers gold" },
  { id: "style_phoenix", name: "Phoenix Style", rarity: "legendary", type: "style", value: "7", description: "Animated fire pattern" },
  { id: "style_constellation", name: "Constellation", rarity: "legendary", type: "style", value: "8", description: "Star field pattern" },
];

export const RARITY_COLORS: Record<LootRarity, string> = {
  common: "#FFFFFF",
  rare: "#60A5FA",
  epic: "#A78BFA",
  legendary: "#D4AF55",
};

export const RARITY_LABELS: Record<LootRarity, string> = {
  common: "COMMON",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};

export const DROP_RATES = {
  nothing: 0.70,
  common: 0.18,
  rare: 0.09,
  epic: 0.025,
  legendary: 0.005,
} as const;

export function rollLoot(streak: number = 0): LootItem | null {
  const multiplier = Math.min(2.0, 1 + streak * 0.05);
  const roll = Math.random();

  // Adjust nothing threshold down (more drops with streak)
  const nothingRate = DROP_RATES.nothing / multiplier;
  if (roll < nothingRate) return null;

  // Determine rarity based on remaining roll space
  const adjusted = roll - nothingRate;
  const remaining = 1 - nothingRate;
  const normalized = adjusted / remaining;

  let rarity: LootRarity;
  const legendaryThresh = DROP_RATES.legendary / (1 - DROP_RATES.nothing);
  const epicThresh = legendaryThresh + DROP_RATES.epic / (1 - DROP_RATES.nothing);
  const rareThresh = epicThresh + DROP_RATES.rare / (1 - DROP_RATES.nothing);

  if (normalized < legendaryThresh) {
    rarity = "legendary";
  } else if (normalized < epicThresh) {
    rarity = "epic";
  } else if (normalized < rareThresh) {
    rarity = "rare";
  } else {
    rarity = "common";
  }

  const candidates = LOOT_TABLE.filter((item) => item.rarity === rarity);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
