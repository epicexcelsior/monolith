# Monolith — Project Context

> **Living state document.** Auto-updated by `/wrapup` workflow.
> **Last updated:** 2026-02-25

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
- Block customization (color, emoji, name, style, textureId) — fully networked + persisted
- Bot simulation (21 personas, 6 archetypes, ~450 blocks, denser energy distribution)
- Colyseus multiplayer (server-authoritative, JSON messages, Railway)
- Interactive onboarding (stakes-first: "yours to keep — or lose" → claim → color → reveal with decay warning)
- 4 new animated block styles (Lava, Aurora, Crystal, Nature — GLSL, styles 7-10)
- Demo mode XP feedback (claim 100/300xp, charge 25xp, customize 10xp — offline-first)
- Liquid glass UI design system (solarpunk palette)
- **Supabase persistence** (blocks, players, events — hosted, migration applied)
- **XP / level system** (claim=100xp, charge=25xp, combo up to 3x, 10 levels)
- **FloatingPoints** ("+25 XP" animation after actions)
- **LevelUpCelebration** (full-screen overlay + haptic on level-up)
- **XPBar** (progress bar in settings + block inspector)
- **ActivityTicker** (real-time event feed on tower HUD)
- **ConnectionBanner** (connecting/reconnecting/offline states)
- **ErrorBoundary** (crash recovery wrapper)
- **Faucet screen** (SOL airdrop + USDC faucet link from Me tab)
- **Charge pulse animation** (blue-white flash on tower when someone charges)
- **Dormant block reclaim** ("RECLAIM" CTA on blocks at 0 energy 3+ days)
- **Sound effects + haptics** (12 sounds, A Dorian crystal identity, wired to all interactions — needs native rebuild)
- **Tappable leaderboard** (tap entry → camera flies to block)
- **XP leaderboard tab** (owners + XP tabs on Board screen)
- **Real activity feed on Board tab** (fetches from /api/events, fallback to generated)
- **Poke mechanic** (tap opponent's block → poke, 30s cooldown, server-validated, push notification)
- **Username system** (set display name, persisted to Supabase, shown on blocks + leaderboard)
- **My Blocks panel** (bottom sheet listing owned blocks, tap to fly camera)
- **Push notifications** (hourly decay check, poke alerts — server handler + expo-notifications)
- **HotBlockTicker** (bottom-left pills for claimable/fading/streak blocks, tap to inspect)
- **AchievementToast** (7 achievements, persisted to SecureStore, slide-in toast)
- **Settings polish** (haptics toggle, username display, replay onboarding)
- **UI overhaul** — tower reveal animation, FloatingNav pills (replaced tab bar), TopHUD, BoardSheet/SettingsSheet bottom panels, WalletConnectSheet card, LiveActivityTicker with poke-random, BlockInspector split into sub-components, swipe-to-dismiss everywhere, dead code cleanup
- **EAS Update / OTA** (expo-updates configured, channel: preview)
- **Ownership enforcement** (can't charge/customize another player's block)
- **REST endpoints** (GET /api/events, GET /api/leaderboard)
- **Server hardening** (try/catch all handlers, error messages to client)

### Mocked / Stubbed
- Activity feed on Board tab falls back to generated data when server has no events

### Not Started
- Guided onboarding camera flight
- Demo video / pitch deck — **Remotion system built** (`apps/video/`), 23s ShowcaseDemo renders
- Gravity Tax implementation
- Lighthouse glow radius mechanic

---

## File Map

### 3D Tower
| File | Purpose |
|------|---------|
| `apps/mobile/components/tower/TowerScene.tsx` | Camera rig, gestures, scene orchestration |
| `apps/mobile/components/tower/TowerGrid.tsx` | InstancedMesh block rendering + claim/charge flash animations |
| `apps/mobile/components/tower/BlockShader.ts` | Custom GLSL shader (AO, SSS, specular, windows) |
| `apps/mobile/components/tower/TowerCore.tsx` | Top-level R3F Canvas wrapper |
| `apps/mobile/components/tower/Foundation.tsx` | Ground plane / base geometry |
| `apps/mobile/components/tower/Particles.tsx` | Ambient particle effects |

### UI Components
| File | Purpose |
|------|---------|
| `apps/mobile/components/ui/BlockInspector.tsx` | Selected block detail panel orchestrator (sub-components in inspector/) |
| `apps/mobile/components/inspector/InspectorHeader.tsx` | Block emoji + name + state badge |
| `apps/mobile/components/inspector/InspectorActions.tsx` | CTA buttons (Claim/Charge/Poke/Reclaim) |
| `apps/mobile/components/inspector/InspectorCustomize.tsx` | Color/emoji/style/name editor |
| `apps/mobile/components/inspector/InspectorStats.tsx` | Energy bar + streak stats |
| `apps/mobile/components/ui/FloatingNav.tsx` | Bottom pill nav (Tower/Board/Me) — replaces tab bar |
| `apps/mobile/components/ui/TopHUD.tsx` | Minimal top bar (MONOLITH + wallet pill) |
| `apps/mobile/components/ui/BoardSheet.tsx` | Board bottom sheet (wraps BoardContent) |
| `apps/mobile/components/ui/SettingsSheet.tsx` | Settings bottom sheet (wraps SettingsContent) |
| `apps/mobile/components/ui/WalletConnectSheet.tsx` | Wallet connect card (BottomPanel) |
| `apps/mobile/components/ui/LiveActivityTicker.tsx` | Bottom-left activity feed + poke-random pill |
| `apps/mobile/components/ui/BottomPanel.tsx` | Reusable glass slide-up panel with swipe dismiss |
| `apps/mobile/components/board/BoardContent.tsx` | Leaderboard + activity feed content |
| `apps/mobile/components/settings/SettingsContent.tsx` | Profile + settings content |
| `apps/mobile/hooks/useBlockActions.ts` | Block action handlers (claim/charge/poke/customize) |
| `apps/mobile/hooks/useTowerReveal.ts` | Tower build-up reveal animation |
| `apps/mobile/components/ui/LayerIndicator.tsx` | Floor scrubber / layer nav |
| `apps/mobile/components/ui/ClaimModal.tsx` | Block claim confirmation modal |
| `apps/mobile/components/ui/AchievementToast.tsx` | Slide-in achievement notifications (7 types) |
| `apps/mobile/components/ui/MyBlocksPanel.tsx` | Bottom sheet listing owned blocks |
| `apps/mobile/components/ui/UsernameModal.tsx` | Set display name modal |
| `apps/mobile/components/ui/ConnectionBanner.tsx` | Connection status indicator |
| `apps/mobile/components/ui/FloatingPoints.tsx` | "+25 XP" floating animation after actions |
| `apps/mobile/components/ui/LevelUpCelebration.tsx` | Full-screen level-up overlay + haptic |
| `apps/mobile/components/ui/XPBar.tsx` | XP progress bar component |
| `apps/mobile/components/ErrorBoundary.tsx` | React error boundary for crash recovery |
| `apps/mobile/components/ui/Button.tsx` | Glass button (4 variants) |
| `apps/mobile/components/ui/Card.tsx` | Glass card container |

### State Management
| File | Purpose |
|------|---------|
| `apps/mobile/stores/tower-store.ts` | Block data, selection, charge, decay loop, recentlyChargedId |
| `apps/mobile/stores/multiplayer-store.ts` | Colyseus connection, state sync, recentEvents, chargesToday |
| `apps/mobile/stores/player-store.ts` | XP, level, combo, lastPointsEarned, levelUp state |
| `apps/mobile/stores/wallet-store.ts` | Wallet connection + balance |
| `apps/mobile/stores/onboarding-store.ts` | Onboarding flow progress |
| `apps/mobile/stores/poke-store.ts` | Poke cooldown tracking |
| `apps/mobile/stores/achievement-store.ts` | Achievement unlocks (7 types, SecureStore persistence) |
| `apps/mobile/stores/activity-store.ts` | Real-time activity events (wired to multiplayer) |

### Screens (Expo Router)
| File | Purpose |
|------|---------|
| `apps/mobile/app/(tabs)/index.tsx` | Home screen (tower + HUD + FloatingPoints + LevelUp + HotBlockTicker) |
| `apps/mobile/app/(tabs)/blocks.tsx` | Board: leaderboard (tappable) + real activity feed |
| `apps/mobile/app/(tabs)/settings.tsx` | Me tab: XP stats, best streak, faucet button |
| `apps/mobile/app/faucet.tsx` | Devnet faucet (SOL airdrop + USDC link) |
| `apps/mobile/app/connect.tsx` | Wallet connect |
| `apps/mobile/app/deposit.tsx` | USDC deposit |

### Config / Constants
| File | Purpose |
|------|---------|
| `apps/mobile/utils/audio.ts` | Sound system: 18 preloaded WAV players, fire-and-forget API |
| `apps/mobile/docs/SFX.md` | How to swap/add/remove sounds |
| `apps/mobile/utils/haptics.ts` | Named haptic events (all interactions) |
| `apps/mobile/assets/sfx/` | WAV files: 3 Kenney CC0 + 9 synthesized (A Dorian palette) |
| `scripts/generate-sounds.js` | Node.js WAV synthesizer — re-run to regenerate hero sounds |
| `apps/mobile/constants/theme.ts` | Colors, glass styles, typography |
| `apps/mobile/constants/network.ts` | GAME_SERVER_URL from env |
| `apps/mobile/app.json` | EAS project config, expo-updates URL |
| `apps/mobile/eas.json` | Build profiles (dev/preview/prod) + Supabase env vars |

### Game Server
| File | Purpose |
|------|---------|
| `apps/server/src/index.ts` | Colyseus server entrypoint + REST endpoints |
| `apps/server/src/rooms/TowerRoom.ts` | Game room: claims, decay, XP, persistence, ownership enforcement |
| `apps/server/src/utils/supabase.ts` | Supabase client + CRUD helpers (fire-and-forget writes) |
| `apps/server/src/utils/xp.ts` | XP computation, level thresholds, combo tracking |
| `apps/server/src/utils/notifications.ts` | Push notification helpers (Expo push API) |

### Shared Package
| File | Purpose |
|------|---------|
| `packages/common/src/layout.ts` | Tower geometry / block position math |
| `packages/common/src/constants.ts` | Shared tower dimensions, limits |
| `packages/common/src/types.ts` | Shared TypeScript types (ClaimMessage, ChargeMessage, ActivityEvent) |

### Database
| File | Purpose |
|------|---------|
| `supabase/migrations/001_initial.sql` | Schema: blocks, players, events + RLS policies |
| `supabase/migrations/002_push_tokens.sql` | Push notification token storage |
| `supabase/migrations/003_player_username.sql` | Username column on players table |
| `supabase/config.toml` | Supabase CLI config (linked to project pscgsbdznfitscxflxrm) |

### Anchor Program
| File | Purpose |
|------|---------|
| `programs/monolith/src/lib.rs` | Instructions (claim, charge, deposit, withdraw) |
| `programs/monolith/src/state.rs` | On-chain account structures |

---

## Data Flow

```
User gesture → TowerScene.tsx (camera)
Block tap → TowerGrid.tsx (raycast) → tower-store.ts (select) → BlockInspector.tsx (UI)
Claim/Charge → multiplayer-store.ts → Colyseus room.send() → TowerRoom.ts (server)
  → XP computed → updatePlayerXp() → Supabase players table
  → insertEvent() → Supabase events table
  → upsertBlock() → Supabase blocks table
  → charge_result/claim_result → BlockInspector → player-store → FloatingPoints/LevelUp
Server mutation → room.broadcast("block_update", { eventType }) → multiplayer-store.ts
  → tower-store.ts → TowerGrid re-render (claim flash gold / charge flash blue-white)
  → recentEvents → activity-store → HotBlockTicker / Board tab
Position math → @monolith/common/layout.ts (shared) → positionCache (client-side Map)
USDC deposit → useAnchorProgram.ts → MWA transact() → Anchor program (on-chain)
```

---

## Gotchas & Critical Patterns

1. **Tab bar hidden** — `tabBar: () => null` in _layout.tsx. FloatingNav replaces it. Bottom-anchored UI uses `insets.bottom` only (no +60 offset)
2. **Custom shaders = no R3F lights** — every mesh uses ShaderMaterial, R3F light components have zero effect
3. **Never use `transparent: true` on InstancedMesh** — 650 instances + alpha sorting kills perf
4. **Elevation coordinate system**: `0 = directly above, π/2 = horizontal` (not intuitive)
5. **pnpm strict isolation** — must declare ALL imported packages as direct deps (even transitive)
6. **Position source of truth** — always from `positionCache` (computed from `@monolith/common`), never from server block data
7. **MWA auth tokens expire** — every `reauthorize()` path MUST fallback to `authorize()`
8. **Colyseus uses JSON messages** — NOT schema auto-sync (version mismatch breaks silently)
9. **Azimuth grows unbounded** — use `nearestAzimuth()` for programmatic changes, never normalize
10. **tsc hangs in monorepo** — always wrap with `timeout 90`
11. **Supabase writes are fire-and-forget** — `upsertBlock`, `updatePlayerXp`, `insertEvent` return `void`, not `Promise`. Don't `await` them.
12. **Supabase uses service role key on server** — the anon/publishable key (`sb_publishable_...`) is for mobile only. Server needs `eyJ...` service role key.
13. **`mpConnected` includes reconnecting guard** — `connected && !reconnecting`. Never use raw `connected` for action routing in BlockInspector.
14. **Android physical device can't reach `localhost`** — use `adb reverse tcp:2567 tcp:2567` over USB, or LAN IP, or prod URL.
15. **Supabase lazy init** — client initializes on first TowerRoom.onCreate(), not at server startup. Now also eagerly inits + verifies at server start.
16. **mediump uTime precision** — fragment shaders use `precision mediump float` for 2x GPU throughput, but `uTime` grows unboundedly. After ~10 min, `sin(uTime * N)` returns garbage on float16. All `uTime` uniforms MUST use `uniform highp float uTime;` override.
17. **expo-audio loop bug** — calling `seekTo(0)` on a `didJustFinish` player triggers auto-play → infinite loop. Pattern: `player.seekTo(0).catch(()=>{})` then `player.play()` fire-and-forget. No listeners.
18. **No `new` in useFrame** — `new THREE.Color()`, `.clone()`, `new Float32Array()` inside per-frame callbacks create GC pressure. Pre-allocate in `useRef` and use `.set()`/`.copy()`.

---

## Environment Setup

### Mobile env files
| File | Used when | Server target |
|------|-----------|---------------|
| `.env` | `npx expo start` (Expo Go / bare) | LAN IP (`ws://192.168.1.21:2567`) |
| `.env.local` | Overrides `.env` — current active | LAN IP (`ws://192.168.1.21:2567`) |
| `eas.json` | EAS builds (preview/prod APK) | prod Railway (`wss://...railway.app`) |

### Server env (apps/server/.env — gitignored)
```
SUPABASE_URL=https://pscgsbdznfitscxflxrm.supabase.co
SUPABASE_SERVICE_KEY=eyJ...   ← service_role key from Supabase dashboard
```

### Local dev with physical Android device
```bash
./dev.sh                         # One command: adb reverse + server + Expo
# OR manually:
adb reverse tcp:2567 tcp:2567   # forward device → laptop
cd apps/server && pnpm dev       # start local server
cd apps/mobile && npx expo start --dev-client
```

---

## Common Tasks

### Test
```bash
cd apps/mobile && npx jest              # 220 tests, 18 suites
cd apps/server && npx jest              # 84 tests, 6 suites
```

### Typecheck
```bash
timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json
cd apps/server && npx tsc --noEmit
```

### Run (dev)
```bash
cd apps/mobile && npx expo start --dev-client
```

### Deploy server
```bash
git push origin main   # Railway auto-deploys (~2 min)
# Server URL: wss://monolith-server-production.up.railway.app
```

### OTA update (no APK rebuild)
```bash
cd apps/mobile && eas update --branch preview --message "description"
```

### Apply DB migration
```bash
npx supabase db push   # linked to pscgsbdznfitscxflxrm
```

---

## System Dependencies (Change X → Must Update Y)

| If you change... | Also update... |
|---|---|
| `packages/common/layout.ts` | Rebuild `positionCache` in `multiplayer-store.ts` |
| `BlockShader.ts` uniforms | Uniform assignments in `TowerGrid.tsx` |
| Block data shape / types | `tower-store.ts`, `multiplayer-store.ts`, `TowerRoom.ts`, `types.ts` |
| Camera config values | `CameraConfig.ts` + test expectations in `__tests__/` |
| FloatingNav visibility in `index.tsx` | Add new sheets/overlays to `!showX` condition |
| Tower dimensions in `constants.ts` | Both client and server use this — redeploy server too |
| `TowerRoom.ts` message format | Client handlers in `multiplayer-store.ts` |
| `supabase/migrations/` | Run `npx supabase db push` to apply to hosted DB |
| Supabase table schema | Update `BlockRow` / `PlayerRow` interfaces in `supabase.ts` |

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
| `docs/TESTER_GUIDE.md` | Tester onboarding: install, get tokens, how to play |
| `docs/TESTING.md` | Developer testing guide: local setup, feature checklist |
| `apps/video/GUIDE.md` | **Content engine guide** — how to make marketing videos with Remotion + real tower |

---

## Recent Changes

- **2026-02-25**: UI overhaul — tower reveal animation (bottom→top build + camera sweep), FloatingNav pills (replaced tab bar), TopHUD minimal top bar, Board/Settings/Wallet as bottom sheets over tower, BlockInspector split into sub-components (inspector/), LiveActivityTicker with poke-random-block, swipe-to-dismiss on all panels, double SFX fix, dead code cleanup, SFX doc. 220 tests passing.
- **2026-02-25**: Tower perf optimizations — dirty-flag decayTick (in-place mutate, no 650 object spreads), idle loop skip for fade/highlight/pop-out (near-zero useFrame cost when idle), single-block matrix restore (not 650), splice→filter for charge flash, removed `transparent:true` from glow material, delta cap on TowerCore, mediump shaders for Foundation+Particles (~2x Adreno throughput)
- **2026-02-24**: Pre-testing sprint merged to main — poke mechanic, username system, My Blocks panel, XP leaderboard, push notifications, achievements, HotBlockTicker, settings polish, onboarding copy update, dormant reclaim tests, dev.sh path fix. Removed redundant ActivityTicker/ActivityFeed overlays. 304 tests (220 mobile + 84 server).
- **2026-02-23**: Sound effects — 12-sound A Dorian crystal palette, zero-latency engine (seekTo+play fire-and-forget), expo-audio plugin linked, wired to every interaction including layer scrubber + panel open; mute toggle in settings
- **2026-02-23**: Onboarding v2 — stakes messaging ("yours to keep or lose", decay warning, miss-3-days reclaim), full-screen dark scrim contrast, step dots, animated entrances; fixed customize XP callback (was silent-dropped); demo mode XP (claim 100/300xp, charge 25xp, customize 10xp); removed dead stepIndex variable
- **2026-02-21**: Demo sprint "aha moment" — stakes-first onboarding rewrite, 4 new GLSL block styles (Lava/Aurora/Crystal/Nature), demo mode XP, brighter bot population, customize XP callback fix, stronger text contrast
- **2026-02-21**: Remotion content engine — 23s ShowcaseDemo video w/ real GLSL shaders, globalShowcasePath (no transition glitches), camera lerp, beat-sync music, text overlays, `apps/video/GUIDE.md` doc
- **2026-02-21**: Full "alive game" feature set — XP/levels, Supabase persistence, ActivityTicker, ConnectionBanner, LevelUpCelebration, FloatingPoints, XPBar, faucet, dormant reclaim, charge flash, tappable leaderboard, OTA config, ErrorBoundary (204 tests)
- **2026-02-19**: Documentation system overhaul (CONTEXT.md, CLAUDE.md, topic-indexed LESSONS.md)
- **2026-02-18**: Interior-mapped image windows with 3D parallax depth
- **2026-02-18**: Fixed BlockInspector panel visibility above tab bar
- **2026-02-17**: Colyseus multiplayer fully working (JSON messages, Railway deploy)
- **2026-02-16**: Camera system overhaul (dramatic side-on view, clean gesture model)
- **2026-02-16**: Bot simulation (21 personas, 6 archetypes)
