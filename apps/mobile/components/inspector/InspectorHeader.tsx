import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SPACING, FONT_FAMILY } from "@/constants/theme";
import Badge from "@/components/ui/Badge";
import { getBlockState, stateColor } from "@/hooks/useBlockActions";
import { getStreakMultiplier } from "@/stores/tower-store";
import type { DemoBlock } from "@/stores/tower-store";

interface InspectorHeaderProps {
  block: DemoBlock;
  isUnclaimed: boolean;
  isOwner: boolean;
}

export default function InspectorHeader({ block, isUnclaimed, isOwner }: InspectorHeaderProps) {
  const state = getBlockState(block.energy);
  const streak = block.streak ?? 0;
  const multiplier = getStreakMultiplier(streak);

  return (
    <View style={styles.headerRow}>
      <View style={styles.identity}>
        {block.emoji && <Text style={styles.emoji}>{block.emoji}</Text>}
        <View style={styles.titleCol}>
          <Text style={styles.blockName} numberOfLines={1}>
            {block.name || `L${block.layer} / B${block.index}`}
          </Text>
          {!isUnclaimed && block.owner && (
            <Text style={styles.ownerLabel}>
              {isOwner ? "Your block" : truncateAddr(block.owner)}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.statusCol}>
        <Badge
          label={isUnclaimed ? "OPEN" : state.toUpperCase()}
          color={isUnclaimed ? COLORS.gold : stateColor(state)}
        />
        {streak > 0 && (
          <Text style={styles.streakBadge}>
            {streak}d {multiplier > 1 ? `${multiplier}×` : ""}
          </Text>
        )}
      </View>
    </View>
  );
}

function truncateAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}..${addr.slice(-4)}`;
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  emoji: {
    fontSize: 24,
  },
  titleCol: {
    flex: 1,
  },
  blockName: {
    fontFamily: FONT_FAMILY.heading,
    color: COLORS.text,
    fontSize: 18,
    letterSpacing: 0.3,
  },
  ownerLabel: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  statusCol: {
    alignItems: "flex-end",
    gap: 3,
  },
  streakBadge: {
    fontFamily: FONT_FAMILY.monoBold,
    fontSize: 11,
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
});
