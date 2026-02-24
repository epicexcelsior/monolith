import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, GLASS_STYLE } from "@/constants/theme";
import { useAchievementStore } from "@/stores/achievement-store";
import { hapticButtonPress } from "@/utils/haptics";

const TOAST_DURATION = 4000;

export default function AchievementToast() {
  const pendingToast = useAchievementStore((s) => s.pendingToast);
  const dismissToast = useAchievementStore((s) => s.dismissToast);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pendingToast) return;

    hapticButtonPress();

    // Slide in
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => dismissToast());
    }, TOAST_DURATION);

    return () => clearTimeout(timer);
  }, [pendingToast, slideAnim, opacityAnim, dismissToast]);

  if (!pendingToast) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Text style={styles.icon}>{pendingToast.icon}</Text>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{pendingToast.title}</Text>
        <Text style={styles.description}>{pendingToast.description}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    ...GLASS_STYLE.hudDark,
    borderColor: COLORS.gold,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.sm,
    zIndex: 999,
  },
  icon: {
    fontSize: 28,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 14,
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  description: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 11,
    color: COLORS.textOnDark,
    marginTop: 2,
  },
});
