/**
 * Quest definitions — 7 quests, 3 picked daily per wallet.
 * Deterministic selection via hash of wallet + date.
 */

export interface QuestDef {
  id: string;
  name: string;
  desc: string;
  target: number;
  xp: number;
}

export const QUEST_POOL: QuestDef[] = [
  { id: "charge_1", name: "Charge your Spark", desc: "Charge 1 block", target: 1, xp: 15 },
  { id: "charge_3", name: "Triple Charge", desc: "Charge 3 blocks", target: 3, xp: 30 },
  { id: "poke_1", name: "Friendly Poke", desc: "Poke a neighbor", target: 1, xp: 20 },
  { id: "streak_1", name: "Streak Guardian", desc: "Maintain your streak today", target: 1, xp: 25 },
  { id: "great_1", name: "Lucky Roll", desc: "Get a Great quality charge", target: 1, xp: 35 },
  { id: "customize_1", name: "Fresh Look", desc: "Customize your block", target: 1, xp: 10 },
  { id: "full_charge", name: "Fully Charged", desc: "Bring a block to 100%", target: 1, xp: 40 },
];

/**
 * Pick 3 daily quests deterministically for a wallet on a given date.
 * Uses a simple hash to ensure same quests per wallet per day.
 */
export function pickDailyQuests(wallet: string, dateStr: string): QuestDef[] {
  // Simple hash
  const str = wallet + dateStr;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  hash = Math.abs(hash);

  // Fisher-Yates shuffle with seeded random
  const indices = QUEST_POOL.map((_, i) => i);
  let seed = hash;
  const nextRand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return [QUEST_POOL[indices[0]], QUEST_POOL[indices[1]], QUEST_POOL[indices[2]]];
}
