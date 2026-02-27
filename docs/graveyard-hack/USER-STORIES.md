# User Stories — Graveyard Hackathon

> Organized by bounty, then by priority within each bounty.
> Each story has acceptance criteria and UI context.

---

## Bounty 1: Tapestry — On-Chain Social Layer

### US-1: Profile Creation on Wallet Connect

**As a** player connecting my wallet,
**I want** a Tapestry profile auto-created for me,
**So that** I have an on-chain social identity linked to my gameplay.

**Acceptance Criteria:**
- [ ] On successful wallet connect, `POST /v1/profiles/findOrCreate` is called (fire-and-forget)
- [ ] Profile uses the player's existing username (from Supabase/player-store) or truncated wallet address as fallback
- [ ] Profile ID stored in a new `tapestry-store.ts` Zustand store
- [ ] If the call fails, gameplay is NOT blocked — Tapestry is a non-critical enhancement
- [ ] Works on app boot (hydrateCachedAuth) AND fresh connect

**Integration Point:** `apps/mobile/hooks/useAuthorization.ts` — after `setConnected()` call

---

### US-2: Cross-App Profile Import (Onboarding)

**As a** new player who already uses other Tapestry-powered Solana apps,
**I want** the app to find my existing profile and pre-fill my username,
**So that** my identity carries over and onboarding is faster.

**Acceptance Criteria:**
- [ ] On first wallet connect (no existing profile in our namespace), call `GET /v1/profiles/search?walletAddress=X&shouldIncludeExternalProfiles=true`
- [ ] If external profiles found, use the first result's username as a suggestion
- [ ] Show a subtle "Welcome back, {name}!" message (not a blocking modal)
- [ ] If no external profiles, proceed with normal username flow
- [ ] Cross-app import is one-time, on profile creation only

**Integration Point:** Inside the tapestry profile creation logic in `tapestry-store.ts`

**Priority:** Medium — impressive for judges but not core functionality. Cut if running out of time.

---

### US-3: Block Claims as Social Content

**As a** player who just claimed a block,
**I want** that claim to appear as a social event on Tapestry,
**So that** my followers can see my activity and the tower feels alive.

**Acceptance Criteria:**
- [ ] On successful claim, `POST /v1/contents/create` called (fire-and-forget)
- [ ] Content text: `"Claimed Block #{blockId} on Layer {layerIndex} for {faction}"`
- [ ] Custom properties include: `type=block_claim`, `blockId`, `layerIndex`, `faction`
- [ ] Content ID stored/cached for like functionality (the block's "post")
- [ ] Also creates content for charge events: `"Charged Block #{blockId} — Day {streak} streak!"`
- [ ] Also creates content for poke events: `"Poked {ownerName}'s Block #{blockId}!"`
- [ ] API failures never block gameplay — all calls are fire-and-forget with `.catch(console.warn)`

**Integration Point:** `apps/mobile/hooks/useBlockActions.ts` — inside `handleClaim`, `handleCharge`, `handlePoke`

**Content Type Mapping:**

| Game Event | Tapestry Content | customProperties |
|-----------|-----------------|-----------------|
| Claim | "Claimed Block #{id} on Layer {n} for {faction}" | `type=block_claim, blockId, layerIndex, faction` |
| Charge | "Charged Block #{id} — Day {streak} streak!" | `type=charge, blockId, streak` |
| Poke | "Poked {owner}'s Block #{id}!" | `type=poke, blockId, targetOwner` |

---

### US-4: Follow Block Owners

**As a** player inspecting another player's block,
**I want** to follow them so I see their activity in my social feed,
**So that** spatial proximity on the tower creates organic social connections.

**Acceptance Criteria:**
- [ ] When viewing another player's block in BlockInspector, a **[+ Follow]** button appears
- [ ] Tapping Follow calls `POST /v1/followers` and toggles button to **[Following ✓]**
- [ ] Tapping again calls `DELETE /v1/followers` and toggles back to **[+ Follow]**
- [ ] Follow status checked on inspector open: `GET /v1/followers/check`
- [ ] Both players must have Tapestry profiles in our namespace (ensured by US-1)
- [ ] If the other player doesn't have a Tapestry profile yet, create one via `findOrCreate` using their wallet address before following (their profile uses truncated wallet as username)
- [ ] Haptic + SFX on tap (follow existing pattern: `hapticButtonPress()` + `playButtonTap()`)

**UI Location:** `InspectorActions.tsx` — new row below POKE button when viewing other's block

```
┌────────────────────────────────┐
│  🔥 Block #42 — Furnace        │  ← InspectorHeader
│  Owner: CryptoKid              │
│  Energy: ██████░░ 78%          │  ← InspectorStats
│────────────────────────────────│
│  [POKE 👆]                      │  ← existing
│  [❤️ 12]  [+ Follow]           │  ← NEW social row
│────────────────────────────────│
│  [RECLAIM] (if dormant)        │
└────────────────────────────────┘
```

---

### US-5: Like Blocks

**As a** player inspecting a cool block,
**I want** to "like" it as a quick social signal,
**So that** block owners get recognition and popular blocks are discoverable.

**Acceptance Criteria:**
- [ ] When viewing another player's block, show **[❤️ {count}]** button
- [ ] Tapping Like calls `POST /v1/likes`, increments count, fills heart icon
- [ ] Tapping again calls `DELETE /v1/likes`, decrements, unfills heart
- [ ] Like count fetched on inspector open: `GET /v1/likes/count/{contentId}`
- [ ] Check if already liked: `GET /v1/likes/check`
- [ ] **Requires the block to have a content node** — if the block was claimed before Tapestry integration, there's no content node to like. Handle gracefully: hide the like button OR create a content node on-the-fly.
- [ ] Haptic + SFX on tap

**Dependency:** US-3 (block claims create content nodes). Likes reference the content node ID.

**Fallback for pre-existing blocks:** When inspecting a block that has no Tapestry content node, either:
- (a) Skip the like button (show Follow only), OR
- (b) Create a content node for the block lazily on first like attempt

Recommend option (a) for simplicity. Only blocks claimed after Tapestry integration will have like capability.

---

### US-6: Social Feed Tab

**As a** player,
**I want** to see what people I follow are doing on the tower,
**So that** I feel connected to my neighborhood and the game feels alive.

**Acceptance Criteria:**
- [ ] New "Social" tab added to BoardContent: **Owners | XP | Social**
- [ ] Social tab shows content from followed users, sorted by recency
- [ ] Each item shows: `[username] [action text] · [relative time]`
- [ ] Tapping an item flies the camera to the referenced block (using `blockId` from customProperties)
- [ ] Empty state: "Follow block owners to see their activity here" with a subtle prompt
- [ ] Loading state: skeleton/spinner while fetching
- [ ] Pull-to-refresh or auto-refresh on tab switch
- [ ] Shows follower/following count at top of Social tab

**Data Flow:**
1. Fetch following list: `GET /v1/profiles/following/{myProfileId}?limit=20`
2. For each followed user (parallel, max 10): `GET /v1/contents/profile/{id}?limit=5`
3. Merge all content, sort by `createdAt` descending
4. Cache in tapestry-store to avoid re-fetching on every tab switch

**UI Location:** `BoardContent.tsx` — new tab alongside existing Owners/XP tabs

```
┌──────────────────────────────────┐
│  [Owners] [XP] [Social]          │  ← tab bar (Social is new)
│──────────────────────────────────│
│  12 followers · 5 following      │  ← social stats header
│──────────────────────────────────│
│  CryptoKid claimed Block #42     │
│  Layer 5 · Furnace · 2m ago      │
│──────────────────────────────────│
│  SolWhale charged Block #108     │
│  Day 14 streak! · 15m ago        │
│──────────────────────────────────│
│  Punk99 poked your Block #7!     │
│  · 1h ago                        │
└──────────────────────────────────┘
```

**Performance Note:** Fetching content for N followed users = N API calls. Cap at 10 followed users for feed, cache aggressively. Total: 1 (following list) + up to 10 (content per user) = 11 API calls max per feed load.

---

### US-7: Social Stats in Settings

**As a** player,
**I want** to see my follower/following counts in my profile,
**So that** I can track my social presence on the tower.

**Acceptance Criteria:**
- [ ] SettingsContent shows "Followers" and "Following" counts
- [ ] Data from `GET /v1/profiles/{myProfileId}` → `socialCounts`
- [ ] Positioned in a new "SOCIAL" section between XP and SETTINGS sections
- [ ] Counts refresh on settings open

**UI Location:** `SettingsContent.tsx`

```
┌──────────────────────────────────┐
│  SOCIAL                          │
│  12 Followers  ·  5 Following    │
└──────────────────────────────────┘
```

**Priority:** Low effort, nice polish. Do after core social features.

---

## Bounty 2: OrbitFlare Blinks — Shareable Block Interactions

### US-8: Share Block as Blink (Inspector Button)

**As a** player viewing my own block,
**I want** a "Share" button that generates a Blink URL,
**So that** I can share my block on X/Discord and friends can interact with it.

**Acceptance Criteria:**
- [ ] When viewing own block in BlockInspector, existing "Share" chip generates a Blink URL
- [ ] URL format: `https://{worker-domain}/api/actions/block/{blockId}`
- [ ] Opens native share sheet (React Native `Share.share()`) with the URL + text
- [ ] Share text: "Check out my block on The Monolith! Poke it or charge it 👇 {url}"
- [ ] Haptic + SFX on tap

**Note:** The "Share" button already exists in InspectorActions (see `onShare` prop). We just need to change what it shares — currently it may share a generic link. Update to share the Blink URL.

---

### US-9: Post-Claim Share Prompt

**As a** player who just claimed a block,
**I want** a share prompt after the celebration,
**So that** the dopamine high drives viral sharing.

**Acceptance Criteria:**
- [ ] After claim celebration ends and inspector reopens (~5.5s), show a share card/banner
- [ ] Card: "Share your claim!" with Blink URL + share button
- [ ] Dismissible (tap outside or X button)
- [ ] Auto-dismiss after 8 seconds if not interacted with
- [ ] Only shows if Blinks worker is configured (don't show broken share links)

**Integration Point:** `useClaimCelebration.ts` — add a timer alongside `_inspectorReopenTimer` that triggers a share prompt ~1.5s after inspector reopens.

**Priority:** Medium — high viral impact but requires careful timing with celebration flow. Can be a simple banner rather than a full modal.

---

### US-10: Blink GET — Block Metadata

**As a** web visitor seeing a Monolith Blink URL,
**I want** to see the block's info (owner, faction, energy, layer) rendered as an interactive card,
**So that** I understand what I'm interacting with before signing a transaction.

**Acceptance Criteria:**
- [ ] `GET /api/actions/block/:blockId` returns valid `ActionGetResponse`
- [ ] Icon: static tower image (absolute URL)
- [ ] Title: "The Monolith — Block #{blockId}"
- [ ] Description: "Owned by {ownerName} | {faction} | Energy: {energy}% | Layer {layerIndex}"
- [ ] Three action buttons: "Poke This Block", "Charge This Block", "View on Tower"
- [ ] For unclaimed blocks: different description + buttons ("Claim in App", "View on Tower")
- [ ] CORS headers on response + OPTIONS handler
- [ ] Block data fetched from Supabase (direct query) or game server REST API

**Cloudflare Worker endpoint.**

---

### US-11: Blink POST — Poke via Memo Transaction

**As a** web visitor clicking "Poke This Block" on a Blink,
**I want** to sign a lightweight Solana transaction that pokes the block,
**So that** I can interact with the tower without installing the app.

**Acceptance Criteria:**
- [ ] `POST /api/actions/block/:blockId?action=poke` returns valid `ActionPostResponse`
- [ ] Transaction: single Memo instruction with data `"monolith:poke:{blockId}"`
- [ ] Memo instruction includes user pubkey as signer + Monolith marker address as read-only non-signer
- [ ] Transaction uses OrbitFlare RPC for `recentBlockhash`
- [ ] `feePayer` = user's pubkey (from `request.body.account`)
- [ ] Response `message`: "Poked Block #{blockId}!"
- [ ] Action chaining: `links.next` with `type: "completed"`, title "Poke Sent!"
- [ ] Cost: ~0.000005 SOL (base tx fee only)

**Cloudflare Worker endpoint.**

---

### US-12: Blink POST — Charge via Memo Transaction

**As a** web visitor clicking "Charge This Block" on a Blink,
**I want** to sign a transaction that charges a friend's block,
**So that** I can help maintain their block from the web.

**Acceptance Criteria:**
- [ ] `POST /api/actions/block/:blockId?action=charge` returns valid `ActionPostResponse`
- [ ] Transaction: single Memo instruction with data `"monolith:charge:{blockId}"`
- [ ] Same transaction structure as poke (Memo + marker address)
- [ ] Response `message`: "Charged Block #{blockId}!"
- [ ] Action chaining: completion card

**Cloudflare Worker endpoint.**

---

### US-13: Memo Detection (Server-Side)

**As the** game server,
**I want** to detect poke/charge memo transactions on-chain,
**So that** Blink interactions are processed and reflected in the game state.

**Acceptance Criteria:**
- [ ] Server polls `getSignaturesForAddress(MONOLITH_MARKER_ADDRESS)` via OrbitFlare RPC
- [ ] Poll interval: every 30 seconds
- [ ] For each new signature, fetch tx details and parse memo data
- [ ] Parse format: `monolith:{action}:{blockId}` where action = "poke" or "charge"
- [ ] Route to existing TowerRoom poke/charge logic
- [ ] Deduplicate: track processed signatures to avoid double-processing
- [ ] Log processed memos for debugging

**Integration Point:** `apps/server/src/index.ts` — new background interval, or a dedicated `src/utils/memo-watcher.ts`

**Priority:** Medium-high. Without this, Blinks are showcase-only. With this, they're functional. For the hackathon demo, even showcase-only is acceptable — explain server-side processing in the video.

---

### US-14: OrbitFlare RPC Integration

**As a** developer,
**I want** all Solana RPC calls in the Blinks system to use OrbitFlare,
**So that** we qualify for the OrbitFlare bounty.

**Acceptance Criteria:**
- [ ] Cloudflare Worker uses OrbitFlare RPC for `getLatestBlockhash`
- [ ] Game server uses OrbitFlare RPC for `getSignaturesForAddress` (memo polling)
- [ ] OrbitFlare API key stored as environment variable (Cloudflare Worker secrets / server .env)
- [ ] Free tier (10 RPS) is sufficient
- [ ] Optionally: mobile app swaps to OrbitFlare RPC too (bonus, not required)

---

## Bounty 3: Exchange Art — Collaborative Art (Bonus)

### US-15: Tower Timelapse

**As a** hackathon judge viewing the Exchange Art submission,
**I want** to see a timelapse of the tower evolving as blocks are claimed,
**So that** I understand the tower as collaborative art.

**Acceptance Criteria:**
- [ ] Video/recording showing blocks filling in with faction colors over time
- [ ] Multiple camera angles (orbit, top-down, side view)
- [ ] Either: Remotion-rendered (apps/video/) or screen-recorded with simulated data
- [ ] 30-60 seconds, visually compelling

**Priority:** Low — do last, only if time permits. Screen recording is faster than Remotion setup.

---

## Story Dependency Map

```
US-1 (Profile Creation)
  ├── US-2 (Cross-App Import) — optional enhancement to US-1
  ├── US-3 (Content Creation) — needs profile ID from US-1
  │     └── US-5 (Likes) — needs content node IDs from US-3
  ├── US-4 (Follow) — needs profile IDs from US-1
  │     └── US-6 (Social Feed) — needs following list from US-4
  └── US-7 (Social Stats) — needs profile ID from US-1

US-8 (Share Button) — independent, needs Blinks worker URL
US-9 (Post-Claim Share) — independent, needs Blinks worker URL
US-10 (Blink GET) — independent, Cloudflare Worker
US-11 (Blink Poke POST) — depends on US-10
US-12 (Blink Charge POST) — depends on US-10
US-13 (Memo Detection) — depends on US-11/US-12
US-14 (OrbitFlare RPC) — parallel with all Blinks work

US-15 (Timelapse) — fully independent
```

---

## Technical Notes

### Block ID Format
Block IDs follow the pattern `"block-{layer}-{index}"`, e.g., `"block-5-3"`. They are NOT numeric. All Blinks URLs, Tapestry content custom properties, and memo transactions must use this full string ID.

### Tapestry Namespace
`the-monolith` — set when the API key was created at app.usetapestry.dev.

---

## Definition of Done (per story)

- [ ] Feature works in dev build on physical device (Tapestry) or dial.to (Blinks)
- [ ] No TypeScript errors (`timeout 90 npx tsc --noEmit`)
- [ ] Existing tests still pass (`cd apps/mobile && npx jest`)
- [ ] Follows existing code patterns (haptics + SFX on interactions, theme tokens, fire-and-forget async)
- [ ] No hardcoded colors — use COLORS tokens
- [ ] No blocking API calls — all Tapestry/Blinks calls are fire-and-forget or non-blocking
