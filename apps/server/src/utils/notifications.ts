/**
 * Push notification sender for the game server.
 *
 * All sends are fire-and-forget — never await these in the game loop.
 * Uses the Expo Push API: https://exp.host/--/api/v2/push/send
 */

import { getClient } from "./supabase.js";
import { getTokensForPlayer } from "./push-tokens.js";

// ─── Types ────────────────────────────────────────────────

export type NotificationType =
  | "energy_low"
  | "block_dormant"
  | "block_reclaimed"
  | "new_neighbor"
  | "streak_reminder"
  | "poke";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;
const THROTTLE_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours (was 30 min)
const DAILY_NOTIF_CAP = 3;

// ─── Daily Notification Cap ──────────────────────────────
const dailyNotifCount = new Map<string, number>();
let lastCapResetDate = new Date().toISOString().slice(0, 10);

function checkAndIncrementDailyCap(wallet: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== lastCapResetDate) {
    dailyNotifCount.clear();
    lastCapResetDate = today;
  }
  const count = dailyNotifCount.get(wallet) ?? 0;
  if (count >= DAILY_NOTIF_CAP) return false;
  dailyNotifCount.set(wallet, count + 1);
  return true;
}

// ─── Helpers ──────────────────────────────────────────────

/**
 * Build a batch of Expo push message objects.
 */
function buildMessages(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  return tokens.map((token) => ({
    to: token,
    sound: "default",
    priority: "high",
    title,
    body,
    data: data ?? {},
  }));
}

/**
 * Split an array into chunks of `size`.
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── Core Send ────────────────────────────────────────────

/**
 * Fire-and-forget push notification sender.
 * Batches up to 100 tokens per Expo API request.
 */
export function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): void {
  if (tokens.length === 0) return;

  const batches = chunk(tokens, EXPO_BATCH_SIZE);

  for (const batch of batches) {
    const messages = buildMessages(batch, title, body, data);

    fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    })
      .then((res) => {
        if (!res.ok) {
          console.error(`[Notifications] Expo API error: ${res.status} ${res.statusText}`);
        }
      })
      .catch((err) => {
        console.error("[Notifications] sendPushNotification fetch error:", err);
      });
  }
}

// ─── Throttled Player Notification ───────────────────────

/**
 * Send a notification to a player, with a 30-minute per-type throttle.
 * Fire-and-forget — never throws.
 */
export function sendPlayerNotification(
  wallet: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): void {
  if (!wallet) return;

  // Daily cap check (in-memory, resets at UTC midnight)
  if (!checkAndIncrementDailyCap(wallet)) return;

  const client = getClient();

  // Get tokens and check throttle concurrently
  Promise.all([
    getTokensForPlayer(wallet),
    client
      ? client
          .from("notification_log")
          .select("id")
          .eq("wallet", wallet)
          .eq("notification_type", type)
          .gte("created_at", new Date(Date.now() - THROTTLE_WINDOW_MS).toISOString())
          .limit(1)
      : Promise.resolve({ data: [], error: null }),
  ])
    .then(([tokens, throttleResult]) => {
      if (tokens.length === 0) return;

      const { data: throttleRows, error: throttleError } = throttleResult as {
        data: unknown[] | null;
        error: { message: string } | null;
      };

      if (throttleError) {
        console.error("[Notifications] Throttle check error:", throttleError.message);
      }

      const isThrottled = (throttleRows?.length ?? 0) > 0;

      if (isThrottled) {
        return;
      }

      // Send notification
      sendPushNotification(tokens, title, body, data);

      // Log to prevent spam
      if (client) {
        client
          .from("notification_log")
          .insert({ wallet, notification_type: type })
          .then(({ error }) => {
            if (error) console.error("[Notifications] log insert error:", error.message);
          });
      }
    })
    .catch((err) => {
      console.error("[Notifications] sendPlayerNotification error:", err);
    });
}

// ─── Trigger Helpers (exported for testing) ──────────────

/** Returns true if block energy is low (> 0 and <= 20) */
export function isEnergyLow(energy: number): boolean {
  return energy > 0 && energy <= 20;
}

/** Returns true if block is dormant (energy 0, lastChargeTime > 3 days ago) */
export function isBlockDormant(energy: number, lastChargeTime: number, now: number = Date.now()): boolean {
  if (energy !== 0) return false;
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const elapsed = now - lastChargeTime;
  return elapsed >= THREE_DAYS_MS && elapsed < THREE_DAYS_MS + ONE_HOUR_MS;
}

/** Returns true if streak reminder should fire (streak >= 3, not charged today) */
export function shouldSendStreakReminder(
  streak: number,
  lastStreakDate: string,
  today: string,
): boolean {
  return streak >= 3 && lastStreakDate !== today;
}

/** Returns true if block should trigger energy low notification */
export function shouldNotifyEnergyLow(energy: number): boolean {
  return isEnergyLow(energy);
}
