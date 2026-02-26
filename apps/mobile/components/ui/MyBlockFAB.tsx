/**
 * MyBlockFAB — Floating action button for quick access to owned blocks.
 * Single block: tap flies camera to it. Multi-block: opens MyBlocksPanel.
 * Shows red urgency dot when any block is below 20% energy.
 */
import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING, RADIUS, FONT_FAMILY, SHADOW } from "@/constants/theme";
import { useTowerStore } from "@/stores/tower-store";
import { useWalletStore } from "@/stores/wallet-store";
import { ENERGY_THRESHOLDS } from "@monolith/common";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";

interface MyBlockFABProps {
  visible: boolean;
  onOpenPanel: () => void;
}

export default function MyBlockFAB({ visible, onOpenPanel }: MyBlockFABProps) {
  const insets = useSafeAreaInsets();
  const publicKey = useWalletStore((s) => s.publicKey);
  const demoBlocks = useTowerStore((s) => s.demoBlocks);
  const selectBlock = useTowerStore((s) => s.selectBlock);

  const wallet = publicKey?.toBase58();

  const myBlocks = useMemo(() => {
    if (!wallet) return [];
    return demoBlocks.filter((b) => b.owner === wallet);
  }, [demoBlocks, wallet]);

  const hasUrgent = useMemo(
    () => myBlocks.some((b) => b.energy < ENERGY_THRESHOLDS.fading),
    [myBlocks],
  );

  if (!visible || myBlocks.length === 0) return null;

  const firstBlock = myBlocks[0];
  const displayEmoji = myBlocks.length === 1 ? (firstBlock.emoji || "\uD83D\uDD32") : "\uD83C\uDFD7\uFE0F";

  const handlePress = () => {
    hapticButtonPress();
    playButtonTap();
    if (myBlocks.length === 1) {
      selectBlock(firstBlock.id);
    } else {
      onOpenPanel();
    }
  };

  const bottomOffset = Math.max(insets.bottom, 12) + 56 + SPACING.md;

  return (
    <TouchableOpacity
      style={[styles.fab, { bottom: bottomOffset }]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Text style={styles.emoji}>{displayEmoji}</Text>
      {myBlocks.length > 1 && (
        <Text style={styles.count}>{myBlocks.length}</Text>
      )}
      {hasUrgent && <View style={styles.urgentDot} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: SPACING.md,
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.hudGlass,
    borderWidth: 1,
    borderColor: COLORS.goldGlow,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: SHADOW.blazing,
  },
  emoji: {
    fontSize: 20,
  },
  count: {
    position: "absolute",
    bottom: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.gold,
    fontFamily: FONT_FAMILY.monoBold,
    fontSize: 10,
    color: COLORS.textOnGold,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 2,
    overflow: "hidden",
  },
  urgentDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.flickering,
    borderWidth: 1.5,
    borderColor: COLORS.bgTower,
  },
});
