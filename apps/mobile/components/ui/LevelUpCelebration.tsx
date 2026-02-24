/**
 * LevelUpCelebration — Full-screen momentary overlay for level-ups.
 *
 * Triggered by usePlayerStore.levelUp.
 */

import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { usePlayerStore } from "@/stores/player-store";
import { COLORS, FONT_FAMILY } from "@/constants/theme";
import { hapticLevelUp } from "@/utils/haptics";
import { playLevelUp } from "@/utils/audio";

export default function LevelUpCelebration() {
  const levelUp = usePlayerStore((s) => s.levelUp);
  const clearLevelUp = usePlayerStore((s) => s.clearLevelUp);

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const bgOpacity = useSharedValue(0);

  useEffect(() => {
    if (levelUp == null) return;

    // Haptic + SFX
    hapticLevelUp();
    playLevelUp();

    // Animate
    scale.value = withSequence(
      withTiming(1.2, { duration: 300 }),
      withTiming(1, { duration: 200 }),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(1500, withTiming(0, { duration: 800 })),
    );
    bgOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(1500, withTiming(0, { duration: 800 })),
    );
  }, [levelUp, scale, opacity, bgOpacity]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  if (levelUp == null) return null;

  return (
    <Animated.View style={[styles.overlay, bgStyle]} pointerEvents="none">
      <Animated.View style={[styles.content, contentStyle]}>
        <Text style={styles.levelText}>LEVEL {levelUp}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 8, 16, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 200,
  },
  content: {
    alignItems: "center",
    gap: 8,
  },
  levelText: {
    fontFamily: FONT_FAMILY.headingBlack,
    fontSize: 48,
    color: COLORS.gold,
    letterSpacing: 4,
    textShadowColor: COLORS.goldGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
});
