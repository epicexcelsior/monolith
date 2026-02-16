# Bot Simulation System

> Makes the tower feel alive with AI-controlled blocks that charge, fade, and cluster into neighborhoods.

---

## Quick Start

The bot system is **enabled by default**. On first launch, the tower generates ~450 bot-owned blocks (70% of 649 total) with varied energy levels, personas, and streaks. A live simulation loop then makes bots periodically "charge" their blocks, creating visible energy changes.

**No configuration needed for the default experience.**

---

## How It Works

### 1. Seed Generation (one-time)

`generateSeedTower(seed)` creates the initial tower state:

- Uses a **deterministic PRNG** (mulberry32) — same seed = same tower on every device
- Assigns **bot personas** to ~70% of blocks (remaining ~30% are empty/claimable)
- Groups similar personas into **neighborhoods** for organic clustering
- Sets varied **energy levels**, **streaks**, and **stake amounts** per persona archetype

### 2. Live Simulation (ongoing)

`startBotSimulation()` runs a periodic loop that:

- **Charges**: Some bots recharge their blocks (3% chance per tick per bot, scaled by activity level)
- **Flickers**: Small random energy fluctuations create ambient visual movement (8% chance)
- **Respects player blocks**: Never touches blocks owned by real wallet addresses

### 3. Persona System

Each bot has an **archetype** that determines behavior:

| Archetype | Bots | Stake Range | Activity | Behavior |
|-----------|------|-------------|----------|----------|
| **Whale** | SolWhale.sol, VaultMaxi, DiamondHodl | $200-$5,000 | 85-95% | High stakes, always charged, reliable |
| **Degen** | DeFiDegen, ApeMode, YoloStake, GigaBrain | $1-$500 | 30-60% | Volatile — blazing one day, dead the next |
| **Builder** | BuilderDAO, StakeGuru, CyberMonk, SolPilot | $5-$200 | 80-95% | Consistent, long streaks, medium stakes |
| **Artist** | PixelVault, NeonDreams, GlitchArt | $1-$50 | 60-70% | Varied colors, expressive, lower stakes |
| **Explorer** | ChainGhost, WanderSOL, CosmicDust | $1-$25 | 30-40% | Scattered, low commitment, often fading |
| **Competitor** | AlphaGrind, SkylineKing, RankHunter | $20-$1,000 | 85-95% | Status-obsessed, high energy, mid-high stakes |

### 4. Neighborhoods

The seeder creates 6 neighborhoods where blocks of the same archetype cluster together. This creates natural "districts" on the tower:

- A whale district with consistently bright blocks
- A degen zone with volatile energy states
- A builder neighborhood with steady mid-energy blocks

---

## Configuration

All settings are in `apps/mobile/utils/seed-tower.ts` via the `BOT_CONFIG` object.

### Disable bots entirely

```typescript
import { configureBots } from "@/utils/seed-tower";
configureBots({ enabled: false });
// Now generateSeedTower() returns all-empty blocks
```

### Adjust bot density

```typescript
configureBots({ botDensity: 0.5 }); // 50% bot-owned (default: 0.7)
```

### Change energy distribution

```typescript
configureBots({
  energyDistribution: {
    blazing: 0.30,    // 30% at 80-100 energy
    thriving: 0.30,   // 30% at 50-79
    fading: 0.20,     // 20% at 20-49
    flickering: 0.15, // 15% at 1-19
    dormant: 0.05,    // 5% at 0
  },
});
```

### Tune simulation speed

```typescript
configureBots({
  simulation: {
    enabled: true,
    tickIntervalMs: 5_000,    // Every 5 seconds (default: 15s)
    chargeChance: 0.10,        // 10% chance per tick (default: 3%)
    chargeAmount: 25,          // +25 energy per charge (default: 15)
    ambientFlickerChance: 0.15, // 15% flicker chance (default: 8%)
    ambientFlickerRange: 8,    // ±8 energy fluctuation (default: 5)
  },
});
```

### Demo mode (fast, dramatic changes)

```typescript
configureBots({
  simulation: {
    enabled: true,
    tickIntervalMs: 3_000,
    chargeChance: 0.08,
    chargeAmount: 30,
    ambientFlickerChance: 0.20,
    ambientFlickerRange: 10,
  },
});
```

### Reset to defaults

```typescript
import { resetBotConfig } from "@/utils/seed-tower";
resetBotConfig();
```

---

## API Reference

### `generateSeedTower(seed?: number): DemoBlock[]`

Generate a complete tower with bot-owned and empty blocks. Deterministic — same seed produces the same tower.

### `startBotSimulation(getBlocks, updateBlock): () => void`

Start the live simulation loop. Returns a cleanup function to stop it.

### `configureBots(overrides): void`

Override bot configuration. Merges with current config.

### `resetBotConfig(): void`

Reset all config to defaults.

### `getBotConfig(): BotConfigShape`

Get current config (read-only snapshot).

### `isBotOwner(owner: string): boolean`

Check if a block owner is a bot (vs. a real wallet address).

### `getBotStats(blocks): BotStatsResult`

Get summary stats: bot count, empty count, avg energy, archetype distribution.

### `getActiveBotNames(blocks): string[]`

Get sorted list of unique bot names present in the tower.

---

## Integration

The bot system is wired into the app at two points:

1. **Tower initialization** (`tower-store.ts → initTower`): Calls `generateSeedTower()` on first launch
2. **Tower screen** (`app/(tabs)/index.tsx`): Starts `startBotSimulation()` alongside the decay loop

To force a fresh tower (e.g., after changing bot config):

```typescript
import { useTowerStore } from "@/stores/tower-store";
useTowerStore.getState().resetTower();
```

---

## Testing

36 tests cover:
- Deterministic generation (same seed = same tower)
- Block count and structure validation
- Bot density and layer-based scarcity
- Energy distribution across all states
- Persona assignment (emoji, names, colors, stakes)
- Streak generation
- Configuration overrides (density, enable/disable)
- Live simulation (charges, flicker, cleanup, player-block safety)

Run: `npx jest __tests__/utils/seed-tower.test.ts --verbose`
