import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { COLORS, SPACING } from "@/constants/theme";
import { useTowerStore } from "@/stores/tower-store";
import { ENERGY_THRESHOLDS } from "@monolith/common";
import type { BlockState } from "@monolith/common";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const PANEL_HEIGHT = 260;

function getBlockState(energy: number): BlockState {
  if (energy >= ENERGY_THRESHOLDS.blazing) return "blazing";
  if (energy >= ENERGY_THRESHOLDS.thriving) return "thriving";
  if (energy >= ENERGY_THRESHOLDS.fading) return "fading";
  if (energy >= ENERGY_THRESHOLDS.dying) return "dying";
  return "dead";
}

function stateColor(state: BlockState): string {
  return COLORS[state];
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatUsdc(lamports: number): string {
  return `${(lamports / 1_000_000).toFixed(2)} USDC`;
}

/**
 * BlockInspector — Animated bottom panel showing selected block details.
 * Renders outside the R3F Canvas as a React Native overlay.
 */
export default function BlockInspector() {
  const selectedBlockId = useTowerStore((s) => s.selectedBlockId);
  const getDemoBlockById = useTowerStore((s) => s.getDemoBlockById);
  const selectBlock = useTowerStore((s) => s.selectBlock);

  const slideAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const isVisible = selectedBlockId !== null;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isVisible ? 0 : PANEL_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible, slideAnim]);

  const block = selectedBlockId ? getDemoBlockById(selectedBlockId) : null;

  if (!block && !isVisible) return null;

  const state = block ? getBlockState(block.energy) : "dead";
  const energyPct = block ? Math.min(100, Math.max(0, block.energy)) : 0;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Close button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => selectBlock(null)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.closeText}>X</Text>
      </TouchableOpacity>

      {/* Handle bar */}
      <View style={styles.handle} />

      {block && (
        <View style={styles.content}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <Text style={styles.blockTitle}>
              Layer {block.layer} / Block {block.index}
            </Text>
            <View
              style={[styles.stateBadge, { backgroundColor: stateColor(state) + "33" }]}
            >
              <Text
                style={[styles.stateText, { color: stateColor(state) }]}
              >
                {state.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Energy bar */}
          <View style={styles.energySection}>
            <Text style={styles.label}>Energy</Text>
            <View style={styles.energyBarBg}>
              <View
                style={[
                  styles.energyBarFill,
                  {
                    width: `${energyPct}%`,
                    backgroundColor: stateColor(state),
                  },
                ]}
              />
            </View>
            <Text style={[styles.energyValue, { color: stateColor(state) }]}>
              {Math.round(energyPct)}%
            </Text>
          </View>

          {/* Info rows */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Owner</Text>
            <Text style={styles.value}>
              {block.owner ? truncateAddress(block.owner) : "Unclaimed"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Staked</Text>
            <Text style={styles.value}>
              {block.stakedAmount > 0 ? formatUsdc(block.stakedAmount) : "--"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Color</Text>
            <View style={styles.colorRow}>
              <View
                style={[
                  styles.colorSwatch,
                  { backgroundColor: block.ownerColor },
                ]}
              />
              <Text style={styles.value}>{block.ownerColor}</Text>
            </View>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: PANEL_HEIGHT,
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textMuted,
    alignSelf: "center",
    marginBottom: SPACING.md,
  },
  closeButton: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.md,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  blockTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
  },
  stateBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stateText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  energySection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    width: 54,
  },
  energyBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    overflow: "hidden",
  },
  energyBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  energyValue: {
    fontSize: 13,
    fontWeight: "700",
    width: 42,
    textAlign: "right",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  value: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  colorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
});
