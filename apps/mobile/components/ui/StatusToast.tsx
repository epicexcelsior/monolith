/**
 * StatusToast — Reusable error/success/info toast notification.
 *
 * Follows the AchievementToast pattern: slides from top, auto-dismisses
 * after 4 seconds, color-coded border by type.
 */

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { COLORS, SPACING, FONT_FAMILY, GLASS_STYLE } from "@/constants/theme";
import { useStatusToastStore, type ToastType } from "@/stores/status-toast-store";
import { hapticError } from "@/utils/haptics";

const TOAST_DURATION = 4000;

const TOAST_CONFIG: Record<ToastType, { border: string; label: string }> = {
  error: { border: COLORS.error, label: "Error" },
  success: { border: COLORS.success, label: "Done" },
  info: { border: COLORS.info, label: "Info" },
};

export default function StatusToast() {
  const message = useStatusToastStore((s) => s.message);
  const type = useStatusToastStore((s) => s.type);
  const dismiss = useStatusToastStore((s) => s.dismiss);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;

    if (type === "error") hapticError();

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
      ]).start(() => dismiss());
    }, TOAST_DURATION);

    return () => clearTimeout(timer);
  }, [message, type, slideAnim, opacityAnim, dismiss]);

  if (!message) return null;

  const config = TOAST_CONFIG[type];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          borderColor: config.border,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.textContainer}>
        <Text style={[styles.label, { color: config.border }]}>
          {config.label}
        </Text>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
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
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.sm,
    zIndex: 998,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  message: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 11,
    color: COLORS.textOnDark,
    marginTop: 2,
  },
});
