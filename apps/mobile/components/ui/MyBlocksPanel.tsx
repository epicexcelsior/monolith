/**
 * MyBlocksPanel — Bottom sheet listing all blocks owned by the current wallet.
 * Sorted by urgency (dying/fading first). Shows energy bars, streak badges,
 * quick-charge buttons, and a "Charge All" batch action.
 * Tapping a block row navigates the camera to it.
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import BottomPanel from "./BottomPanel";
import ChargeBar from "./ChargeBar";
import Button from "./Button";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, getChargeColor } from "@/constants/theme";
import { useTowerStore, getStreakMultiplier } from "@/stores/tower-store";
import { useWalletStore } from "@/stores/wallet-store";
import { useMultiplayerStore } from "@/stores/multiplayer-store";
import { usePlayerStore } from "@/stores/player-store";
import { ENERGY_THRESHOLDS } from "@monolith/common";
import type { BlockState } from "@monolith/common";
import { hapticChargeTap, hapticError, hapticButtonPress } from "@/utils/haptics";
import { playChargeTap, playError, playButtonTap } from "@/utils/audio";

function getBlockState(energy: number): BlockState {
  if (energy >= ENERGY_THRESHOLDS.blazing) return "blazing";
  if (energy >= ENERGY_THRESHOLDS.thriving) return "thriving";
  if (energy >= ENERGY_THRESHOLDS.fading) return "fading";
  if (energy >= ENERGY_THRESHOLDS.dying) return "dying";
  return "dead";
}

function stateColor(state: BlockState): string {
  const map: Record<string, string> = {
    blazing: COLORS.blazing,
    thriving: COLORS.thriving,
    fading: COLORS.fading,
    dying: COLORS.flickering,
    dead: COLORS.dormant,
  };
  return map[state] ?? COLORS.textMuted;
}

/** Urgency priority for sorting — lower = more urgent */
function urgencyPriority(energy: number): number {
  if (energy === 0) return 0;                          // dead — most urgent
  if (energy < ENERGY_THRESHOLDS.fading) return 1;     // dying
  if (energy < ENERGY_THRESHOLDS.thriving) return 2;   // fading
  return 3;                                            // healthy
}

interface MyBlocksPanelProps {
  visible: boolean;
  onClose: () => void;
}

export default function MyBlocksPanel({ visible, onClose }: MyBlocksPanelProps) {
  const publicKey = useWalletStore((s) => s.publicKey);
  const demoBlocks = useTowerStore((s) => s.demoBlocks);
  const selectBlock = useTowerStore((s) => s.selectBlock);
  const chargeBlock = useTowerStore((s) => s.chargeBlock);
  const mpConnected = useMultiplayerStore((s) => s.connected && !s.reconnecting);
  const sendCharge = useMultiplayerStore((s) => s.sendCharge);
  const setRecentlyChargedId = useTowerStore((s) => s.setRecentlyChargedId);
  const [cooldownBlockId, setCooldownBlockId] = useState<string | null>(null);
  const [chargingAll, setChargingAll] = useState(false);

  const wallet = publicKey?.toBase58();

  const myBlocks = useMemo(() => {
    if (!wallet) return [];
    return demoBlocks
      .filter((b) => b.owner === wallet)
      .sort((a, b) => {
        const urgDiff = urgencyPriority(a.energy) - urgencyPriority(b.energy);
        if (urgDiff !== 0) return urgDiff;
        return a.layer - b.layer || a.index - b.index;
      });
  }, [demoBlocks, wallet]);

  const urgentCount = useMemo(
    () => myBlocks.filter((b) => b.energy < ENERGY_THRESHOLDS.fading).length,
    [myBlocks],
  );

  const handleBlockTap = useCallback((blockId: string) => {
    hapticButtonPress();
    playButtonTap();
    selectBlock(blockId);
    onClose();
  }, [selectBlock, onClose]);

  const handleCharge = useCallback((blockId: string) => {
    hapticChargeTap();
    if (mpConnected && wallet) {
      sendCharge({ blockId, wallet });
      playChargeTap();
    } else {
      const result = chargeBlock(blockId);
      if (!result.success && result.cooldownRemaining) {
        setCooldownBlockId(blockId);
        setTimeout(() => setCooldownBlockId(null), 2000);
        hapticError();
        playError();
      } else if (result.success) {
        playChargeTap();
        setRecentlyChargedId(blockId, result.chargeQuality);
        const store = usePlayerStore.getState();
        const isFirstToday = store.isFirstChargeToday();
        const pts = isFirstToday ? 50 : 25;
        const label = isFirstToday ? "Daily Charge \u2713" : undefined;
        store.addPoints({ pointsEarned: pts, totalXp: store.xp + pts, level: store.level, label, chargeAmount: result.chargeAmount, chargeQuality: result.chargeQuality });
        if (isFirstToday) store.markChargeToday();
      }
    }
  }, [mpConnected, wallet, sendCharge, chargeBlock, setRecentlyChargedId]);

  const handleChargeAll = useCallback(async () => {
    if (chargingAll || myBlocks.length === 0) return;
    setChargingAll(true);
    let totalXp = 0;
    for (let i = 0; i < myBlocks.length; i++) {
      const block = myBlocks[i];
      if (mpConnected && wallet) {
        sendCharge({ blockId: block.id, wallet });
      } else {
        const result = chargeBlock(block.id);
        if (result.success) {
          setRecentlyChargedId(block.id, result.chargeQuality);
          const store = usePlayerStore.getState();
          const isFirstToday = store.isFirstChargeToday();
          const pts = isFirstToday ? 50 : 25;
          totalXp += pts;
          if (isFirstToday) store.markChargeToday();
        }
      }
      // Stagger for satisfying cascade
      if (i < myBlocks.length - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    if (totalXp > 0) {
      hapticChargeTap();
      playChargeTap();
      const store = usePlayerStore.getState();
      store.addPoints({ pointsEarned: totalXp, totalXp: store.xp + totalXp, level: store.level, label: "Charge All" });
    }
    setChargingAll(false);
  }, [chargingAll, myBlocks, mpConnected, wallet, sendCharge, chargeBlock, setRecentlyChargedId]);

  const renderBlock = useCallback(({ item }: { item: typeof myBlocks[0] }) => {
    const state = getBlockState(item.energy);
    const streak = item.streak ?? 0;
    const multiplier = getStreakMultiplier(streak);
    const isCooldown = cooldownBlockId === item.id;

    return (
      <TouchableOpacity
        style={styles.blockRow}
        onPress={() => handleBlockTap(item.id)}
        activeOpacity={0.7}
      >
        {/* Left: emoji + position */}
        <View style={styles.blockIdentity}>
          <Text style={styles.blockEmoji}>{item.emoji || "\uD83D\uDD32"}</Text>
          <View style={styles.blockInfo}>
            <Text style={styles.blockName} numberOfLines={1}>
              {item.name || `L${item.layer} / B${item.index}`}
            </Text>
            <Text style={[styles.blockState, { color: stateColor(state) }]}>
              {state.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Center: energy bar + percentage */}
        <View style={styles.blockEnergy}>
          <ChargeBar charge={item.energy} size="sm" />
          <Text style={[styles.energyText, { color: getChargeColor(item.energy) }]}>
            {Math.round(item.energy)}%
          </Text>
        </View>

        {/* Right: streak + charge */}
        <View style={styles.blockActions}>
          {streak > 0 && (
            <Text style={styles.streakText}>
              {streak}d {multiplier > 1 ? `${multiplier}\u00D7` : ""}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.chargeChip, isCooldown && styles.chargeChipDisabled]}
            onPress={(e) => {
              e.stopPropagation?.();
              handleCharge(item.id);
            }}
            disabled={isCooldown}
          >
            <Text style={[styles.chargeChipText, isCooldown && styles.chargeChipTextDisabled]}>
              {isCooldown ? "Wait" : "Charge"}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [handleBlockTap, handleCharge, cooldownBlockId]);

  return (
    <BottomPanel
      visible={visible}
      onClose={onClose}
      title={`My Blocks (${myBlocks.length})`}
      height={420}
      dark
    >
      {myBlocks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>{"\uD83C\uDFD7\uFE0F"}</Text>
          <Text style={styles.emptyTitle}>No blocks yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap an unclaimed block on the tower to get started!
          </Text>
        </View>
      ) : (
        <>
          {/* Urgency header + Charge All */}
          <View style={styles.headerRow}>
            {urgentCount > 0 && (
              <Text style={styles.urgentText}>
                {"\u26A0\uFE0F"} {urgentCount} block{urgentCount > 1 ? "s" : ""} need{urgentCount === 1 ? "s" : ""} attention
              </Text>
            )}
            <View style={styles.chargeAllWrap}>
              <Button
                title={chargingAll ? "Charging..." : `Charge All (${myBlocks.length})`}
                variant="gold"
                size="sm"
                onPress={handleChargeAll}
                loading={chargingAll}
                disabled={chargingAll}
              />
            </View>
          </View>
          <FlatList
            data={myBlocks}
            keyExtractor={(item) => item.id}
            renderItem={renderBlock}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.listContent}
          />
        </>
      )}
    </BottomPanel>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    paddingHorizontal: SPACING.xs,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  urgentText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 13,
    color: COLORS.flickering,
  },
  chargeAllWrap: {
    alignSelf: "stretch",
  },
  listContent: {
    paddingBottom: SPACING.md,
  },
  blockRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  blockIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    width: 110,
  },
  blockInfo: {
    flex: 1,
  },
  blockEmoji: {
    fontSize: 28,
  },
  blockName: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 14,
    color: COLORS.textOnDark,
  },
  blockState: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  blockEnergy: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginHorizontal: SPACING.sm,
  },
  energyText: {
    fontFamily: FONT_FAMILY.monoBold,
    fontSize: 13,
    width: 36,
    textAlign: "right",
  },
  blockActions: {
    alignItems: "flex-end",
    gap: 2,
  },
  streakText: {
    fontFamily: FONT_FAMILY.monoBold,
    fontSize: 10,
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  chargeChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.gold,
  },
  chargeChipDisabled: {
    opacity: 0.4,
  },
  chargeChipText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 12,
    color: COLORS.textOnGold,
  },
  chargeChipTextDisabled: {
    color: COLORS.textMuted,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: SPACING.xl,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  emptyTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 18,
    color: COLORS.textOnDark,
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: "center",
    maxWidth: 240,
  },
});
