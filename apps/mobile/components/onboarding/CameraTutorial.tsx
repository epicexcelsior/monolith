/**
 * CameraTutorial — 3-step coach marks teaching camera controls.
 *
 * Step 1: "Swipe to look around" (orbit)
 * Step 2: "Pinch to zoom" (zoom)
 * Step 3: "Drag the bar to jump floors" (layer scrubber)
 *
 * Each step auto-advances after 4s or on tap.
 * pointerEvents="box-none" so gestures pass through to tower.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import { COLORS, FONT_FAMILY, SPACING, RADIUS, TIMING } from "@/constants/theme";

interface CameraTutorialProps {
  onComplete: () => void;
}

const STEPS = [
  {
    icon: "👆",
    title: "Swipe to look around",
    subtitle: "Drag to orbit the tower",
  },
  {
    icon: "🤏",
    title: "Pinch to zoom",
    subtitle: "Zoom in for details, out for overview",
  },
  {
    icon: "↕️",
    title: "Drag the bar to jump floors",
    subtitle: "Use the side bar to move between layers",
  },
] as const;

const STEP_DURATION_MS = 4000;

export default function CameraTutorial({ onComplete }: CameraTutorialProps) {
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateIn = useCallback(() => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.9);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        ...TIMING.springOnboarding,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const advance = useCallback(() => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }

    // Fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      if (step >= STEPS.length - 1) {
        onComplete();
      } else {
        setStep((s) => s + 1);
      }
    });
  }, [step, fadeAnim, onComplete]);

  // Animate in on mount and each step change
  useEffect(() => {
    animateIn();
    autoAdvanceTimer.current = setTimeout(advance, STEP_DURATION_MS);
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, [step, animateIn, advance]);

  const current = STEPS[step];

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable onPress={advance} style={styles.pressArea}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={styles.icon}>{current.icon}</Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.subtitle}>{current.subtitle}</Text>
          <Text style={styles.dots}>
            {STEPS.map((_, i) => (i === step ? "●" : "○")).join("  ")}
          </Text>
          <Text style={styles.tapHint}>Tap to continue</Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  pressArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  card: {
    backgroundColor: COLORS.hudGlassStrong,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.hudBorder,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    alignItems: "center",
    gap: SPACING.xs,
    maxWidth: 280,
  },
  icon: {
    fontSize: 40,
    marginBottom: SPACING.xs,
  },
  title: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 18,
    color: COLORS.textOnDark,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 14,
    color: COLORS.inspectorTextSecondary,
    textAlign: "center",
  },
  dots: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 14,
    color: COLORS.goldAccent,
    marginTop: SPACING.sm,
    letterSpacing: 4,
  },
  tapHint: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    color: COLORS.inspectorTextSecondary,
    marginTop: SPACING.xs,
    opacity: 0.6,
  },
});
