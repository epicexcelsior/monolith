# The Monolith — Architecture & Design Bible v2

> **Living document. Single source of truth.** Update as project evolves.

**Last Updated:** 2026-02-28 | **Solo Developer**

---

## 1. The Pitch

> **The Monolith is r/Place meets DeFi — in 3D.**
> Stake your coins, they become a glowing block on a massive shared tower. Everyone sees it. Customize it. Compete for status. Earn real yield. The tower is alive, multiplayer, and always growing.

**Demo sentence:** _"I stake $10 → my block appears → it glows → I customize it with AI-generated art → other players see it live → I compete for the top."_

---

## 2. Decisions Log

| Decision           | Choice                                   | Why                                          |
| ------------------ | ---------------------------------------- | -------------------------------------------- |
| **Structure**      | **Monorepo** (pnpm workspaces)           | Single repo: app + server + program + shared |
| **Platform**       | Android only (Seeker)                    | Solana Seeker native target                  |
| **Framework**      | Expo SDK 54, React 19, RN 0.81           | Latest stable                                |
| **3D Engine**      | R3F v9 + Three.js + expo-gl              | React 19 compatible, mobile-proven           |
| **Wallet**         | MWA → Seed Vault                         | Seeker-native                                |
| **Smart Contract** | Anchor (Rust)                            | On-chain ownership + staking                 |
| **Yield**          | **Mocked for MVP**                       | Real Drift integration post-MVP              |
| **Network**        | **Devnet**                               | Safe, free                                   |
| **Backend/DB**     | Supabase                                 | Real-time subscriptions, storage, auth       |
| **Real-time Sync** | Colyseus or raw WebSockets               | Multiplayer tower state                      |
| **State**          | Zustand                                  | Lightweight                                  |
| **AR**             | Cut from MVP                             | Later                                        |
| **UGC**            | Simple customization → AI textures later | Progressive                                  |
| **Block Count**    | **1,000+ minimum**                       | Aggressive LOD makes this viable             |
| **Shape**          | Flexible — tower/ziggurat/cylinder TBD   | Optimized for visual impact + performance    |

---

## 3. Monorepo Structure

```
monolith/
├── apps/
│   └── mobile/              # Expo 54 React Native app
│       ├── app/             # Expo Router screens
│       ├── components/      # React + R3F components
│       ├── hooks/           # MWA, game state hooks
│       ├── services/        # Solana, Supabase clients
│       ├── stores/          # Zustand stores
│       ├── constants/       # Theme, config
│       ├── assets/          # Images, models, fonts
│       ├── app.json
│       ├── eas.json
│       ├── metro.config.js
│       └── package.json
├── apps/
│   └── server/              # Game server (Colyseus/WebSocket)
│       ├── src/
│       │   ├── rooms/       # Game rooms (tower state)
│       │   ├── simulation/  # Bot simulation engine
│       │   ├── entropy/     # Entropy tick logic
│       │   └── index.ts
│       └── package.json
├── packages/
│   └── common/              # Shared types, constants, utils
│       ├── src/
│       │   ├── types.ts     # Block, Tower, Player types
│       │   ├── constants.ts # Game constants (entropy rates, etc)
│       │   └── utils.ts     # Shared helpers
│       └── package.json
├── programs/
│   └── monolith/            # Anchor Solana program
│       ├── src/
│       │   ├── lib.rs       # initialize_tower, deposit_stake, add_stake, withdraw
│       │   ├── state.rs     # TowerState, BlockAccount
│       │   └── error.rs     # MonolithError enum
│       └── Cargo.toml
├── tests/                   # Anchor tests (monolith.ts)
├── Anchor.toml              # Anchor workspace config (at root)
├── Cargo.toml               # Rust workspace manifest
├── docs/
│   ├── ARCHITECTURE.md      # This file
│   └── SETUP.md             # Developer setup guide
├── pnpm-workspace.yaml
├── package.json             # Root scripts
├── .gitignore
└── README.md
```

---

## 4. Game Mechanics

### A. Entropy — Decoupled Game Clock

Real yield is too slow for gameplay. The game runs its own clock:

| Concept             | Value                                         | Purpose                       |
| ------------------- | --------------------------------------------- | ----------------------------- |
| Energy max          | 100                                           | Full charge on new block      |
| Tick interval       | **4 hours**                                   | Entropy drains energy         |
| Base drain          | 1-3/tick                                      | Depends on tier/position      |
| Stake → time bought | Higher stake = slower drain                   | Money buys staying power      |
| Recharge            | Manual top-up (spend USDC)                    | Keep block alive              |
| Yield → energy      | Real yield restores energy (when implemented) | Real yield matters eventually |

**Visual states:**

| Energy | Look                       | Name                 |
| ------ | -------------------------- | -------------------- |
| 80-100 | Brilliant glow + particles | **Blazing**          |
| 50-79  | Steady glow                | **Thriving**         |
| 20-49  | Dim, flickering            | **Fading**           |
| 1-19   | Dark, sparking             | **Dying**            |
| 0      | Black/cracked              | **Dead** (claimable) |

### B. Gravity Tax — Simplified Linear

```
Base rate: 1 Energy/tick
Per adjacent owned block: +0.5/tick
Cap: 3x maximum
```

UI shows: **"Burn Rate: 1.5x ⚡"** — simple, clear.

### C. Lighthouse — Visibility = Status

- Brightness = `log(staked_amount) * energy_pct`
- High-stake blocks illuminate neighbors (bloom spillover)
- Small players buy adjacent to whales for "free glow"

### D. Tower Shape (1,000+ blocks)

**Candidate: Layered Cylinder / Hexagonal Tower**

```
Layer 10 (top):    ~20 blocks   ← VIP, ultra-visible
Layer 9:           ~40 blocks
Layer 8:           ~60 blocks
...
Layer 2:           ~140 blocks
Layer 1 (base):    ~160 blocks  ← Most accessible
                   ─────────────
                   ~1,000 blocks total
```

**Shape is flexible** — could be cylinder, hex grid, organic, or something unique. Key constraints:

- Must support 1,000+ blocks
- Must have clear hierarchy (top = exclusive)
- Must look visually stunning from any angle
- Must render at 30+ FPS on Seeker

---

## 5. LOD Strategy (1,000+ blocks on mobile)

Three-tier InstancedMesh system:

| Tier       | Distance     | Detail                                | Instance Count  |
| ---------- | ------------ | ------------------------------------- | --------------- |
| **High**   | < 50 units   | Full geometry, textures, glow effects | ~50-100 blocks  |
| **Medium** | 50-200 units | Simple cube, solid color, no effects  | ~200-400 blocks |
| **Low**    | > 200 units  | Point/billboard, color dot            | ~500-600 blocks |

**Implementation:** Three separate `InstancedMesh` objects. Each frame, blocks are sorted by camera distance and assigned to the appropriate mesh tier. Frustum culling removes off-screen blocks entirely.

**Performance budget on Seeker (Dimensity 7300):**

- Target: 30 FPS stable, 60 FPS preferred
- Max draw calls: ~100-200
- Max triangles: ~50K visible
- InstancedMesh gets this down to 3 draw calls for all blocks

---

## 6. Block Customization Roadmap

### Phase 1 (MVP — this week)

- Color picker (16 curated neon colors)
- Icon/emoji overlay (50+ presets)
- Name tag (short text)

### Phase 2 (Week 2)

- Image upload to block face (accept NSFW risk for now)
- NFT display (pull from user's Solana wallet)

### Phase 3 (Post-MVP)

- **AI-generated textures** via Meshy API (free tier: 100 credits/mo)
  - User types prompt → generates texture → applied to block
  - Fallback: Tripo3D or Hypereal ($0.05-0.10/model)
- **AI-generated 3D models** (replace cube with custom shape)
  - Premium feature for high-tier stakers

---

## 7. On-Chain vs Off-Chain

| Data                 | Location                         | Why                 |
| -------------------- | -------------------------------- | ------------------- |
| Block ownership      | **On-chain** (PDA)               | Trust               |
| Staked amount        | **On-chain** (token account)     | Verifiable          |
| Block position       | **On-chain** (PDA field)         | Tied to ownership   |
| Energy level         | **Off-chain** (Supabase)         | Changes every 4h    |
| Block appearance     | **Off-chain** (Supabase Storage) | Too large for chain |
| Entropy calculations | **Off-chain** (Game Server)      | Real-time logic     |
| Leaderboard          | **Off-chain** (Supabase)         | Derived             |

---

## 8. Simulation Engine

Solo dev on Devnet = need bots to make tower alive.

**Bot types (50-150 simulated):**

- **Holder** — stakes, holds, slowly decays
- **Active** — frequently recharges, stays blazing
- **Whale** — owns cluster, high visibility
- **Abandoned** — staked once, block dying
- **Sniper** — claims dead blocks

**Pre-seed script:** Generates a "lived-in" tower for demos. Runs server-side, writes to Supabase.

---

## 9. Seeker Hardware

| Feature                         | Implementation                                     | Priority |
| ------------------------------- | -------------------------------------------------- | -------- |
| **Seed Vault**                  | MWA handles transparently                          | MVP      |
| **Action Button** (short press) | Sonar Pulse — visual ripple revealing dying blocks | MVP      |
| **Action Button** (long press)  | Block info overlay                                 | MVP      |
| **Camera/AR**                   | Tabletop AR                                        | Post-MVP |

---

## 10. Real-time Architecture

```
┌─────────┐     WebSocket      ┌──────────────┐
│  Mobile  │◄──────────────────►│  Game Server │
│   App    │                    │  (Colyseus)  │
│          │                    │              │
│  R3F     │  REST/Realtime     │  Entropy     │
│  Scene   │◄──────────────────►│  Engine      │
└─────┬────┘                    │              │
      │                         │  Simulation  │
      │ MWA                     │  Bots        │
      ▼                         └──────┬───────┘
┌──────────┐                           │
│  Solana  │                    ┌──────▼───────┐
│  Devnet  │◄───────────────────│  Supabase    │
└──────────┘                    │  (DB + RT)   │
                                └──────────────┘
```

---

## 11. Development Phases

| Phase | Focus | Deliverable |
| ----- | ----- | ----------- |
| **Foundation** | Monorepo scaffold, R3F, InstancedMesh, MWA + Anchor | 3D tower with on-chain staking |
| **Core Loop** | Charge system, decay, streaks, visual states, Supabase | Playable game loop |
| **Multiplayer** | Colyseus server, bot simulation, real-time sync | Living tower with 650+ blocks |
| **Social** | Poke mechanic, Tapestry profiles, Blinks, SOAR | Social engagement layer |
| **Polish** | Design system, onboarding, SFX, haptics, customization | Polished user experience |
| **Next** | AI textures, real yield integration, token economy | Platform expansion |

---

## 12. Risks (Accepted)

| Risk                      | Severity | Stance                                   |
| ------------------------- | -------- | ---------------------------------------- |
| R3F performance on Seeker | HIGH     | Test Day 1, LOD mitigates                |
| Anchor program complexity | HIGH     | Keep minimal, expand iteratively         |
| Solo dev scope            | HIGH     | Simulation fills gaps, mock aggressively |
| expo-gl version mismatch  | MEDIUM   | Use `npx expo install`, test early       |
| NSFW user content         | MEDIUM   | Accept for now, filter later             |
| WebSocket server hosting  | LOW      | Free tier Fly.io or Railway              |

---

## 13. Agentic Integration (New)

> **"The Monolith is for humans. The API is for agents."**

Agents (autonomous AI entities) can participate in the economy without rendering the 3D world. They interact directly with the Game Server via REST endpoints.

### Agentic Capabilities

1.  **Read State**: Query tower status, find open spots, check energy levels.
2.  **Act**: Claim blocks, stake funds, recharge energy.
3.  **Generate**: Create 3D models/textures via image generation APIs and upload to blocks.

### API Endpoints (Planned)

| Method | Endpoint                    | Purpose                         |
| ------ | --------------------------- | ------------------------------- |
| `GET`  | `/api/tower/snapshot`       | Full tower state (JSON)         |
| `GET`  | `/api/blocks/{id}`          | Specific block details          |
| `POST` | `/api/blocks/{id}/claim`    | Stake & claim a block           |
| `POST` | `/api/blocks/{id}/recharge` | Boost energy                    |
| `POST` | `/api/blocks/{id}/texture`  | Upload AI-generated texture URL |

**Why separate?**

- **Performance**: Agents don't need WebGL.
- **Scale**: Thousands of agents can play via lightweight API calls.
- **Economy**: Agents drive demand for the $MONOLITH economy.
