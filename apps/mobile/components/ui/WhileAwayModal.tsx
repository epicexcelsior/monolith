import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import BottomPanel from "@/components/ui/BottomPanel";
import Button from "@/components/ui/Button";
import { COLORS, SPACING, TEXT, RADIUS } from "@/constants/theme";
import type { AwaySummary } from "@/stores/session-store";
import { useTowerStore } from "@/stores/tower-store";
import { hapticButtonPress } from "@/utils/haptics";
import { playPokeReceive } from "@/utils/audio";

interface WhileAwayModalProps {
  awaySummary: AwaySummary;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 10_000;

/**
 * "While You Were Away" modal — shown on app open after 4+ hours away.
 * Summarizes what happened to the player's blocks and prompts action.
 */
export default function WhileAwayModal({ awaySummary, onDismiss }: WhileAwayModalProps) {
  const selectBlock = useTowerStore((s) => s.selectBlock);

  // SFX + haptic on mount
  useEffect(() => {
    playPokeReceive();
    hapticButtonPress();
  }, []);

  // Auto-dismiss after 10s
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleChargeNow = () => {
    hapticButtonPress();
    if (awaySummary.lowestEnergyBlockId) {
      selectBlock(awaySummary.lowestEnergyBlockId);
    }
    onDismiss();
  };

  return (
    <BottomPanel visible onClose={onDismiss} height={260} dark>
      {/* Title */}
      <Text style={styles.title}>While you were away...</Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {awaySummary.energyDelta !== 0 && (
          <View style={styles.statPill}>
            <Text style={styles.statText}>
              ⚡ {awaySummary.energyDelta > 0 ? "+" : ""}{awaySummary.energyDelta} energy
            </Text>
          </View>
        )}
        {awaySummary.pokesReceived > 0 && (
          <View style={styles.statPill}>
            <Text style={styles.statText}>👆 {awaySummary.pokesReceived} poke{awaySummary.pokesReceived !== 1 ? "s" : ""}</Text>
          </View>
        )}
        {awaySummary.neighborChanges > 0 && (
          <View style={styles.statPill}>
            <Text style={styles.statText}>🔄 {awaySummary.neighborChanges} neighbor change{awaySummary.neighborChanges !== 1 ? "s" : ""}</Text>
          </View>
        )}
        {awaySummary.energyDelta === 0 && awaySummary.pokesReceived === 0 && awaySummary.neighborChanges === 0 && (
          <View style={styles.statPill}>
            <Text style={styles.statText}>Your block is waiting for you</Text>
          </View>
        )}
      </View>

      {/* Streak risk warning */}
      {awaySummary.streakAtRisk && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>⚠️ Your streak is at risk! Charge now.</Text>
        </View>
      )}

      {/* CTAs */}
      <View style={styles.ctaRow}>
        <Button
          title="CHARGE NOW"
          variant="gold"
          size="md"
          onPress={handleChargeNow}
          pulsing={awaySummary.streakAtRisk}
        />
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </BottomPanel>
  );
}

const styles = StyleSheet.create({
  title: {
    ...TEXT.headingLg,
    color: COLORS.inspectorText,
    marginBottom: SPACING.md,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  statPill: {
    backgroundColor: COLORS.hudHighlight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.hudBorder,
  },
  statText: {
    ...TEXT.bodySm,
    color: COLORS.inspectorTextSecondary,
  },
  warningBox: {
    backgroundColor: "rgba(196, 64, 42, 0.20)",
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.error,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  warningText: {
    ...TEXT.bodySm,
    color: "#FF8A73",
    textAlign: "center",
  },
  ctaRow: {
    gap: SPACING.sm,
    alignItems: "center",
  },
  dismissButton: {
    paddingVertical: SPACING.sm,
  },
  dismissText: {
    ...TEXT.bodySm,
    color: COLORS.inspectorTextSecondary,
    textDecorationLine: "underline",
  },
});
