import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SPACING, FONT_FAMILY, getChargeColor } from "@/constants/theme";
import ChargeBar from "@/components/ui/ChargeBar";

interface InspectorStatsProps {
  energyPct: number;
  isUnclaimed: boolean;
}

export default function InspectorStats({ energyPct, isUnclaimed }: InspectorStatsProps) {
  if (isUnclaimed) return null;

  return (
    <View style={styles.energyRow}>
      <ChargeBar charge={energyPct} size="sm" />
      <Text style={[styles.energyPct, { color: getChargeColor(energyPct) }]}>
        {Math.round(energyPct)}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  energyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  energyPct: {
    fontFamily: FONT_FAMILY.monoBold,
    fontSize: 13,
    width: 36,
    textAlign: "right",
  },
});
