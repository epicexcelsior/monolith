/**
 * LevelUpCelebration — Full-screen momentary overlay for evolution tier-ups.
 *
 * Triggered by useTowerStore.justEvolved (string tier name or null).
 * Auto-clears after 3.2s.
 */

import React, { useEffect, useCallback, useRef } from "react";
import { StyleSheet, Text, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  runOnJS,
} from "react-native-reanimated";
import { useTowerStore } from "@/stores/tower-store";
import { COLORS, FONT_FAMILY } from "@/constants/theme";
import { hapticLevelUp } from "@/utils/haptics";
import { playLevelUp } from "@/utils/audio";

export default function LevelUpCelebration() {
  const justEvolved = useTowerStore((s) => s.justEvolved);
  const clearJustEvolved = useTowerStore((s) => s.clearJustEvolved);
  const showTimeRef = useRef<number>(0);

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const bgOpacity = useSharedValue(0);

  const dismiss = useCallback(() => {
    // Fast fade out, then clear
    opacity.value = withTiming(0, { duration: 200 });
    bgOpacity.value = withTiming(0, { duration: 200 });
    setTimeout(() => clearJustEvolved(), 220);
  }, [opacity, bgOpacity, clearJustEvolved]);

  useEffect(() => {
    if (justEvolved == null) return;

    showTimeRef.current = Date.now();

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

    // Auto-clear after 3.2s (fallback)
    const timer = setTimeout(() => {
      clearJustEvolved();
    }, 3200);

    return () => clearTimeout(timer);
  }, [justEvolved, scale, opacity, bgOpacity, clearJustEvolved]);

  const handleTap = useCallback(() => {
    // Only allow dismiss after 1s (let user see the impact moment)
    if (Date.now() - showTimeRef.current < 1000) return;
    dismiss();
  }, [dismiss]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  if (justEvolved == null) return null;

  return (
    <Animated.View style={[styles.overlay, bgStyle]} pointerEvents="auto">
      <Pressable style={styles.pressArea} onPress={handleTap}>
        <Animated.View style={[styles.content, contentStyle]}>
          <Text style={styles.subtitle}>YOUR SPARK EVOLVED TO</Text>
          <Text style={styles.tierText}>{justEvolved.toUpperCase()}</Text>
        </Animated.View>
      </Pressable>
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
  pressArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
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
