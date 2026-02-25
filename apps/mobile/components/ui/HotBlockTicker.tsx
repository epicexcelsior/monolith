import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Warning, Skull, Sparkle, Flame } from "phosphor-react-native";
import { COLORS, SPACING, FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useTowerStore } from "@/stores/tower-store";

interface TickerPill {
  id: string;
  label: string;
  blockId: string;
  type: "fading" | "new" | "claimable" | "streak";
}

const ICON_SIZE = 10;
const TYPE_COLORS: Record<TickerPill["type"], string> = {
  fading: COLORS.fading,
  new: COLORS.goldLight,
  claimable: COLORS.dormant,
  streak: COLORS.blazing,
};

function TickerIcon({ type }: { type: TickerPill["type"] }) {
  const color = TYPE_COLORS[type];
  switch (type) {
    case "fading": return <Warning size={ICON_SIZE} color={color} weight="fill" />;
    case "claimable": return <Skull size={ICON_SIZE} color={color} weight="fill" />;
    case "new": return <Sparkle size={ICON_SIZE} color={color} weight="fill" />;
    case "streak": return <Flame size={ICON_SIZE} color={color} weight="fill" />;
  }
}

const MAX_PILLS = 3;
const SCAN_INTERVAL_MS = 3000;

export default function HotBlockTicker() {
  const insets = useSafeAreaInsets();
  const demoBlocks = useTowerStore((s) => s.demoBlocks);
  const selectBlock = useTowerStore((s) => s.selectBlock);
  const selectedBlockId = useTowerStore((s) => s.selectedBlockId);
  const [pills, setPills] = useState<TickerPill[]>([]);

  const scanBlocks = useCallback(() => {
    const now = Date.now();
    const results: TickerPill[] = [];

    for (const block of demoBlocks) {
      if (results.length >= MAX_PILLS) break;

      if (block.owner && block.energy === 0) {
        results.push({ id: `claimable-${block.id}`, label: `L${block.layer}`, blockId: block.id, type: "claimable" });
        continue;
      }

      if (block.owner && block.energy > 0 && block.energy < 20) {
        results.push({ id: `fading-${block.id}`, label: `L${block.layer}`, blockId: block.id, type: "fading" });
        continue;
      }

      if (block.owner && block.lastChargeTime && now - block.lastChargeTime < 60_000 && block.energy > 80) {
        results.push({ id: `new-${block.id}`, label: `L${block.layer}`, blockId: block.id, type: "new" });
        continue;
      }

      if (block.owner && (block.streak ?? 0) >= 7) {
        results.push({ id: `streak-${block.id}`, label: `${block.streak}d`, blockId: block.id, type: "streak" });
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

  // FloatingNav pill row is ~56px; sit above it + safe area + padding
  const bottomOffset = Math.max(insets.bottom, 12) + 56 + SPACING.sm;

  return (
    <View pointerEvents="box-none" style={[styles.container, { bottom: bottomOffset }]}>
      {pills.map((pill) => (
        <TouchableOpacity
          key={pill.id}
          style={styles.pill}
          onPress={() => selectBlock(pill.blockId)}
          activeOpacity={0.7}
        >
          <TickerIcon type={pill.type} />
          <Text style={styles.pillText}>{pill.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: SPACING.sm,
    flexDirection: "row",
    gap: 4,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.hudPillBg,
  },
  pillText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 9,
    color: COLORS.textOnDark,
    letterSpacing: 0.3,
    textShadowColor: COLORS.textShadowDark,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
