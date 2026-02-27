# Tapestry API — Verified Reference

> Verified 2026-02-26 against docs.usetapestry.dev and npm package socialfi@0.1.14.
> This is the ONLY source of truth for Tapestry API calls in this project.

## Connection

- **Base URL:** `https://api.usetapestry.dev/v1`
- **Dev URL:** `https://api.dev.usetapestry.dev/v1` (for testing — same API, separate data)
- **Auth:** Query parameter `?apiKey=YOUR_KEY` on EVERY request (not a header)
- **Namespace:** Scoped per API key. Set when creating your key at https://app.usetapestry.dev/
- **No SDK required:** The `socialfi` npm package (v0.1.14) is just an axios wrapper. Use direct `fetch()` calls — fewer deps, more control.

## Execution Modes (Write Operations)

Every write endpoint accepts an `execution` field:

| Value | Behavior | Use When |
|-------|----------|----------|
| `FAST_UNCONFIRMED` | Returns ~1s, before on-chain settlement | **Always use this** |
| `QUICK_SIGNATURE` | Returns tx signature without confirmation | Rarely needed |
| `CONFIRMED_AND_PARSED` | Waits ~15s for on-chain confirmation | Never for UX-critical paths |

---

## Profiles

### POST `/v1/profiles/findOrCreate?apiKey=KEY`

Creates a profile if none exists for this wallet in your namespace, or returns the existing one. **Idempotent — safe to call on every app open.**

**Request:**
```json
{
  "walletAddress": "7xKX...base58",
  "username": "CryptoKid",
  "id": "cryptokid",
  "bio": "Keeper on The Monolith",
  "blockchain": "SOLANA",
  "execution": "FAST_UNCONFIRMED",
  "customProperties": [
    { "key": "faction", "value": "furnace" },
    { "key": "app", "value": "the-monolith" }
  ]
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `walletAddress` | YES | Base58 Solana pubkey |
| `username` | YES | Display name |
| `id` | no | Defaults to `username` value. Used as the profile's unique ID in all other endpoints. |
| `bio` | no | |
| `blockchain` | no | Defaults to `"SOLANA"` |
| `execution` | no | Defaults to `"FAST_UNCONFIRMED"` |
| `customProperties` | no | Array of `{key, value}` string pairs. Flat — no nesting. |

**Response:**
```json
{
  "profile": {
    "id": "cryptokid",
    "username": "CryptoKid",
    "bio": "Keeper on The Monolith",
    "walletAddress": "7xKX...base58",
    "blockchain": "SOLANA",
    "namespace": "the-monolith",
    "customProperties": { "faction": "furnace", "app": "the-monolith" },
    "createdAt": "2026-02-26T...",
    "updatedAt": "2026-02-26T..."
  },
  "socialCounts": {
    "followers": 0,
    "following": 0,
    "posts": 0,
    "likes": 0
  }
}
```

**Gotcha:** No `created: boolean` in response — you cannot tell if it was just created or already existed.

### GET `/v1/profiles/{profileId}?apiKey=KEY`

Returns profile + socialCounts. Same response shape as findOrCreate.

### GET `/v1/profiles/search?apiKey=KEY`

**Query params:**
- `walletAddress` — search by wallet
- `shouldIncludeExternalProfiles=true` — include profiles from OTHER Tapestry apps
- `limit`, `offset` — pagination

**This is how cross-app profile import works.** Call with `shouldIncludeExternalProfiles=true` and a wallet address. If the user has profiles in other Tapestry-powered apps, they're returned here. Use their username/bio for pre-filling onboarding.

---

## Follows

**Resource path:** `/v1/followers` (NOT `/v1/follows`)

### POST `/v1/followers?apiKey=KEY` — Follow

```json
{
  "startId": "my-profile-id",
  "endId": "their-profile-id",
  "blockchain": "SOLANA",
  "execution": "FAST_UNCONFIRMED"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `startId` | YES | The follower (me) — uses profile `id` field |
| `endId` | YES | The followee (them) — uses profile `id` field |
| `blockchain` | no | |
| `execution` | no | |

**CRITICAL:** `startId` = follower, `endId` = followee. Naming feels backwards ("start following end") but this is correct.

**CRITICAL:** Both `startId` and `endId` must be profile IDs that exist in your namespace. You cannot follow a profile from another namespace. Ensure `findOrCreate` has been called for BOTH users before attempting a follow.

### DELETE `/v1/followers?apiKey=KEY` — Unfollow

Same body shape as POST.

### GET `/v1/followers/check?apiKey=KEY&followerId=X&followeeId=Y`

**Response:**
```json
{
  "isFollowing": true,
  "followId": "abc123",
  "followedAt": "2026-02-26T..."
}
```

Returns `{ "isFollowing": false }` if not following (exact shape TBD — may have additional fields or not).

### GET `/v1/profiles/followers/{profileId}?apiKey=KEY&limit=20&offset=0`

**Response:**
```json
{
  "followers": [
    {
      "profile": { "id": "...", "username": "...", "walletAddress": "..." },
      "followRelation": { "id": "...", "createdAt": "..." },
      "socialCounts": { "followers": 0, "following": 0 }
    }
  ],
  "pagination": { "total": 5, "limit": 20, "offset": 0, "hasMore": false }
}
```

### GET `/v1/profiles/following/{profileId}?apiKey=KEY&limit=20&offset=0`

Same response shape as followers.

### GET `/v1/profiles/followers/{profileId}/count?apiKey=KEY`

```json
{ "profileId": "cryptokid", "count": 12, "lastUpdated": "2026-02-26T..." }
```

### GET `/v1/profiles/following/{profileId}/count?apiKey=KEY`

Same shape.

---

## Content

### POST `/v1/contents/create?apiKey=KEY`

**NOT `/v1/contents/findOrCreate`.** The original plan was wrong here.

```json
{
  "profileId": "cryptokid",
  "content": "Claimed Block #42 on Layer 5 for Furnace!",
  "contentType": "text",
  "blockchain": "SOLANA",
  "execution": "FAST_UNCONFIRMED",
  "customProperties": [
    { "key": "type", "value": "block_claim" },
    { "key": "blockId", "value": "42" },
    { "key": "layerIndex", "value": "5" },
    { "key": "faction", "value": "furnace" }
  ]
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `profileId` | YES | |
| `content` | YES | Text content |
| `contentType` | YES | `"text"` for our use case. Enum not fully documented ("text, image, video, etc.") |
| `blockchain` | **YES** | REQUIRED here (optional on other endpoints) |
| `execution` | **YES** | REQUIRED here (optional on other endpoints) |
| `customProperties` | no | |

**Response:**
```json
{
  "content": {
    "id": "content-abc123",
    "profileId": "cryptokid",
    "content": "Claimed Block #42...",
    "contentType": "text",
    "blockchain": "SOLANA",
    "customProperties": { "type": "block_claim", "blockId": "42" },
    "createdAt": "2026-02-26T...",
    "updatedAt": "2026-02-26T..."
  },
  "engagement": {
    "likes": 0,
    "comments": 0,
    "shares": 0
  }
}
```

### GET `/v1/contents/{contentId}?apiKey=KEY`

Returns single content + engagement.

### GET `/v1/contents/profile/{profileId}?apiKey=KEY&limit=10&offset=0`

Returns paginated content from a specific user. **This is the ONLY way to get a user's posts.**

### POST `/v1/contents/delete?apiKey=KEY`

**DELETE is a POST, not a DELETE method.** Non-standard.

```json
{
  "id": "content-abc123",
  "blockchain": "SOLANA",
  "execution": "FAST_UNCONFIRMED"
}
```

---

## Likes

### POST `/v1/likes?apiKey=KEY` — Like

```json
{
  "profileId": "my-profile-id",
  "contentId": "content-abc123",
  "blockchain": "SOLANA",
  "execution": "FAST_UNCONFIRMED"
}
```

**Response:**
```json
{
  "like": { "id": "like-xyz", "profileId": "...", "contentId": "...", "createdAt": "..." },
  "user": { "id": "...", "username": "...", "profileImage": "..." }
}
```

### DELETE `/v1/likes?apiKey=KEY` — Unlike

Same body as POST. Response: `{ "success": true, "message": "..." }`

### GET `/v1/likes/check?apiKey=KEY&profileId=X&contentId=Y`

```json
{ "hasLiked": true, "likeId": "like-xyz", "likedAt": "2026-02-26T..." }
```

### GET `/v1/likes/count/{contentId}?apiKey=KEY`

```json
{ "contentId": "content-abc123", "count": 12, "lastUpdated": "2026-02-26T..." }
```

### GET `/v1/likes/content/{contentId}?apiKey=KEY&limit=20&offset=0`

Returns list of likes with user info + pagination.

---

## Known Limitations

### No Aggregated Feed Endpoint

**There is NO "get feed from followed users" API call.** To build a social feed, you must:

1. `GET /v1/profiles/following/{myProfileId}` → list of followed profile IDs
2. For each followed profile: `GET /v1/contents/profile/{followedId}?limit=5` → their recent posts
3. Merge + sort by `createdAt` client-side

**Optimization:** Cache the following list in Zustand. Fetch content in parallel with `Promise.allSettled()`. Limit to 10 most recent follows to cap API calls.

### No Content Type Queries

Cannot query "all content of type block_claim" globally. Content is only retrievable by:
- Content ID (single item)
- Profile ID (all content from one user)

### No Cross-Namespace Content

Content created in your namespace is not visible from other Tapestry apps. Cross-namespace visibility only applies to profile search (`shouldIncludeExternalProfiles`).

### Rate Limits

Not publicly documented. Be conservative:
- Don't hammer in tight loops
- Use `Promise.allSettled()` not sequential awaits for parallel fetches
- Cache aggressively (following list, like status, profile data)

---

## Gotcha Summary

| # | Gotcha |
|---|--------|
| 1 | Auth is `?apiKey=KEY` query param, NOT a header |
| 2 | Content create is `POST /v1/contents/create`, NOT `/contents/findOrCreate` |
| 3 | `blockchain` + `execution` are REQUIRED on content create (optional elsewhere) |
| 4 | Content delete is `POST /v1/contents/delete`, NOT `DELETE /v1/contents/{id}` |
| 5 | Follows use `/v1/followers` (NOT `/v1/follows`) |
| 6 | `startId` = follower, `endId` = followee (feels backwards) |
| 7 | Both profiles must exist in your namespace before creating a follow |
| 8 | No aggregated feed endpoint — must fetch per-followed-user and merge |
| 9 | No content type queries — can't filter by `customProperties` server-side |
| 10 | `customProperties` response is an object `{}`, request is an array `[{key, value}]` |
| 11 | No `created` boolean on findOrCreate — can't tell new vs existing |
| 12 | `socialfi` npm package is v0.1.14, pre-1.0, last updated April 2025 — use fetch instead |
