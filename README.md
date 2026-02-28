# The Monolith

**r/Place meets DeFi -- in 3D.**

Stake USDC to claim a glowing block on a massive shared tower. Keep it charged, make it yours, compete for the skyline. Built on Solana for the Seeker.

<p align="center">
  <strong>Stake. Glow. Compete.</strong>
</p>

---

## What Is This?

The Monolith is a massively multiplayer mobile game where your DeFi position is a **living, glowing block** on a shared 3D obelisk. Every block represents a real USDC stake on Solana. Blocks glow when their owners are active, fade when they're not, and become claimable if abandoned.

**The core loop takes 30 seconds:**

```
SCAN  ->  See the tower, find your block
ACT   ->  Tap to charge, claim, or customize
FEEL  ->  Watch the glow burst, haptic feedback, rank change
DONE  ->  Close the app, come back tomorrow
```

## Key Features

- **3D Tower** -- 650+ blocks rendered via InstancedMesh at 60 FPS on mobile
- **On-Chain Staking** -- USDC vault on Solana devnet (Anchor program)
- **Charge System** -- Daily tap ritual with streak multipliers (1x-3x), visual decay states
- **Block Customization** -- Colors, emoji, animated GLSL styles, streak-gated tiers
- **Multiplayer** -- Real-time state sync via Colyseus, server-authoritative game logic
- **Social Layer** -- Poke friends for free energy, Tapestry on-chain profiles, comments, follows
- **Solana Blinks** -- Shareable poke URLs via memo transactions (dial.to cards)
- **SOAR Leaderboard** -- On-chain leaderboard + achievements via MagicBlock SOAR
- **Immersive Onboarding** -- 9-phase cinematic flow from first launch to first claim
- **XP & Progression** -- 10 levels, combo multipliers, achievement system
- **Push Notifications** -- Decay alerts, poke notifications via Expo Push
- **Content Engine** -- Remotion-based video pipeline for marketing assets

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile** | Expo 54, React Native 0.81, React 19 |
| **3D Engine** | React Three Fiber v9, Three.js, custom GLSL shaders |
| **Wallet** | Mobile Wallet Adapter (MWA) + Seed Vault |
| **Smart Contract** | Anchor 0.31 (Rust) on Solana Devnet |
| **Game Server** | Colyseus on Node.js (Railway) |
| **Database** | Supabase (Postgres + real-time subscriptions) |
| **Social** | Tapestry Protocol (on-chain social graph) |
| **Leaderboard** | MagicBlock SOAR (on-chain scores + achievements) |
| **State** | Zustand (client), Colyseus schema (server) |
| **Video** | Remotion (programmatic marketing videos) |

## Project Structure

```
monolith/
├── apps/
│   ├── mobile/           # Expo React Native app (Android/Seeker)
│   ├── server/           # Colyseus game server
│   └── video/            # Remotion content engine
├── packages/
│   └── common/           # Shared types, constants, layout math
├── programs/
│   └── monolith/         # Anchor Solana program (Rust)
├── supabase/             # Database migrations & config
├── tests/                # Anchor integration tests
└── docs/                 # Architecture, game design, guides
```

## Quick Start

### Prerequisites

- Node.js >= 22
- pnpm >= 10
- Android device (Solana Seeker or any with Phantom/Seed Vault)

### Install & Run

```bash
# Install dependencies
pnpm install

# Start the game server
pnpm server

# Start mobile dev server (in another terminal)
pnpm mobile
```

### One-Command Dev (with physical device)

```bash
./dev.sh    # sets up adb reverse, starts server + Expo
```

### Build APK

```bash
cd apps/mobile
eas build --profile preview --platform android
```

## Architecture Highlights

- **USDC on-chain, game state off-chain** -- ownership and staking verified on Solana, fast game logic runs on Colyseus
- **InstancedMesh rendering** -- 650 blocks in 3 draw calls = 60 FPS on mobile hardware
- **Custom GLSL shaders** -- ambient occlusion, subsurface scattering, GGX specular, interior-mapped windows with parallax
- **Procedural skybox** -- shader-based, no texture loading
- **Server-authoritative** -- all game actions validated server-side, Supabase persistence
- **Fire-and-forget blockchain** -- SOAR scores, Tapestry social, and Blinks pokes are non-blocking

## Game Mechanics

| Mechanic | Description |
|----------|-------------|
| **Charge Decay** | Blocks lose ~1 energy/hour. Tap daily to restore. |
| **Streaks** | Consecutive daily taps build multipliers up to 3x |
| **Dormant Reclaim** | Blocks at 0 energy for 3+ days become claimable |
| **Gravity Tax** | Owning adjacent blocks increases decay (anti-monopoly) |
| **Lighthouse Effect** | High-stake blocks illuminate neighbors |
| **Layer Pricing** | Higher floors cost more (quadratic curve) |

## Testing

```bash
# Mobile unit tests (222 tests)
cd apps/mobile && npx jest

# Server unit tests (84 tests)
cd apps/server && npx jest

# Anchor program tests
anchor test
```

## Documentation

| Document | Contents |
|----------|----------|
| [Architecture](docs/ARCHITECTURE.md) | System design, tech decisions, data flow |
| [Game Design](docs/game-design/GDD.md) | Full game design document |
| [Pitch & Marketing](docs/PITCH.md) | Positioning, talking points, demo script |
| [Setup Guide](docs/SETUP.md) | Developer environment setup |
| [Tester Guide](docs/TESTER_GUIDE.md) | How to install and play |
| [Platform Vision](docs/vision/PLATFORM_VISION.md) | Long-term roadmap |
| [Investor Strategy](docs/INVESTOR_STRATEGY.md) | Growth, tokenomics, viral loops |
| [Video Guide](apps/video/GUIDE.md) | Marketing video content engine |

## Integrations

- **Solana Blinks** -- Every block is a shareable action URL. Poke friends via on-chain memo transactions rendered as dial.to cards.
- **Tapestry Protocol** -- On-chain social profiles, follows, likes, and comments. Cross-app identity that persists beyond The Monolith.
- **MagicBlock SOAR** -- On-chain leaderboard and 7 achievement types. Scores submit on claim, charge, and poke actions.

## License

Proprietary. All rights reserved.
