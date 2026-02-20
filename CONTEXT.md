# Monolith — Project Context

> **Living state document.** Auto-updated by `/wrapup` workflow.
> **Last updated:** 2026-02-19

## What Is This?

The Monolith is **r/Place meets DeFi in 3D**. Stake USDC, claim a glowing block on a shared tower, customize it, compete for status. Solana Seeker native, hackathon deadline March 9, 2026.

**Solo dev** | Expo 54 + React Native + R3F + Anchor | Colyseus multiplayer on Railway

---

## Current State

### Working
- 3D tower rendering (650 blocks, InstancedMesh, 60 FPS)
- Interior-mapped image windows (parallax depth on 4 vertical faces)
- Additive interior glow (warm amber "keeper of the flame")
- Advanced block shader (AO, SSS, GGX specular, uplight bounce)
- Camera system (orbit + vertical pan + scrubber + block inspect)
- MWA wallet connect (Seed Vault / Phantom)
- On-chain USDC vault (deposit / withdraw, devnet)
- Charge system (decay + daily tap + streaks 1x-3x)
- Block customization (color, emoji, name)
- Bot simulation (21 personas, 6 archetypes, ~450 blocks)
- Colyseus multiplayer (server-authoritative, JSON messages, Railway)
- Interactive onboarding (3-phase: title reveal → ghost claim → charge → CTA)
- Liquid glass UI design system (solarpunk palette)

### Mocked / Stubbed
- Leaderboard tabs (shows `generateMockLeaderboard()`)
- Activity feed (hardcoded `MOCK_ACTIVITY`)
- Supabase client (imported but unused)

### Not Started
- Push notifications
- Dormant block reclaim mechanic (blocks at 0 charge for 3+ days → claimable)
- Sound effects wired to interactions
- Poke system (social re-engagement)
- Guided onboarding camera flight
- Demo video / pitch deck

---

## File Map

### 3D Tower
| File | Purpose |
|------|---------|
| `apps/mobile/components/tower/TowerScene.tsx` | Camera rig, gestures, scene orchestration |
| `apps/mobile/components/tower/TowerGrid.tsx` | InstancedMesh block rendering loop |
| `apps/mobile/components/tower/BlockShader.ts` | Custom GLSL shader (AO, SSS, specular, windows) |
| `apps/mobile/components/tower/TowerCore.tsx` | Top-level R3F Canvas wrapper |
| `apps/mobile/components/tower/Foundation.tsx` | Ground plane / base geometry |
| `apps/mobile/components/tower/Particles.tsx` | Ambient particle effects |

### UI Components
| File | Purpose |
|------|---------|
| `apps/mobile/components/ui/BlockInspector.tsx` | Selected block detail panel |
| `apps/mobile/components/ui/LayerIndicator.tsx` | Floor scrubber / layer nav |
| `apps/mobile/components/ui/ClaimModal.tsx` | Block claim confirmation modal |
| `apps/mobile/components/ui/BottomPanel.tsx` | Slide-up glass bottom sheet |
| `apps/mobile/components/ui/Button.tsx` | Glass button (4 variants) |
| `apps/mobile/components/ui/Card.tsx` | Glass card container |

### State Management
| File | Purpose |
|------|---------|
| `apps/mobile/stores/tower-store.ts` | Block data, selection, charge, decay loop |
| `apps/mobile/stores/multiplayer-store.ts` | Colyseus connection, state sync, position cache |
| `apps/mobile/stores/wallet-store.ts` | Wallet connection + balance |
| `apps/mobile/stores/onboarding-store.ts` | Onboarding flow progress |

### Hooks
| File | Purpose |
|------|---------|
| `apps/mobile/hooks/useAuthorization.ts` | MWA authorization flow |
| `apps/mobile/hooks/useAnchorProgram.ts` | Anchor program + USDC vault transactions |
| `apps/mobile/hooks/useStaking.ts` | USDC deposit/withdraw |

### Screens (Expo Router)
| File | Purpose |
|------|---------|
| `apps/mobile/app/(tabs)/index.tsx` | Home screen (tower view) |
| `apps/mobile/app/(tabs)/blocks.tsx` | Block list / management |
| `apps/mobile/app/(tabs)/settings.tsx` | Settings |
| `apps/mobile/app/connect.tsx` | Wallet connect |
| `apps/mobile/app/deposit.tsx` | USDC deposit |

### Config
| File | Purpose |
|------|---------|
| `apps/mobile/constants/CameraConfig.ts` | Camera limits, zoom, elevation values |
| `apps/mobile/constants/theme.ts` | Colors, glass styles, typography |

### Game Server
| File | Purpose |
|------|---------|
| `apps/server/src/index.ts` | Colyseus server entrypoint |
| `apps/server/src/rooms/TowerRoom.ts` | Game room: claims, decay, bot sim |

### Shared Package
| File | Purpose |
|------|---------|
| `packages/common/src/layout.ts` | Tower geometry / block position math |
| `packages/common/src/constants.ts` | Shared tower dimensions, limits |
| `packages/common/src/types.ts` | Shared TypeScript types |

### Anchor Program
| File | Purpose |
|------|---------|
| `programs/monolith/src/lib.rs` | Instructions (claim, charge, deposit, withdraw) |
| `programs/monolith/src/state.rs` | On-chain account structures |
| `programs/monolith/src/error.rs` | Custom program error codes |

---

## Data Flow

```
User gesture → TowerScene.tsx (camera)
Block tap → TowerGrid.tsx (raycast) → tower-store.ts (select) → BlockInspector.tsx (UI)
Claim/Charge → multiplayer-store.ts → Colyseus room.send() → TowerRoom.ts (server)
Server mutation → room.broadcast("block_update") → multiplayer-store.ts → tower-store.ts → TowerGrid re-render
Position math → @monolith/common/layout.ts (shared) → positionCache (client-side Map)
USDC deposit → useAnchorProgram.ts → MWA transact() → Anchor program (on-chain)
```

---

## Gotchas & Critical Patterns

1. **Tab bar is `position: absolute`** — ALL bottom-anchored UI must offset by `60 + insets.bottom`
2. **Custom shaders = no R3F lights** — every mesh uses ShaderMaterial, R3F light components have zero effect
3. **Never use `transparent: true` on InstancedMesh** — 650 instances + alpha sorting kills perf
4. **Elevation coordinate system**: `0 = directly above, π/2 = horizontal` (not intuitive)
5. **pnpm strict isolation** — must declare ALL imported packages as direct deps (even transitive)
6. **Position source of truth** — always from `positionCache` (computed from `@monolith/common`), never from server block data
7. **MWA auth tokens expire** — every `reauthorize()` path MUST fallback to `authorize()`
8. **Colyseus uses JSON messages** — NOT schema auto-sync (version mismatch breaks silently)
9. **Azimuth grows unbounded** — use `nearestAzimuth()` for programmatic changes, never normalize
10. **tsc hangs in monorepo** — always wrap with `timeout 90`

---

## Common Tasks

### Test
```bash
cd apps/mobile && npx jest              # 165 tests, 0 failing
```

### Typecheck
```bash
# Mobile (always use timeout)
timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json
# Server
cd apps/server && npx tsc --noEmit
```

### Run (dev)
```bash
cd apps/mobile && npx expo start --dev-client
```

### Deploy server
```bash
git push origin main   # Railway auto-deploys
# Server URL: wss://monolith-server-production.up.railway.app
```

---

## System Dependencies (Change X → Must Update Y)

| If you change... | Also update... |
|---|---|
| `packages/common/layout.ts` | Rebuild `positionCache` in `multiplayer-store.ts` |
| `BlockShader.ts` uniforms | Uniform assignments in `TowerGrid.tsx` |
| Block data shape / types | `tower-store.ts`, `multiplayer-store.ts`, `TowerRoom.ts`, `types.ts` |
| Camera config values | `CameraConfig.ts` + test expectations in `__tests__/` |
| Tab bar height in `_layout.tsx` | All bottom-anchored UI (BlockInspector, BottomPanel, etc.) |
| Tower dimensions in `constants.ts` | Both client and server use this — redeploy server too |
| `TowerRoom.ts` message format | Client handlers in `multiplayer-store.ts` |

---

## Docs Map

| Doc | What it covers |
|---|---|
| `CONTEXT.md` | **This file** — current state, file map, tasks |
| `CLAUDE.md` | Agent instructions (auto-loaded by Claude Code) |
| `docs/LESSONS.md` | Technical lessons indexed by topic |
| `docs/ARCHITECTURE.md` | System design, tech decisions, game mechanics |
| `docs/game-design/GDD.md` | Game Design Document (canonical) |
| `docs/design/UI_SYSTEM.md` | Solarpunk design system spec |
| `docs/MULTIPLAYER_DEPLOYMENT.md` | Colyseus + Railway setup |
| `AGENTS.md` | Legacy lessons (being merged into LESSONS.md) |
| `mvp_roadmap.md` | Original roadmap (see Current State above for latest) |

---

## Recent Changes

- **2026-02-19**: Documentation system overhaul (CONTEXT.md, CLAUDE.md, topic-indexed LESSONS.md, workflow updates)
- **2026-02-18**: Interior-mapped image windows with 3D parallax depth
- **2026-02-18**: Fixed BlockInspector panel visibility above tab bar
- **2026-02-18**: Shader validation checklist in `/wrapup` workflow
- **2026-02-17**: Colyseus multiplayer fully working (JSON messages, Railway deploy)
- **2026-02-17**: Multiplayer position computation fix (positionCache)
- **2026-02-16**: Camera system overhaul (dramatic side-on view, clean gesture model)
- **2026-02-16**: Bot simulation (21 personas, 6 archetypes)
