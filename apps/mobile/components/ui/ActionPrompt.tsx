import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, GLASS_STYLE } from "@/constants/theme";
import { useTowerStore } from "@/stores/tower-store";
import { useWalletStore } from "@/stores/wallet-store";
import { hapticButtonPress } from "@/utils/haptics";

/**
 * ActionPrompt — Contextual "what to do next" banner on the tower HUD.
 *
 * Adapts based on player state:
 * - Not connected   → "Connect wallet to claim your spot"
 * - Connected, 0 blocks → "Tap a dark block to claim it"
 * - Has blocks, lowest energy <30 → "Your block is fading! Tap it to charge"
 * - Has blocks, all healthy → shows streak tip or hides
 */
export default function ActionPrompt() {
  const insets = useSafeAreaInsets();
  const isConnected = useWalletStore((s) => s.isConnected);
  const publicKey = useWalletStore((s) => s.publicKey);
  const demoBlocks = useTowerStore((s) => s.demoBlocks);
  const selectedBlockId = useTowerStore((s) => s.selectedBlockId);
  const onboardingDone = useTowerStore((s) => s.onboardingDone);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Derive player state
  const myBlocks = publicKey
    ? demoBlocks.filter((b) => b.owner === publicKey.toBase58())
    : [];
  const lowestEnergy = myBlocks.length > 0
    ? Math.min(...myBlocks.map((b) => b.energy))
    : 100;
  const bestStreak = myBlocks.length > 0
    ? Math.max(...myBlocks.map((b) => b.streak ?? 0))
    : 0;

  // Determine prompt content
  let prompt: { icon: string; text: string; actionText?: string; onAction?: () => void } | null = null;

  if (!onboardingDone) {
    prompt = null; // Don't show during onboarding
  } else if (!isConnected) {
    prompt = {
      icon: "🔗",
      text: "Connect your wallet to claim a block",
      actionText: "Connect",
      onAction: () => {
        hapticButtonPress();
        useWalletStore.getState().setShowConnectSheet(true);
      },
    };
  } else if (myBlocks.length === 0) {
    prompt = {
      icon: "👆",
      text: "Tap any dark block to claim your spot on the tower",
    };
  } else if (lowestEnergy < 30) {
    prompt = {
      icon: "⚡",
      text: `Your block is fading! Tap it to charge (${Math.round(lowestEnergy)}%)`,
    };
  } else if (bestStreak > 0 && bestStreak < 3) {
    prompt = {
      icon: "🔥",
      text: `Day ${bestStreak} streak — charge daily for 1.5x at Day 3!`,
    };
  } else if (bestStreak >= 3 && bestStreak < 7) {
    prompt = {
      icon: "🔥",
      text: `Day ${bestStreak} streak! Keep it up for 2x charge at Day 7`,
    };
  } else {
    prompt = null; // All good, hide it
  }

  // Hide when block inspector is open
  if (selectedBlockId) {
    prompt = null;
  }

  // Animate in/out
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: prompt ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [prompt !== null]);

  // Subtle pulse for attention
  useEffect(() => {
    if (!prompt) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [prompt?.text]);

  if (!prompt && !fadeAnim) return null;

  const Container = prompt?.onAction ? TouchableOpacity : View;

  // Sit above FloatingNav (~56px pill row + safe area + padding)
  const bottomOffset = Math.max(insets.bottom, 12) + 56 + SPACING.md;

  return (
    <Animated.View
      style={[styles.wrapper, { bottom: bottomOffset, opacity: fadeAnim }]}
      pointerEvents={prompt ? "auto" : "none"}
    >
      <Animated.View style={[styles.container, { opacity: pulseAnim }]}>
        <Container
          style={styles.inner}
          {...(prompt?.onAction ? { onPress: prompt.onAction, activeOpacity: 0.8 } : {})}
        >
          <Text style={styles.icon}>{prompt?.icon}</Text>
          <Text style={styles.text}>{prompt?.text}</Text>
          {prompt?.actionText && (
            <View style={styles.actionBadge}>
              <Text style={styles.actionText}>{prompt.actionText}</Text>
            </View>
          )}
        </Container>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: SPACING.md,
    right: SPACING.md,
    alignItems: "center",
  },
  container: {
    ...GLASS_STYLE.hudDark,
    borderColor: COLORS.goldGlow,
    overflow: "hidden",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.sm,
  },
  icon: {
    fontSize: 18,
  },
  text: {
    flex: 1,
    color: COLORS.goldLight,
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  actionBadge: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  actionText: {
    color: COLORS.textOnGold,
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
