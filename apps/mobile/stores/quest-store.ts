/**
 * Quest store — client-side quest state synced from server.
 * Quest progress is authoritative on the server; client receives updates
 * via 'quest_update' messages.
 */

import { create } from "zustand";

export interface QuestState {
  id: string;
  name: string;
  desc: string;
  target: number;
  progress: number;
  xp: number;
  completed: boolean;
}

interface QuestStore {
  quests: QuestState[];
  isQuestPanelOpen: boolean;

  setQuests(quests: QuestState[]): void;
  updateQuest(id: string, progress: number, completed?: boolean): void;
  toggleQuestPanel(): void;
  closeQuestPanel(): void;
}

export const useQuestStore = create<QuestStore>((set) => ({
  quests: [],
  isQuestPanelOpen: false,

  setQuests: (quests) => set({ quests }),

  updateQuest: (id, progress, completed) =>
    set((state) => ({
      quests: state.quests.map((q) =>
        q.id === id ? { ...q, progress, completed: completed ?? q.completed } : q,
      ),
    })),

  toggleQuestPanel: () => set((state) => ({ isQuestPanelOpen: !state.isQuestPanelOpen })),

  closeQuestPanel: () => set({ isQuestPanelOpen: false }),
}));
