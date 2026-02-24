import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { COLORS, SPACING, FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useTowerStore } from "@/stores/tower-store";

interface TickerPill {
  id: string;
  label: string;
  blockId: string;
  type: "fading" | "new" | "claimable" | "streak";
}

const TYPE_ICONS: Record<TickerPill["type"], string> = {
  fading: "⚠️",
  new: "🆕",
  claimable: "💀",
  streak: "🔥",
};

const MAX_PILLS = 5;
const SCAN_INTERVAL_MS = 3000;

export default function HotBlockTicker() {
  const demoBlocks = useTowerStore((s) => s.demoBlocks);
  const selectBlock = useTowerStore((s) => s.selectBlock);
  const selectedBlockId = useTowerStore((s) => s.selectedBlockId);
  const [pills, setPills] = useState<TickerPill[]>([]);

  const scanBlocks = useCallback(() => {
    const now = Date.now();
    const results: TickerPill[] = [];

    for (const block of demoBlocks) {
      if (results.length >= MAX_PILLS) break;

      // Claimable (dead blocks)
      if (block.owner && block.energy === 0) {
        results.push({ id: `claimable-${block.id}`, label: `L${block.layer} Claimable`, blockId: block.id, type: "claimable" });
        continue;
      }

      // Fading (< 20%)
      if (block.owner && block.energy > 0 && block.energy < 20) {
        results.push({ id: `fading-${block.id}`, label: `L${block.layer} Fading`, blockId: block.id, type: "fading" });
        continue;
      }

      // Recently claimed (within 60s)
      if (block.owner && block.lastChargeTime && now - block.lastChargeTime < 60_000 && block.energy > 80) {
        if (results.length < MAX_PILLS) {
          results.push({ id: `new-${block.id}`, label: `L${block.layer} New!`, blockId: block.id, type: "new" });
        }
        continue;
      }

      // High streak
      if (block.owner && (block.streak ?? 0) >= 7) {
        if (results.length < MAX_PILLS) {
          results.push({ id: `streak-${block.id}`, label: `L${block.layer} ${block.streak}d`, blockId: block.id, type: "streak" });
        }
      }
    }

    setPills(results.slice(0, MAX_PILLS));
  }, [demoBlocks]);

  useEffect(() => {
    scanBlocks();
    const interval = setInterval(scanBlocks, SCAN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [scanBlocks]);

  if (selectedBlockId || pills.length === 0) return null;

  return (
    // box-none: container passes through touches, only pills are interactive
    <View pointerEvents="box-none" style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {pills.map((pill) => (
          <TouchableOpacity
            key={pill.id}
            style={styles.pill}
            onPress={() => selectBlock(pill.blockId)}
            activeOpacity={0.7}
          >
            <Text style={styles.pillText}>{TYPE_ICONS[pill.type]} {pill.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
    maxWidth: "95%",
  },
  scrollContent: {
    gap: SPACING.xs,
    alignItems: "center",
  },
  pill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  pillText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 10,
    color: COLORS.textOnDark,
    letterSpacing: 0.3,
  },
});
