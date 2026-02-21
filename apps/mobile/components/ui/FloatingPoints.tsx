/**
 * FloatingPoints — "+25 XP" floating animation above BlockInspector.
 *
 * Triggered by usePlayerStore.lastPointsEarned.
 */

import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
} from "react-native-reanimated";
import { usePlayerStore } from "@/stores/player-store";
import { COLORS, FONT_FAMILY } from "@/constants/theme";

export default function FloatingPoints() {
  const lastPointsEarned = usePlayerStore((s) => s.lastPointsEarned);
  const lastCombo = usePlayerStore((s) => s.lastCombo);

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (lastPointsEarned == null) return;

    // Reset
    translateY.value = 0;
    opacity.value = 1;
    scale.value = 1.2;

    // Animate
    translateY.value = withTiming(-100, { duration: 1500 });
    opacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 1400 }),
    );
    scale.value = withTiming(1, { duration: 300 });
  }, [lastPointsEarned, translateY, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  if (lastPointsEarned == null) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[styles.content, animatedStyle]}>
        <Text style={styles.points}>+{lastPointsEarned} XP</Text>
        {lastCombo != null && lastCombo > 1 && (
          <Text style={styles.combo}>{"\u00D7"}{lastCombo}</Text>
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
    bottom: 200,
    alignItems: "center",
    zIndex: 100,
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
});
