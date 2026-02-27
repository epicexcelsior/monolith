# Implementation Plan — Graveyard Hackathon

> Step-by-step build order. An LLM agent should be able to follow this exactly.
> Every step lists: files to create/modify, exact code patterns, verified field names.
>
> **AUDIT STATUS:** All code references verified against actual source files 2026-02-26.
> All `DemoBlock` field names, COLORS tokens, component structures, and import paths confirmed.

## Prerequisites

- [x] Tapestry API key (from https://app.usetapestry.dev/)
- [ ] OrbitFlare API key (from https://orbitflare.com/ — free tier)
- [ ] Cloudflare account (for Workers — free tier)

## Branch

```bash
git checkout -b feat/graveyard-hack
```

## Reference Docs (read these first)

- `docs/graveyard-hack/TAPESTRY-API.md` — verified endpoint reference
- `docs/graveyard-hack/BLINKS-API.md` — verified Actions/Blinks spec
- `docs/graveyard-hack/USER-STORIES.md` — user stories + acceptance criteria

---

## CRITICAL: DemoBlock Field Reference

**Source:** `apps/mobile/stores/tower-store.ts` lines 97-113

```typescript
interface DemoBlock {
  id: string;           // format: "block-{layer}-{index}" e.g. "block-5-3"
  layer: number;        // NOT "layerIndex" — layer number (0-24)
  index: number;        // block index within layer
  energy: number;       // 0-100
  ownerColor: string;   // hex color
  owner: string | null; // wallet address (base58) — NOT a display name
  stakedAmount: number;
  position: { x: number; y: number; z: number };
  emoji?: string;       // custom emoji
  name?: string;        // custom block name (NOT owner name)
  style?: number;
  textureId?: number;
  imageIndex?: number;
  lastChargeTime?: number;
  streak?: number;
  lastStreakDate?: string;
}
```

**There is NO `faction`, `layerIndex`, `ownerName`, or `ownerEmoji` field.**
- Use `block.layer` (not `block.layerIndex`)
- Use `block.owner` for wallet address, `block.name` for custom block name
- Owner display name must be looked up separately (truncate wallet address as fallback)

## CRITICAL: Theme Tokens Reference

**Source:** `apps/mobile/constants/theme.ts`

Gold tokens: `COLORS.gold`, `COLORS.goldLight`, `COLORS.goldDark`, `COLORS.goldSubtle`, `COLORS.goldGlow`, `COLORS.goldMid`

All exist and are valid. `COLORS.goldMid = "rgba(212, 168, 71, 0.70)"`.

---

## PHASE 1: Tapestry Foundation (Core Infrastructure)

### Step 1.1: Environment Config

**File:** `apps/mobile/.env.local` (add lines)
```
EXPO_PUBLIC_TAPESTRY_API_URL=https://api.usetapestry.dev/v1
EXPO_PUBLIC_TAPESTRY_API_KEY=your-api-key-here
```

**File:** `apps/mobile/eas.json` — add to `preview.env` and `production.env`:
```json
"EXPO_PUBLIC_TAPESTRY_API_URL": "https://api.usetapestry.dev/v1",
"EXPO_PUBLIC_TAPESTRY_API_KEY": "your-api-key-here"
```

**Note on API key security:** For hackathon, embedding in `EXPO_PUBLIC_` is acceptable. Tapestry API keys are namespace-scoped, not payment keys. For production, proxy through server.

### Step 1.2: Create Tapestry API Wrapper

**Create:** `apps/mobile/utils/tapestry.ts`

This file contains ALL Tapestry API calls. Every function is standalone, uses `fetch()`, and returns typed responses. All write operations are fire-and-forget safe (caller uses `.catch(console.warn)`).

**Full implementation:**

```typescript
// ─── Config ────────────────────────────────────────────
const TAPESTRY_API_URL = process.env.EXPO_PUBLIC_TAPESTRY_API_URL || "https://api.usetapestry.dev/v1";
const TAPESTRY_API_KEY = process.env.EXPO_PUBLIC_TAPESTRY_API_KEY || "";

// ─── Types ─────────────────────────────────────────────

export interface TapestryProfileData {
  id: string;
  username: string;
  bio: string;
  walletAddress: string;
  blockchain: string;
  namespace: string;
  customProperties: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface TapestrySocialCounts {
  followers: number;
  following: number;
  posts: number;
  likes: number;
}

export interface TapestryProfile {
  profile: TapestryProfileData;
  socialCounts: TapestrySocialCounts;
}

export interface TapestryContentData {
  id: string;
  profileId: string;
  content: string;
  contentType: string;
  customProperties: Record<string, string>;
  createdAt: string;
}

export interface TapestryContent {
  content: TapestryContentData;
  engagement: { likes: number; comments: number; shares: number };
}

export interface TapestryContentList {
  contents: TapestryContent[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}

export interface TapestryFollowItem {
  profile: TapestryProfileData;
  socialCounts: { followers: number; following: number };
}

export interface TapestryFollowingList {
  following: TapestryFollowItem[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}

/** Response from GET /v1/profiles/search — array of profiles from any namespace */
export interface TapestrySearchResult {
  profiles: TapestryProfileData[];
  pagination?: { total: number; limit: number; offset: number; hasMore: boolean };
}

// ─── Helpers ───────────────────────────────────────────

function apiUrl(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${TAPESTRY_API_URL}${path}${separator}apiKey=${TAPESTRY_API_KEY}`;
}

async function tapestryFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = apiUrl(path);
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tapestry ${options.method || "GET"} ${path}: ${res.status} ${text}`);
  }
  return res.json();
}

// ─── Profiles ──────────────────────────────────────────

export async function findOrCreateProfile(
  walletAddress: string,
  username: string,
  bio?: string,
  customProps?: { key: string; value: string }[]
): Promise<TapestryProfile> {
  return tapestryFetch<TapestryProfile>("/profiles/findOrCreate", {
    method: "POST",
    body: JSON.stringify({
      walletAddress,
      username,
      bio: bio || "Keeper on The Monolith",
      blockchain: "SOLANA",
      execution: "FAST_UNCONFIRMED",
      ...(customProps ? { customProperties: customProps } : {}),
    }),
  });
}

export async function getProfile(profileId: string): Promise<TapestryProfile> {
  return tapestryFetch<TapestryProfile>(`/profiles/${encodeURIComponent(profileId)}`);
}

export async function searchProfiles(
  walletAddress: string,
  includeExternal = false
): Promise<TapestrySearchResult> {
  const params = new URLSearchParams({ walletAddress });
  if (includeExternal) params.set("shouldIncludeExternalProfiles", "true");
  return tapestryFetch<TapestrySearchResult>(`/profiles/search?${params.toString()}`);
}

// ─── Follows ───────────────────────────────────────────
// IMPORTANT: path is /followers (NOT /follows)
// IMPORTANT: startId = follower (me), endId = followee (them)

export async function followProfile(myProfileId: string, theirProfileId: string): Promise<void> {
  await tapestryFetch("/followers", {
    method: "POST",
    body: JSON.stringify({
      startId: myProfileId,
      endId: theirProfileId,
      blockchain: "SOLANA",
      execution: "FAST_UNCONFIRMED",
    }),
  });
}

export async function unfollowProfile(myProfileId: string, theirProfileId: string): Promise<void> {
  await tapestryFetch("/followers", {
    method: "DELETE",
    body: JSON.stringify({
      startId: myProfileId,
      endId: theirProfileId,
      blockchain: "SOLANA",
      execution: "FAST_UNCONFIRMED",
    }),
  });
}

export async function checkFollowing(
  followerId: string,
  followeeId: string
): Promise<{ isFollowing: boolean }> {
  return tapestryFetch<{ isFollowing: boolean }>(
    `/followers/check?followerId=${encodeURIComponent(followerId)}&followeeId=${encodeURIComponent(followeeId)}`
  );
}

export async function getFollowing(
  profileId: string,
  limit = 20
): Promise<TapestryFollowingList> {
  return tapestryFetch<TapestryFollowingList>(
    `/profiles/following/${encodeURIComponent(profileId)}?limit=${limit}&offset=0`
  );
}

export async function getFollowerCount(profileId: string): Promise<number> {
  const result = await tapestryFetch<{ count: number }>(
    `/profiles/followers/${encodeURIComponent(profileId)}/count`
  );
  return result.count;
}

export async function getFollowingCount(profileId: string): Promise<number> {
  const result = await tapestryFetch<{ count: number }>(
    `/profiles/following/${encodeURIComponent(profileId)}/count`
  );
  return result.count;
}

// ─── Content ───────────────────────────────────────────
// IMPORTANT: path is /contents/create (NOT /contents/findOrCreate)
// IMPORTANT: blockchain + execution are REQUIRED here (optional on other endpoints)

export async function createContent(
  profileId: string,
  text: string,
  customProps?: { key: string; value: string }[]
): Promise<TapestryContent> {
  return tapestryFetch<TapestryContent>("/contents/create", {
    method: "POST",
    body: JSON.stringify({
      profileId,
      content: text,
      contentType: "text",
      blockchain: "SOLANA",
      execution: "FAST_UNCONFIRMED",
      ...(customProps ? { customProperties: customProps } : {}),
    }),
  });
}

export async function getContentByProfile(
  profileId: string,
  limit = 10,
  offset = 0
): Promise<TapestryContentList> {
  return tapestryFetch<TapestryContentList>(
    `/contents/profile/${encodeURIComponent(profileId)}?limit=${limit}&offset=${offset}`
  );
}

export async function getContent(contentId: string): Promise<TapestryContent> {
  return tapestryFetch<TapestryContent>(`/contents/${encodeURIComponent(contentId)}`);
}

// ─── Likes ─────────────────────────────────────────────

export async function likeContent(profileId: string, contentId: string): Promise<void> {
  await tapestryFetch("/likes", {
    method: "POST",
    body: JSON.stringify({
      profileId,
      contentId,
      blockchain: "SOLANA",
      execution: "FAST_UNCONFIRMED",
    }),
  });
}

export async function unlikeContent(profileId: string, contentId: string): Promise<void> {
  await tapestryFetch("/likes", {
    method: "DELETE",
    body: JSON.stringify({ profileId, contentId, blockchain: "SOLANA", execution: "FAST_UNCONFIRMED" }),
  });
}

export async function checkLiked(
  profileId: string,
  contentId: string
): Promise<{ hasLiked: boolean }> {
  return tapestryFetch<{ hasLiked: boolean }>(
    `/likes/check?profileId=${encodeURIComponent(profileId)}&contentId=${encodeURIComponent(contentId)}`
  );
}

export async function getLikeCount(contentId: string): Promise<number> {
  const result = await tapestryFetch<{ count: number }>(
    `/likes/count/${encodeURIComponent(contentId)}`
  );
  return result.count;
}
```

### Step 1.3: Create Tapestry Store

**Create:** `apps/mobile/stores/tapestry-store.ts`

**IMPORTANT:** Use `Record<string, string>` not `Map`, and `string[]` not `Set`, for Zustand reactivity. Zustand only triggers re-renders when references change — mutating Map/Set in place won't trigger updates.

```typescript
import { create } from "zustand";
import type { TapestryProfileData, TapestrySocialCounts, TapestryContent } from "@/utils/tapestry";

interface TapestryState {
  // Profile
  profileId: string | null;
  profile: TapestryProfileData | null;
  socialCounts: TapestrySocialCounts | null;

  // Following cache (profile IDs I follow) — plain array, NOT Set
  followingIds: string[];

  // Content cache (blockId → contentId, for likes) — plain object, NOT Map
  blockContentMap: Record<string, string>;

  // Feed cache
  feedItems: TapestryContent[];
  feedLoading: boolean;

  // Share prompt (for post-claim Blinks share)
  showSharePrompt: boolean;
  sharePromptBlockId: string | null;

  // Actions
  setProfile: (profileId: string, profile: TapestryProfileData, socialCounts: TapestrySocialCounts) => void;
  addFollowing: (profileId: string) => void;
  removeFollowing: (profileId: string) => void;
  setBlockContent: (blockId: string, contentId: string) => void;
  getBlockContentId: (blockId: string) => string | undefined;
  setFeed: (items: TapestryContent[]) => void;
  setFeedLoading: (loading: boolean) => void;
  setShowSharePrompt: (show: boolean, blockId?: string) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  profileId: null,
  profile: null,
  socialCounts: null,
  followingIds: [],
  blockContentMap: {},
  feedItems: [],
  feedLoading: false,
  showSharePrompt: false,
  sharePromptBlockId: null,
};

export const useTapestryStore = create<TapestryState>((set, get) => ({
  ...INITIAL_STATE,

  setProfile: (profileId, profile, socialCounts) =>
    set({ profileId, profile, socialCounts }),

  addFollowing: (profileId) =>
    set((s) => ({
      followingIds: s.followingIds.includes(profileId)
        ? s.followingIds
        : [...s.followingIds, profileId],
    })),

  removeFollowing: (profileId) =>
    set((s) => ({
      followingIds: s.followingIds.filter((id) => id !== profileId),
    })),

  setBlockContent: (blockId, contentId) =>
    set((s) => ({
      blockContentMap: { ...s.blockContentMap, [blockId]: contentId },
    })),

  // NOTE: This is NOT a selector — call it imperatively via getState()
  // Do NOT use inside a Zustand selector (e.g., useTapestryStore((s) => s.getBlockContentId("42")))
  // Instead: useTapestryStore.getState().getBlockContentId("42")
  getBlockContentId: (blockId) => get().blockContentMap[blockId],

  setFeed: (items) => set({ feedItems: items }),
  setFeedLoading: (loading) => set({ feedLoading: loading }),

  setShowSharePrompt: (show, blockId) =>
    set({ showSharePrompt: show, sharePromptBlockId: blockId ?? null }),

  reset: () => set(INITIAL_STATE),
}));
```

### Step 1.4: Wire Profile Creation to Wallet Connect

**Modify:** `apps/mobile/hooks/useAuthorization.ts`

**New imports to add (at top of file):**
```typescript
import { findOrCreateProfile, searchProfiles } from "@/utils/tapestry";
import { useTapestryStore } from "@/stores/tapestry-store";
import { usePlayerStore } from "@/stores/player-store";
```

**NOTE:** `usePlayerStore` is NOT currently imported in this file — you must add it.

**Where to insert (connect function):** After `setConnected()` call. The local variable `pubkey` is defined earlier in the `transact` callback as `const pubkey = base64ToPublicKey(account.address)`. The fire-and-forget block must go AFTER `setConnected()` (which uses `pubkey`), using the same local `pubkey` variable.

```typescript
// === INSERT AFTER setConnected() in connect() ===
// Fire-and-forget — never block wallet connect
const walletAddr = pubkey.toBase58();
(async () => {
  try {
    const username = usePlayerStore.getState().username || walletAddr.slice(0, 8);

    // Check for cross-app profiles first (optional — skip if slow)
    let externalUsername: string | undefined;
    try {
      const search = await searchProfiles(walletAddr, true);
      externalUsername = search?.profiles?.[0]?.username;
    } catch { /* cross-app search is optional */ }

    // Create/find our profile
    const result = await findOrCreateProfile(
      walletAddr,
      externalUsername || username,
      "Keeper on The Monolith"
    );

    useTapestryStore.getState().setProfile(
      result.profile.id,
      result.profile,
      result.socialCounts
    );
  } catch (e) {
    console.warn("Tapestry profile creation failed:", e);
  }
})();
```

**Where to insert (hydrateCachedAuth function):** Same pattern, but note: `hydrateCachedAuth` returns early if `hasOnboarded` is null (first-time users). This means first-time users only get Tapestry profile creation from `connect()`, NOT from hydration. This is fine — the profile will be created when they connect their wallet.

For returning users (hydration path), add the same fire-and-forget block after `setConnected()` in `hydrateCachedAuth()`. Use `useWalletStore.getState().publicKey!.toBase58()` since by this point the store is updated.

---

## PHASE 2: Tapestry Content Creation (Block Events → Social Posts)

### Step 2.1: Create Content on Block Actions

**Modify:** `apps/mobile/hooks/useBlockActions.ts`

**New imports to add (at top of file):**
```typescript
import { createContent } from "@/utils/tapestry";
import { useTapestryStore } from "@/stores/tapestry-store";
```

**Helper function (add near top of file, after imports):**
```typescript
function truncAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}
```

#### 2.1a: Claim Content

**IMPORTANT:** In multiplayer mode (`mpConnected === true`), `handleClaim` calls `sendClaim()` and immediately calls `triggerCelebration()` — there is NO synchronous "claim succeeded" hook. The server confirms the claim later via `onClaimResult` callback. Therefore:

- **In offline mode** (the `else` branch of `handleClaim`): Insert Tapestry content creation after `claimBlock()` succeeds.
- **In multiplayer mode**: Insert Tapestry content creation in the `onClaimResult` handler inside the `useEffect` that listens for server responses.

**Offline mode — inside `handleClaim`, in the `else` branch, after `claimBlock(selectedBlockId, ...)` call:**
```typescript
// Fire-and-forget Tapestry content
const tProfileId = useTapestryStore.getState().profileId;
if (tProfileId) {
  const b = demoBlocks.find((d) => d.id === selectedBlockId);
  createContent(tProfileId, `Claimed Block #${selectedBlockId} on Layer ${b?.layer ?? "?"}!`, [
    { key: "type", value: "block_claim" },
    { key: "blockId", value: selectedBlockId },
    { key: "layer", value: String(b?.layer ?? 0) },
  ]).then((result) => {
    useTapestryStore.getState().setBlockContent(selectedBlockId, result.content.id);
  }).catch(console.warn);
}
```

**Multiplayer mode — inside the `onClaimResult` handler (the `useEffect` that calls `onClaimResult(...)`):**
The `onClaimResult` callback receives a `ClaimResult` which has `blockId` and other fields. Add after the XP update logic:
```typescript
// Fire-and-forget Tapestry content for multiplayer claim
const tProfileId = useTapestryStore.getState().profileId;
if (tProfileId && result.blockId) {
  const b = useTowerStore.getState().demoBlocks.find((d) => d.id === result.blockId);
  createContent(tProfileId, `Claimed Block #${result.blockId} on Layer ${b?.layer ?? "?"}!`, [
    { key: "type", value: "block_claim" },
    { key: "blockId", value: result.blockId },
    { key: "layer", value: String(b?.layer ?? 0) },
  ]).then((res) => {
    useTapestryStore.getState().setBlockContent(result.blockId!, res.content.id);
  }).catch(console.warn);
}
```

#### 2.1b: Charge Content

**In the offline `handleCharge` handler, inside the `else if (result.success)` branch:**
The variable `result.streak` contains the NEW streak value. The block's `id` is `selectedBlockId`.

```typescript
const tProfileId = useTapestryStore.getState().profileId;
if (tProfileId && selectedBlockId) {
  createContent(tProfileId, `Charged Block #${selectedBlockId} — Day ${result.streak ?? 1} streak!`, [
    { key: "type", value: "charge" },
    { key: "blockId", value: selectedBlockId },
    { key: "streak", value: String(result.streak ?? 1) },
  ]).catch(console.warn);
}
```

**In the multiplayer `onChargeResult` handler:** Same pattern, using `result.blockId` and `result.streak` from the `ChargeResult` type.

#### 2.1c: Poke Content

**IMPORTANT:** `DemoBlock` has NO `ownerName` field. The owner's display name is NOT available on the block object. Use `truncAddr(block.owner)` as the display name.

**In `handlePoke`, after `sendPoke()` is called (or in offline branch):**
```typescript
const tProfileId = useTapestryStore.getState().profileId;
if (tProfileId && selectedBlockId) {
  const b = demoBlocks.find((d) => d.id === selectedBlockId);
  const ownerDisplay = b?.owner ? truncAddr(b.owner) : "someone";
  createContent(tProfileId, `Poked ${ownerDisplay}'s Block #${selectedBlockId}!`, [
    { key: "type", value: "poke" },
    { key: "blockId", value: selectedBlockId },
  ]).catch(console.warn);
}
```

**In the multiplayer `onPokeResult` handler:** The `PokeResult` type has `blockId` but NOT `ownerName`. Look up the block from the store:
```typescript
const tProfileId = useTapestryStore.getState().profileId;
if (tProfileId && result.blockId) {
  const b = useTowerStore.getState().demoBlocks.find((d) => d.id === result.blockId);
  const ownerDisplay = b?.owner ? truncAddr(b.owner) : "someone";
  createContent(tProfileId, `Poked ${ownerDisplay}'s Block #${result.blockId}!`, [
    { key: "type", value: "poke" },
    { key: "blockId", value: result.blockId },
  ]).catch(console.warn);
}
```

**Key pattern:** ALL Tapestry calls are fire-and-forget. A Tapestry failure must NEVER prevent gameplay. Use `.catch(console.warn)`.

---

## PHASE 3: Tapestry Social UI (Follow + Like + Feed)

### Step 3.1: Follow + Like on Block Inspector

**Modify:** `apps/mobile/components/inspector/InspectorActions.tsx`

**New props to add to `InspectorActionsProps` interface:**
```typescript
// Add these to the existing InspectorActionsProps interface:
tapestryProfileId?: string | null;
blockContentId?: string | null;
isFollowing?: boolean;
hasLiked?: boolean;
likeCount?: number;
onFollow?: () => void;
onUnfollow?: () => void;
onLike?: () => void;
onUnlike?: () => void;
```

**New UI section — INSERTION POINT:** Inside the `{!isUnclaimed && !isOwner && block.owner && (...)}` branch. This branch contains:
1. Owner display row
2. Poke button (wrapped in `{isWalletConnected && mpConnected && !isDormant && (...)}`)
3. Dormant/reclaim section (wrapped in `{isDormant && (...)}`)

**Insert the social row AFTER the poke conditional, BEFORE the dormant conditional:**

```tsx
{/* Social actions — Follow + Like */}
{tapestryProfileId && (
  <View style={styles.actionRow}>
    {blockContentId != null && (
      <TouchableOpacity
        style={[styles.actionChip, hasLiked && { backgroundColor: COLORS.goldMid }]}
        onPress={() => {
          hapticButtonPress();
          playButtonTap();
          hasLiked ? onUnlike?.() : onLike?.();
        }}
      >
        <Text style={styles.actionChipText}>
          {hasLiked ? "❤️" : "🤍"} {likeCount ?? 0}
        </Text>
      </TouchableOpacity>
    )}
    <TouchableOpacity
      style={[styles.actionChip, isFollowing && { backgroundColor: COLORS.goldMid }]}
      onPress={() => {
        hapticButtonPress();
        playButtonTap();
        isFollowing ? onUnfollow?.() : onFollow?.();
      }}
    >
      <Text style={styles.actionChipText}>
        {isFollowing ? "Following ✓" : "+ Follow"}
      </Text>
    </TouchableOpacity>
  </View>
)}
```

**Style note:** Instead of adding `actionChipActive` style (which would be used nowhere else), use inline `{ backgroundColor: COLORS.goldMid }` — this is simpler and avoids adding unnecessary styles.

### Step 3.2: Wire Follow/Like Logic in BlockInspector

**Modify:** `apps/mobile/components/ui/BlockInspector.tsx`

**IMPORTANT:** The share implementation (`handleShare`) lives in THIS file (lines ~249-270), NOT in `InspectorActions.tsx`. The `onShare` prop passed to InspectorActions is a callback defined here.

**New imports (add to existing imports):**
```typescript
import { useTapestryStore } from "@/stores/tapestry-store";
import {
  followProfile,
  unfollowProfile,
  checkFollowing,
  checkLiked,
  getLikeCount,
  likeContent,
  unlikeContent,
  findOrCreateProfile,
} from "@/utils/tapestry";
```

**New state + effects (add inside the component, near other state declarations):**

```typescript
// ─── Tapestry social state ─────────────────────────────
const tapestryProfileId = useTapestryStore((s) => s.profileId);
const blockContentMap = useTapestryStore((s) => s.blockContentMap);

const [isFollowingOwner, setIsFollowingOwner] = useState(false);
const [hasLikedBlock, setHasLikedBlock] = useState(false);
const [blockLikeCount, setBlockLikeCount] = useState(0);
const [ownerTapestryId, setOwnerTapestryId] = useState<string | null>(null);

// Derived: get content ID for current block (not a selector — read from map directly)
const currentBlockContentId = block?.id ? blockContentMap[block.id] : undefined;

// Check follow/like status when viewing another player's block
useEffect(() => {
  if (!tapestryProfileId || !block?.id || !block.owner || isOwner) {
    // Reset social state when not viewing other's block
    setIsFollowingOwner(false);
    setHasLikedBlock(false);
    setBlockLikeCount(0);
    setOwnerTapestryId(null);
    return;
  }

  // Ensure owner has a Tapestry profile in our namespace
  // (REQUIRED: both profiles must exist in our namespace before we can follow)
  const ownerAddr = block.owner;
  const ownerName = block.name || ownerAddr.slice(0, 8);

  findOrCreateProfile(ownerAddr, ownerName)
    .then((result) => {
      const ownerId = result.profile.id;
      setOwnerTapestryId(ownerId);
      return checkFollowing(tapestryProfileId!, ownerId);
    })
    .then((result) => setIsFollowingOwner(result.isFollowing))
    .catch(console.warn);

  // Check like status if content node exists for this block
  if (currentBlockContentId) {
    checkLiked(tapestryProfileId, currentBlockContentId)
      .then((result) => setHasLikedBlock(result.hasLiked))
      .catch(console.warn);
    getLikeCount(currentBlockContentId)
      .then((count) => setBlockLikeCount(count))
      .catch(console.warn);
  }
  // NOTE: Do NOT add ownerTapestryId to deps — it's set inside this effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [block?.id, tapestryProfileId, isOwner, currentBlockContentId]);

// Follow handler — optimistic update
const handleTapestryFollow = useCallback(() => {
  if (!tapestryProfileId || !ownerTapestryId) return;
  setIsFollowingOwner(true);
  followProfile(tapestryProfileId, ownerTapestryId)
    .then(() => useTapestryStore.getState().addFollowing(ownerTapestryId))
    .catch(() => setIsFollowingOwner(false));
}, [tapestryProfileId, ownerTapestryId]);

const handleTapestryUnfollow = useCallback(() => {
  if (!tapestryProfileId || !ownerTapestryId) return;
  setIsFollowingOwner(false);
  unfollowProfile(tapestryProfileId, ownerTapestryId)
    .then(() => useTapestryStore.getState().removeFollowing(ownerTapestryId))
    .catch(() => setIsFollowingOwner(true));
}, [tapestryProfileId, ownerTapestryId]);

// Like handler — optimistic update
const handleTapestryLike = useCallback(() => {
  if (!tapestryProfileId || !currentBlockContentId) return;
  setHasLikedBlock(true);
  setBlockLikeCount((c) => c + 1);
  likeContent(tapestryProfileId, currentBlockContentId).catch(() => {
    setHasLikedBlock(false);
    setBlockLikeCount((c) => c - 1);
  });
}, [tapestryProfileId, currentBlockContentId]);

const handleTapestryUnlike = useCallback(() => {
  if (!tapestryProfileId || !currentBlockContentId) return;
  setHasLikedBlock(false);
  setBlockLikeCount((c) => c - 1);
  unlikeContent(tapestryProfileId, currentBlockContentId).catch(() => {
    setHasLikedBlock(true);
    setBlockLikeCount((c) => c + 1);
  });
}, [tapestryProfileId, currentBlockContentId]);
```

**Pass to InspectorActions (find the `<InspectorActions` JSX and add props):**
```tsx
<InspectorActions
  // ... existing props ...
  tapestryProfileId={tapestryProfileId}
  blockContentId={currentBlockContentId ?? null}
  isFollowing={isFollowingOwner}
  hasLiked={hasLikedBlock}
  likeCount={blockLikeCount}
  onFollow={handleTapestryFollow}
  onUnfollow={handleTapestryUnfollow}
  onLike={handleTapestryLike}
  onUnlike={handleTapestryUnlike}
/>
```

### Step 3.3: Social Feed Tab on Board

**Modify:** `apps/mobile/components/board/BoardContent.tsx`

**Changes in order:**

**1. Add imports (to existing import block at top):**
```typescript
import { ActivityIndicator, FlatList } from "react-native";  // ADD to existing RN import
import { getFollowing, getContentByProfile, type TapestryContent } from "@/utils/tapestry";
import { useTapestryStore } from "@/stores/tapestry-store";
```

**NOTE:** `ActivityIndicator` and `FlatList` are NOT currently imported in this file. You MUST add them to the `react-native` import on line 8.

**2. Update LeaderboardTab type (line 20):**
```typescript
type LeaderboardTab = "skyline" | "brightest" | "streak" | "territory" | "xp" | "social";
```

**3. Update LEADERBOARD_TABS array (line 62-68):**
Replace `"territory"` with `"social"` to keep the sub-tab count at 5 (these are sub-tabs inside the Board bottom sheet — NOT the main nav. The main nav stays Tower/Board/Me):
```typescript
const LEADERBOARD_TABS: { key: LeaderboardTab; label: string }[] = [
  { key: "xp", label: "XP" },
  { key: "skyline", label: "Skyline" },
  { key: "brightest", label: "Brightest" },
  { key: "streak", label: "Streaks" },
  { key: "social", label: "Social" },
];
```

**4. Add `fetchSocialFeed` function (near other async functions like `fetchXpLeaderboard`):**
```typescript
async function fetchSocialFeed(myProfileId: string): Promise<TapestryContent[]> {
  const following = await getFollowing(myProfileId, 10);
  const results = await Promise.allSettled(
    following.following.map((f) =>
      getContentByProfile(f.profile.id, 5).catch(() => ({ contents: [] } as any))
    )
  );
  const allContent: TapestryContent[] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value?.contents) {
      allContent.push(...result.value.contents);
    }
  }
  return allContent.sort(
    (a, b) => new Date(b.content.createdAt).getTime() - new Date(a.content.createdAt).getTime()
  );
}
```

**5. Add state + effect inside the component:**
```typescript
const tapestryProfileId = useTapestryStore((s) => s.profileId);
const socialCounts = useTapestryStore((s) => s.socialCounts);
const [socialFeed, setSocialFeed] = useState<TapestryContent[]>([]);
const [socialLoading, setSocialLoading] = useState(false);

useEffect(() => {
  if (activeTab !== "social" || !tapestryProfileId) return;
  setSocialLoading(true);
  fetchSocialFeed(tapestryProfileId)
    .then(setSocialFeed)
    .catch(console.warn)
    .finally(() => setSocialLoading(false));
}, [activeTab, tapestryProfileId]);
```

**6. Add Social tab rendering (in the JSX):**

**IMPORTANT:** The existing content area uses `ScrollView`. A `FlatList` nested inside `ScrollView` breaks scrolling. Use `scrollEnabled={false}` on the FlatList to disable its own scroll — let the parent ScrollView handle it.

Find where the leaderboard entries render (after the tab buttons). Add this conditional alongside the existing tab rendering:

```tsx
{activeTab === "social" && (
  <View style={{ paddingHorizontal: SPACING.md }}>
    {socialCounts && (
      <View style={{ flexDirection: "row", justifyContent: "center", gap: SPACING.md, marginBottom: SPACING.md }}>
        <Text style={{ ...TEXT.caption, color: COLORS.textSecondary }}>{socialCounts.followers} followers</Text>
        <Text style={{ ...TEXT.caption, color: COLORS.textMuted }}>·</Text>
        <Text style={{ ...TEXT.caption, color: COLORS.textSecondary }}>{socialCounts.following} following</Text>
      </View>
    )}
    {socialLoading ? (
      <ActivityIndicator color={COLORS.gold} style={{ marginTop: SPACING.xl }} />
    ) : socialFeed.length === 0 ? (
      <Text style={{ ...TEXT.caption, color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.xl }}>
        Follow block owners to see their activity here
      </Text>
    ) : (
      socialFeed.map((item) => {
        const blockId = item.content.customProperties?.blockId;
        return (
          <TouchableOpacity
            key={item.content.id}
            style={{ paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border }}
            onPress={() => {
              if (blockId) {
                selectBlock(blockId);
                onSelectBlock?.(blockId);
              }
            }}
          >
            <Text style={{ ...TEXT.body, color: COLORS.textPrimary }}>{item.content.content}</Text>
            <Text style={{ ...TEXT.caption, color: COLORS.textMuted, marginTop: 2 }}>
              {relativeTime(item.content.createdAt)}
            </Text>
          </TouchableOpacity>
        );
      })
    )}
  </View>
)}
```

**NOTE:** Uses `relativeTime()` which ALREADY EXISTS in this file (line 51-59). Do NOT create a duplicate `formatRelativeTime`.

**NOTE:** Uses `selectBlock` — add to the existing `useTowerStore` selector if not already extracted:
```typescript
const selectBlock = useTowerStore((s) => s.selectBlock);
```

**NOTE:** Uses `.map()` instead of `FlatList` to avoid the nested-scroll problem entirely. This is simpler and works because the feed is capped at ~50 items.

### Step 3.4: Social Stats in Settings

**Modify:** `apps/mobile/components/settings/SettingsContent.tsx`

**New import:**
```typescript
import { useTapestryStore } from "@/stores/tapestry-store";
```

**Inside the component:**
```typescript
const socialCounts = useTapestryStore((s) => s.socialCounts);
```

**In JSX — insert between the XP section and the SETTINGS section.**

**IMPORTANT:** The styles `statsRow`, `statItem`, `statValue`, `statLabel`, `statDivider` ALREADY EXIST in this file's StyleSheet. Reuse them — do NOT redefine.

```tsx
{socialCounts && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>SOCIAL</Text>
    <View style={styles.statsRow}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{socialCounts.followers}</Text>
        <Text style={styles.statLabel}>Followers</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{socialCounts.following}</Text>
        <Text style={styles.statLabel}>Following</Text>
      </View>
    </View>
  </View>
)}
```

---

## PHASE 4-8: Blinks + Exchange Art + Submission

See `docs/graveyard-hack/BLINKS-API.md` for the full Blinks spec and OrbitFlare reference.

The Blinks implementation follows the OrbitFlare template pattern from https://github.com/orbitflare/templates/tree/main/solana-blinks-axum — a Rust/Axum backend with Next.js frontend. We adapt the TypeScript patterns from their `frontend/src/lib/` directory (types, actions, constants) for our Cloudflare Worker.

**Key pattern from OrbitFlare template:**
- `ActionGetResponse` type mirrors their `spec.rs` / `frontend/src/lib/types.ts`
- CORS via their `cors.rs` pattern → our `ACTIONS_CORS_HEADERS` from `@solana/actions`
- Memo-based transactions follow their `DonateAction` → `DonateMemoAction` chained pattern (donate.rs)
- `ChainState` pattern (base64-encoded JSON in `_chain` query param) for multi-step flows — we don't need this for simple poke/charge
- Transaction serialization: `bincode` serialize → base64 encode (handled by `createPostResponse` in JS)

**Blinks implementation details are deferred to after Tapestry is complete.** When ready:
1. Create `apps/web/` Cloudflare Worker project
2. Port the OrbitFlare template patterns to TypeScript
3. Implement block GET (metadata) and POST (memo tx) handlers
4. Deploy and test on dial.to

**Key corrections from audit (apply when implementing Blinks):**
- Block IDs are `"block-{layer}-{index}"` format (e.g., `"block-5-3"`). Route regex MUST match this: use `/api/actions/block/(.+)` NOT `/api/actions/block/(\d+)`
- `handleShare` function lives in `BlockInspector.tsx` (lines ~249-270), NOT `InspectorActions.tsx`
- Generate MONOLITH_MARKER keypair: `solana-keygen new --outfile monolith-marker.json` and use the pubkey
- OrbitFlare RPC URL format: `https://fra.rpc.orbitflare.com?api_key=YOUR_KEY` — include API key everywhere
- Memo watcher regex should match string blockIds: `monolith:(poke|charge):(.+)` not `\d+`
- `accountKeys[0]` works for legacy txs; use `staticAccountKeys[0]` for versioned txs

---

## Verification Checklist

### After Each Phase

```bash
# TypeScript check (run from repo root)
timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json

# Tests (run from apps/mobile/)
cd apps/mobile && npx jest
```

### Tapestry Complete
- [ ] `apps/mobile/utils/tapestry.ts` — all API functions, typed
- [ ] `apps/mobile/stores/tapestry-store.ts` — Zustand store with plain arrays/objects (not Map/Set)
- [ ] Profile creation on wallet connect in `useAuthorization.ts` (fire-and-forget)
- [ ] Content creation on claim/charge/poke in `useBlockActions.ts` (fire-and-forget)
- [ ] Follow/Unfollow buttons on `InspectorActions.tsx` (other player's blocks only)
- [ ] Like/Unlike buttons on `InspectorActions.tsx` (blocks with content nodes only)
- [ ] Social feed tab on `BoardContent.tsx` (replaces Territory tab)
- [ ] Social stats in `SettingsContent.tsx` (reuses existing style names)
- [ ] TypeScript compiles clean
- [ ] 222 existing mobile tests still pass
- [ ] Manual test: connect wallet → open someone's block → Follow/Like buttons appear

### Blinks Complete
- [ ] Cloudflare Worker deployed
- [ ] actions.json returns rules
- [ ] GET /api/actions/block/:id returns block metadata
- [ ] POST /api/actions/block/:id returns memo transaction
- [ ] CORS headers on all routes + OPTIONS handlers
- [ ] Tested on dial.to — Blink renders, buttons work
- [ ] Share button in mobile app generates Blink URL
- [ ] OrbitFlare RPC used for all Solana connections in Worker
