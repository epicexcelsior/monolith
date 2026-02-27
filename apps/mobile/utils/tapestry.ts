/**
 * Tapestry API wrapper — all calls use fetch(), typed responses.
 * Every write operation is fire-and-forget safe (caller uses .catch(console.warn)).
 *
 * API Reference: docs/graveyard-hack/TAPESTRY-API.md
 */

// ─── Config ────────────────────────────────────────────
const TAPESTRY_API_URL =
  process.env.EXPO_PUBLIC_TAPESTRY_API_URL || "https://api.usetapestry.dev/v1";
const TAPESTRY_API_KEY =
  process.env.EXPO_PUBLIC_TAPESTRY_API_KEY || "";

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

export interface TapestryFollowersList {
  followers: TapestryFollowItem[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}

export interface TapestryFollowingList {
  following: TapestryFollowItem[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}

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
  customProps?: { key: string; value: string }[],
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
  includeExternal = false,
): Promise<TapestrySearchResult> {
  const params = new URLSearchParams({ walletAddress });
  if (includeExternal) params.set("shouldIncludeExternalProfiles", "true");
  return tapestryFetch<TapestrySearchResult>(`/profiles/search?${params.toString()}`);
}

// ─── Follows ───────────────────────────────────────────
// Path is /followers (NOT /follows)
// startId = follower (me), endId = followee (them)

export async function followProfile(
  myProfileId: string,
  theirProfileId: string,
): Promise<void> {
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

export async function unfollowProfile(
  myProfileId: string,
  theirProfileId: string,
): Promise<void> {
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
  followeeId: string,
): Promise<{ isFollowing: boolean }> {
  return tapestryFetch<{ isFollowing: boolean }>(
    `/followers/check?followerId=${encodeURIComponent(followerId)}&followeeId=${encodeURIComponent(followeeId)}`,
  );
}

export async function getFollowing(
  profileId: string,
  limit = 20,
): Promise<TapestryFollowingList> {
  return tapestryFetch<TapestryFollowingList>(
    `/profiles/following/${encodeURIComponent(profileId)}?limit=${limit}&offset=0`,
  );
}

export async function getFollowers(
  profileId: string,
  limit = 20,
): Promise<TapestryFollowersList> {
  return tapestryFetch<TapestryFollowersList>(
    `/profiles/followers/${encodeURIComponent(profileId)}?limit=${limit}&offset=0`,
  );
}

export async function getFollowerCount(profileId: string): Promise<number> {
  const result = await tapestryFetch<{ count: number }>(
    `/profiles/followers/${encodeURIComponent(profileId)}/count`,
  );
  return result.count;
}

export async function getFollowingCount(profileId: string): Promise<number> {
  const result = await tapestryFetch<{ count: number }>(
    `/profiles/following/${encodeURIComponent(profileId)}/count`,
  );
  return result.count;
}

// ─── Content ───────────────────────────────────────────
// Path is /contents/create (NOT /contents/findOrCreate)
// blockchain + execution are REQUIRED here

export async function createContent(
  profileId: string,
  text: string,
  customProps?: { key: string; value: string }[],
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
  offset = 0,
): Promise<TapestryContentList> {
  return tapestryFetch<TapestryContentList>(
    `/contents/profile/${encodeURIComponent(profileId)}?limit=${limit}&offset=${offset}`,
  );
}

export async function getContent(contentId: string): Promise<TapestryContent> {
  return tapestryFetch<TapestryContent>(`/contents/${encodeURIComponent(contentId)}`);
}

// ─── Likes ─────────────────────────────────────────────

export async function likeContent(
  profileId: string,
  contentId: string,
): Promise<void> {
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

export async function unlikeContent(
  profileId: string,
  contentId: string,
): Promise<void> {
  await tapestryFetch("/likes", {
    method: "DELETE",
    body: JSON.stringify({
      profileId,
      contentId,
      blockchain: "SOLANA",
      execution: "FAST_UNCONFIRMED",
    }),
  });
}

export async function checkLiked(
  profileId: string,
  contentId: string,
): Promise<{ hasLiked: boolean }> {
  return tapestryFetch<{ hasLiked: boolean }>(
    `/likes/check?profileId=${encodeURIComponent(profileId)}&contentId=${encodeURIComponent(contentId)}`,
  );
}

export async function getLikeCount(contentId: string): Promise<number> {
  const result = await tapestryFetch<{ count: number }>(
    `/likes/count/${encodeURIComponent(contentId)}`,
  );
  return result.count;
}
