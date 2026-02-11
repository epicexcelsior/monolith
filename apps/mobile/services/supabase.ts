import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client.
 *
 * Used for:
 * - Block metadata (appearance, energy, textures)
 * - Player profiles
 * - Real-time subscriptions for tower updates
 * - Storage for block images/textures
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
