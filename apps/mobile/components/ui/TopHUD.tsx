import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { COLORS, SPACING, RADIUS, FONT_FAMILY, GLASS_STYLE } from "@/constants/theme";
import { useWalletStore, useTruncatedAddress } from "@/stores/wallet-store";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";

interface TopHUDProps {
  onReplayOnboarding: () => void;
}

/**
 * TopHUD — Minimal top bar: "MONOLITH" overline + wallet pill.
 * XP removed — evolution tier is the one progression system now.
 */
export default function TopHUD({ onReplayOnboarding }: TopHUDProps) {

  const insets = useSafeAreaInsets();
  const isConnected = useWalletStore((s) => s.isConnected);
  const truncatedAddress = useTruncatedAddress();

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

      <View style={styles.spacer} />

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
  spacer: {
    flex: 1,
  },
  walletPill: {
    ...GLASS_STYLE.hudDark,
    borderRadius: RADIUS.full,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6, // 6px: visually balanced, not a token multiple
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
