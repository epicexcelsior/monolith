import React, { forwardRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, FONT_FAMILY, SPACING, RADIUS } from "@/constants/theme";
import type { DemoBlock } from "@/stores/tower-store";

interface ShareCardProps {
  block: DemoBlock;
}

const ShareCard = forwardRef<View, ShareCardProps>(({ block }, ref) => {
  const chargePct = Math.round(Math.min(100, Math.max(0, block.energy)));
  const label = block.name || `Layer ${block.layer} / Block ${block.index}`;
  const streakText = (block.streak ?? 0) > 0 ? `Day ${block.streak} streak` : null;

  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      {/* Top accent bar */}
      <View style={[styles.accentBar, { backgroundColor: block.ownerColor }]} />

      {/* Emoji */}
      <Text style={styles.emoji}>{block.emoji || "🧱"}</Text>

      {/* Block name */}
      <Text style={styles.blockName}>{label}</Text>

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
        {streakText && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{block.streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        )}
      </View>

      {/* Charge bar */}
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${chargePct}%`, backgroundColor: block.ownerColor }]} />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.brandText}>THE MONOLITH</Text>
        <Text style={styles.linkText}>monolith-server-production.up.railway.app</Text>
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
  emoji: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  blockName: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 28,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: SPACING.xs,
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
    marginBottom: SPACING.lg,
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
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 14,
    color: COLORS.gold,
    letterSpacing: 3,
  },
  linkText: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 11,
    color: "#665C50",
  },
});
