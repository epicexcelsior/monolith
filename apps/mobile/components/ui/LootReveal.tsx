/**
 * LootReveal — gacha-style reveal overlay when a loot item drops.
 *
 * Triggered by useLootStore.pendingReveal.
 * Animation: dim → rarity flash → card bounce → equip button.
 * Delays 3.5s if evolution celebration is active.
 */

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { useLootStore } from "@/stores/loot-store";
import { useTowerStore } from "@/stores/tower-store";
import { RARITY_COLORS, RARITY_LABELS } from "@/constants/loot-table";
import type { LootItem, LootType } from "@/constants/loot-table";
import { COLORS, FONT_FAMILY, RADIUS, SPACING } from "@/constants/theme";
import Button from "@/components/ui/Button";
import { hapticBlockClaimed, hapticButtonPress } from "@/utils/haptics";
import { playBlockClaim } from "@/utils/audio";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function LootReveal() {
  const pendingReveal = useLootStore((s) => s.pendingReveal);
  const clearPendingReveal = useLootStore((s) => s.clearPendingReveal);
  const [visibleItem, setVisibleItem] = useState<LootItem | null>(null);
  const [showEquip, setShowEquip] = useState(false);

  const overlayOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    if (!pendingReveal) return;

    // Delay if evolution celebration is active
    const justEvolved = useTowerStore.getState().justEvolved;
    const delay = justEvolved ? 3500 : 300;

    const timer = setTimeout(() => {
      setVisibleItem(pendingReveal);
      setShowEquip(false);
      hapticBlockClaimed();
      playBlockClaim();

      // Animation sequence
      overlayOpacity.value = withTiming(1, { duration: 300 });
      flashOpacity.value = withSequence(
        withDelay(300, withTiming(0.6, { duration: 200 })),
        withTiming(0, { duration: 300 }),
      );
      cardScale.value = withDelay(500, withSpring(1, { damping: 12, stiffness: 200 }));
      cardOpacity.value = withDelay(500, withTiming(1, { duration: 200 }));

      // Show equip after card lands
      setTimeout(() => runOnJS(setShowEquip)(true), 1200);
    }, delay);

    return () => clearTimeout(timer);
  }, [pendingReveal, overlayOpacity, flashOpacity, cardScale, cardOpacity]);

  const dismiss = useCallback(() => {
    overlayOpacity.value = withTiming(0, { duration: 200 });
    cardScale.value = withTiming(0, { duration: 200 });
    cardOpacity.value = withTiming(0, { duration: 150 });

    setTimeout(() => {
      setVisibleItem(null);
      setShowEquip(false);
      clearPendingReveal();
    }, 250);
  }, [overlayOpacity, cardScale, cardOpacity, clearPendingReveal]);

  const handleEquip = useCallback(() => {
    if (!visibleItem) return;
    hapticButtonPress();

    // Apply loot to currently selected block
    const selectedBlockId = useTowerStore.getState().selectedBlockId;
    if (selectedBlockId) {
      const customizeBlock = useTowerStore.getState().customizeBlock;
      const typeHandlers: Record<LootType, () => void> = {
        color: () => customizeBlock(selectedBlockId, { color: visibleItem.value }),
        emoji: () => customizeBlock(selectedBlockId, { emoji: visibleItem.value }),
        style: () => customizeBlock(selectedBlockId, { style: parseInt(visibleItem.value, 10) }),
        effect: () => { /* effects are visual-only, stored in inventory */ },
      };
      typeHandlers[visibleItem.type]();
    }

    dismiss();
  }, [visibleItem, dismiss]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  if (!visibleItem) return null;

  const rarityColor = RARITY_COLORS[visibleItem.rarity];
  const rarityLabel = RARITY_LABELS[visibleItem.rarity];
  const isLegendary = visibleItem.rarity === "legendary";

  // Display icon based on type
  const displayIcon = visibleItem.type === "color"
    ? null // show color swatch instead
    : visibleItem.type === "emoji"
      ? visibleItem.value
      : visibleItem.type === "effect"
        ? "\u2728"
        : "\uD83D\uDD25";

  return (
    <View style={styles.fullScreen} pointerEvents="box-none">
      {/* Dark overlay */}
      <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="auto">
        <TouchableOpacity style={styles.overlayTouch} onPress={dismiss} activeOpacity={1} />
      </Animated.View>

      {/* Rarity flash */}
      <Animated.View
        style={[styles.flash, flashStyle, { backgroundColor: rarityColor }]}
        pointerEvents="none"
      />

      {/* Item card */}
      <Animated.View style={[styles.cardContainer, cardStyle]} pointerEvents="box-none">
        <View
          style={[
            styles.card,
            { borderColor: rarityColor },
            isLegendary && styles.cardLegendary,
          ]}
        >
          {/* Item visual */}
          <View style={styles.iconArea}>
            {visibleItem.type === "color" ? (
              <View style={[styles.colorSwatch, { backgroundColor: visibleItem.value }]} />
            ) : (
              <Text style={styles.iconText}>{displayIcon}</Text>
            )}
          </View>

          {/* Item info */}
          <Text style={[styles.itemName, { color: rarityColor }]}>{visibleItem.name}</Text>
          <Text style={[styles.rarityLabel, { color: rarityColor }]}>
            {rarityLabel} {visibleItem.type.toUpperCase()}
          </Text>
          <Text style={styles.description}>{visibleItem.description}</Text>

          {/* Actions */}
          {showEquip && (
            <View style={styles.actions}>
              {visibleItem.type !== "effect" && (
                <Button
                  title="EQUIP"
                  variant="gold"
                  size="md"
                  onPress={handleEquip}
                />
              )}
              <TouchableOpacity style={styles.dismissBtn} onPress={dismiss}>
                <Text style={styles.dismissText}>
                  {visibleItem.type === "effect" ? "Nice!" : "Keep for later"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  overlayTouch: {
    flex: 1,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
  },
  cardContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: SCREEN_WIDTH,
  },
  card: {
    width: SCREEN_WIDTH * 0.75,
    backgroundColor: "rgba(10, 12, 28, 0.95)",
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    padding: SPACING.lg,
    alignItems: "center",
    gap: SPACING.sm,
  },
  cardLegendary: {
    shadowColor: "#D4AF55",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  iconArea: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xs,
  },
  colorSwatch: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  iconText: {
    fontSize: 48,
  },
  itemName: {
    fontFamily: FONT_FAMILY.headingBlack,
    fontSize: 20,
    letterSpacing: 0.5,
  },
  rarityLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.5,
    opacity: 0.8,
  },
  description: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  actions: {
    width: "100%",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  dismissBtn: {
    alignItems: "center",
    paddingVertical: SPACING.xs,
  },
  dismissText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 13,
    color: COLORS.textMuted,
  },
});
