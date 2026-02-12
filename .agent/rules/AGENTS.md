# AGENTS.md — Agent Onboarding Guide

> **Audience:** AI coding agents. Read this first when dropped into this repo.

## Project in One Sentence

**The Monolith** is a multiplayer 3D staking game on Solana — stake crypto, own a glowing block on a massive shared tower, compete for status. Think r/Place meets DeFi, in 3D, on mobile.

## Environment

| Item           | Detail                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------ |
| **OS**         | Windows (WSL2 → Ubuntu) — agent tools run from Windows but the repo lives in WSL at `~/monolith` |
| **Runtime**    | Node ≥22, pnpm 10 (hoisted mode — see `.npmrc`)                                                  |
| **Platform**   | Android-only mobile app, tested on **physical Solana Seeker device** via Android Studio + ADB    |
| **Blockchain** | Solana Devnet, smart contracts in **Rust** (Anchor framework)                                    |
| **Build**      | Expo SDK 54 with `expo-dev-client` (NOT Expo Go — native modules required)                       |

> ⚠️ **WSL gotcha:** The repo is at `\\wsl.localhost\Ubuntu\home\epic\monolith` from Windows, but `/home/epic/monolith` from WSL. All build commands run inside WSL. ADB and Android Studio run from Windows. Be aware of path translation between the two.

> ⚠️ **Solana + Rust:** The `programs/monolith/` directory contains Anchor/Rust code. Do NOT assume JavaScript tooling works here — use `anchor build`, `anchor test`, etc. Rust toolchain must be installed in WSL.

## Tech Stack

| Layer          | Technology                                                 |
| -------------- | ---------------------------------------------------------- |
| Mobile app     | Expo 54, React Native 0.81, React 19, Expo Router          |
| 3D rendering   | React Three Fiber v9, Three.js 0.170, expo-gl              |
| Wallet         | Solana Mobile Wallet Adapter (MWA) → Seed Vault            |
| Smart contract | Anchor (Rust), deployed on Devnet                          |
| State          | Zustand                                                    |
| Backend        | Supabase (DB + realtime), Game Server (Colyseus/WebSocket) |
| Monorepo       | pnpm workspaces, hoisted `node_modules`                    |

## Monorepo Layout

```
monolith/
├── apps/
│   ├── mobile/          # Expo React Native app (the product)
│   │   ├── app/         # Expo Router screens
│   │   ├── components/  # React + R3F components
│   │   ├── services/    # Solana, Supabase clients
│   │   ├── stores/      # Zustand stores
│   │   └── constants/   # Theme, config
│   └── server/          # Game server (Colyseus/WebSocket)
│       └── src/         # Rooms, simulation, entropy
├── packages/
│   └── common/          # Shared types, constants, utils
├── programs/
│   └── monolith/        # Anchor Solana program (Rust)
├── docs/                # Deep docs (ARCHITECTURE, SOLANA_MOBILE, LESSONS, etc.)
└── .agent/              # Agent skills & workflows
```

## Quick Commands

```bash
# From monorepo root (inside WSL)
pnpm install                              # Install all deps
pnpm mobile                               # Start Metro bundler
pnpm mobile:android                       # Build & run on connected device

# From apps/mobile/
npx expo start --dev-client --localhost    # Dev server with hot reload
npx expo run:android                      # Build debug APK + install
npx expo prebuild --platform android --clean  # Regenerate native project

# EAS (cloud builds)
eas build --profile preview --platform android

# Anchor (from programs/monolith/, in WSL)
anchor build
anchor test
anchor deploy
```

## Key Conventions

- **Package names:** `@monolith/mobile`, `@monolith/server`, `@monolith/common`
- **Routing:** File-based via Expo Router (`app/` directory)
- **State:** One Zustand store per domain (e.g., `stores/gameStore.ts`)
- **Secrets:** Never commit. Use `.env` files (see `.env.example`)
- **Native modules:** Always use `expo-dev-client`, never Expo Go
- **Device testing:** Debug APK on physical device is the primary workflow. Release builds are for CI/CD only.

## Testing Strategy

### Current: Manual on Physical Device

Build debug APK → install via ADB → test on Solana Seeker device.

### Future: Automated E2E via Maestro

[Maestro](https://maestro.mobile.dev/) is the recommended path for agent-driven E2E testing:

- Tests are written in **simple YAML** — perfect for AI agents to generate and iterate on
- Runs on real devices and emulators
- Can tap, swipe, assert text, take screenshots — full UI automation
- No app code changes required (uses accessibility layer)
- Agents can: write tests → run them → read output → fix bugs → re-run, fully autonomously

This unlocks a workflow where AI agents can **own the full test-debug loop** without human intervention for UI testing.

## Deep Docs

| Document                                  | What's Inside                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)   | Full design bible — game mechanics, on-chain vs off-chain, LOD strategy, real-time architecture |
| [SOLANA_MOBILE.md](docs/SOLANA_MOBILE.md) | MWA integration, wallet adapter pattern, Seed Vault details                                     |
| [SETUP.md](docs/SETUP.md)                 | Developer environment setup                                                                     |
| [LESSONS.md](docs/LESSONS.md)             | Battle-tested gotchas & lessons learned (regularly updated)                                     |
| [APK_INSTALL.md](docs/APK_INSTALL.md)     | How to install APKs on device                                                                   |
