# Monolith — Project Context

> **Living state document.** Auto-updated by `/wrapup` workflow.
> **Last updated:** 2026-03-16

## What Is This?

The Monolith is **r/Place meets DeFi in 3D**. Stake USDC, claim a glowing block on a shared tower, customize it, compete for status. Solana Seeker native.

**Solo dev** | Expo 54 + React Native + R3F + Anchor | Colyseus multiplayer on Railway

---

## Current State

### Working
- **3D tower** (650 blocks, InstancedMesh, 60 FPS, advanced GLSL shader: AO/SSS/GGX specular/interior-mapped windows/uplight bounce)
- **Camera system** (orbit + vertical pan + layer scrubber + block inspect + cinematic claim celebration)
- **Charge system** (variable 15-35 energy, weighted quality brackets normal/good/great, streak 1x-3x multiplier, quality-aware 3D flash + squash-and-stretch bounce)
- **Block evolution** (5 tiers: Spark→Ember→Flame→Blaze→Beacon — permanent progression via cumulative charges + best streak, GLSL glow/rim/shimmer boost)
- **Block customization** (color, emoji, name, style, textureId — fully networked + persisted, all tiers unlocked for testers)
- **Spark faces** (kawaii SDF faces — energy-driven expressions, adaptive contrast, sleeping on dead, 5 eye x 4 mouth variety via hash, evolution tier progression, tier-aware LOD)
- **Breathing blocks** (energy-tiered aura: blazing/thriving/fading/dying/dead — warm-to-cold tint)
- **4 animated block styles** (Lava, Aurora, Crystal, Nature — GLSL, styles 7-10)
- **Immersive onboarding** (10-phase: cinematic → camera tutorial → title → claim → celebration → customize → charge → poke → wallet → done)
- **XP system** (levels, FloatingPoints, LevelUpCelebration, XPBar, combo up to 3x, 10 levels, demo mode XP)
- **Colyseus multiplayer** (server-authoritative, JSON messages, Railway) + Supabase persistence (blocks, players, events)
- **Wallet + on-chain** (MWA connect, USDC vault deposit/withdraw devnet, layer-based pricing quadratic curve)
- **Bot simulation** (21 personas, 6 archetypes, ~450 blocks)
- **Engagement HUD** (ActivityTicker, HotBlockTicker, ConnectionBanner, ErrorBoundary, AchievementToast)
- **Social features** (poke mechanic with 30s cooldown + push notif, username system, tappable leaderboard, XP leaderboard tab, real activity feed)
- **My Blocks** (FAB + bottom sheet panel, urgency-sorted, Charge All, tap to fly camera)
- **Dormant block reclaim** ("RECLAIM" CTA on blocks at 0 energy 3+ days)
- **Sound effects + haptics** (16 sounds, A Dorian identity, 8.5s tower-rise pad, wired to all interactions)
- **Enhanced share flow** (gold Share button, post-charge nudge, achievement share, ShareCard with evo tier + streak badge)
- **Push notifications** (state-transition triggers: energy<20%, dormant, streak risk — 4h throttle, 3/day cap per wallet)
- **HotBlockTicker** (bottom-right mini-cards for dying/fading/claimable/streak blocks — per-type colors, tap to inspect, 2 cards max, 5s scan)
- **Layer-based pricing** (quadratic curve: Layer 0 = $0.10, Layer 24 = $1.00, tier badges in ClaimModal + InspectorActions)
- **AchievementToast** (22 achievements, persisted to SecureStore, slide-in toast, share button)
- **Breathing blocks** (energy-tiered aura: blazing warm gold pulse, thriving amber, fading anxious flicker, dying cold sparks, dead dark)
- **Spark faces** (kawaii SDF faces on outward-facing side only — energy-driven expressions, adaptive contrast (bioluminescent on dark blocks), sleeping face on dead blocks, programmatic variety (5 eye shapes × 4 mouth styles per block via hash), evolution tier face progression (Spark→Ember→Flame→Blaze→Beacon adds blush/brows/halo), tier-aware LOD (Beacon visible from 54 units, Spark from 38))
- **Loot drop system** (gacha-style cosmetic drops on charge — 43 items across 4 rarity tiers: 12 common colors, 18 rare items, 8 epic, 4 legendary — 35% base drop rate with streak multiplier, full-screen reveal overlay with rarity flash + equip button, client-side inventory persisted to expo-secure-store)
- **Compact inspector** (~280px default, expandable to ~540px — block visible behind panel, smooth spring animation, scroll gating)
- **Evolution celebration dedup** (lastCelebratedTier per block — each tier celebration fires exactly once)
- **Charge quality amplification** (normal/good/great rolls feel dramatically different — flash duration/color spread, haptic intensity, FloatingPoints scale)
- **Unclaimed block warm pulse** (golden 0.6Hz shimmer instead of harsh dark glass — inviting "claim me" lanterns)
- **Spark Dev Panel** (`__DEV__` only: floating panel with energy slider + evolution tier + eye/mouth variant selectors + shuffle button for testing all face variations live)
- **Charge bounce** (squash-and-stretch on charge flash — 0.1s squash → 0.15s stretch → 0.25s settle, volume-preserving, bottom-anchored)
- **Enhanced share flow** (prominent gold Share button for owners, post-charge share nudge 8s pulse, achievement share, improved ShareCard with evo tier + streak badge)
- **Bot-only demo images** (player blocks no longer show Doge/Solana logos — isBotOwner guard)
- **multi_block achievement** ("Empire Builder" — fires when player owns 3+ blocks)
- **Settings polish** (haptics toggle, username display, replay onboarding)
- **UI overhaul** — tower reveal animation, FloatingNav pills (replaced tab bar), TopHUD, BoardSheet/SettingsSheet bottom panels, WalletConnectSheet card, BlockInspector split into sub-components, swipe-to-dismiss everywhere, dead code cleanup
- **EAS Update / OTA** (expo-updates configured, channel: preview)
- **Ownership enforcement** (can't charge/customize another player's block)
- **REST endpoints** (GET /api/events, GET /api/leaderboard, GET /api/tower/blocks)
- **Server hardening** (try/catch all handlers, error messages to client)
- **Tapestry social layer** (on-chain profiles, follow/like/comment, deterministic block content IDs, activity feed tab, comments in inspector, namespace isolation — client-side only, fire-and-forget)
- **Solana Blinks** (shareable poke URLs via memo transactions — dial.to cards, actions.json discovery, Alchemy devnet RPC, swappable via BLINKS_RPC_URL env var, in-game poke effects: block shake/bounce/flash + gold toast + SFX + haptic + push notification)
- **MagicBlock SOAR** (on-chain leaderboard + 7 achievements via `@magicblock-labs/soar-sdk` — fire-and-forget score submission on claim/charge/poke, auto-register on wallet connect via MWA, authority-signed score/achievement txs, feature-flagged `SOAR_ENABLED`, active on devnet)
- **Wallet signature verification** (Ed25519 nonce auth via tweetnacl — server challenges on join, client signs via MWA, write ops require verified wallet)
- **Inspector dark mode** (dark glass theme on 3D background — inspectorBg/inspectorText tokens, gold accents preserved)
- **Celebration tap-to-skip** (LevelUpCelebration + cinematic mode dismissible by tap, 1-2s gate)
- **Camera tutorial** (3-step onboarding coach marks: swipe, pinch, layer scrubber — auto-advance 4s or tap)
- **Ghost blocks (free-to-play)** (claim free on bottom 6 layers — 2x decay, 50 energy cap, 1 per session, upgradeable to staked)
- **Ghost-first onboarding** (wallet optional — "START PLAYING" primary CTA, ghost block path)
- **Neighbor pacts** (bilateral streak bonds — +5 energy when both charge same day, max 2 per block, breaks after 2 consecutive misses)
- **Floor weekly competition** (weekly charge tracking per layer, Monday UTC reset, floor_winner broadcast)
- **Daily quests** (7-quest pool, 3 picked per wallet per day, deterministic hash — charge/poke/customize/streak triggers, XP rewards)
- **Streak freeze** (earned at 7-day milestones, max 2 stored — consumed on gap day to save streak)
- **Weekly events** (Charge Storm 1.5x on odd weeks + Land Rush 50% off on even weeks, Saturday UTC)
- **Progression map** (15 milestones: First Claim → Legend, derived from player/tower stores)
- **Session tracking** (last session timestamp for "While You Were Away" summaries)

### Mocked / Stubbed
- Activity feed on Board tab falls back to generated data when server has no events

### Not Started
- Demo video / pitch deck — **Remotion system built** (`apps/video/`), 23s ShowcaseDemo renders
- Gravity Tax implementation
- Lighthouse glow radius mechanic
- Invite code system (needs Supabase migration)
- While You Were Away modal (store + server done, UI component pending)
- Quest panel UI component
- Progression map UI component
- Floor leaderboard UI component
- Event banner UI component

---

## File Map

### 3D Tower
| File | Purpose |
|------|---------|
| `apps/mobile/components/tower/TowerScene.tsx` | Camera rig, gestures, scene orchestration |
| `apps/mobile/components/tower/TowerGrid.tsx` | InstancedMesh block rendering + claim/charge flash animations |
| `apps/mobile/components/tower/BlockShader.ts` | Custom GLSL shader (AO, SSS, specular, windows) |
| `apps/mobile/components/tower/TowerCore.tsx` | Top-level R3F Canvas wrapper |
| `apps/mobile/components/tower/Foundation.tsx` | Classical marble pedestal + abyss column (triplanar UV, normal mapping) |
| `apps/mobile/components/tower/AuroraWisps.tsx` | Ephemeral squiggly light wisps (35 instances, lifecycle fade in/out) |
| `apps/mobile/components/tower/Particles.tsx` | Ambient particle effects |

### UI Components
| File | Purpose |
|------|---------|
| `apps/mobile/components/ui/BlockInspector.tsx` | Selected block detail panel orchestrator (sub-components in inspector/) |
| `apps/mobile/components/inspector/InspectorHeader.tsx` | Block emoji + name + state badge |
| `apps/mobile/components/inspector/InspectorActions.tsx` | CTA buttons (Claim/Charge/Poke/Reclaim) |
| `apps/mobile/components/inspector/InspectorCustomize.tsx` | Color/emoji/style/name editor |
| `apps/mobile/components/inspector/InspectorComments.tsx` | Block comments (Tapestry API, optimistic add) |
| `apps/mobile/components/inspector/InspectorStats.tsx` | Energy bar + streak stats |
| `apps/mobile/components/ui/FloatingNav.tsx` | Bottom pill nav (Tower/Board/Me) — replaces tab bar |
| `apps/mobile/components/ui/TopHUD.tsx` | Minimal top bar (MONOLITH + wallet pill) |
| `apps/mobile/components/ui/BoardSheet.tsx` | Board bottom sheet (wraps BoardContent) |
| `apps/mobile/components/ui/SettingsSheet.tsx` | Settings bottom sheet (wraps SettingsContent) |
| `apps/mobile/components/ui/WalletConnectSheet.tsx` | Wallet connect card (BottomPanel) |
| `apps/mobile/components/ui/LiveActivityTicker.tsx` | Bottom-left activity feed + poke-random pill (REMOVED from index.tsx — not mounted) |
| `apps/mobile/components/ui/BottomPanel.tsx` | Reusable glass slide-up panel with swipe dismiss |
| `apps/mobile/components/board/BoardContent.tsx` | Leaderboard + activity feed content |
| `apps/mobile/components/settings/SettingsContent.tsx` | Profile + settings content |
| `apps/mobile/components/onboarding/CameraTutorial.tsx` | 3-step camera gesture coach marks (swipe/pinch/scrubber) |
| `apps/mobile/hooks/useBlockActions.ts` | Block action handlers (claim/ghostClaim/charge/poke/customize) |
| `apps/mobile/hooks/useClaimCelebration.ts` | Claim celebration orchestrator (timers, cinematic mode, tap-to-skip) |
| `apps/mobile/constants/ClaimEffectConfig.ts` | Claim celebration tuning (shake, zoom, camera, haptics, particles) |
| `apps/mobile/hooks/useTowerReveal.ts` | Tower build-up reveal + cinematic orbit animation |
| `apps/mobile/components/ui/LayerIndicator.tsx` | Floor scrubber / layer nav |
| `apps/mobile/components/ui/ClaimModal.tsx` | Block claim confirmation modal |
| `apps/mobile/components/ui/AchievementToast.tsx` | Slide-in achievement notifications (7 types) |
| `apps/mobile/components/ui/MyBlocksPanel.tsx` | Bottom sheet listing owned blocks (urgency-sorted, Charge All) |
| `apps/mobile/components/ui/MyBlockFAB.tsx` | Floating action button for quick access to owned blocks |
| `apps/mobile/components/ui/HotBlockTicker.tsx` | Bottom-right notable block mini-cards (dying/fading/claimable/streak) |
| `apps/mobile/components/ui/PokeReceivedToast.tsx` | Blink/in-app poke notification toast (gold glow, SFX, haptic) |
| `apps/mobile/components/ui/UsernameModal.tsx` | Set display name modal |
| `apps/mobile/components/ui/SparkDevSlider.tsx` | Dev-only face testing panel (energy slider + tier + eye/mouth variant pickers) |
| `apps/mobile/components/ui/ConnectionBanner.tsx` | Connection status indicator |
| `apps/mobile/components/ui/FloatingPoints.tsx` | "+25 XP" floating animation after actions (evolution context labels) |
| `apps/mobile/components/ui/LootReveal.tsx` | Gacha-style loot reveal overlay (rarity flash, card bounce, equip) |
| `apps/mobile/components/ui/LevelUpCelebration.tsx` | Full-screen level-up overlay + haptic |
| `apps/mobile/components/ui/XPBar.tsx` | XP progress bar component |
| `apps/mobile/components/ErrorBoundary.tsx` | React error boundary for crash recovery |
| `apps/mobile/components/ui/Button.tsx` | Glass button (5 variants: primary/secondary/ghost/danger/gold) |
| `apps/mobile/components/ui/Card.tsx` | Glass card container |
| `apps/mobile/components/ui/ProgressDots.tsx` | Duolingo-style horizontal step dots (gold active, spring scale) |
| `apps/mobile/components/ui/StepCard.tsx` | Glass onboarding panel with title, subtitle, ProgressDots footer |

### State Management
| File | Purpose |
|------|---------|
| `apps/mobile/stores/tower-store.ts` | Block data, selection, charge, decay loop, recentlyChargedId, recentlyPokedId |
| `apps/mobile/stores/multiplayer-store.ts` | Colyseus connection, state sync, auth challenge/response, ghost/pact messages |
| `apps/mobile/stores/player-store.ts` | XP, level, combo, lastPointsEarned, levelUp state |
| `apps/mobile/stores/wallet-store.ts` | Wallet connection + balance + signAuthMessage utility |
| `apps/mobile/stores/onboarding-store.ts` | 10-phase onboarding state machine (with cameraTutorial + ghostMode) |
| `apps/mobile/stores/poke-store.ts` | Poke cooldown tracking |
| `apps/mobile/stores/progression-store.ts` | 15-milestone Keeper's Journey derived from player/tower state |
| `apps/mobile/stores/session-store.ts` | Session timestamps for "While You Were Away" summaries |
| `apps/mobile/stores/achievement-store.ts` | Achievement unlocks (7 types, SecureStore persistence) |
| `apps/mobile/stores/activity-store.ts` | Real-time activity events (wired to multiplayer) |
| `apps/mobile/stores/loot-store.ts` | Loot inventory (Zustand + expo-secure-store, rollAndStore, pendingReveal) |
| `apps/mobile/stores/tapestry-store.ts` | Tapestry social state (profile, social counts) |
| `apps/mobile/utils/tapestry.ts` | Tapestry API wrapper (profiles, follows, content, likes, comments, activity feed) |
| `apps/mobile/utils/soar.ts` | SOAR on-chain leaderboard/achievements wrapper (fire-and-forget, feature-flagged) |
| `apps/mobile/services/soar-constants.ts` | SOAR addresses, authority key, SOAR_ENABLED flag |
| `apps/mobile/scripts/setup-soar.ts` | One-shot SOAR game registration on devnet |

### Screens (Expo Router)
| File | Purpose |
|------|---------|
| `apps/mobile/app/(tabs)/index.tsx` | Home screen (tower + HUD + FloatingPoints + LevelUp + HotBlockTicker + MyBlockFAB) |
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
| `apps/mobile/constants/loot-table.ts` | 43 loot items, 4 rarity tiers, weighted rollLoot() function |
| `apps/mobile/constants/network.ts` | GAME_SERVER_URL from env |
| `apps/mobile/app.json` | EAS project config, expo-updates URL |
| `apps/mobile/eas.json` | Build profiles (dev/preview/prod) + Supabase env vars |

### Game Server
| File | Purpose |
|------|---------|
| `apps/server/src/index.ts` | Colyseus server entrypoint + REST endpoints |
| `apps/server/src/rooms/TowerRoom.ts` | Game room: claims, ghost claims, decay, XP, pacts, quests, auth, persistence |
| `apps/server/src/utils/auth.ts` | Wallet signature verification (nonce + Ed25519 via tweetnacl) |
| `apps/server/src/utils/supabase.ts` | Supabase client + CRUD helpers (fire-and-forget writes) |
| `apps/server/src/utils/xp.ts` | XP computation, level thresholds, combo tracking |
| `apps/server/src/utils/notifications.ts` | Push notifications (state-transition triggers, 4h throttle, 3/day cap) |
| `apps/server/src/utils/quests.ts` | Daily quest progress tracking per wallet |
| `apps/server/src/utils/floor-competition.ts` | Weekly floor charge competition + Monday reset |
| `apps/server/src/utils/weekly-events.ts` | Rotating Saturday events (Charge Storm / Land Rush) |
| `apps/server/src/routes/blinks.ts` | Solana Blinks routes (actions.json, GET metadata, POST poke tx) |
| `apps/server/src/utils/memo-tx.ts` | RPC connection + unsigned memo transaction builder |
| `apps/server/src/utils/blink-poke.ts` | Apply Blink poke to live TowerRoom (energy boost, broadcast, push notif) |
| `apps/server/static/blink-icon.png` | Tower icon for Blink action cards |

### Shared Package
| File | Purpose |
|------|---------|
| `packages/common/src/layout.ts` | Tower geometry / block position math |
| `packages/common/src/quest-defs.ts` | Quest pool (7 quests) + deterministic daily picker |
| `packages/common/src/constants.ts` | Shared tower dimensions, limits, layer pricing, customization tiers, streak system, variable charge brackets, evolution tiers |
| `packages/common/src/types.ts` | Shared TypeScript types (ClaimMessage, ChargeMessage, ActivityEvent) |

### Database
| File | Purpose |
|------|---------|
| `supabase/migrations/001_initial.sql` | Schema: blocks, players, events + RLS policies |
| `supabase/migrations/002_push_tokens.sql` | Push notification token storage |
| `supabase/migrations/003_player_username.sql` | Username column on players table |
| `supabase/migrations/004_block_evolution.sql` | Evolution columns (total_charges, best_streak, evolution_tier) |
| `supabase/config.toml` | Supabase CLI config (linked to project pscgsbdznfitscxflxrm) |

### Landing Page & Deploy
| File | Purpose |
|------|---------|
| `apps/web/index.html` | Landing page (Three.js tower, aurora skybox, waitlist form) |
| `apps/web/LANDING-CONTEXT.md` | Landing page design context |
| `.github/workflows/deploy-landing.yml` | CF Pages auto-deploy on push to `apps/web/` |

### Pitch Deck
| File | Purpose |
|------|---------|
| `pitch/deck.html` | Hackathon pitch deck (11 slides, snap scroll, slide 3 = cinematic Three.js tower reveal) |
| `pitch/deck-content.md` | Pitch content/copy source |
| `pitch/speaker-script.md` | Speaker notes per slide |

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
  → tower-store.ts → TowerGrid re-render (claim flash gold / charge flash quality-colored / poke shake orange)
  → recentEvents → activity-store → HotBlockTicker / Board tab
Blink poke → routes/blinks.ts POST → blink-poke.ts → getActiveRoom().broadcast("block_update", eventType:"poke")
  + poke_received to owner client → PokeReceivedToast + SFX + haptic
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
12. **Supabase uses service role key on server** — the anon/publishable key is for mobile only. Server needs service role key.
13. **`mpConnected` includes reconnecting guard** — `connected && !reconnecting`. Never use raw `connected` for action routing.
14. **Android physical device can't reach `localhost`** — use `adb reverse tcp:2567 tcp:2567` over USB, or LAN IP, or prod URL.
15. **mediump uTime precision** — `uTime` grows unboundedly; after ~10 min, `sin(uTime * N)` returns garbage on float16. All `uTime` uniforms MUST use `uniform highp float uTime;` override.
16. **No `new` in useFrame** — pre-allocate Color/Vector3/Matrix4 in `useRef`, use `.set()`/`.copy()`. GC pressure kills mobile perf.
17. **Overlay UI blocks R3F touches** — add `pointerEvents="none"` on non-interactive overlays. PanResponder `onStartShouldSetPanResponder: () => true` steals all taps from Canvas.
18. **FloatingNav visibility** — derived from `anyOverlayOpen` in index.tsx. When adding a new sheet/overlay, add it to `anyOverlayOpen` (one place).
19. **One SFX per action chain** — gesture → state change → UI reaction should play exactly ONE sound at the gesture origin. Don't add sounds to downstream effects.
20. **BottomPanel dismiss pattern** — animate off-screen FIRST, THEN call `onClose()` in `.start()` callback. Never reset `dragOffset` before unmount.

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
cd apps/mobile && npx jest              # 222 tests, 18 suites
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
| New sheet/overlay in `index.tsx` | Add to `anyOverlayOpen` boolean (hides FloatingNav) |
| Tower dimensions in `constants.ts` | Both client and server use this — redeploy server too |
| `TowerRoom.ts` message format | Client handlers in `multiplayer-store.ts` |
| `supabase/migrations/` | Run `npx supabase db push` to apply to hosted DB |
| Supabase table schema | Update `BlockRow` / `PlayerRow` interfaces in `supabase.ts` |
| `CHARGE_BRACKETS` or `EVOLUTION_TIERS` in `constants.ts` | Both client and server use these — redeploy server too. Evolution tier is denormalized in DB — existing blocks keep old tier until next charge. |
| `getStreakMultiplier` / `isNextDay` | Shared in `@monolith/common/constants.ts` — used by both `tower-store.ts` (re-export) and `TowerRoom.ts` |
| Tapestry API wrapper (`tapestry.ts`) | `tapestry-store.ts`, `useAuthorization.ts`, `useBlockActions.ts`, `BlockInspector.tsx` |
| SOAR constants (`soar-constants.ts`) | `soar.ts`, `BoardContent.tsx` (badge visibility) |

---

## Docs Map

| Doc | What it covers |
|---|---|
| `CONTEXT.md` | **This file** — current state, file map, tasks |
| `CLAUDE.md` | Agent instructions (auto-loaded by Claude Code) |
| `docs/LESSONS.md` | Technical lessons indexed by topic |
| `docs/ARCHITECTURE.md` | System design, tech decisions, game mechanics |
| `docs/game-design/GDD.md` | Game Design Document (canonical) |
| `docs/game-design/SPARK_SYSTEM.md` | Spark System PRD — living faces, expressions, evolution roadmap |
| `docs/design/GACHA_VISION.md` | Loot drop / gacha design vision (post-testing) |
| `docs/MULTIPLAYER_DEPLOYMENT.md` | Colyseus + Railway setup |
| `docs/TESTER_GUIDE.md` | Tester onboarding: install, get tokens, how to play |
| `docs/TESTING.md` | Developer testing guide: local setup, feature checklist |
| `apps/video/GUIDE.md` | **Content engine guide** — how to make marketing videos with Remotion + real tower |

---

## Recent Changes

- **2026-03-12**: **Beta 0.1.0 release for testers.** GitHub Release created (`v0.1.0-beta`) as primary tester entry point. TESTING.md trimmed to quick-start, TESTER_GUIDE.md rewritten with comprehensive gameplay reference + 40-item testing checklist. QR code + APK link updated to latest EAS build (`29DyQzPgjq24rXPCTxpKCn.apk`). Server pushed to Railway (security hardening + post-hack sprint deployed). Faucet links (Circle USDC, Solana SOL) included in release. Release: https://github.com/epicexcelsior/monolith/releases/tag/v0.1.0-beta

- **2026-03-10**: **Post-hack "Make It Click" sprint** — 3 phases, 13 sub-tasks. Phase 1: front-face-only rendering, evolution celebration dedup (lastCelebratedTier), compact inspector (280→540px animated), progression messaging in FloatingPoints ("3 more to Ember"), face picker prominence, SOAR badge hidden, unclaimed block warm golden pulse. Phase 2: loot drop system (12 items, 4 rarity tiers, gacha reveal overlay, expo-secure-store persistence), charge quality amplification (flash/haptic/scale spread). Phase 3: regression verified (222/222 tests), visual polish, APK built. New files: loot-table.ts, loot-store.ts, LootReveal.tsx.

- **2026-03-10**: Documentation cleanup for hackathon submission — archived 27 internal docs (sprint plans, roadmaps, scorecards, pitch internals, old marketing) to `archive/`, deleted 6 temporal files (outdated guides, old hackathon materials). Visual README overhaul (hero banner from og-image, shields.io tech badges, QR code for APK install, feature tables). New EAS cloud APK build (`4k3G64YyQ8NCJ7RgxA4RT6.apk`) + local release APK. TESTING.md APK link updated. Judge-facing docs are clean: root has 4 files, docs/ has 17 quality files, pitch/ has deck + media only.

- **2026-03-07**: Landing page camera overhaul + pitch deck cinematic tower — Landing page: imposing low-angle camera (FOV 42→52, ground-level start R=22, looking UP), scroll-driven spiral ascent (2 full rotations climbing to overhead view at page bottom), aurora green shift (teal→classic green ribbons, magenta→emerald wisps, green sky undertones), darkened aurora (ribbon multipliers 3.5→1.0, bloom 0.50→0.35, exposure 0.9→0.7). Pitch deck: replaced slide 3 (old 2D canvas) with full-screen Three.js cinematic tower reveal — same tower geometry/shaders/aurora/particles/bloom as landing page, cinematic spin-in camera (R=55→22, 324° sweep), text fades in at 2.5s with staggered reveals, lazy-init via IntersectionObserver, renders pause off-screen, graceful WebGL fallback. Text contrast: 4-layer black text-shadow, radial vignette behind text, bright gold gradient on "in 3D" with gold drop-shadow glow, pills with backdrop-filter blur.

- **2026-03-04**: Landing page immersive aurora + deploy (`apps/web/index.html`) — dramatic aurora skybox (4 seamless FBM ribbon layers: purple/teal/gold/magenta, cylindrical coords for no seam, scroll-responsive intensity, liquid flow motion), liquid marble pedestal (animated flowing veins via time-offset FBM), 3-tier parallax particles (150 near embers + 80 aurora-colored fireflies + 250 far cosmic dust), bloom 0.50, ground glow aurora-tinted, waitlist form bug fix (inline display:none overriding success class), tight title shadow. CF Pages deployed to themonolith.pages.dev, GitHub Action auto-deploys on push to `apps/web/`. Waitlist writes to Supabase verified working.

- **2026-03-04**: Landing page redesign (`apps/web/index.html`) — JS-fitted full-width title (88% viewport, recalculates on resize), removed all dark-band scrims and hero-grad overlay (tower visible throughout), true glassmorphic cards (rgba(10,12,28,0.30-0.35) + blur(28-32px) + white borders + inset highlights), card hover animations (scale(1.02) + translateY + gold glow), typography overhaul (Syne hero title only, Outfit headings, Inter body), all text larger/bolder with text-shadow for 3D readability, copywriting refreshed to PITCH.md brand voice (Keeper/skyline/blaze/fade), waitlist CTA "Claim Your Spot" with gold shimmer, footer redesigned with icon pill-buttons (X/GitHub/Discord).

- **2026-03-04**: Spark face overhaul — adaptive contrast (bioluminescent faces on dark blocks), sleeping face on dead blocks (X_X or closed-line eyes), programmatic variety (5 eye shapes × 4 mouth shapes via hash21), evolution tier face progression (Tier 2 blush, Tier 3 eyebrows+sparkle, Tier 4 halo), tier-aware LOD (38-54 units), full dev panel (energy slider + tier + eye/mouth variant selectors + shuffle). 222 mobile tests passing.
