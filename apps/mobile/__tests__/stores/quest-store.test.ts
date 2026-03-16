/**
 * Tests for the quest store.
 */

import { useQuestStore } from "@/stores/quest-store";
import type { QuestState } from "@/stores/quest-store";

const mockQuests: QuestState[] = [
  { id: "charge_1", name: "Charge Up", desc: "Charge your block once", target: 1, progress: 0, xp: 10, completed: false },
  { id: "poke_1", name: "Poke a Neighbor", desc: "Poke a neighboring block", target: 1, progress: 0, xp: 15, completed: false },
  { id: "streak_1", name: "Keep the Flame", desc: "Maintain a streak for 3 days", target: 3, progress: 2, xp: 25, completed: false },
];

beforeEach(() => {
  useQuestStore.setState({ quests: [], isQuestPanelOpen: false });
});

describe("quest-store", () => {
  it("starts with empty quests", () => {
    const { quests, isQuestPanelOpen } = useQuestStore.getState();
    expect(quests).toHaveLength(0);
    expect(isQuestPanelOpen).toBe(false);
  });

  it("setQuests replaces quest list", () => {
    useQuestStore.getState().setQuests(mockQuests);
    const { quests } = useQuestStore.getState();
    expect(quests).toHaveLength(3);
    expect(quests[0].id).toBe("charge_1");
  });

  it("updateQuest updates progress and completed flag", () => {
    useQuestStore.getState().setQuests(mockQuests);
    useQuestStore.getState().updateQuest("streak_1", 3, true);
    const { quests } = useQuestStore.getState();
    const q = quests.find((q) => q.id === "streak_1");
    expect(q?.progress).toBe(3);
    expect(q?.completed).toBe(true);
  });

  it("updateQuest preserves completed flag when not passed", () => {
    useQuestStore.getState().setQuests([{ ...mockQuests[0], completed: true }]);
    useQuestStore.getState().updateQuest("charge_1", 1);
    const q = useQuestStore.getState().quests[0];
    expect(q.completed).toBe(true);
  });

  it("toggleQuestPanel opens and closes panel", () => {
    expect(useQuestStore.getState().isQuestPanelOpen).toBe(false);
    useQuestStore.getState().toggleQuestPanel();
    expect(useQuestStore.getState().isQuestPanelOpen).toBe(true);
    useQuestStore.getState().toggleQuestPanel();
    expect(useQuestStore.getState().isQuestPanelOpen).toBe(false);
  });

  it("closeQuestPanel closes the panel", () => {
    useQuestStore.setState({ isQuestPanelOpen: true });
    useQuestStore.getState().closeQuestPanel();
    expect(useQuestStore.getState().isQuestPanelOpen).toBe(false);
  });
});
