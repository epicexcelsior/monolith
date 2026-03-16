import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SPACING, FONT_FAMILY, TEXT, getChargeColor } from "@/constants/theme";
import Badge from "@/components/ui/Badge";
import ChargeBar from "@/components/ui/ChargeBar";
import { getBlockState, stateColor } from "@/hooks/useBlockActions";
import { getStreakMultiplier } from "@/stores/tower-store";
import { getEvolutionTierInfo } from "@monolith/common";
import type { DemoBlock } from "@/stores/tower-store";

interface InspectorHeaderProps {
  block: DemoBlock;
  isUnclaimed: boolean;
  isOwner: boolean;
  energyPct: number;
}

export default function InspectorHeader({ block, isUnclaimed, isOwner, energyPct }: InspectorHeaderProps) {
  const state = getBlockState(block.energy);
  const streak = block.streak ?? 0;
  const multiplier = getStreakMultiplier(streak);
  const evolutionTier = block.evolutionTier ?? 0;
  const tierInfo = getEvolutionTierInfo(evolutionTier);

  return (
    <View style={styles.headerCol}>
      <View style={styles.headerRow}>
        <View style={styles.identity}>
          {block.emoji && <Text style={styles.emoji}>{block.emoji}</Text>}
          <Text style={styles.blockName} numberOfLines={1}>
            {block.name || `L${block.layer} / B${block.index}`}
          </Text>
          {!isUnclaimed && (
            <Badge
              label={tierInfo.name.toUpperCase()}
              color={COLORS.goldAccent}
            />
          )}
        </View>
        <View style={styles.statsRow}>
          {!isUnclaimed && (
            <Text style={[styles.energyPct, { color: getChargeColor(energyPct) }]}>
              {Math.round(energyPct)}%
            </Text>
          )}
          {streak > 0 && (
            <Text style={styles.streakText}>
              {streak}d {multiplier > 1 ? `${multiplier}×` : ""}
            </Text>
          )}
        </View>
      </View>
      {!isUnclaimed && (
        <View style={styles.ownerRow}>
          {isOwner ? (
            <Text style={styles.ownerLabel}>Your block</Text>
          ) : block.owner ? (
            <Text style={styles.ownerLabel}>
              {block.ownerName || truncateAddr(block.owner)}
            </Text>
          ) : null}
          <ChargeBar charge={energyPct} size="sm" />
        </View>
      )}
    </View>
  );
}

function truncateAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}..${addr.slice(-4)}`;
}

const styles = StyleSheet.create({
  headerCol: {
    marginBottom: SPACING.xs,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    flex: 1,
  },
  emoji: {
    fontSize: 22,
  },
  blockName: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 16,
    color: COLORS.inspectorText,
    flexShrink: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  energyPct: {
    fontFamily: FONT_FAMILY.monoBold,
    fontSize: 14,
  },
  streakText: {
    ...TEXT.overline,
    color: COLORS.gold,
    fontFamily: FONT_FAMILY.monoBold,
    fontSize: 12,
  },
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  ownerLabel: {
    ...TEXT.caption,
    fontFamily: FONT_FAMILY.mono,
    color: COLORS.inspectorTextSecondary,
  },
});
