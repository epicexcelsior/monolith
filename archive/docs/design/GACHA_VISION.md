# Gacha / Loot Drop Vision

> Design doc — NOT code. Planning artifact for post-testing implementation.

## Core Idea

Charging your block has a chance to drop loot. Loot = cosmetic items that make your block more unique. This creates a daily reason to come back beyond energy decay.

## Loot Drops on Charge

Every charge action rolls for a loot drop:
- **70%** — Nothing (energy only)
- **20%** — Common drop
- **8%** — Rare drop
- **2%** — Legendary drop

Streak multiplier increases drop chance: `baseChance * (1 + streak * 0.05)` capped at 2x.

## Rarity Tiers

| Tier | Color | Drop Rate | Examples |
|------|-------|-----------|---------|
| Common | White | 20% | Basic patterns, simple borders, muted color variants |
| Rare | Blue | 8% | Animated patterns, glow effects, sound packs |
| Epic | Purple | 2% | Unique block styles, particle auras, rare emojis |
| Legendary | Gold | 0.5% | One-of-a-kind styles, animated emoji, full block skins |

## Collection System

- **Inventory**: per-player collection persisted to Supabase
- **Equip slots**: pattern, border, aura, sound, emoji skin
- **Duplicates**: auto-convert to "Dust" currency (10 common = 1 rare roll)
- **Trading**: future — peer-to-peer cosmetic swaps (or on-chain NFTs)

## Seasonal Content

- **Seasons**: 4-week cycles with themed drops
- **Season pass**: free tier (5 items) + premium tier (15 items, paid with USDC stake bonus)
- **Exclusive items**: only available during that season, never return
- **End-of-season**: unclaimed items gone forever (scarcity)

## Social Display

- **Block showcase**: other players see your equipped cosmetics on the tower
- **Rarity indicator**: subtle glow border around legendary-equipped blocks
- **Collection score**: visible on leaderboard (completionist flex)
- **Share card**: loot drops appear on share cards ("Just pulled a Legendary!")

## Drop Animation

1. Charge completes
2. Block flashes with rarity color (white/blue/purple/gold)
3. Loot card slides up from bottom (think gacha reveal)
4. Item spins in 3D preview
5. "Add to collection" + "Share" buttons

## Technical Notes

- Drop rolls happen server-side (anti-cheat)
- Inventory stored in Supabase `player_inventory` table
- Equip state synced via Colyseus room message
- Shader needs per-instance cosmetic attributes (border style, aura type)
- Keep GPU budget: cosmetics = texture/color swaps, not geometry changes

## Implementation Priority

1. Server-side drop roll on charge
2. Inventory table + API
3. Equip UI in customize panel
4. Drop reveal animation
5. Share integration
6. Seasonal rotation system
7. Dust/crafting economy
