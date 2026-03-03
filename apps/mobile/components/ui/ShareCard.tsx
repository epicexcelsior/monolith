import React, { forwardRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, FONT_FAMILY, SPACING, RADIUS } from "@/constants/theme";
import { getEvolutionTier, getEvolutionTierInfo } from "@monolith/common";
import type { DemoBlock } from "@/stores/tower-store";

interface ShareCardProps {
  block: DemoBlock;
}

const ShareCard = forwardRef<View, ShareCardProps>(({ block }, ref) => {
  const chargePct = Math.round(Math.min(100, Math.max(0, block.energy)));
  const label = block.name || `Layer ${block.layer} / Block ${block.index}`;
  const streak = block.streak ?? 0;
  const totalCharges = block.totalCharges ?? 0;
  const bestStreak = block.bestStreak ?? 0;
  const evoTier = getEvolutionTier(totalCharges, bestStreak);
  const evoInfo = getEvolutionTierInfo(evoTier);

  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      {/* Gradient accent bar — tinted to owner color */}
      <View style={[styles.accentBar, { backgroundColor: block.ownerColor }]} />
      <View style={[styles.accentBarGlow, { backgroundColor: block.ownerColor, opacity: 0.15 }]} />

      {/* Emoji */}
      <Text style={styles.emoji}>{block.emoji || "\uD83E\uDDF1"}</Text>

      {/* Block name */}
      <Text style={styles.blockName}>{label}</Text>

      {/* Evolution tier badge */}
      {evoTier > 0 && (
        <View style={styles.evoBadge}>
          <Text style={styles.evoBadgeText}>{evoInfo.name}</Text>
        </View>
      )}

      {/* Position */}
      <Text style={styles.position}>
        Floor {block.layer}, Block {block.index}
      </Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{chargePct}%</Text>
          <Text style={styles.statLabel}>Charge</Text>
        </View>
        {streak > 0 && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        )}
        {totalCharges > 0 && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{totalCharges}</Text>
            <Text style={styles.statLabel}>Charges</Text>
          </View>
        )}
      </View>

      {/* Streak badge */}
      {streak >= 3 && (
        <View style={styles.streakBadge}>
          <Text style={styles.streakBadgeText}>
            {"\uD83D\uDD25"} {streak}-day streak
          </Text>
        </View>
      )}

      {/* Charge bar */}
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${chargePct}%`, backgroundColor: block.ownerColor }]} />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.brandText}>THE MONOLITH</Text>
        <Text style={styles.taglineText}>Stake. Charge. Compete.</Text>
      </View>
    </View>
  );
});

ShareCard.displayName = "ShareCard";
export default ShareCard;

const styles = StyleSheet.create({
  card: {
    width: 400,
    height: 600,
    backgroundColor: "#1A1610",
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  accentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  accentBarGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  emoji: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  blockName: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 32,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: SPACING.xs,
  },
  evoBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.goldSubtle,
    marginBottom: SPACING.xs,
  },
  evoBadgeText: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 12,
    color: COLORS.gold,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  position: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 14,
    color: "#A89880",
    marginBottom: SPACING.lg,
  },
  statsRow: {
    flexDirection: "row",
    gap: SPACING.xl,
    marginBottom: SPACING.md,
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 36,
    color: COLORS.gold,
  },
  statLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 12,
    color: "#A89880",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  streakBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: "#3A2A10",
    marginBottom: SPACING.md,
  },
  streakBadgeText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 13,
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  barBg: {
    width: "80%",
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2A2520",
    overflow: "hidden",
    marginBottom: SPACING.xl,
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  footer: {
    alignItems: "center",
    gap: 4,
    position: "absolute",
    bottom: SPACING.lg,
  },
  brandText: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 16,
    color: COLORS.gold,
    letterSpacing: 4,
  },
  taglineText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 12,
    color: "#665C50",
    letterSpacing: 1,
  },
});
