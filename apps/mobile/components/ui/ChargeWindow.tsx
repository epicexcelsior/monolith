/**
 * ChargeWindow — Timing minigame overlay for charging blocks.
 *
 * A contracting ring animation where tap timing determines charge quality.
 * Ring shrinks from scale 3.0 to 0.0 over 1.5s. Precision = 1 - (currentScale / 3).
 *
 * Brackets:
 *   precision >= 0.92 → "perfect" (40 energy)
 *   precision >= 0.75 → "great"   (31-35 energy)
 *   precision >= 0.45 → "good"    (26-30 energy)
 *   else              → "normal"  (existing RNG)
 *   timeout/miss      → "normal"  (existing RNG fallback)
 */

import React, { useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
} from "react-native";
import { CHARGE_WINDOW } from "@monolith/common";
import type { ChargeQuality } from "@monolith/common";
import { COLORS, FONT_FAMILY } from "@/constants/theme";
import { hapticChargeTap, hapticStreakMilestone } from "@/utils/haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const RING_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.5;
const MAX_SCALE = 3.0;

interface ChargeWindowProps {
  onResolve: (quality: ChargeQuality) => void;
  onCancel: () => void;
}

const QUALITY_LABELS: Record<ChargeQuality, string> = {
  perfect: "PERFECT!",
  great: "GREAT!",
  good: "GOOD!",
  normal: "OK",
};

const QUALITY_COLORS: Record<ChargeQuality, string> = {
  perfect: "#FFD700",
  great: "#FFC107",
  good: COLORS.goldLight,
  normal: COLORS.inspectorTextSecondary,
};

export default function ChargeWindow({ onResolve, onCancel }: ChargeWindowProps) {
  // Pre-allocate Animated values in refs — no `new` in render
  const ringScale = useRef(new Animated.Value(MAX_SCALE)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const resultScale = useRef(new Animated.Value(0.5)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const resolvedRef = useRef(false);
  const resultQualityRef = useRef<ChargeQuality>("normal");
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fade in overlay
  useEffect(() => {
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [overlayOpacity]);

  // Start contracting ring animation
  useEffect(() => {
    const anim = Animated.timing(ringScale, {
      toValue: 0,
      duration: CHARGE_WINDOW.DURATION_MS,
      useNativeDriver: true,
    });
    animRef.current = anim;
    anim.start(({ finished }) => {
      // If ring reaches 0 without tap — timeout, resolve as normal
      if (finished && !resolvedRef.current) {
        resolvedRef.current = true;
        hapticChargeTap();
        showResult("normal");
      }
    });

    return () => {
      anim.stop();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [ringScale]);

  const showResult = useCallback((quality: ChargeQuality) => {
    resultQualityRef.current = quality;

    // Flash the result text
    resultOpacity.setValue(1);
    resultScale.setValue(0.5);
    Animated.spring(resultScale, {
      toValue: 1,
      tension: 120,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Resolve after 500ms display
    timeoutRef.current = setTimeout(() => {
      onResolve(quality);
    }, 500);
  }, [onResolve, resultOpacity, resultScale]);

  const handleTap = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;

    // Stop the ring animation
    if (animRef.current) animRef.current.stop();

    // Read current scale value
    // @ts-ignore — Animated.Value has _value in RN
    const currentScale: number = (ringScale as any)._value ?? MAX_SCALE;
    const precision = 1.0 - (currentScale / MAX_SCALE);

    let quality: ChargeQuality;
    if (precision >= 1 - CHARGE_WINDOW.PERFECT_RADIUS) {
      quality = "perfect";
      hapticStreakMilestone();
    } else if (precision >= 1 - CHARGE_WINDOW.GREAT_RADIUS) {
      quality = "great";
      hapticChargeTap();
    } else if (precision >= 1 - CHARGE_WINDOW.GOOD_RADIUS) {
      quality = "good";
      hapticChargeTap();
    } else {
      quality = "normal";
      hapticChargeTap();
    }

    showResult(quality);
  }, [ringScale, showResult]);

  // Ring color interpolation: white → gold → bright gold as it shrinks
  const ringColor = ringScale.interpolate({
    inputRange: [0, MAX_SCALE * 0.3, MAX_SCALE],
    outputRange: ["#FFD700", "#FFC107", "rgba(255, 255, 255, 0.8)"],
  });

  const ringBorderWidth = ringScale.interpolate({
    inputRange: [0, MAX_SCALE],
    outputRange: [4, 2],
  });

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        {/* Target dot in center */}
        <View style={styles.targetDot} />

        {/* Contracting ring */}
        <Animated.View
          style={[
            styles.ring,
            {
              width: RING_SIZE,
              height: RING_SIZE,
              borderRadius: RING_SIZE / 2,
              borderColor: ringColor,
              borderWidth: ringBorderWidth,
              transform: [{ scale: ringScale }],
            },
          ]}
        />

        {/* Instruction text */}
        {!resolvedRef.current && (
          <Text style={styles.instructionText}>TAP when the ring is small!</Text>
        )}

        {/* Result flash */}
        <Animated.View
          style={[
            styles.resultContainer,
            {
              opacity: resultOpacity,
              transform: [{ scale: resultScale }],
            },
          ]}
          pointerEvents="none"
        >
          <Text
            style={[
              styles.resultText,
              { color: QUALITY_COLORS[resultQualityRef.current] },
            ]}
          >
            {QUALITY_LABELS[resultQualityRef.current]}
          </Text>
        </Animated.View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.60)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  targetDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.gold,
    position: "absolute",
  },
  ring: {
    position: "absolute",
    borderStyle: "solid",
  },
  instructionText: {
    position: "absolute",
    bottom: "25%",
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.7)",
    letterSpacing: 0.5,
  },
  resultContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  resultText: {
    fontFamily: FONT_FAMILY.headingBlack,
    fontSize: 36,
    letterSpacing: 2,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});
