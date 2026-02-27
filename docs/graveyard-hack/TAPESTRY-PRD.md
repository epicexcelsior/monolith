# Tapestry Integration — PRD & Implementation Plan

> **Bounty:** Tapestry On-Chain Social ($2,500 / $1,500 / $1,000)
> **Hackathon Deadline:** February 27, 2026
> **Branch:** `feat/graveyard-hack`
> **Status:** Approved — implementing

---

## 1. Product Overview

### What We're Building

A lightweight on-chain social layer for The Monolith powered by Tapestry. Social features are embedded into existing surfaces (inspector, board sub-tab, settings) — no new screens, no new bottom nav pills. The tower remains front-and-center.

### Why This Matters for the Bounty

Tapestry judges want to see:
1. **Profile integration** — wallet-linked profiles, cross-app import
2. **Social graph usage** — follows between players
3. **Content creation** — game events as on-chain social content
4. **Engagement** — likes on blocks
5. **Feed** — aggregated social feed from followed users

We hit all 5 with deep integration into existing gameplay, not a bolted-on afterthought.

### Design Principles

1. **Never block gameplay** — All Tapestry calls are fire-and-forget. API failures are silently logged.
2. **Optimistic UI** — Follow/like toggles update immediately, revert on failure.
3. **Invisible to non-social users** — No wallet = no Tapestry features visible. Zero noise during onboarding.
4. **Bot-aware** — Bot-owned blocks hide social buttons (`isBotOwner()` check). Only real players get social features.
5. **Client-side only** — No server changes needed. API key is namespace-scoped (safe for `EXPO_PUBLIC_`). Production would proxy through server.
6. **Extensible** — Clean API wrapper + Zustand store pattern. Adding new Tapestry features later = add function to wrapper + wire to store.
3. **No new screens, no new nav pills** — Social features live inside existing UI surfaces (inspector, board sub-tab, settings). Bottom nav stays Tower / Board / Me.
4. **Existing patterns** — Haptics, SFX, theme tokens, glass UI — same feel as everything else.

---

## 2. User Stories

### US-1: Auto Profile Creation (P0 — Required)

**As a** player connecting my wallet,
**I want** a Tapestry profile auto-created for me,
**So that** I have an on-chain social identity.

**Acceptance Criteria:**
- On wallet connect, call `POST /v1/profiles/findOrCreate` (fire-and-forget)
- Use player's existing username (from player-store) or truncated wallet as fallback
- Store profile ID in new `tapestry-store.ts`
- Also fires on app boot via `hydrateCachedAuth()` for returning users
- Failure never blocks wallet connection

**Integration:** `useAuthorization.ts` — after `setConnected()` (line ~181 in connect, ~274 in hydrate)

---

### US-2: Cross-App Profile Import (P1 — Nice to Have)

**As a** player who uses other Tapestry apps,
**I want** my username pre-filled from my existing Tapestry profile,
**So that** my identity carries across Solana apps.

**Acceptance Criteria:**
- Before `findOrCreate`, call `GET /v1/profiles/search?walletAddress=X&shouldIncludeExternalProfiles=true`
- If external profile found, use their username instead of truncated wallet
- One-time, on profile creation path only
- Optional — skip if API is slow (2s timeout)

**Integration:** Inside the Tapestry profile creation async block in `useAuthorization.ts`

---

### US-3: Game Events as Social Content (P0 — Required)

**As a** player claiming/charging/poking blocks,
**I want** those actions to appear as social content on Tapestry,
**So that** my followers can see my activity.

**Acceptance Criteria:**
- On claim: `POST /v1/contents/create` with text "Claimed Block #{id} on Layer {n}!"
- On charge: "Charged Block #{id} — Day {streak} streak!"
- On poke: "Poked {truncatedOwner}'s Block #{id}!"
- Custom properties: `type`, `blockId`, `layer`/`streak` as appropriate
- All fire-and-forget with `.catch(console.warn)`
- Content IDs cached in tapestry-store for like functionality
- Works in both offline and multiplayer code paths

**Integration:** `useBlockActions.ts` — in handleClaim/handleCharge/handlePoke + result handlers

**Content Mapping:**

| Game Event | Content Text | Custom Properties |
|-----------|-------------|-------------------|
| Claim | "Claimed Block #{id} on Layer {n}!" | `type=block_claim, blockId, layer` |
| Charge | "Charged Block #{id} — Day {streak} streak!" | `type=charge, blockId, streak` |
| Poke | "Poked {addr}'s Block #{id}!" | `type=poke, blockId` |

---

### US-4: Follow Block Owners (P0 — Required)

**As a** player inspecting another player's block,
**I want** to follow them,
**So that** I see their activity in my social feed.

**Acceptance Criteria:**
- [+ Follow] / [Following ✓] button on non-owner blocks in InspectorActions
- Tapping calls `POST /v1/followers` (follow) or `DELETE /v1/followers` (unfollow)
- Optimistic toggle — reverts on error
- Owner's profile auto-created via `findOrCreate` if needed (required: both profiles must exist)
- Follow status checked on inspector open via `GET /v1/followers/check`
- Haptic + SFX on tap

**UI Location:** New row in InspectorActions, below POKE button, above dormant section

```
┌────────────────────────────────┐
│  🔥 Block #42                   │  ← Header
│  Owner: CryptoKid              │
│  Energy: ██████░░ 78%          │  ← Stats
│────────────────────────────────│
│  [POKE 👆]                      │  ← Existing
│  [🤍 12]  [+ Follow]           │  ← NEW social row
└────────────────────────────────┘
```

**Integration:**
- `InspectorActions.tsx` — new props + social row JSX
- `BlockInspector.tsx` — social state, follow/like handlers, pass props down

---

### US-5: Like Blocks (P0 — Required)

**As a** player inspecting a block,
**I want** to like it,
**So that** block owners get recognition.

**Acceptance Criteria:**
- [🤍 {count}] / [❤️ {count}] button alongside Follow
- Like calls `POST /v1/likes`, unlike calls `DELETE /v1/likes`
- Optimistic count update — reverts on error
- Only visible if block has a content node (claimed after Tapestry integration)
- Check status on inspector open: `GET /v1/likes/check` + `GET /v1/likes/count/{contentId}`

**Dependency:** US-3 (content nodes must exist for likes to reference)

---

### US-6: Social Feed Tab (P0 — Required)

**As a** player,
**I want** to see what people I follow are doing,
**So that** the game feels socially alive.

**Acceptance Criteria:**
- New "Social" tab in BoardContent (replaces "Territory" — keeps 5 tabs)
- Shows follower/following count at top
- Lists content from followed users, sorted by recency
- Tapping an item flies camera to the referenced block
- Empty state: "Follow block owners to see their activity here"
- Loading spinner while fetching
- Auto-refresh on tab switch

**Data Flow:**
1. Fetch following list (1 API call)
2. Fetch content per followed user, max 10 (up to 10 API calls, parallel)
3. Merge + sort by `createdAt` descending

**Integration:** `BoardContent.tsx` — new tab type, fetch function, render section

---

### US-7: Social Stats in Settings (P2 — Polish)

**As a** player,
**I want** to see my follower/following counts in my profile.

**Acceptance Criteria:**
- New "SOCIAL" section in SettingsContent between XP and SETTINGS
- Reuses existing `statsRow`, `statItem`, `statValue`, `statLabel`, `statDivider` styles
- Shows counts from `socialCounts` in tapestry-store

**Integration:** `SettingsContent.tsx` — conditional section render

---

## 3. Architecture

### New Files

| File | Purpose |
|------|---------|
| `apps/mobile/utils/tapestry.ts` | All Tapestry API functions (fetch-based, typed) |
| `apps/mobile/stores/tapestry-store.ts` | Zustand store (profile, following, content cache, feed) |

### Modified Files

| File | Changes |
|------|---------|
| `apps/mobile/.env.local` | Add `EXPO_PUBLIC_TAPESTRY_API_URL` + `EXPO_PUBLIC_TAPESTRY_API_KEY` |
| `apps/mobile/eas.json` | Add Tapestry env vars to preview/production profiles |
| `apps/mobile/hooks/useAuthorization.ts` | Fire-and-forget profile creation after `setConnected()` |
| `apps/mobile/hooks/useBlockActions.ts` | Content creation on claim/charge/poke (both code paths) |
| `apps/mobile/components/inspector/InspectorActions.tsx` | New social props + Follow/Like row UI |
| `apps/mobile/components/ui/BlockInspector.tsx` | Social state, follow/like handlers, wiring |
| `apps/mobile/components/board/BoardContent.tsx` | Social tab (replaces Territory), feed fetch + render |
| `apps/mobile/components/settings/SettingsContent.tsx` | Social stats section |

### Data Flow

```
Wallet Connect
  → useAuthorization.ts setConnected()
  → fire-and-forget: findOrCreateProfile(wallet, username)
  → tapestry-store: setProfile(id, profile, socialCounts)

Block Action (Claim/Charge/Poke)
  → useBlockActions.ts handleClaim/Charge/Poke
  → fire-and-forget: createContent(profileId, text, customProps)
  → tapestry-store: setBlockContent(blockId, contentId)

Inspect Block (other player's)
  → BlockInspector useEffect
  → findOrCreateProfile(ownerWallet) → get owner's Tapestry ID
  → checkFollowing(me, owner) → setIsFollowingOwner
  → checkLiked(me, contentId) + getLikeCount(contentId)
  → Pass all to InspectorActions as props

Follow/Like Action
  → InspectorActions button tap
  → BlockInspector handler (optimistic update)
  → followProfile/likeContent API call
  → Revert on error

Social Feed
  → BoardContent "Social" tab selected
  → getFollowing(myId) → list of followed IDs
  → getContentByProfile(id) for each (parallel, max 10)
  → Merge + sort → render
```

### Tapestry API Key Security

For hackathon: `EXPO_PUBLIC_` env var is acceptable. Tapestry keys are namespace-scoped (can only create/read within our namespace), not payment keys. For production: proxy through game server.

---

## 4. Implementation Phases

### Phase 1: Foundation (~45 min)

**Goal:** API wrapper + store + profile creation on wallet connect

| Step | File | Action |
|------|------|--------|
| 1.1 | `.env.local` + `eas.json` | Add Tapestry API URL + key |
| 1.2 | `utils/tapestry.ts` | **Create** — all API functions with types |
| 1.3 | `stores/tapestry-store.ts` | **Create** — profile, following, content cache, feed state |
| 1.4 | `hooks/useAuthorization.ts` | Wire profile creation after `setConnected()` in both connect + hydrate paths |

**Verification:**
- `timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json` — compiles clean
- Manual: connect wallet → check console for Tapestry profile creation log

### Phase 2: Content Creation (~30 min)

**Goal:** Game events become Tapestry social content

| Step | File | Action |
|------|------|--------|
| 2.1 | `hooks/useBlockActions.ts` | Add content creation to handleClaim (offline + multiplayer) |
| 2.2 | `hooks/useBlockActions.ts` | Add content creation to handleCharge (offline + multiplayer) |
| 2.3 | `hooks/useBlockActions.ts` | Add content creation to handlePoke (multiplayer only — poke requires mpConnected) |

**Key Pattern:** ALL calls are fire-and-forget. Check `tapestry-store.profileId` before calling. Cache returned content IDs for likes.

**Verification:**
- Tests still pass: `cd apps/mobile && npx jest`
- Manual: claim a block → check Tapestry dashboard for content

### Phase 3: Social UI — Follow + Like (~60 min)

**Goal:** Follow/like buttons on block inspector

| Step | File | Action |
|------|------|--------|
| 3.1 | `inspector/InspectorActions.tsx` | Add social props to interface + Follow/Like row JSX |
| 3.2 | `ui/BlockInspector.tsx` | Add social state, useEffect for status checks, handlers, wire props |

**Critical Details:**
- Owner's Tapestry profile must be ensured via `findOrCreateProfile` before follow
- `startId` = me (follower), `endId` = them (followee) — naming feels backwards but correct
- Like button only shows if block has a content node (`blockContentMap[blockId]`)
- All status checks fire on block selection change, not on mount

**Verification:**
- TypeScript compiles clean
- Manual: open another player's block → see Follow + Like buttons → tap each

### Phase 4: Social Feed + Settings (~45 min)

**Goal:** Social feed tab on Board + stats in Settings

| Step | File | Action |
|------|------|--------|
| 4.1 | `board/BoardContent.tsx` | Add "Social" tab (replace "Territory"), fetch function, render |
| 4.2 | `settings/SettingsContent.tsx` | Add "SOCIAL" section with follower/following counts |

**Key Details:**
- Feed uses `.map()` not FlatList (avoids nested ScrollView conflict)
- Cap at 10 followed users for feed = max 11 API calls
- Uses existing `relativeTime()` helper in BoardContent
- Settings reuses existing `statsRow`/`statItem`/etc styles

**Verification:**
- TypeScript compiles clean
- Tests still pass
- Manual: follow someone → Board > Social tab → see their activity

### Phase 5: Polish + Testing (~30 min)

**Goal:** Edge cases, manual testing, cleanup

| Step | Action |
|------|--------|
| 5.1 | Test full flow: connect → claim → charge → poke → inspect other's block → follow → like → social feed |
| 5.2 | Test offline graceful degradation (Tapestry API unreachable) |
| 5.3 | Test hydration path (kill app, reopen — profile should restore) |
| 5.4 | Run full test suite: `cd apps/mobile && npx jest` |
| 5.5 | Run typecheck: `timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json` |
| 5.6 | Run `/ui-standards` to verify no hardcoded colors |

---

## 5. Gotchas & Risks

| # | Gotcha | Mitigation |
|---|--------|------------|
| 1 | Tapestry auth is `?apiKey=KEY` query param, NOT a header | Handled in `apiUrl()` helper |
| 2 | Content create is `POST /v1/contents/create` not `/findOrCreate` | Hardcoded in wrapper |
| 3 | `blockchain` + `execution` REQUIRED on content create | Always included |
| 4 | Follow: `startId` = follower, `endId` = followee | Comments in code |
| 5 | Both profiles must exist before follow | `findOrCreateProfile` for owner first |
| 6 | No aggregated feed endpoint | Manual: fetch per-user, merge client-side |
| 7 | `customProperties` request = array, response = object | Types handle both |
| 8 | Rate limits undocumented | Cap feed to 10 users, cache aggressively |
| 9 | DemoBlock has NO `faction`, `ownerName`, `layerIndex` fields | Use `layer`, `owner`, `name` |
| 10 | Zustand reactivity: plain arrays/objects, NOT Map/Set | Store uses `string[]` and `Record<>` |
| 11 | `useBlockActions` has separate offline/multiplayer paths | Content creation in both |
| 12 | Poke only works in multiplayer mode | Only create poke content when `mpConnected` |

---

## 6. Prerequisites

- [x] Tapestry API key (from https://app.usetapestry.dev/)
- [x] Understanding of existing codebase (all files audited)
- [ ] Add API key to `.env.local` before starting implementation

---

## 7. Success Metrics

For the hackathon submission:
1. Tapestry profiles created for all connected wallets
2. Block claims/charges/pokes visible as on-chain social content
3. Follow/unfollow working between players
4. Likes working on blocks with content nodes
5. Social feed showing followed users' activity
6. Zero gameplay regressions — all 222 tests passing
7. TypeScript compiles clean

---

## 8. Out of Scope (for Tapestry bounty)

- Blinks integration (separate bounty, separate phase)
- Exchange Art submission (separate bounty)
- Push notifications for social events (would need server-side Tapestry polling)
- Profile editing UI (Tapestry profile is auto-managed)
- Block comments (Tapestry has no comment API)
- Global feed (no endpoint for all content — only per-user)
