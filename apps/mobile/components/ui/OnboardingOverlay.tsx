import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, TEXT, TIMING } from "@/constants/theme";
import { useTowerStore } from "@/stores/tower-store";
import { hapticButtonPress } from "@/utils/haptics";

type OnboardingStep = "welcome" | "explore" | "claim-hint" | "done";

const STEP_CONFIGS: Record<OnboardingStep, { title: string; subtitle: string; buttonText: string }> = {
  welcome: {
    title: "Welcome to The Monolith",
    subtitle: "A living tower of staked blocks.\nEach one claimed, charged, and customized by its owner.",
    buttonText: "Show Me",
  },
  explore: {
    title: "Find Your Spot",
    subtitle: "Explore the tower. Look for dark or empty blocks \u2014 those are unclaimed and waiting for you.",
    buttonText: "Got It",
  },
  "claim-hint": {
    title: "Tap to Claim",
    subtitle: "Tap any unclaimed block, stake USDC, and make it yours. Keep it charged or watch it fade.",
    buttonText: "Let's Go",
  },
  done: {
    title: "",
    subtitle: "",
    buttonText: "",
  },
};

const STEPS: OnboardingStep[] = ["welcome", "explore", "claim-hint"];

export default function OnboardingOverlay() {
  const completeOnboarding = useTowerStore((s) => s.completeOnboarding);
  const [stepIndex, setStepIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  const currentStep = STEPS[stepIndex] ?? "done";
  const config = STEP_CONFIGS[currentStep];

  // Fade in on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    Animated.timing(contentFade, {
      toValue: 1,
      duration: 400,
      delay: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Animate content when step changes
  useEffect(() => {
    contentFade.setValue(0);
    Animated.timing(contentFade, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [stepIndex]);

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

  if (currentStep === "done") return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} pointerEvents="box-none">
      <View style={styles.spacer} pointerEvents="none" />

      <Animated.View style={[styles.card, { opacity: contentFade }]}>
        {/* Step indicator */}
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === stepIndex && styles.dotActive]}
            />
          ))}
        </View>

        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.subtitle}>{config.subtitle}</Text>

        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>{config.buttonText}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 6, 16, 0.75)",
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
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl + 20,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.borderStrong,
  },
  dotActive: {
    backgroundColor: COLORS.gold,
    width: 24,
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
    paddingHorizontal: SPACING.md,
  },
  button: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    width: "100%",
    alignItems: "center",
    boxShadow: "0 4px 16px rgba(200, 153, 62, 0.20)",
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
