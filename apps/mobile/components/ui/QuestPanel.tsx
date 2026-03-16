import React from "react";
import { View, Text, StyleSheet } from "react-native";
import BottomPanel from "@/components/ui/BottomPanel";
import { COLORS, SPACING, RADIUS, TEXT, FONT_FAMILY } from "@/constants/theme";
import { useQuestStore } from "@/stores/quest-store";
import type { QuestState } from "@/stores/quest-store";

const QUEST_ICONS: Record<string, string> = {
  charge_1: "⚡",
  charge_3: "⚡",
  poke_1: "👆",
  streak_1: "🔥",
  great_1: "✨",
  customize_1: "🎨",
  full_charge: "💫",
};

interface QuestCardProps {
  quest: QuestState;
}

function QuestCard({ quest }: QuestCardProps) {
  const progress = Math.min(quest.progress, quest.target);
  const pct = quest.target > 0 ? (progress / quest.target) * 100 : 0;
  const icon = QUEST_ICONS[quest.id] ?? "📜";

  return (
    <View style={[styles.card, quest.completed && styles.cardCompleted]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardIcon}>{icon}</Text>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>
            {quest.completed ? "✓ " : ""}{quest.name}
          </Text>
          <Text style={styles.cardDesc} numberOfLines={2}>
            {quest.desc}
          </Text>
        </View>
        <View style={styles.xpBadge}>
          <Text style={styles.xpText}>{quest.xp} XP</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` as any }, quest.completed && styles.progressComplete]} />
      </View>
      <Text style={styles.progressLabel}>
        {progress} / {quest.target}
      </Text>
    </View>
  );
}

interface QuestPanelProps {
  visible: boolean;
  onClose: () => void;
}

export default function QuestPanel({ visible, onClose }: QuestPanelProps) {
  const quests = useQuestStore((s) => s.quests);
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <BottomPanel visible={visible} onClose={onClose} height={320} title={`Daily Quests · ${today}`} dark>
      <View style={styles.container}>
        {quests.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📜</Text>
            <Text style={styles.emptyText}>Quests load when connected to the tower</Text>
          </View>
        ) : (
          quests.map((q) => <QuestCard key={q.id} quest={q} />)
        )}
      </View>
    </BottomPanel>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  card: {
    backgroundColor: COLORS.hudHighlight,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.hudBorder,
  },
  cardCompleted: {
    borderColor: COLORS.goldAccentDim,
    backgroundColor: "rgba(212, 168, 71, 0.08)",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  cardIcon: {
    fontSize: 18,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 13,
    color: COLORS.inspectorText,
    marginBottom: 2,
  },
  cardDesc: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 11,
    color: COLORS.inspectorTextSecondary,
  },
  xpBadge: {
    backgroundColor: COLORS.goldSubtle,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.goldAccentDim,
  },
  xpText: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 10,
    color: COLORS.goldLight,
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.hudBorder,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 2,
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.gold,
    borderRadius: 2,
  },
  progressComplete: {
    backgroundColor: COLORS.gold,
  },
  progressLabel: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 10,
    color: COLORS.inspectorTextSecondary,
    textAlign: "right",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyText: {
    ...TEXT.bodySm,
    color: COLORS.inspectorTextSecondary,
    textAlign: "center",
  },
});
