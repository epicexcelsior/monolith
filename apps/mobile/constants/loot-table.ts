/**
 * Loot Drop System — cosmetic rewards on charge.
 *
 * 44 items across 4 rarity tiers. 35% base drop rate.
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
  // ─── Common (12 colors) ──────────────────────────────
  { id: "color_sunset", name: "Sunset Blush", rarity: "common", type: "color", value: "#FF8C69", description: "A warm sunset glow" },
  { id: "color_ocean", name: "Ocean Mist", rarity: "common", type: "color", value: "#4ECDC4", description: "Cool ocean breeze" },
  { id: "color_violet", name: "Violet Dream", rarity: "common", type: "color", value: "#A78BFA", description: "Soft purple haze" },
  { id: "color_midnight", name: "Midnight", rarity: "common", type: "color", value: "#1E1B4B", description: "Deep midnight blue" },
  { id: "color_coral", name: "Coral Reef", rarity: "common", type: "color", value: "#FF6F61", description: "Vibrant coral pink" },
  { id: "color_sage", name: "Sage Leaf", rarity: "common", type: "color", value: "#87AE73", description: "Calm sage green" },
  { id: "color_lavender", name: "Lavender Field", rarity: "common", type: "color", value: "#B4A7D6", description: "Gentle lavender mist" },
  { id: "color_amber", name: "Honey Amber", rarity: "common", type: "color", value: "#FFBF00", description: "Rich golden amber" },
  { id: "color_rose", name: "Desert Rose", rarity: "common", type: "color", value: "#C97B84", description: "Dusty rose petal" },
  { id: "color_seafoam", name: "Seafoam", rarity: "common", type: "color", value: "#93E9BE", description: "Fresh seafoam spray" },
  { id: "color_dustyblue", name: "Dusty Blue", rarity: "common", type: "color", value: "#6C9BCF", description: "Faded denim sky" },
  { id: "color_marigold", name: "Marigold", rarity: "common", type: "color", value: "#EAA221", description: "Sunny marigold bloom" },

  // ─── Rare (14: 4 colors + 6 emojis + 4 effects) ─────
  { id: "color_holographic", name: "Holographic", rarity: "rare", type: "color", value: "#E0E0FF", description: "Iridescent shimmer" },
  { id: "color_oilslick", name: "Oil Slick", rarity: "rare", type: "color", value: "#2D1B4E", description: "Dark rainbow sheen" },
  { id: "color_sunsetgrad", name: "Sunset Gradient", rarity: "rare", type: "color", value: "#FF6B35", description: "Warm gradient blend" },
  { id: "color_aurora", name: "Aurora Green", rarity: "rare", type: "color", value: "#00FF87", description: "Northern lights green" },
  { id: "emoji_crown", name: "Royal Crown", rarity: "rare", type: "emoji", value: "\u{1F451}", description: "A crown fit for a keeper" },
  { id: "emoji_diamond", name: "Diamond", rarity: "rare", type: "emoji", value: "\u{1F48E}", description: "Brilliant and rare" },
  { id: "emoji_lightning", name: "Lightning", rarity: "rare", type: "emoji", value: "\u{26A1}", description: "Pure energy" },
  { id: "emoji_moon", name: "Moon", rarity: "rare", type: "emoji", value: "\u{1F319}", description: "Crescent moon glow" },
  { id: "emoji_dragon", name: "Dragon", rarity: "rare", type: "emoji", value: "\u{1F409}", description: "Ancient guardian" },
  { id: "emoji_crystal", name: "Crystal Ball", rarity: "rare", type: "emoji", value: "\u{1F52E}", description: "See the future" },
  { id: "effect_warm", name: "Warm Aura", rarity: "rare", type: "effect", value: "warm_aura", description: "Warm particle ring" },
  { id: "effect_frost", name: "Frost Aura", rarity: "rare", type: "effect", value: "frost_aura", description: "Cool blue glow ring" },
  { id: "effect_cherry", name: "Cherry Blossom", rarity: "rare", type: "effect", value: "cherry_blossom", description: "Floating pink petals" },
  { id: "effect_electric", name: "Electric Arc", rarity: "rare", type: "effect", value: "electric_arc", description: "Crackling electricity" },

  // ─── Epic (7: 2 emojis + 3 effects + 2 styles) ──────
  { id: "emoji_phoenix", name: "Phoenix", rarity: "epic", type: "emoji", value: "\u{1F985}", description: "Rise from the ashes" },
  { id: "emoji_blackhole", name: "Black Hole", rarity: "epic", type: "emoji", value: "\u{1F573}\u{FE0F}", description: "Infinite gravity" },
  { id: "effect_shimmer", name: "Gold Shimmer", rarity: "epic", type: "effect", value: "gold_shimmer", description: "Your block shimmers gold" },
  { id: "effect_rainbow", name: "Rainbow Trail", rarity: "epic", type: "effect", value: "rainbow_trail", description: "Prismatic light trail" },
  { id: "effect_gravity", name: "Gravity Field", rarity: "epic", type: "effect", value: "gravity_field", description: "Warped space around you" },
  { id: "effect_firering", name: "Fire Ring", rarity: "epic", type: "effect", value: "fire_ring", description: "Blazing ring of fire" },
  { id: "style_geometric", name: "Sacred Geometry", rarity: "epic", type: "style", value: "9", description: "Geometric pattern overlay" },

  // ─── Legendary (3: 2 effects + 1 style) ──────────────
  { id: "style_phoenix", name: "Phoenix Style", rarity: "legendary", type: "style", value: "7", description: "Animated fire pattern" },
  { id: "style_constellation", name: "Constellation", rarity: "legendary", type: "style", value: "8", description: "Star field pattern" },
  { id: "effect_cosmic", name: "Cosmic Void", rarity: "legendary", type: "effect", value: "cosmic_void", description: "Swirling cosmic energy" },
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
  nothing: 0.65,
  common: 0.20,
  rare: 0.10,
  epic: 0.035,
  legendary: 0.015,
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
