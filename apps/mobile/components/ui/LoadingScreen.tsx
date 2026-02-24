import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { COLORS, SPACING, FONT_FAMILY } from "@/constants/theme";

export default function LoadingScreen({ visible }: { visible: boolean }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Animate progress
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: visible ? 0.7 : 1,
      duration: visible ? 4000 : 300,
      useNativeDriver: false,
    }).start();
  }, [visible, progressAnim]);

  // Fade out when not visible
  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(1);
      return;
    }
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim]);

  return (
    <Animated.View
      style={[styles.container, { opacity: fadeAnim }]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <View style={styles.content}>
        <Text style={styles.title}>THE MONOLITH</Text>
        <Text style={styles.subtitle}>{visible ? "Connecting..." : "Ready"}</Text>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bgTower,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  content: {
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    width: "100%",
  },
  title: {
    fontFamily: FONT_FAMILY.headingBlack,
    fontSize: 28,
    color: COLORS.gold,
    letterSpacing: 6,
    textShadowColor: COLORS.goldGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginBottom: SPACING.md,
  },
  subtitle: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 14,
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: SPACING.lg,
  },
  progressTrack: {
    width: "60%",
    height: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: SPACING.lg,
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.gold,
    borderRadius: 2,
  },
});
