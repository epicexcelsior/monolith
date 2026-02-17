import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, GLASS_STYLE } from "@/constants/theme";
import { useTowerStore } from "@/stores/tower-store";
import { useWalletStore } from "@/stores/wallet-store";
import { isBotOwner } from "@/utils/seed-tower";

/**
 * TowerStats — Semi-transparent stat pills on the tower HUD.
 *
 * Shows: Keepers (unique owners), Your Blocks, Avg Charge.
 * Gives immediate context: "this tower is alive, other people are here."
 */
export default function TowerStats() {
  const demoBlocks = useTowerStore((s) => s.demoBlocks);
  const publicKey = useWalletStore((s) => s.publicKey);

  const stats = useMemo(() => {
    const owned = demoBlocks.filter((b) => b.owner !== null);
    const uniqueOwners = new Set(owned.map((b) => b.owner));
    const avgEnergy = owned.length > 0
      ? Math.round(owned.reduce((sum, b) => sum + b.energy, 0) / owned.length)
      : 0;
    const myCount = publicKey
      ? demoBlocks.filter((b) => b.owner === publicKey.toBase58()).length
      : 0;

    return {
      keepers: uniqueOwners.size,
      myBlocks: myCount,
      avgEnergy,
      totalBlocks: demoBlocks.length,
      claimedPct: demoBlocks.length > 0
        ? Math.round((owned.length / demoBlocks.length) * 100)
        : 0,
    };
  }, [demoBlocks, publicKey]);

  return (
    <View style={styles.container}>
      <View style={styles.pill}>
        <Text style={styles.pillValue}>{stats.keepers}</Text>
        <Text style={styles.pillLabel}>Keepers</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.pill}>
        <Text style={styles.pillValue}>{stats.claimedPct}%</Text>
        <Text style={styles.pillLabel}>Claimed</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.pill}>
        <Text style={styles.pillValue}>{stats.avgEnergy}%</Text>
        <Text style={styles.pillLabel}>Avg Charge</Text>
      </View>
      {publicKey && stats.myBlocks > 0 && (
        <>
          <View style={styles.divider} />
          <View style={styles.pill}>
            <Text style={[styles.pillValue, { color: COLORS.goldLight }]}>{stats.myBlocks}</Text>
            <Text style={styles.pillLabel}>Mine</Text>
          </View>
        </>
      )}
    </View>
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
