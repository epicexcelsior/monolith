/**
 * LevelUpCelebration — Full-screen momentary overlay for evolution tier-ups.
 *
 * Triggered by useTowerStore.justEvolved (string tier name or null).
 * Auto-clears after 3.2s.
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
import { useTowerStore } from "@/stores/tower-store";
import { COLORS, FONT_FAMILY } from "@/constants/theme";
import { hapticLevelUp } from "@/utils/haptics";
import { playLevelUp } from "@/utils/audio";

export default function LevelUpCelebration() {
  const justEvolved = useTowerStore((s) => s.justEvolved);
  const clearJustEvolved = useTowerStore((s) => s.clearJustEvolved);

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const bgOpacity = useSharedValue(0);

  useEffect(() => {
    if (justEvolved == null) return;

    // Haptic + SFX
    hapticLevelUp();
    playLevelUp();

    // Animate in then out
    scale.value = withSequence(
      withTiming(1.2, { duration: 300 }),
      withTiming(1, { duration: 200 }),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(2000, withTiming(0, { duration: 800 })),
    );
    bgOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(2000, withTiming(0, { duration: 800 })),
    );

    // Auto-clear after 3.2s
    const timer = setTimeout(() => {
      clearJustEvolved();
    }, 3200);

    return () => clearTimeout(timer);
  }, [justEvolved, scale, opacity, bgOpacity, clearJustEvolved]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  if (justEvolved == null) return null;

  return (
    <Animated.View style={[styles.overlay, bgStyle]} pointerEvents="none">
      <Animated.View style={[styles.content, contentStyle]}>
        <Text style={styles.subtitle}>YOUR SPARK EVOLVED TO</Text>
        <Text style={styles.tierText}>{justEvolved.toUpperCase()}</Text>
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
  subtitle: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 16,
    color: COLORS.textSecondary,
    letterSpacing: 2,
  },
  tierText: {
    fontFamily: FONT_FAMILY.headingBlack,
    fontSize: 48,
    color: COLORS.goldAccent,
    letterSpacing: 4,
    textShadowColor: COLORS.goldGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
});
