/**
 * FloatingPoints — "+25 XP" floating animation above BlockInspector.
 *
 * Triggered by usePlayerStore.lastPointsEarned.
 * Positions dynamically: higher when BlockInspector is visible.
 * Shows optional label (e.g. "Daily Charge ✓") from player-store.
 */

import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { usePlayerStore } from "@/stores/player-store";
import { useTowerStore } from "@/stores/tower-store";
import { COLORS, FONT_FAMILY } from "@/constants/theme";

export default function FloatingPoints() {
  const lastPointsEarned = usePlayerStore((s) => s.lastPointsEarned);
  const lastCombo = usePlayerStore((s) => s.lastCombo);
  const lastPointsLabel = usePlayerStore((s) => s.lastPointsLabel);
  const lastChargeAmount = usePlayerStore((s) => s.lastChargeAmount);
  const lastChargeQuality = usePlayerStore((s) => s.lastChargeQuality);
  const hasInspector = useTowerStore((s) => s.selectedBlockId) !== null;

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (lastPointsEarned == null) return;

    // Reset
    translateY.value = 0;
    opacity.value = 1;
    // "Great" rolls get a bigger pop — dramatic spread
    scale.value = lastChargeQuality === "great" ? 1.8 : lastChargeQuality === "good" ? 1.4 : 1.1;

    // Animate
    translateY.value = withTiming(-100, { duration: 1500 });
    opacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 1400 }),
    );
    scale.value = withTiming(1, { duration: 300 });
  }, [lastPointsEarned, lastChargeQuality, translateY, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  if (lastPointsEarned == null) return null;

  // Position above BlockInspector when it's visible, otherwise lower
  const bottom = hasInspector ? 340 : 200;

  // Quality-based text color
  const qualityColor = lastChargeQuality === "great" ? COLORS.blazingLight
    : lastChargeQuality === "good" ? COLORS.goldLight
    : COLORS.gold;

  // Check if label is evolution context (e.g. "3 more to Ember")
  const isEvoLabel = lastPointsLabel?.includes("more to") || lastPointsLabel === "FULLY EVOLVED";
  const isEvolvedLabel = lastPointsLabel?.startsWith("Evolved to");

  return (
    <View style={[styles.container, { bottom }]} pointerEvents="none">
      <Animated.View style={[styles.contentColumn, animatedStyle]}>
        {lastChargeQuality === "great" && (
          <Text style={styles.luckyLabel}>Lucky!</Text>
        )}
        <View style={styles.content}>
          {lastChargeAmount != null ? (
            <Text style={[styles.points, { color: qualityColor }]}>+1 Charge {"\u26A1"}</Text>
          ) : (
            <Text style={styles.points}>+{lastPointsEarned} XP</Text>
          )}
          {lastCombo != null && lastCombo > 1 && (
            <Text style={styles.combo}>{"\u00D7"}{lastCombo}</Text>
          )}
        </View>
        {isEvolvedLabel && lastPointsLabel && (
          <Text style={styles.evolvedLabel}>{lastPointsLabel}</Text>
        )}
        {isEvoLabel && lastPointsLabel && (
          <Text style={styles.evoContext}>{lastPointsLabel}</Text>
        )}
        {!isEvoLabel && !isEvolvedLabel && lastPointsLabel && (
          <Text style={styles.label}>{lastPointsLabel}</Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
  label: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 13,
    color: COLORS.goldLight,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 2,
  },
  contentColumn: {
    alignItems: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  points: {
    fontFamily: FONT_FAMILY.headingBlack,
    fontSize: 24,
    color: COLORS.gold,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  combo: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 18,
    color: COLORS.goldLight,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  luckyLabel: {
    fontFamily: FONT_FAMILY.headingBlack,
    fontSize: 14,
    color: COLORS.blazingLight,
    textShadowColor: "rgba(255,180,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  evoContext: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 14,
    color: COLORS.goldLight,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginTop: 4,
  },
  evolvedLabel: {
    fontFamily: FONT_FAMILY.headingBlack,
    fontSize: 16,
    color: COLORS.blazingLight,
    textShadowColor: "rgba(255,180,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
    marginTop: 4,
    letterSpacing: 1,
  },
  xpSubtext: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 13,
    color: COLORS.textMuted,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginTop: 2,
  },
});
