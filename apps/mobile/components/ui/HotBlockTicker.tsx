/**
 * HotBlockTicker — Shows notable blocks as mini-cards above FloatingNav.
 * Redesigned from tiny 9px pills to readable cards with full context.
 * Priority: dying > fading > claimable > streak > new
 */
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Reanimated, { FadeInLeft } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Warning, Skull, Sparkle, Flame } from "phosphor-react-native";
import { COLORS, SPACING, FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useTowerStore } from "@/stores/tower-store";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";

interface TickerCard {
  id: string;
  blockId: string;
  type: "dying" | "fading" | "claimable" | "streak" | "new";
  emoji: string;
  name: string;
  detail: string;
  priority: number;
}

const ICON_SIZE = 14;

const TYPE_COLORS: Record<TickerCard["type"], string> = {
  dying: COLORS.flickering,
  fading: COLORS.fading,
  claimable: COLORS.dormant,
  streak: COLORS.blazing,
  new: COLORS.goldLight,
};

const TYPE_BG: Record<TickerCard["type"], string> = {
  dying: "rgba(196, 64, 42, 0.20)",
  fading: "rgba(227, 167, 51, 0.20)",
  claimable: "rgba(110, 110, 110, 0.20)",
  streak: "rgba(255, 184, 0, 0.20)",
  new: "rgba(212, 168, 71, 0.15)",
};

const TYPE_BORDER: Record<TickerCard["type"], string> = {
  dying: "rgba(196, 64, 42, 0.30)",
  fading: "rgba(227, 167, 51, 0.30)",
  claimable: "rgba(110, 110, 110, 0.30)",
  streak: "rgba(255, 184, 0, 0.30)",
  new: "rgba(212, 168, 71, 0.25)",
};

function TickerIcon({ type }: { type: TickerCard["type"] }) {
  const color = TYPE_COLORS[type];
  switch (type) {
    case "dying": return <Warning size={ICON_SIZE} color={color} weight="fill" />;
    case "fading": return <Warning size={ICON_SIZE} color={color} weight="fill" />;
    case "claimable": return <Skull size={ICON_SIZE} color={color} weight="fill" />;
    case "new": return <Sparkle size={ICON_SIZE} color={color} weight="fill" />;
    case "streak": return <Flame size={ICON_SIZE} color={color} weight="fill" />;
  }
}

const MAX_CARDS = 2;
const SCAN_INTERVAL_MS = 5000;

export default function HotBlockTicker() {
  const insets = useSafeAreaInsets();
  const demoBlocks = useTowerStore((s) => s.demoBlocks);
  const selectBlock = useTowerStore((s) => s.selectBlock);
  const selectedBlockId = useTowerStore((s) => s.selectedBlockId);
  const [cards, setCards] = useState<TickerCard[]>([]);

  const scanBlocks = useCallback(() => {
    const now = Date.now();
    const results: TickerCard[] = [];

    for (const block of demoBlocks) {
      const emoji = block.emoji || "\uD83D\uDD32";
      const name = block.name || `L${block.layer}`;

      // Dying blocks (1-19% energy) — highest priority
      if (block.owner && block.energy > 0 && block.energy < 20) {
        results.push({
          id: `dying-${block.id}`,
          blockId: block.id,
          type: block.energy < 5 ? "dying" : "fading",
          emoji,
          name,
          detail: `${Math.round(block.energy)}% \u00B7 L${block.layer}`,
          priority: block.energy < 5 ? 0 : 1,
        });
        continue;
      }

      // Claimable (dead/dormant)
      if (block.owner && block.energy === 0) {
        results.push({
          id: `claimable-${block.id}`,
          blockId: block.id,
          type: "claimable",
          emoji,
          name: block.name || "Unclaimed",
          detail: `L${block.layer}`,
          priority: 2,
        });
        continue;
      }

      // Streak (7+ days)
      if (block.owner && (block.streak ?? 0) >= 7) {
        results.push({
          id: `streak-${block.id}`,
          blockId: block.id,
          type: "streak",
          emoji,
          name,
          detail: `${block.streak}d streak`,
          priority: 4,
        });
        continue;
      }

      // Recently claimed/charged (new)
      if (block.owner && block.lastChargeTime && now - block.lastChargeTime < 60_000 && block.energy > 80) {
        results.push({
          id: `new-${block.id}`,
          blockId: block.id,
          type: "new",
          emoji,
          name,
          detail: "Just claimed!",
          priority: 5,
        });
      }
    }

    // Sort by priority (lowest = most urgent), then take top MAX_CARDS
    results.sort((a, b) => a.priority - b.priority || a.detail.localeCompare(b.detail));
    setCards(results.slice(0, MAX_CARDS));
  }, [demoBlocks]);

  useEffect(() => {
    scanBlocks();
    const interval = setInterval(scanBlocks, SCAN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [scanBlocks]);

  if (selectedBlockId || cards.length === 0) return null;

  const bottomOffset = Math.max(insets.bottom, 12) + 56 + SPACING.sm;

  const handleCardPress = (blockId: string) => {
    hapticButtonPress();
    playButtonTap();
    selectBlock(blockId);
  };

  return (
    <View pointerEvents="box-none" style={[styles.container, { bottom: bottomOffset }]}>
      {cards.map((card, index) => (
        <Reanimated.View
          key={card.id}
          entering={FadeInLeft.delay(index * 200).springify().damping(14).stiffness(120)}
        >
          <TouchableOpacity
            style={[
              styles.card,
              { backgroundColor: TYPE_BG[card.type], borderColor: TYPE_BORDER[card.type] },
            ]}
            onPress={() => handleCardPress(card.blockId)}
            activeOpacity={0.7}
          >
            <TickerIcon type={card.type} />
            <Text style={styles.cardEmoji}>{card.emoji}</Text>
            <Text style={styles.cardName} numberOfLines={1}>{card.name}</Text>
            <Text style={[styles.cardDetail, { color: TYPE_COLORS[card.type] }]}>{card.detail}</Text>
          </TouchableOpacity>
        </Reanimated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: SPACING.sm,
    gap: SPACING.xs,
    alignItems: "flex-end",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    minWidth: 100,
    height: 36,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  cardEmoji: {
    fontSize: 14,
  },
  cardName: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 12,
    color: COLORS.textOnDark,
    maxWidth: 80,
  },
  cardDetail: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
