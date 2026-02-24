/**
 * Push token storage helpers.
 *
 * Graceful fallback: if Supabase env vars are missing, all functions become no-ops.
 * All write operations are fire-and-forget (no await needed by callers).
 */

import { getClient } from "./supabase.js";

/** Fire-and-forget upsert of a push token for a wallet. */
export function upsertPushToken(wallet: string, token: string): void {
  const client = getClient();
  if (!client) return;

  client
    .from("push_tokens")
    .upsert(
      {
        wallet,
        expo_push_token: token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "expo_push_token" },
    )
    .then(({ error }) => {
      if (error) console.error("[PushTokens] upsertPushToken error:", error.message);
    });
}

/** Fire-and-forget delete of a push token. */
export function removePushToken(token: string): void {
  const client = getClient();
  if (!client) return;

  client
    .from("push_tokens")
    .delete()
    .eq("expo_push_token", token)
    .then(({ error }) => {
      if (error) console.error("[PushTokens] removePushToken error:", error.message);
    });
}

/** Returns expo push tokens for a wallet. */
export async function getTokensForPlayer(wallet: string): Promise<string[]> {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from("push_tokens")
    .select("expo_push_token")
    .eq("wallet", wallet);

  if (error) {
    console.error("[PushTokens] getTokensForPlayer error:", error.message);
    return [];
  }
  return (data ?? []).map((row: { expo_push_token: string }) => row.expo_push_token);
}

/** Batch lookup of push tokens for multiple wallets. */
export async function getTokensForPlayers(wallets: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (wallets.length === 0) return result;

  const client = getClient();
  if (!client) return result;

  const { data, error } = await client
    .from("push_tokens")
    .select("wallet, expo_push_token")
    .in("wallet", wallets);

  if (error) {
    console.error("[PushTokens] getTokensForPlayers error:", error.message);
    return result;
  }

  for (const row of data ?? []) {
    const r = row as { wallet: string; expo_push_token: string };
    const existing = result.get(r.wallet) ?? [];
    existing.push(r.expo_push_token);
    result.set(r.wallet, existing);
  }

  return result;
}
