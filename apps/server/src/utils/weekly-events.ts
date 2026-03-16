/**
 * Weekly events — rotating events that create urgency windows.
 *
 * Charge Storm (odd weeks): 1.5x energy for 24h Saturday UTC
 * Land Rush (even weeks): 50% off staking for 24h Saturday UTC
 */

export interface WeeklyEvent {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: "charge_storm" | "land_rush";
}

const EVENTS: WeeklyEvent[] = [
  {
    id: "charge_storm",
    name: "Charge Storm",
    description: "All charges give 1.5x energy!",
    icon: "⚡",
    type: "charge_storm",
  },
  {
    id: "land_rush",
    name: "Land Rush",
    description: "Staking prices 50% off!",
    icon: "🏃",
    type: "land_rush",
  },
];

function getUTCWeekNumber(): number {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
}

function isSaturdayUTC(): boolean {
  return new Date().getUTCDay() === 6;
}

/** Get the currently active event, or null if none */
export function getCurrentEvent(): WeeklyEvent | null {
  if (!isSaturdayUTC()) return null;
  const weekNum = getUTCWeekNumber();
  return weekNum % 2 === 1 ? EVENTS[0] : EVENTS[1];
}

/** Get the charge multiplier (1.5 during Charge Storm, 1.0 otherwise) */
export function getChargeEventMultiplier(): number {
  const event = getCurrentEvent();
  return event?.type === "charge_storm" ? 1.5 : 1.0;
}

/** Get the staking price multiplier (0.5 during Land Rush, 1.0 otherwise) */
export function getStakingEventMultiplier(): number {
  const event = getCurrentEvent();
  return event?.type === "land_rush" ? 0.5 : 1.0;
}

/** Get next Saturday UTC timestamp for countdown */
export function getNextEventTime(): number {
  const now = new Date();
  const daysUntilSaturday = (6 - now.getUTCDay() + 7) % 7 || 7;
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilSaturday,
    0, 0, 0,
  ));
  return next.getTime();
}
