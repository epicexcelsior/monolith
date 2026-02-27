/**
 * Tapestry API wrapper — all calls use fetch(), typed responses.
 * Every write operation is fire-and-forget safe (caller uses .catch(console.warn)).
 *
 * Base URL: https://api.usetapestry.dev/api/v1
 * Docs: https://docs.usetapestry.dev/
 * Namespace: themonolith
 */

// ─── Config ────────────────────────────────────────────
const TAPESTRY_API_URL =
  process.env.EXPO_PUBLIC_TAPESTRY_API_URL || "https://api.usetapestry.dev/api/v1";
const TAPESTRY_API_KEY =
  process.env.EXPO_PUBLIC_TAPESTRY_API_KEY || "";

// ─── Types ─────────────────────────────────────────────

export interface TapestryProfileData {
  id: string;
  username: string;
  bio: string | null;
  image: string | null;
  namespace: string;
  created_at: number;
  walletAddress?: string;
  blockchain?: string;
}

export interface TapestrySocialCounts {
  followers: number;
  following: number;
  globalFollowers?: number;
  globalFollowing?: number;
}

export interface TapestryFindOrCreateResult {
  profile: TapestryProfileData;
  operation: "CREATED" | "FOUND";
  walletAddress: string;
}

export interface TapestryContentData {
  id: string;
  profileId?: string;
  content?: string;
  contentType?: string;
  created_at: number;
  namespace?: string;
  // Properties are flattened into the top-level object
  [key: string]: unknown;
}

// Content list items have nested structure from the API
export interface TapestryContentItem {
  authorProfile?: TapestryProfileData;
  content: TapestryContentData;
  socialCounts?: { likeCount: number; commentCount: number };
}

// Alias for backward compat — used in store + social feed
export type TapestryContent = TapestryContentItem;

export interface TapestryContentList {
  contents: TapestryContentItem[];
  page?: number;
  pageSize?: number;
  totalCount?: number;
}

// findOrCreate returns flat content data (NOT wrapped)
export type TapestryContentCreateResult = TapestryContentData;

export interface TapestryFollowingList {
  profiles: TapestryProfileData[];
  page?: number;
  pageSize?: number;
  totalCount?: number;
}

export interface TapestryFollowersList {
  profiles: TapestryProfileData[];
  page?: number;
  pageSize?: number;
  totalCount?: number;
}

export interface TapestrySearchResult {
  profiles: TapestryProfileData[];
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
): Promise<TapestryFindOrCreateResult> {
  return tapestryFetch<TapestryFindOrCreateResult>("/profiles/findOrCreate", {
    method: "POST",
    body: JSON.stringify({
      walletAddress,
      username,
      namespace: "themonolith",
      bio: bio || "Keeper on The Monolith",
      blockchain: "SOLANA",
      execution: "FAST_UNCONFIRMED",
    }),
  });
}

export async function getProfile(profileId: string): Promise<{ profile: TapestryProfileData }> {
  return tapestryFetch<{ profile: TapestryProfileData }>(`/profiles/${encodeURIComponent(profileId)}`);
}

export async function searchProfiles(
  walletAddress: string,
  includeExternal = false,
): Promise<TapestrySearchResult> {
  const params = new URLSearchParams({ walletAddress });
  if (includeExternal) params.set("shouldIncludeExternalProfiles", "true");
  return tapestryFetch<TapestrySearchResult>(`/search/profiles?${params.toString()}`);
}

// ─── Social Counts ─────────────────────────────────────
// Separate endpoint — NOT part of profile response

export async function getSocialCounts(walletAddress: string): Promise<TapestrySocialCounts> {
  return tapestryFetch<TapestrySocialCounts>(
    `/wallets/${encodeURIComponent(walletAddress)}/socialCounts`,
  );
}

// ─── Follows ───────────────────────────────────────────
// POST /followers/add and POST /followers/remove
// startId = follower (me), endId = followee (them)

export async function followProfile(
  myProfileId: string,
  theirProfileId: string,
): Promise<void> {
  await tapestryFetch("/followers/add", {
    method: "POST",
    body: JSON.stringify({
      startId: myProfileId,
      endId: theirProfileId,
    }),
  });
}

export async function unfollowProfile(
  myProfileId: string,
  theirProfileId: string,
): Promise<void> {
  await tapestryFetch("/followers/remove", {
    method: "POST",
    body: JSON.stringify({
      startId: myProfileId,
      endId: theirProfileId,
    }),
  });
}

export async function checkFollowing(
  followerId: string,
  followeeId: string,
): Promise<{ isFollowing: boolean }> {
  return tapestryFetch<{ isFollowing: boolean }>(
    `/followers/state?startId=${encodeURIComponent(followerId)}&endId=${encodeURIComponent(followeeId)}`,
  );
}

export async function getFollowing(
  profileId: string,
  limit = 20,
): Promise<TapestryFollowingList> {
  return tapestryFetch<TapestryFollowingList>(
    `/profiles/${encodeURIComponent(profileId)}/following?limit=${limit}&offset=0`,
  );
}

export async function getFollowers(
  profileId: string,
  limit = 20,
): Promise<TapestryFollowersList> {
  return tapestryFetch<TapestryFollowersList>(
    `/profiles/${encodeURIComponent(profileId)}/followers?limit=${limit}&offset=0`,
  );
}

// ─── Content ───────────────────────────────────────────
// POST /contents/findOrCreate — requires `id` field
// Uses `properties` not `customProperties`

/** Deterministic content ID for a block — always the same for a given blockId. */
export function getBlockContentId(blockId: string): string {
  return `monolith-block-${blockId}`;
}

/**
 * Ensure canonical block content exists (findOrCreate with deterministic ID).
 * Used for claims so likes/comments always have a stable target.
 */
export async function ensureBlockContent(
  profileId: string,
  blockId: string,
  text: string,
  properties?: { key: string; value: string }[],
): Promise<TapestryContentCreateResult> {
  const contentId = getBlockContentId(blockId);
  return tapestryFetch<TapestryContentCreateResult>("/contents/findOrCreate", {
    method: "POST",
    body: JSON.stringify({
      id: contentId,
      profileId,
      content: text,
      contentType: "text",
      ...(properties && properties.length > 0 ? { properties } : {}),
    }),
  });
}

export async function createContent(
  profileId: string,
  text: string,
  properties?: { key: string; value: string }[],
): Promise<TapestryContentCreateResult> {
  // Generate deterministic ID from profileId + timestamp for findOrCreate
  const contentId = `monolith-${profileId}-${Date.now()}`;
  return tapestryFetch<TapestryContentCreateResult>("/contents/findOrCreate", {
    method: "POST",
    body: JSON.stringify({
      id: contentId,
      profileId,
      content: text,
      contentType: "text",
      ...(properties && properties.length > 0 ? { properties } : {}),
    }),
  });
}

export async function getContentByProfile(
  profileId: string,
  limit = 10,
  offset = 0,
): Promise<TapestryContentList> {
  return tapestryFetch<TapestryContentList>(
    `/contents?profileId=${encodeURIComponent(profileId)}&limit=${limit}&offset=${offset}`,
  );
}

export async function getContent(contentId: string): Promise<TapestryContent> {
  return tapestryFetch<TapestryContent>(`/contents/${encodeURIComponent(contentId)}`);
}

// ─── Likes ─────────────────────────────────────────────
// POST/DELETE /likes/{nodeId} with profileId in body

export async function likeContent(
  profileId: string,
  contentId: string,
): Promise<void> {
  await tapestryFetch(`/likes/${encodeURIComponent(contentId)}`, {
    method: "POST",
    body: JSON.stringify({ startId: profileId }),
  });
}

export async function unlikeContent(
  profileId: string,
  contentId: string,
): Promise<void> {
  await tapestryFetch(`/likes/${encodeURIComponent(contentId)}`, {
    method: "DELETE",
    body: JSON.stringify({ startId: profileId }),
  });
}

export async function checkLiked(
  profileId: string,
  contentId: string,
): Promise<{ hasLiked: boolean }> {
  try {
    const result = await tapestryFetch<{ profiles: Array<{ id: string }>, total: number }>(
      `/likes/${encodeURIComponent(contentId)}`,
    );
    const hasLiked = result.profiles?.some((p) => p.id === profileId) ?? false;
    return { hasLiked };
  } catch {
    return { hasLiked: false };
  }
}

export async function getLikeCount(contentId: string): Promise<number> {
  try {
    const result = await tapestryFetch<{ profiles: unknown[], total: number }>(
      `/likes/${encodeURIComponent(contentId)}`,
    );
    return result.total ?? 0;
  } catch {
    return 0;
  }
}

// ─── Comments ───────────────────────────────────────────

export interface TapestryCommentItem {
  comment: { id: string; created_at: number; text: string };
  author?: TapestryProfileData;
  socialCounts?: { likeCount: number };
}

export async function createComment(
  profileId: string,
  contentId: string,
  text: string,
): Promise<{ id: string; created_at: number; text: string }> {
  return tapestryFetch<{ id: string; created_at: number; text: string }>("/comments", {
    method: "POST",
    body: JSON.stringify({ profileId, text, contentId }),
  });
}

export async function getComments(
  contentId: string,
  requestingProfileId?: string,
  page = 1,
  pageSize = 20,
): Promise<{ comments: TapestryCommentItem[]; page: number; pageSize: number }> {
  const params = new URLSearchParams({
    contentId,
    page: String(page),
    pageSize: String(pageSize),
  });
  if (requestingProfileId) params.set("requestingProfileId", requestingProfileId);
  return tapestryFetch<{ comments: TapestryCommentItem[]; page: number; pageSize: number }>(
    `/comments?${params.toString()}`,
  );
}

// ─── Activity Feed ──────────────────────────────────────

export interface TapestryActivityItem {
  id: string;
  activity_type: string;
  actor_username: string;
  target_username?: string;
  content_id?: string;
  created_at: number;
  description?: string;
}

export async function getActivityFeed(
  username: string,
  page = 1,
  pageSize = 20,
): Promise<{ activities: TapestryActivityItem[]; page: number; pageSize: number }> {
  const params = new URLSearchParams({
    username,
    page: String(page),
    pageSize: String(pageSize),
  });
  return tapestryFetch<{ activities: TapestryActivityItem[]; page: number; pageSize: number }>(
    `/activity/feed?${params.toString()}`,
  );
}
