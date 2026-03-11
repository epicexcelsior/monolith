# Monolith — Project Context

> **Living state document.** Auto-updated by `/wrapup` workflow.
> **Last updated:** 2026-03-10

## What Is This?

The Monolith is **r/Place meets DeFi in 3D**. Stake USDC, claim a glowing block on a shared tower, customize it, compete for status. Solana Seeker native.

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
- Charge system (variable 15-35 energy, weighted brackets, streak 1x-3x multiplier, quality-based visual feedback)
- Block customization (color, emoji, name, style, textureId) — fully networked + persisted, all tiers unlocked for testers
- Bot simulation (21 personas, 6 archetypes, ~450 blocks, denser energy distribution)
- Colyseus multiplayer (server-authoritative, JSON messages, Railway)
- **Immersive onboarding revamp** (9-phase: cinematic orbit → title → claim → celebration → customize → charge → poke → wallet → done)
- 4 new animated block styles (Lava, Aurora, Crystal, Nature — GLSL, styles 7-10)
- Demo mode XP feedback (claim 100/300xp, charge 25/50xp — offline-first, customization XP removed)
- **Block evolution** (5 tiers: Spark→Ember→Flame→Blaze→Beacon — permanent progression via cumulative charges + best streak, GLSL glow/rim/shimmer boost, progress bar in inspector)
- **Variable charge rewards** (weighted random 15-35 base energy, quality brackets: normal/good/great, "Lucky!" label on great rolls, quality-aware 3D flash colors)
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
- **Sound effects + haptics** (16 sounds incl. 8.5s tower-rise cinematic pad, A Dorian identity, wired to all interactions)
- **Tappable leaderboard** (tap entry → camera flies to block)
- **XP leaderboard tab** (owners + XP tabs on Board screen)
- **Real activity feed on Board tab** (fetches from /api/events, fallback to generated)
- **Poke mechanic** (tap opponent's block → poke, 30s cooldown, server-validated, push notification)
- **Username system** (set display name, persisted to Supabase, shown on blocks + leaderboard)
- **My Blocks panel** (bottom sheet listing owned blocks, urgency-sorted, Charge All, tap to fly camera)
- **My Blocks FAB** (floating action button, bottom-left — single block: fly to it, multi: open panel, red urgency dot, 56px)
- **Push notifications** (hourly decay check, poke alerts — server handler + expo-notifications)
- **HotBlockTicker** (bottom-right mini-cards for dying/fading/claimable/streak blocks — per-type colors, tap to inspect, 2 cards max, 5s scan)
- **Layer-based pricing** (quadratic curve: Layer 0 = $0.10, Layer 24 = $1.00, tier badges in ClaimModal + InspectorActions)
- **AchievementToast** (7 achievements, persisted to SecureStore, slide-in toast, share button)
- **Breathing blocks** (energy-tiered aura: blazing warm gold pulse, thriving amber, fading anxious flicker, dying cold sparks, dead dark)
- **Spark faces** (kawaii SDF faces on outward-facing side only — energy-driven expressions, adaptive contrast (bioluminescent on dark blocks), sleeping face on dead blocks, programmatic variety (5 eye shapes × 4 mouth styles per block via hash), evolution tier face progression (Spark→Ember→Flame→Blaze→Beacon adds blush/brows/halo), tier-aware LOD (Beacon visible from 54 units, Spark from 38))
- **Loot drop system** (gacha-style cosmetic drops on charge — 12 items across 4 rarity tiers: common colors, rare emojis/effects, epic/legendary styles — 30% base drop rate with streak multiplier, full-screen reveal overlay with rarity flash + equip button, client-side inventory persisted to expo-secure-store)
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
- **REST endpoints** (GET /api/events, GET /api/leaderboard)
- **Server hardening** (try/catch all handlers, error messages to client)
- **Tapestry social layer** (on-chain profiles, follow/like/comment, deterministic block content IDs, activity feed tab, comments in inspector, namespace isolation — client-side only, fire-and-forget)
- **Solana Blinks** (shareable poke URLs via memo transactions — dial.to cards, actions.json discovery, Alchemy devnet RPC, swappable via BLINKS_RPC_URL env var, in-game poke effects: block shake/bounce/flash + gold toast + SFX + haptic + push notification)
- **MagicBlock SOAR** (on-chain leaderboard + 7 achievements via `@magicblock-labs/soar-sdk` — fire-and-forget score submission on claim/charge/poke, auto-register on wallet connect via MWA, authority-signed score/achievement txs, feature-flagged `SOAR_ENABLED`, active on devnet)

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
| `apps/mobile/hooks/useBlockActions.ts` | Block action handlers (claim/charge/poke/customize) |
| `apps/mobile/hooks/useClaimCelebration.ts` | Claim celebration orchestrator (timers, cinematic mode, inspector reopen) |
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
| `apps/mobile/stores/multiplayer-store.ts` | Colyseus connection, state sync, recentEvents, chargesToday |
| `apps/mobile/stores/player-store.ts` | XP, level, combo, lastPointsEarned, levelUp state |
| `apps/mobile/stores/wallet-store.ts` | Wallet connection + balance |
| `apps/mobile/stores/onboarding-store.ts` | 9-phase onboarding state machine |
| `apps/mobile/stores/poke-store.ts` | Poke cooldown tracking |
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
| `apps/mobile/constants/loot-table.ts` | 12 loot items, rarity tiers, weighted rollLoot() function |
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
| `apps/server/src/routes/blinks.ts` | Solana Blinks routes (actions.json, GET metadata, POST poke tx) |
| `apps/server/src/utils/memo-tx.ts` | RPC connection + unsigned memo transaction builder |
| `apps/server/src/utils/blink-poke.ts` | Apply Blink poke to live TowerRoom (energy boost, broadcast, push notif) |
| `apps/server/static/blink-icon.png` | Tower icon for Blink action cards |

### Shared Package
| File | Purpose |
|------|---------|
| `packages/common/src/layout.ts` | Tower geometry / block position math |
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
12. **Supabase uses service role key on server** — the anon/publishable key (`sb_publishable_...`) is for mobile only. Server needs `eyJ...` service role key.
13. **`mpConnected` includes reconnecting guard** — `connected && !reconnecting`. Never use raw `connected` for action routing in BlockInspector.
14. **Android physical device can't reach `localhost`** — use `adb reverse tcp:2567 tcp:2567` over USB, or LAN IP, or prod URL.
15. **Supabase lazy init** — client initializes on first TowerRoom.onCreate(), not at server startup. Now also eagerly inits + verifies at server start.
16. **mediump uTime precision** — fragment shaders use `precision mediump float` for 2x GPU throughput, but `uTime` grows unboundedly. After ~10 min, `sin(uTime * N)` returns garbage on float16. All `uTime` uniforms MUST use `uniform highp float uTime;` override.
17. **expo-audio loop bug** — calling `seekTo(0)` on a `didJustFinish` player triggers auto-play → infinite loop. Pattern: `player.seekTo(0).catch(()=>{})` then `player.play()` fire-and-forget. No listeners.
18. **No `new` in useFrame** — `new THREE.Color()`, `.clone()`, `new Float32Array()` inside per-frame callbacks create GC pressure. Pre-allocate in `useRef` and use `.set()`/`.copy()`.
19. **Overlay UI blocks R3F touches** — absolute-positioned Views default to `pointerEvents="auto"`, intercepting taps before Canvas raycaster. Add `pointerEvents="none"` on non-interactive overlays. PanResponder `onStartShouldSetPanResponder: () => true` steals all taps even from underlying Canvas.
20. **Audio init must be fault-tolerant** — `setAudioModeAsync`/`setIsAudioActiveAsync` can throw on Android. Wrap in separate try/catch so player loading still proceeds. Always set `interruptionMode: "mixWithOthers"` for SFX.
19. **FloatingNav visibility** — derived from `anyOverlayOpen` in index.tsx. When adding a new sheet/overlay, add it to `anyOverlayOpen` (one place) — don't thread individual booleans into the visible prop.
20. **One SFX per action chain** — gesture → state change → UI reaction should play exactly ONE sound at the gesture origin. Don't add sounds to downstream effects (e.g. BottomPanel open, BlockInspector visibility change). Audit with: `grep -rn "play[A-Z]" apps/mobile/components/ apps/mobile/app/ --include="*.tsx"` and trace each call's trigger chain.
21. **BottomPanel dismiss pattern** — always animate off-screen FIRST (`Animated.timing` to totalHeight), THEN call `onClose()` in `.start()` callback. Never reset `dragOffset` before unmount. Never put slide-out in useEffect else branch when component has `if (!visible) return null`.
22. **Deselect + pop-out fight celebration camera** — `selectBlock(null)` triggers both the deselect handler (wants `ZOOM_OVERVIEW`) AND the pop-out restore (wants `popTarget=0`). Both fight the celebration camera. Guard deselect with `if (!isCelActive)` in TowerScene.tsx. Guard pop-out with `isCelActive && celBlockId` check in TowerGrid.tsx deselect handler — keep the claimed block popped out + highlighted during celebration.
23. **Customization must not award XP** — free, instant, repeatable actions must never award points. XP removed from both client (`useBlockActions.ts`) and server (`TowerRoom.ts`).
24. **Onboarding replay requires tower reset** — `resetOnboardingFlag()` must also set `revealComplete: false` and `revealProgress: 0`, otherwise the HUD wrapper (`{revealComplete && ...}`) stays mounted and `useTowerReveal` refs won't re-run. The hook detects `revealComplete` going `true→false` and resets its internal animation refs.
25. **Tapestry: block content uses deterministic IDs** — `getBlockContentId(blockId)` → `monolith-block-{blockId}`. Likes/comments always have a target. `ensureBlockContent()` lazily creates on inspector open. BlockInspector uses `getProfile()` for block owners (bot name = profile ID). **Content `properties` is REQUIRED** — always include at least `[{key:"blockId",value:blockId}]`.
26. **Tapestry: `startId` = follower, `endId` = followee** — naming feels backwards but is correct per API docs.
27. **Tapestry: ChargeResult has no blockId** — use `useTowerStore.getState().selectedBlockId` in the charge result handler instead.

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
| `docs/design/UI_SYSTEM.md` | Solarpunk design system spec |
| `docs/design/GACHA_VISION.md` | Loot drop / gacha design vision (post-testing) |
| `docs/MULTIPLAYER_DEPLOYMENT.md` | Colyseus + Railway setup |
| `docs/TESTER_GUIDE.md` | Tester onboarding: install, get tokens, how to play |
| `docs/TESTING.md` | Developer testing guide: local setup, feature checklist |
| `apps/video/GUIDE.md` | **Content engine guide** — how to make marketing videos with Remotion + real tower |

---

## Recent Changes

- **2026-03-10**: **Post-hack "Make It Click" sprint** — 3 phases, 13 sub-tasks. Phase 1: front-face-only rendering, evolution celebration dedup (lastCelebratedTier), compact inspector (280→540px animated), progression messaging in FloatingPoints ("3 more to Ember"), face picker prominence, SOAR badge hidden, unclaimed block warm golden pulse. Phase 2: loot drop system (12 items, 4 rarity tiers, gacha reveal overlay, expo-secure-store persistence), charge quality amplification (flash/haptic/scale spread). Phase 3: regression verified (222/222 tests), visual polish, APK built. New files: loot-table.ts, loot-store.ts, LootReveal.tsx.

- **2026-03-10**: Documentation cleanup for hackathon submission — archived 27 internal docs (sprint plans, roadmaps, scorecards, pitch internals, old marketing) to `archive/`, deleted 6 temporal files (outdated guides, old hackathon materials). Visual README overhaul (hero banner from og-image, shields.io tech badges, QR code for APK install, feature tables). New EAS cloud APK build (`4k3G64YyQ8NCJ7RgxA4RT6.apk`) + local release APK. TESTING.md APK link updated. Judge-facing docs are clean: root has 4 files, docs/ has 17 quality files, pitch/ has deck + media only.

- **2026-03-07**: Landing page camera overhaul + pitch deck cinematic tower — Landing page: imposing low-angle camera (FOV 42→52, ground-level start R=22, looking UP), scroll-driven spiral ascent (2 full rotations climbing to overhead view at page bottom), aurora green shift (teal→classic green ribbons, magenta→emerald wisps, green sky undertones), darkened aurora (ribbon multipliers 3.5→1.0, bloom 0.50→0.35, exposure 0.9→0.7). Pitch deck: replaced slide 3 (old 2D canvas) with full-screen Three.js cinematic tower reveal — same tower geometry/shaders/aurora/particles/bloom as landing page, cinematic spin-in camera (R=55→22, 324° sweep), text fades in at 2.5s with staggered reveals, lazy-init via IntersectionObserver, renders pause off-screen, graceful WebGL fallback. Text contrast: 4-layer black text-shadow, radial vignette behind text, bright gold gradient on "in 3D" with gold drop-shadow glow, pills with backdrop-filter blur.

- **2026-03-04**: Landing page immersive aurora + deploy (`apps/web/index.html`) — dramatic aurora skybox (4 seamless FBM ribbon layers: purple/teal/gold/magenta, cylindrical coords for no seam, scroll-responsive intensity, liquid flow motion), liquid marble pedestal (animated flowing veins via time-offset FBM), 3-tier parallax particles (150 near embers + 80 aurora-colored fireflies + 250 far cosmic dust), bloom 0.50, ground glow aurora-tinted, waitlist form bug fix (inline display:none overriding success class), tight title shadow. CF Pages deployed to themonolith.pages.dev, GitHub Action auto-deploys on push to `apps/web/`. Waitlist writes to Supabase verified working.

- **2026-03-04**: Landing page redesign (`apps/web/index.html`) — JS-fitted full-width title (88% viewport, recalculates on resize), removed all dark-band scrims and hero-grad overlay (tower visible throughout), true glassmorphic cards (rgba(10,12,28,0.30-0.35) + blur(28-32px) + white borders + inset highlights), card hover animations (scale(1.02) + translateY + gold glow), typography overhaul (Syne hero title only, Outfit headings, Inter body), all text larger/bolder with text-shadow for 3D readability, copywriting refreshed to PITCH.md brand voice (Keeper/skyline/blaze/fade), waitlist CTA "Claim Your Spot" with gold shimmer, footer redesigned with icon pill-buttons (X/GitHub/Discord).

- **2026-03-04**: Spark face overhaul — adaptive contrast (bioluminescent faces on dark blocks), sleeping face on dead blocks (X_X or closed-line eyes), programmatic variety (5 eye shapes × 4 mouth shapes via hash21), evolution tier face progression (Tier 2 blush, Tier 3 eyebrows+sparkle, Tier 4 halo), tier-aware LOD (38-54 units), full dev panel (energy slider + tier + eye/mouth variant selectors + shuffle). Branch: `feat/spark-face-overhaul`. 222 mobile tests passing.

- **2026-03-03**: Spark polish — narrowed mouth width, fixed customization selection UI (gold checkmark on emojis, stronger selected background), added Spark Tester to Settings (5 energy presets for face testing). 222 mobile tests passing.

- **2026-03-03**: Spark System MVP — kawaii SDF faces on blocks (energy-driven expressions + idle blink + LOD fade), charge squash-and-stretch bounce, streak gates removed (all customization unlocked for testers). Pure client-side visual layer, no server changes. 222 mobile tests passing.

- **2026-03-03**: Tester experience overhaul — breathing blocks (energy-tiered aura shader: blazing/thriving/fading/dying/dead with warm-to-cold tint), enhanced share flow (gold Share button + post-charge nudge + achievement share + improved ShareCard with evo tier/streak badge), bot-only demo images fix (isBotOwner guard), multi_block achievement wired, gacha/loot vision doc. 222 mobile tests passing.

- **2026-03-01**: Core loop redesign Phase 1 — Variable charge system (weighted random 15-35 base, quality brackets normal/good/great, "Lucky!" on great rolls, quality-aware 3D flash colors + FloatingPoints scale), block evolution (5 permanent tiers Spark→Beacon via cumulative charges + best streak, GLSL glow/rim/shimmer boost, progress bar in inspector), breathing pulse on charge button, bestStreak tracking (evolution never regresses). Code quality: moved getStreakMultiplier/isNextDay to @monolith/common (DRY), embedded quality in CHARGE_BRACKETS, ChargeQuality type shared, shader shimmer uses hash21 instead of noise2D, charge quality passed via tower store (not player store). DB migration: 004_block_evolution.sql (total_charges, best_streak, evolution_tier).

- **2026-02-27**: MagicBlock SOAR integration (Graveyard Hack bounty) — `@magicblock-labs/soar-sdk` installed, fire-and-forget score submission on claim/charge/poke (5 call sites in useBlockActions.ts), auto-register on wallet connect via MWA, authority-signed score/achievement txs (dual SoarProgram pattern — authority as payer for submissions, player as payer for init), fixed totalXp truthy check bug (0 is falsy), feature-flagged `SOAR_ENABLED`, on-chain leaderboard + 7 achievements active on devnet, "Verified on Solana via SOAR" badge on XP leaderboard, one-shot setup script (`setup-soar.ts`), pnpm overrides for Anchor version conflict, demo guide for judges. 222 mobile + 84 server tests passing.

- **2026-02-27**: Blink poke client-side effects — PokeReceivedToast (hudDark glass, gold glow pulse, energy badge, scale+slide entrance, 6s), block shake/bounce VFX (0.18 amp, Y-axis pop, 1.4s flash with peak hold), SFX+haptic from block_update path (no _wallet dependency), blink-poke.ts broadcasts full appearance to prevent data loss, wallet passed on joinOrCreate for poke_received targeting. 222 mobile + 84 server tests passing.
- **2026-02-27**: Marble pedestal + aurora wisps + dark sky — Foundation rewritten with real marble textures (triplanar UV, normal mapping, classical molding details), GroundPlane/AtmosphericHaze removed (pedestal descends into abyss), AuroraWisps added (35 ephemeral squiggly light streams with lifecycle), sky gradient darkened with brighter stars, canvas bg #0a0812. Perf audit passed (13 idle draw calls, 15K tris). 222 mobile tests passing.
- **2026-02-27**: Fix block selection (LayerIndicator stealing taps via onStartShouldSetPanResponder, AchievementToast missing pointerEvents="none"), fix pop animation perf degradation (celebration-end detection + 3s safety timeout), fix audio silence (isolate setAudioModeAsync + add interruptionMode:"mixWithOthers" for Android, console.warn on failures), fix unmute toggle ordering. 222 mobile tests passing.
- **2026-02-27**: Claim celebration choreography overhaul — audio-synced cinematic camera (sound delay=0, 2.5s buildup matches audio), block jitter via per-block matrix offset in TowerGrid (no camera shake during buildup), all VFX delayed to impact (autoStart={false} on 8 burst emitters), block stays popped out during celebration, phase-specific camera lerp (buildup 0.020/impact 0.055/return 0.025), removed orbit phase, longer tower hold (5.3s). 222 mobile tests passing.
- **2026-02-26**: Solana Blinks integration — shareable poke URLs via memo transactions. `routes/blinks.ts` (actions.json, GET block metadata, POST poke tx), `utils/memo-tx.ts` (RPC + memo builder), static icon, mobile share/tweet URLs use dial.to Blink wrapper, `getBlockById` in supabase.ts. Alchemy devnet RPC, swappable via BLINKS_RPC_URL env var. 222 mobile + 84 server tests passing.
- **2026-02-26**: Tapestry demo-ready fixes — `ensureBlockContent` requires `properties` (was silently 404ing all likes/comments), lazy content creation on inspector open (contentReadyRef gate), bot profile bootstrap on first connect (21 Tapestry profiles, auto-follow 3), removed isBotOwner gate on social UI (bots are social too), Social tab replaced broken /activity/feed with server events, fixed duplicate/split imports silently crashing BlockInspector, dead code cleanup (getActivityFeed, TapestryActivityItem, socialEmptyIcon). 222 mobile tests passing.
- **2026-02-26**: Tapestry full integration fix — deterministic block content IDs (`monolith-block-{id}`), namespace isolation (`themonolith`), comments on blocks (InspectorComments with optimistic add), activity feed replaces N+1 social feed (single API call), stop creating ghost profiles (getProfile instead of findOrCreate for owners), poke content only on confirmed success, dead store cleanup (removed followingIds/feedItems/blockContentMap), improved Social tab empty states. 222 mobile tests passing.
- **2026-02-26**: Tapestry social integration (Graveyard Hack) — on-chain profiles via findOrCreate on wallet connect, cross-app profile import, game events (claim/charge/poke) as Tapestry content, follow/like buttons on block inspector (bot-aware, optimistic UI), Social sub-tab on Board (replaces Territory, fetches feed from followed users), social stats in Settings. Client-side only, all fire-and-forget. 222 mobile tests passing.
- **2026-02-26**: Post-polish bug fixes — claim celebration camera rewrite (phase state machine: buildup→impact→orbit→return), fixed double claim VFX (skip during cinematic), removed XP from customization (farmable exploit), removed LiveActivityTicker, HotBlockTicker less intrusive (2 cards, 5s scan, 36px), MyBlockFAB moved left + enlarged (56px), charge explainer text in InspectorActions, boosted shake/zoom params. 222 mobile + 84 server tests passing.
- **2026-02-25**: Polish Plan Phases 7-10 — layer-based pricing (getLayerMinPrice quadratic curve, tier badges in ClaimModal + InspectorActions), MyBlockFAB (bottom-right FAB for owned blocks, urgency dot), MyBlocksPanel polish (urgency sorting, Charge All with stagger, bigger rows), HotBlockTicker redesign (44px mini-cards, per-type colors/borders, priority sorting, FadeInLeft animation, mounted bottom-right), final polish (LayerIndicator → TIMING.springSnappy, ClaimModal stale-state fix, HotBlockTicker mounted). 222 mobile + 84 server tests passing.
- **2026-02-25**: Polish Plan Phase 6 — block customization tiered unlocks: CUSTOMIZATION_TIERS config + helpers in common/constants.ts (8 base colors/streak 3+ all 16, 20 base emojis/streak 30+ all 48, base styles free/streak 7+ animated Lava-Nature, streak 14+ textures), InspectorCustomize rewrite with lock overlays + streak requirements + "Make it yours!" post-claim encouragement, removed "More styles" expander in favor of visible-but-gated grid. 222 tests passing.
- **2026-02-25**: Polish Plan Phase 5 — charge mechanic dopamine overhaul: XP pill in TopHUD (XPBar + spring pulse on change), streak badge above CHARGE button in InspectorActions, daily first-charge bonus (50 XP + "Daily Charge ✓" label + haptic), recentlyChargedId set on local charge for 3D flash, FloatingPoints dynamic positioning (above inspector when visible) + custom label support, MyBlocksPanel charge bug fixed (removed hardcoded pts=25, added recentlyChargedId + daily bonus). 222 tests passing.
- **2026-02-25**: Polish Plan Phase 4 — onboarding charge & poke full simulation: charge step triggers FloatingPoints "+25 XP", energy bar fill animation in StepCard, hapticChargeTap(); poke step uses new `recentlyPokedId` store field → TowerGrid orange-red shake/flash animation (1s, decaying amplitude), camera flies to bot block then returns to ghost block after 1.5s. 222 tests passing.
- **2026-02-25**: Polish Plan Phase 3 — claim celebration camera fix: removed aftershock shake, added buildup shake escalation (0.1→0.4), dramatic zoom-out (1.6x), orbit stops at ZOOM_RETURN_DELAY, zoom-back before cinematic exits, gold→owner color glow-up transition, inspector reopens after celebration, blockId stored in ClaimCelebrationState. Durations: normal 4→5.5s, firstClaim 5.5→7s. 222 tests passing.
- **2026-02-25**: Polish Plan Phase 2 — onboarding UI standardization: all CTA buttons → `<Button>` component, all panel containers → `<StepCard>`, typography → TEXT presets, spring animations → TIMING tokens, CoachMark hardcoded rgba → COLORS tokens. Net -200 lines. On `feat/polish-plan` branch.
- **2026-02-25**: Polish Plan Phase 1 — design system foundations: added `COLORS.goldMid`, `COLORS.blazingLight`, `COLORS.hudGlassStrong`, `SHADOW.blazing`, `TIMING.springOnboarding`/`springOnboardingReanimated` tokens; `Button` "gold" variant; new `ProgressDots` + `StepCard` reusable components; documented TIMING spring API split (RN Animated vs Reanimated). See `POLISH_PLAN.md` for full 10-phase plan.
- **2026-02-25**: Push notifications FCM wired — `google-services.json` added, `googleServicesFile` in app.json, gitignored. Needs EAS rebuild to activate. 222 mobile + 84 server tests passing.
- **2026-02-25**: Onboarding revamp — 9-phase immersive flow (cinematic 300° orbit, minimal MONOLITH title, dedicated claim CTA, celebration VFX, color+emoji customize, charge tutorial, poke prompt, wallet connect), VFX timing tightened (2.5s→1.5s impact), enhanced particles (glow orbs, ring shockwave, lingering trails), extended tower-rise SFX (8.5s cinematic pad), camera return after celebration, replay via long-press fix. 222 tests passing.
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
