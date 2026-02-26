import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { COLORS, SPACING, RADIUS, FONT_FAMILY, GLASS_STYLE } from "@/constants/theme";
import { useWalletStore, useTruncatedAddress } from "@/stores/wallet-store";
import { usePlayerStore } from "@/stores/player-store";
import XPBar from "@/components/ui/XPBar";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";

interface TopHUDProps {
  onReplayOnboarding: () => void;
}

/**
 * TopHUD — Minimal top bar: "MONOLITH" overline + wallet pill.
 * Replaces the old cluttered top bar with elegant minimal design.
 */
export default function TopHUD({ onReplayOnboarding }: TopHUDProps) {

  const insets = useSafeAreaInsets();
  const isConnected = useWalletStore((s) => s.isConnected);
  const truncatedAddress = useTruncatedAddress();
  const xp = usePlayerStore((s) => s.xp);
  const level = usePlayerStore((s) => s.level);
  const lastPointsEarned = usePlayerStore((s) => s.lastPointsEarned);

  // Pulse scale when XP increases
  const xpScale = useSharedValue(1);
  useEffect(() => {
    if (lastPointsEarned != null) {
      xpScale.value = withSequence(
        withSpring(1.12, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 12, stiffness: 150 }),
      );
    }
  }, [lastPointsEarned, xpScale]);

  const xpAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: xpScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(200).duration(400)}
      style={[styles.container, { paddingTop: insets.top + SPACING.xs }]}
    >
      {/* Left: MONOLITH overline */}
      <TouchableOpacity
        onLongPress={() => {
          hapticButtonPress();
          playButtonTap();
          onReplayOnboarding();
        }}
        delayLongPress={800}
        activeOpacity={0.7}
      >
        <Text style={styles.title}>MONOLITH</Text>
      </TouchableOpacity>

      {/* Center: XP pill */}
      <Animated.View style={[styles.xpPill, xpAnimStyle]}>
        <XPBar xp={xp} level={level} size="sm" />
      </Animated.View>

      {/* Right: Wallet pill */}
      <TouchableOpacity
        style={[styles.walletPill, isConnected && styles.walletPillConnected]}
        onPress={() => {
          hapticButtonPress();
          playButtonTap();
          useWalletStore.getState().setShowConnectSheet(true);
        }}
        activeOpacity={0.7}
      >
        {isConnected && <View style={styles.statusDot} />}
        <Text style={[styles.walletText, isConnected && styles.walletTextConnected]}>
          {isConnected && truncatedAddress ? truncatedAddress : "Connect"}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  title: {
    fontFamily: FONT_FAMILY.headingBlack,
    fontSize: 13,
    color: COLORS.goldLight,
    letterSpacing: 3,
    textShadowColor: COLORS.goldGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  xpPill: {
    flex: 1,
    marginHorizontal: SPACING.sm,
  },
  walletPill: {
    ...GLASS_STYLE.hudDark,
    borderRadius: RADIUS.full,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    minHeight: 32,
  },
  walletPillConnected: {
    borderColor: COLORS.successSubtle,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  walletText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  walletTextConnected: {
    fontFamily: FONT_FAMILY.mono,
    color: COLORS.success,
  },
});
