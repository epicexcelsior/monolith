import React, { useRef, useEffect } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { useTowerStore } from "@/stores/tower-store";
import { CLAIM_FLASH, CLAIM_PHASES } from "@/constants/ClaimEffectConfig";

/**
 * ScreenFlash — Full-screen white/gold flash at claim impact moment.
 *
 * Reads the celebration ref from the store and triggers a fast opacity
 * animation: 0 → peak → 0 in ~350ms. Creates the "BOOM" moment
 * that makes the impact phase feel explosive.
 *
 * Pointer events pass through — this is purely visual.
 */
export default function ScreenFlash() {
  const opacity = useRef(new Animated.Value(0)).current;
  const claimCelebrationRef = useTowerStore((s) => s.claimCelebrationRef);
  const lastTriggerRef = useRef<number>(0);

  useEffect(() => {
    // Poll the celebration ref to detect impact phase
    const interval = setInterval(() => {
      const cel = claimCelebrationRef?.current;
      if (!cel?.active) return;

      const now = performance.now() / 1000;
      const elapsed = now - cel.startTime;
      const progress = elapsed / cel.duration;

      // Trigger flash at impact start
      if (
        progress >= CLAIM_PHASES.impact.start &&
        progress < CLAIM_PHASES.impact.end &&
        cel.startTime !== lastTriggerRef.current
      ) {
        lastTriggerRef.current = cel.startTime;

        // Flash in fast, flash out slower
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: CLAIM_FLASH.peakOpacity,
            duration: CLAIM_FLASH.fadeInDuration * 1000,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: CLAIM_FLASH.fadeOutDuration * 1000,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, 16); // Check every frame (~60fps)

    return () => clearInterval(interval);
  }, [claimCelebrationRef, opacity]);

  return (
    <Animated.View
      style={[styles.overlay, { opacity }]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `rgb(${Math.round(CLAIM_FLASH.color[0] * 255)}, ${Math.round(CLAIM_FLASH.color[1] * 255)}, ${Math.round(CLAIM_FLASH.color[2] * 255)})`,
    zIndex: 999,
  },
});
