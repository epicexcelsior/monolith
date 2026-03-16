/**
 * Quest progress tracking — server-side.
 * Tracks daily quest progress per wallet.
 */

import { pickDailyQuests, type QuestDef } from "@monolith/common";

interface QuestProgress {
  questId: string;
  progress: number;
  completed: boolean;
}

interface WalletQuestState {
  date: string;
  quests: QuestDef[];
  progress: Map<string, QuestProgress>;
}

const walletQuests = new Map<string, WalletQuestState>();

function getOrCreateState(wallet: string): WalletQuestState {
  const today = new Date().toISOString().slice(0, 10);
  const existing = walletQuests.get(wallet);

  if (existing && existing.date === today) return existing;

  // New day — pick fresh quests
  const quests = pickDailyQuests(wallet, today);
  const progress = new Map<string, QuestProgress>();
  for (const q of quests) {
    progress.set(q.id, { questId: q.id, progress: 0, completed: false });
  }

  const state: WalletQuestState = { date: today, quests, progress };
  walletQuests.set(wallet, state);
  return state;
}

/**
 * Check and update quest progress after an action.
 * Returns XP earned from completed quests (0 if none).
 */
export function checkQuestProgress(
  wallet: string,
  eventType: "charge" | "poke" | "customize" | "streak" | "great_charge" | "full_charge",
): { xpEarned: number; completedQuests: string[] } {
  const state = getOrCreateState(wallet);
  let xpEarned = 0;
  const completedQuests: string[] = [];

  const questEventMap: Record<string, string[]> = {
    charge_1: ["charge"],
    charge_3: ["charge"],
    poke_1: ["poke"],
    streak_1: ["streak"],
    great_1: ["great_charge"],
    customize_1: ["customize"],
    full_charge: ["full_charge"],
  };

  for (const quest of state.quests) {
    const triggers = questEventMap[quest.id] ?? [];
    if (!triggers.includes(eventType)) continue;

    const prog = state.progress.get(quest.id);
    if (!prog || prog.completed) continue;

    prog.progress++;
    if (prog.progress >= quest.target) {
      prog.completed = true;
      xpEarned += quest.xp;
      completedQuests.push(quest.id);
    }
  }

  return { xpEarned, completedQuests };
}

/**
 * Get current quest state for a wallet.
 */
export function getQuestState(wallet: string): Array<{
  id: string;
  name: string;
  desc: string;
  target: number;
  xp: number;
  progress: number;
  completed: boolean;
}> {
  const state = getOrCreateState(wallet);
  return state.quests.map((q) => {
    const prog = state.progress.get(q.id);
    return {
      id: q.id,
      name: q.name,
      desc: q.desc,
      target: q.target,
      xp: q.xp,
      progress: prog?.progress ?? 0,
      completed: prog?.completed ?? false,
    };
  });
}
