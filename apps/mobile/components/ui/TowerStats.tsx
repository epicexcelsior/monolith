import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { COLORS, SPACING, FONT_FAMILY, GLASS_STYLE } from "@/constants/theme";
import { useTowerStore } from "@/stores/tower-store";
import { useWalletStore } from "@/stores/wallet-store";
import { useMultiplayerStore } from "@/stores/multiplayer-store";
import { usePlayerStore } from "@/stores/player-store";

/**
 * TowerStats — Compact stat pills on the tower HUD.
 * Shows: Online, My Blocks, Level (reduced from 7 stats).
 */
export default function TowerStats() {
  const demoBlocks = useTowerStore((s) => s.demoBlocks);
  const publicKey = useWalletStore((s) => s.publicKey);
  const playerCount = useMultiplayerStore((s) => s.playerCount);
  const level = usePlayerStore((s) => s.level);

  const myBlocks = useMemo(() => {
    if (!publicKey) return 0;
    const wallet = publicKey.toBase58();
    return demoBlocks.filter((b) => b.owner === wallet).length;
  }, [demoBlocks, publicKey]);

  const hasStats = playerCount > 0 || myBlocks > 0 || level > 1;
  if (!hasStats) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(400).duration(400)}
      style={styles.container}
    >
      {playerCount > 0 && (
        <>
          <View style={styles.pill}>
            <Text style={[styles.pillValue, { color: COLORS.success }]}>{playerCount}</Text>
            <Text style={styles.pillLabel}>Online</Text>
          </View>
          <View style={styles.divider} />
        </>
      )}
      {myBlocks > 0 && (
        <>
          <View style={styles.pill}>
            <Text style={[styles.pillValue, { color: COLORS.goldLight }]}>{myBlocks}</Text>
            <Text style={styles.pillLabel}>Mine</Text>
          </View>
          {level > 1 && <View style={styles.divider} />}
        </>
      )}
      {level > 1 && (
        <View style={styles.pill}>
          <Text style={[styles.pillValue, { color: COLORS.gold }]}>Lv.{level}</Text>
          <Text style={styles.pillLabel}>Level</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    ...GLASS_STYLE.hudDark,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  pill: {
    alignItems: "center",
  },
  pillValue: {
    color: COLORS.textOnDark,
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  pillLabel: {
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.body,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.goldSubtle,
  },
});
