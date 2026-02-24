/**
 * Supabase persistence helpers for the game server.
 *
 * Graceful fallback: if env vars are missing, all functions become no-ops.
 * This allows local dev without Supabase running.
 *
 * All write operations are fire-and-forget (no await needed by callers).
 * Read operations are properly awaited and return data.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.warn("[Supabase] SUPABASE_URL or SUPABASE_SERVICE_KEY not set — persistence disabled");
    return null;
  }

  supabase = createClient(url, key);
  console.log(`[Supabase] Client initialized → ${url}`);
  return supabase;
}

/** Call once at server startup to eagerly init and verify connectivity. */
export async function initSupabase(): Promise<void> {
  const client = getClient();
  if (!client) return;

  // Verify connectivity with a lightweight query
  const { error } = await client.from("players").select("wallet").limit(0);
  if (error) {
    console.error("[Supabase] Connectivity check failed:", error.message);
    console.error("[Supabase] ⚠️  Check SUPABASE_SERVICE_KEY — may be using anon key instead of service_role key");
  } else {
    console.log("[Supabase] ✓ Connected and ready");
  }
}

// ─── Block Persistence ────────────────────────────────────

interface BlockRow {
  id: string;
  layer: number;
  index: number;
  energy: number;
  owner: string;
  owner_color: string;
  staked_amount: number;
  last_charge_time: number;
  streak: number;
  last_streak_date: string;
  appearance: Record<string, any>;
}

const BLOCK_COLUMNS = "id, layer, index, energy, owner, owner_color, staked_amount, last_charge_time, streak, last_streak_date, appearance";

export async function loadPlayerBlocks(): Promise<BlockRow[]> {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from("blocks")
    .select(BLOCK_COLUMNS);

  if (error) {
    console.error("[Supabase] loadPlayerBlocks error:", error.message);
    return [];
  }
  return data ?? [];
}

/** Fire-and-forget upsert — does NOT return a meaningful promise. */
export function upsertBlock(block: BlockRow): void {
  const client = getClient();
  if (!client) return;

  client
    .from("blocks")
    .upsert({
      ...block,
      updated_at: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) console.error("[Supabase] upsertBlock error:", error.message);
    });
}

/** Fire-and-forget bulk upsert. */
export function bulkUpsertBlocks(blocks: BlockRow[]): void {
  const client = getClient();
  if (!client || blocks.length === 0) return;

  const rows = blocks.map((b) => ({
    ...b,
    updated_at: new Date().toISOString(),
  }));

  client
    .from("blocks")
    .upsert(rows)
    .then(({ error }) => {
      if (error) console.error("[Supabase] bulkUpsertBlocks error:", error.message);
    });
}

// ─── Player Persistence ───────────────────────────────────

interface PlayerRow {
  wallet: string;
  xp: number;
  level: number;
  total_claims: number;
  total_charges: number;
  combo_best: number;
  username: string | null;
}

const PLAYER_COLUMNS = "wallet, xp, level, total_claims, total_charges, combo_best, username";

export async function loadOrCreatePlayer(wallet: string): Promise<PlayerRow> {
  const client = getClient();
  if (!client) {
    return { wallet, xp: 0, level: 1, total_claims: 0, total_charges: 0, combo_best: 0, username: null };
  }

  const { data, error } = await client
    .from("players")
    .select(PLAYER_COLUMNS)
    .eq("wallet", wallet)
    .single();

  if (error || !data) {
    // Create new player
    const newPlayer: PlayerRow = {
      wallet,
      xp: 0,
      level: 1,
      total_claims: 0,
      total_charges: 0,
      combo_best: 0,
      username: null,
    };

    client
      .from("players")
      .insert(newPlayer)
      .then(({ error: insertErr }) => {
        if (insertErr) console.error("[Supabase] insert player error:", insertErr.message);
      });

    return newPlayer;
  }

  return data as PlayerRow;
}

/** Fire-and-forget XP update. */
export function updatePlayerXp(
  wallet: string,
  xp: number,
  level: number,
  updates?: Partial<Pick<PlayerRow, "total_claims" | "total_charges" | "combo_best">>,
): void {
  const client = getClient();
  if (!client) return;

  client
    .from("players")
    .upsert({
      wallet,
      xp,
      level,
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) console.error("[Supabase] updatePlayerXp error:", error.message);
    });
}

/** Set username for a player. Returns error message if failed (e.g., duplicate). */
export async function setPlayerUsername(
  wallet: string,
  username: string,
): Promise<{ success: boolean; error?: string }> {
  const client = getClient();
  if (!client) return { success: true }; // no-op in dev without Supabase

  const { error } = await client
    .from("players")
    .update({ username, updated_at: new Date().toISOString() })
    .eq("wallet", wallet);

  if (error) {
    if (error.message.includes("unique") || error.code === "23505") {
      return { success: false, error: "Username already taken" };
    }
    console.error("[Supabase] setPlayerUsername error:", error.message);
    return { success: false, error: "Failed to set username" };
  }
  return { success: true };
}

// ─── Events ───────────────────────────────────────────────

/** Fire-and-forget event insert. */
export function insertEvent(
  type: string,
  blockId?: string,
  wallet?: string,
  data?: Record<string, any>,
): void {
  const client = getClient();
  if (!client) return;

  client
    .from("events")
    .insert({
      type,
      block_id: blockId ?? null,
      wallet: wallet ?? null,
      data: data ?? {},
    })
    .then(({ error }) => {
      if (error) console.error("[Supabase] insertEvent error:", error.message);
    });
}

const EVENT_COLUMNS = "id, type, block_id, wallet, data, created_at";

export async function getRecentEvents(limit: number = 20): Promise<any[]> {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from("events")
    .select(EVENT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Supabase] getRecentEvents error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getTopPlayers(limit: number = 10): Promise<any[]> {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from("players")
    .select(PLAYER_COLUMNS)
    .order("xp", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Supabase] getTopPlayers error:", error.message);
    return [];
  }
  return data ?? [];
}

// ─── Exports for testing ──────────────────────────────────
export { getClient };
