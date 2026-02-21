/**
 * ConnectionBanner — Thin status banner at top of tower HUD.
 *
 * Shows connecting/reconnecting/offline states.
 * Connected state fades out after 2s.
 */

import React, { useEffect } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { useMultiplayerStore } from "@/stores/multiplayer-store";
import { COLORS, FONT_FAMILY, SPACING, GLASS_STYLE } from "@/constants/theme";

export default function ConnectionBanner() {
  const connected = useMultiplayerStore((s) => s.connected);
  const connecting = useMultiplayerStore((s) => s.connecting);
  const reconnecting = useMultiplayerStore((s) => s.reconnecting);
  const error = useMultiplayerStore((s) => s.error);
  const connect = useMultiplayerStore((s) => s.connect);

  const opacity = useSharedValue(1);

  useEffect(() => {
    if (connected) {
      // Show briefly, then fade out
      opacity.value = 1;
      opacity.value = withDelay(2000, withTiming(0, { duration: 500 }));
    } else {
      opacity.value = 1;
    }
  }, [connected, connecting, reconnecting, error, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // Don't show when connected and faded out
  const isOffline = !connected && !connecting && !reconnecting && error;
  const showBanner = connecting || reconnecting || isOffline;

  if (!showBanner && !connected) return null;

  const dotColor = connecting || reconnecting
    ? COLORS.warning
    : isOffline
      ? COLORS.error
      : COLORS.success;
  const label = connecting
    ? "Connecting..."
    : reconnecting
      ? "Reconnecting..."
      : isOffline
        ? "Offline"
        : "Connected";

  const Wrapper = isOffline ? TouchableOpacity : View;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Wrapper
        style={styles.banner}
        {...(isOffline ? { onPress: connect, activeOpacity: 0.7 } : {})}
      >
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.label}>{label}</Text>
        {isOffline && <Text style={styles.retry}>Tap to retry</Text>}
      </Wrapper>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    marginTop: SPACING.xs,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    ...GLASS_STYLE.hudDark,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontFamily: FONT_FAMILY.bodyMedium,
    fontSize: 11,
    color: COLORS.textOnDark,
  },
  retry: {
    fontFamily: FONT_FAMILY.bodyMedium,
    fontSize: 10,
    color: COLORS.textMuted,
    marginLeft: SPACING.xs,
  },
});
