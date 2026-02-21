/**
 * XP computation engine — rewards, combos, levels.
 *
 * All XP logic lives here so it can be tested independently.
 */

// ─── XP Rewards ───────────────────────────────────────────

export const XP_TABLE = {
  claim: 100,
  claim_first_block_bonus: 200,
  charge: 25,
  customize: 10,
  streak_3d: 50,
  streak_7d: 150,
  streak_30d: 500,
} as const;

// ─── Level Thresholds ─────────────────────────────────────

export const LEVEL_THRESHOLDS = [
  0,      // L1
  100,    // L2
  300,    // L3
  600,    // L4
  1000,   // L5
  1500,   // L6
  2500,   // L7
  4000,   // L8
  6000,   // L9
  10000,  // L10
] as const;

// ─── Combo Config ─────────────────────────────────────────

const COMBO_WINDOW_MS = 30_000; // 30 seconds
const COMBO_MULTIPLIERS = [1, 1.5, 2, 2.5, 3]; // indexed by combo count (0-4+)

// In-memory combo tracking per player
const playerCombos = new Map<string, { count: number; lastTime: number }>();

// ─── Functions ────────────────────────────────────────────

export type XpAction = "claim" | "charge" | "customize";

export function computeXp(
  action: XpAction,
  options?: {
    streak?: number;
    isFirstBlock?: boolean;
    comboCount?: number;
  },
): number {
  let base = 0;

  switch (action) {
    case "claim":
      base = XP_TABLE.claim;
      if (options?.isFirstBlock) base += XP_TABLE.claim_first_block_bonus;
      break;
    case "charge":
      base = XP_TABLE.charge;
      // Add streak milestone bonuses
      if (options?.streak === 3) base += XP_TABLE.streak_3d;
      if (options?.streak === 7) base += XP_TABLE.streak_7d;
      if (options?.streak === 30) base += XP_TABLE.streak_30d;
      break;
    case "customize":
      base = XP_TABLE.customize;
      break;
  }

  // Apply combo multiplier
  const comboIdx = Math.min((options?.comboCount ?? 0), COMBO_MULTIPLIERS.length - 1);
  const multiplier = COMBO_MULTIPLIERS[comboIdx];

  return Math.round(base * multiplier);
}

export function computeLevel(totalXp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getComboCount(wallet: string, now: number = Date.now()): number {
  const combo = playerCombos.get(wallet);
  if (!combo) return 0;

  if (now - combo.lastTime > COMBO_WINDOW_MS) {
    // Combo expired
    return 0;
  }
  return combo.count;
}

export function incrementCombo(wallet: string, now: number = Date.now()): number {
  const existing = playerCombos.get(wallet);

  if (!existing || now - existing.lastTime > COMBO_WINDOW_MS) {
    // Start new combo
    playerCombos.set(wallet, { count: 1, lastTime: now });
    return 1;
  }

  // Continue combo
  const newCount = existing.count + 1;
  playerCombos.set(wallet, { count: newCount, lastTime: now });
  return newCount;
}

export function resetCombo(wallet: string): void {
  playerCombos.delete(wallet);
}

/** Exported for testing only */
export function _clearAllCombos(): void {
  playerCombos.clear();
}
