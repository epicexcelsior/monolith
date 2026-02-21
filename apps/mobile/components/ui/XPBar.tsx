/**
 * XPBar — XP progress bar with level badge.
 *
 * Modeled on existing ChargeBar pattern (animated spring fill).
 */

import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { COLORS, FONT_FAMILY, RADIUS, SPACING, GLASS_STYLE } from "@/constants/theme";

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000];

interface XPBarProps {
  xp: number;
  level: number;
  size?: "sm" | "md";
}

export default function XPBar({ xp, level, size = "sm" }: XPBarProps) {
  const fillWidth = useSharedValue(0);

  // Compute progress within current level
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const range = nextThreshold - currentThreshold;
  const progress = range > 0 ? Math.min(1, (xp - currentThreshold) / range) : 1;

  useEffect(() => {
    fillWidth.value = withSpring(progress, { damping: 15, stiffness: 90 });
  }, [progress, fillWidth]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillWidth.value * 100}%` as any,
  }));

  const height = size === "sm" ? 6 : 10;

  return (
    <View style={styles.container}>
      <View style={styles.levelBadge}>
        <Text style={styles.levelText}>{level}</Text>
      </View>
      <View style={[styles.track, { height }]}>
        <Animated.View style={[styles.fill, { height }, fillStyle]} />
      </View>
      <Text style={styles.xpText}>{xp} XP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  levelBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  levelText: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 11,
    color: COLORS.textOnGold,
  },
  track: {
    flex: 1,
    backgroundColor: COLORS.goldSubtle,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  fill: {
    backgroundColor: COLORS.gold,
    borderRadius: RADIUS.full,
  },
  xpText: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 10,
    color: COLORS.textMuted,
    width: 48,
    textAlign: "right",
  },
});
