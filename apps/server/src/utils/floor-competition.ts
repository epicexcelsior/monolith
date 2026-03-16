/**
 * Floor weekly competition — tracks charges per layer and picks weekly winners.
 * Resets Monday 00:00 UTC.
 */

const weeklyLayerCharges = new Map<number, number>();
let lastWeekWinnerLayer: number | null = null;
let lastWeekWinnerCharges = 0;
let currentWeekNumber = getUTCWeekNumber();

function getUTCWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getUTCFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
}

/** Increment charge count for a layer */
export function recordLayerCharge(layer: number): void {
  const current = weeklyLayerCharges.get(layer) ?? 0;
  weeklyLayerCharges.set(layer, current + 1);
}

/** Get sorted floor leaderboard (descending by charges) */
export function getFloorLeaderboard(): Array<{ layer: number; charges: number }> {
  return Array.from(weeklyLayerCharges.entries())
    .map(([layer, charges]) => ({ layer, charges }))
    .sort((a, b) => b.charges - a.charges);
}

/** Get last week's winning floor */
export function getWinningFloor(): { layer: number; charges: number } | null {
  if (lastWeekWinnerLayer == null) return null;
  return { layer: lastWeekWinnerLayer, charges: lastWeekWinnerCharges };
}

/** Check and reset weekly if we crossed Monday UTC boundary */
export function checkWeeklyReset(): { layer: number; charges: number } | null {
  const weekNum = getUTCWeekNumber();
  if (weekNum === currentWeekNumber) return null;

  // Find winner before reset
  let winnerLayer: number | null = null;
  let winnerCharges = 0;
  weeklyLayerCharges.forEach((charges, layer) => {
    if (charges > winnerCharges) {
      winnerLayer = layer;
      winnerCharges = charges;
    }
  });

  // Store winner and reset
  lastWeekWinnerLayer = winnerLayer;
  lastWeekWinnerCharges = winnerCharges;
  currentWeekNumber = weekNum;
  weeklyLayerCharges.clear();

  if (winnerLayer != null) {
    return { layer: winnerLayer, charges: winnerCharges };
  }
  return null;
}

/** Get raw weekly charges map for state sync */
export function getWeeklyCharges(): Record<number, number> {
  const result: Record<number, number> = {};
  weeklyLayerCharges.forEach((charges, layer) => {
    result[layer] = charges;
  });
  return result;
}
