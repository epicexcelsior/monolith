import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, TEXT, TIMING } from "@/constants/theme";
import { useTowerStore } from "@/stores/tower-store";
import { hapticButtonPress } from "@/utils/haptics";

// ─── Step Configuration ──────────────────────────────────

interface StepConfig {
  emoji: string;
  title: string;
  subtitle: string;
  buttonText: string;
}

const STEPS: StepConfig[] = [
  {
    emoji: "🏛️",
    title: "Welcome to the Monolith",
    subtitle:
      "A living tower where every block is someone's real stake. Bright = active. Dark = neglected.\n\nYour job: claim a block and keep it glowing.",
    buttonText: "How?",
  },
  {
    emoji: "⚡",
    title: "The Daily Loop",
    subtitle:
      "1. Stake USDC to claim a block\n2. Tap daily to charge it\n3. Build streaks for multipliers (Day 3 = 1.5x, Day 7 = 2x)\n4. Don't let it fade!",
    buttonText: "What if I stop?",
  },
  {
    emoji: "💀",
    title: "Use It or Lose It",
    subtitle:
      "Blocks slowly lose charge over time. Miss a day and your streak resets.\n\nThe tower punishes neglect and rewards consistency.",
    buttonText: "Got it — let me in!",
  },
];

// ─── Component ──────────────────────────────────────────

export default function OnboardingOverlay() {
  const completeOnboarding = useTowerStore((s) => s.completeOnboarding);
  const [stepIndex, setStepIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const emojiScale = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const config = STEPS[stepIndex];

  // Fade in on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    animateStepIn();
  }, []);

  // Animate content when step changes
  useEffect(() => {
    animateStepIn();
    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: (stepIndex + 1) / STEPS.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [stepIndex]);

  const animateStepIn = () => {
    contentFade.setValue(0);
    emojiScale.setValue(0.3);

    Animated.parallel([
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(emojiScale, {
        toValue: 1,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleNext = () => {
    hapticButtonPress();
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      // Final step -> dismiss
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        completeOnboarding();
      });
    }
  };

  const handleSkip = () => {
    hapticButtonPress();
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      completeOnboarding();
    });
  };

  if (!config) return null;

  const screenWidth = Dimensions.get("window").width;
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, screenWidth - SPACING.lg * 2 - SPACING.md * 2],
  });

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} pointerEvents="box-none">
      <View style={styles.spacer} pointerEvents="none" />

      <Animated.View style={[styles.card, { opacity: contentFade }]}>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, { width: progressWidth }]}
          />
        </View>

        {/* Step counter */}
        <Text style={styles.stepCounter}>
          {stepIndex + 1} of {STEPS.length}
        </Text>

        {/* Large emoji icon */}
        <Animated.Text
          style={[styles.emoji, { transform: [{ scale: emojiScale }] }]}
        >
          {config.emoji}
        </Animated.Text>

        {/* Title & subtitle */}
        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.subtitle}>{config.subtitle}</Text>

        {/* Primary action */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>{config.buttonText}</Text>
        </TouchableOpacity>

        {/* Skip */}
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip Tutorial</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 6, 4, 0.80)",
    justifyContent: "flex-end",
  },
  spacer: {
    flex: 1,
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl + 20,
    alignItems: "center",
  },
  progressTrack: {
    width: "100%",
    height: 4,
    backgroundColor: COLORS.bgMuted,
    borderRadius: 2,
    marginBottom: SPACING.sm,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: COLORS.gold,
    borderRadius: 2,
  },
  stepCounter: {
    ...TEXT.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  emoji: {
    fontSize: 56,
    marginBottom: SPACING.md,
  },
  title: {
    ...TEXT.displaySm,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...TEXT.bodyLg,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.xs,
  },
  button: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    width: "100%",
    alignItems: "center",
    boxShadow: "0 4px 16px rgba(200, 153, 62, 0.25)",
  },
  buttonText: {
    ...TEXT.button,
    color: COLORS.textOnGold,
  },
  skipButton: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  skipText: {
    ...TEXT.bodySm,
    color: COLORS.textMuted,
  },
});
