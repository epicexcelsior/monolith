# AGENTS.md — Agent Onboarding Guide

> **Audience:** AI coding agents (Claude Code, Antigravity, any tool). Read this when dropped into this repo.

## Boot Sequence

1. **Read `CONTEXT.md`** (project root) — living state document with current state, file map, data flow, gotchas, system dependencies, and common tasks. This is the single source of truth for project state.
2. **Read `docs/LESSONS.md` index** — scan topic headers before touching any system. Lessons are indexed by topic (Camera, Shaders, Multiplayer, Solana, etc.)
3. **Check skills** — if working on an unfamiliar domain, look for a specialized skill before proceeding. Available skills: `perf`, `ui-standards`, `build`, `anchor-test`, `solana-dev`, `react-native-three`, `find-skills`

## Project in One Sentence

**The Monolith** is a multiplayer 3D staking game on Solana — stake crypto, own a glowing block on a massive shared tower, compete for status. r/Place meets DeFi, in 3D, on mobile.

## Environment

| Item           | Detail                                                      |
| -------------- | ----------------------------------------------------------- |
| **OS**         | Linux (Ubuntu / WSL2)                                       |
| **Runtime**    | Node >=22, pnpm 10 (hoisted mode — see `.npmrc`)           |
| **Platform**   | Android-only, tested on physical Solana Seeker device       |
| **Blockchain** | Solana Devnet, smart contracts in Rust (Anchor framework)   |
| **Build**      | Expo SDK 54 with `expo-dev-client` (NOT Expo Go)            |

## Tech Stack

| Layer          | Technology                                      |
| -------------- | ----------------------------------------------- |
| Mobile app     | Expo 54, React Native 0.81, React 19            |
| 3D rendering   | React Three Fiber v9, Three.js 0.170, expo-gl   |
| Wallet         | Solana Mobile Wallet Adapter (MWA) → Seed Vault |
| Smart contract | Anchor (Rust), deployed on Devnet               |
| State          | Zustand                                         |
| Multiplayer    | Colyseus 0.15 (JSON messages, Railway deploy)   |
| Monorepo       | pnpm workspaces                                 |

## Key Conventions

- **Package names**: `@monolith/mobile`, `@monolith/server`, `@monolith/common`
- **UI**: Use components from `components/ui/` — never create raw `<TouchableOpacity>` or `<Pressable>`
- **Styling**: Use `theme.ts` tokens — never hardcode colors, font sizes, or spacing
- **3D**: ALL lighting is baked in shaders. R3F light components have zero effect.
- **Multiplayer**: JSON room messages, NOT Colyseus schema auto-sync
- **Secrets**: Never commit. Use `.env` files
- **Package manager**: pnpm only — never npm or yarn
- **Tests**: `cd apps/mobile && npx jest` — always run after changes
- **Typecheck**: `timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json`

## Don't

- Don't use `transparent: true` on InstancedMesh (650 instances + alpha sorting kills perf)
- Don't hardcode ports for Railway (use `process.env.PORT`)
- Don't normalize azimuth values that are being interpolated
- Don't assume MWA auth tokens are valid — always fallback to fresh `authorize()`
- Don't run `tsc` without `timeout` wrapper in this monorepo
- Don't add R3F light components — they do nothing with custom shaders
- Don't put CTA buttons inside ScrollViews in bottom panels
- Don't use Expo Go — native modules require `expo-dev-client`

## Workflows

When finishing work, use the **wrapup** workflow — it runs checks AND updates CONTEXT.md.
When you learn a gotcha, use the **learn** workflow — it categorizes by topic into docs/LESSONS.md.
When starting a session, use the **context** workflow — it loads CONTEXT.md and relevant docs.

## Anchor / Solana Patterns

- **Anchor 0.31**: Use `InterfaceAccount<TokenAccount>`, not plain `Account<>`. Use `transfer_checked`. Add `idl-build` feature.
- **Program ID**: `Fu76EqtVLqX2LKCW5ZW8zWBqdgsQTbkvQ9nBDyykgwDh` (devnet)
- **PDA Seeds**: Tower: `[b"tower"]`, Block: `[b"block", block_id.to_le_bytes()]`
- **MWA signing**: All inside `transact()` sessions. Try `reauthorize()` first, fallback to `authorize()`.
- **ID sync**: Run `anchor keys sync` after every `anchor build`

## Docs Map

| Doc | What it covers |
|---|---|
| `CONTEXT.md` | **Start here** — current state, file map, gotchas, tasks |
| `docs/LESSONS.md` | Technical lessons indexed by topic |
| `docs/ARCHITECTURE.md` | System design, tech decisions, game mechanics |
| `docs/game-design/GDD.md` | Game Design Document (canonical) |
| `docs/MULTIPLAYER_DEPLOYMENT.md` | Colyseus + Railway setup |
| `docs/ANCHOR_PROGRAM.md` | On-chain program details |
| `docs/SOLANA_MOBILE.md` | MWA integration patterns |
