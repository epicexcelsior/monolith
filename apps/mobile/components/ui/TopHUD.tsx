import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { COLORS, SPACING, RADIUS, FONT_FAMILY, GLASS_STYLE } from "@/constants/theme";
import { useWalletStore, useTruncatedAddress } from "@/stores/wallet-store";
import { useTowerStore } from "@/stores/tower-store";
import { useQuestStore } from "@/stores/quest-store";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";

// Streak milestone days — pulse animation fires on these
const STREAK_MILESTONES = [3, 7, 10, 14, 21, 30, 50, 100];

interface TopHUDProps {
  onReplayOnboarding: () => void;
}

/**
 * TopHUD — Minimal top bar: "MONOLITH" overline + streak pill + quest pill + wallet pill.
 */
export default function TopHUD({ onReplayOnboarding }: TopHUDProps) {
  const insets = useSafeAreaInsets();
  const isConnected = useWalletStore((s) => s.isConnected);
  const publicKey = useWalletStore((s) => s.publicKey);
  const truncatedAddress = useTruncatedAddress();
  const demoBlocks = useTowerStore((s) => s.demoBlocks);
  const quests = useQuestStore((s) => s.quests);
  const toggleQuestPanel = useQuestStore((s) => s.toggleQuestPanel);

  // Find best streak across owned blocks
  const wallet = publicKey?.toBase58();
  const bestStreak = useMemo(() => {
    if (!wallet) return 0;
    let best = 0;
    for (const b of demoBlocks) {
      if (b.owner === wallet && (b.streak ?? 0) > best) {
        best = b.streak ?? 0;
      }
    }
    return best;
  }, [demoBlocks, wallet]);

  // Quest progress
  const totalQuests = quests.length;
  const completedQuests = quests.filter((q) => q.completed).length;
  const allQuestsDone = totalQuests > 0 && completedQuests === totalQuests;

  // Streak milestone pulse animation
  const isMilestone = STREAK_MILESTONES.includes(bestStreak) && bestStreak > 0;
  const pulseScale = useSharedValue(1);
  if (isMilestone) {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 600 }),
        withTiming(1.0, { duration: 600 }),
      ),
      -1,
      false,
    );
  }
  const streakAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
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

      <View style={styles.center}>
        {/* Streak pill — only shown when player has blocks with streaks */}
        {bestStreak > 0 && (
          <Animated.View style={[styles.pill, streakAnimStyle]}>
            <Text style={styles.pillText}>🔥 {bestStreak}</Text>
          </Animated.View>
        )}

        {/* Quest progress pill — only shown when quests are loaded */}
        {totalQuests > 0 && (
          <TouchableOpacity
            style={[styles.pill, allQuestsDone && styles.pillGold]}
            onPress={() => {
              hapticButtonPress();
              toggleQuestPanel();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.pillText}>
              📜 {completedQuests}/{totalQuests}
            </Text>
          </TouchableOpacity>
        )}
      </View>

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
  center: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  pill: {
    ...GLASS_STYLE.hudDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    minHeight: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  pillGold: {
    borderColor: COLORS.goldAccentDim,
    backgroundColor: "rgba(212, 168, 71, 0.15)",
  },
  pillText: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 12,
    color: COLORS.inspectorText,
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
