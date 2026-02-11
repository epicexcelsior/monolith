# The Monolith — Developer Setup Guide

> Quick reference for getting started with the monorepo.

## Prerequisites

- Node.js ≥ 22
- pnpm ≥ 10
- Android device or emulator (for mobile testing)
- Expo Go app (for quick testing) or EAS dev client

## Install & Run

```bash
# From repository root
pnpm install

# Start mobile dev server
pnpm dev:mobile
# OR from apps/mobile:
npx expo start

# Start game server
pnpm dev:server
```

## Monorepo Structure

```
monolith/
├── apps/mobile/      # Expo 54 + R3F app (Android/Seeker)
├── apps/server/      # Colyseus game server (Node.js)
├── packages/common/  # Shared types & constants
├── programs/monolith/ # Anchor smart contract (Solana)
└── docs/             # Architecture bible + guides
```

## Key Files

| File                                          | Purpose                            |
| --------------------------------------------- | ---------------------------------- |
| `apps/mobile/index.js`                        | Entry point — polyfills load first |
| `apps/mobile/app/_layout.tsx`                 | Root layout + providers            |
| `apps/mobile/app/(tabs)/index.tsx`            | Tower 3D screen                    |
| `apps/mobile/components/tower/TowerScene.tsx` | R3F Canvas                         |
| `apps/mobile/components/tower/TowerGrid.tsx`  | InstancedMesh (1000 blocks)        |
| `apps/mobile/stores/tower-store.ts`           | Zustand state                      |
| `packages/common/src/types.ts`                | Shared game types                  |
| `packages/common/src/constants.ts`            | Game constants & balance           |

## Environment

Copy `.env.example` to `.env` in `apps/mobile/`:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

## Building for Seeker

```bash
cd apps/mobile
# Preview APK (fastest)
eas build --profile preview --platform android
# Dev client build (with dev tools)
eas build --profile development --platform android
```

## Network

- **Devnet** by default
- RPC: `https://api.devnet.solana.com`
- Game Server: `ws://localhost:2567`
