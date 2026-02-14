import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, TIMING } from "@/constants/theme";
import { Badge, ChargeBar } from "@/components/ui";
import { useTowerStore } from "@/stores/tower-store";
import { ENERGY_THRESHOLDS } from "@monolith/common";
import type { BlockState } from "@monolith/common";
import { hapticBlockDeselect } from "@/utils/haptics";

const PANEL_HEIGHT = 260;

function getBlockState(energy: number): BlockState {
  if (energy >= ENERGY_THRESHOLDS.blazing) return "blazing";
  if (energy >= ENERGY_THRESHOLDS.thriving) return "thriving";
  if (energy >= ENERGY_THRESHOLDS.fading) return "fading";
  if (energy >= ENERGY_THRESHOLDS.dying) return "dying";
  return "dead";
}

/** Map common block state names to theme colors. */
function stateColor(state: BlockState): string {
  const map: Record<string, string> = {
    blazing: COLORS.blazing,
    thriving: COLORS.thriving,
    fading: COLORS.fading,
    dying: COLORS.flickering,
    dead: COLORS.dormant,
    flickering: COLORS.flickering,
    dormant: COLORS.dormant,
  };
  return map[state] ?? COLORS.textMuted;
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
 *
 * Uses Badge for state indicator and ChargeBar for energy display.
 * Replaced Dimensions.get() with useWindowDimensions for responsiveness.
 */
export default function BlockInspector() {
  const selectedBlockId = useTowerStore((s) => s.selectedBlockId);
  const getDemoBlockById = useTowerStore((s) => s.getDemoBlockById);
  const selectBlock = useTowerStore((s) => s.selectBlock);

  const slideAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const isVisible = selectedBlockId !== null;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isVisible ? 0 : PANEL_HEIGHT,
      ...TIMING.spring,
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
        onPress={() => {
          hapticBlockDeselect();
          selectBlock(null);
        }}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.closeText}>✕</Text>
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
            <Badge
              label={state.toUpperCase()}
              color={stateColor(state)}
            />
          </View>

          {/* Energy bar — using ChargeBar component */}
          <ChargeBar
            charge={energyPct}
            size="md"
            showLabel
            showPercentage
          />

          {/* Info rows */}
          <View style={styles.infoSection}>
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
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    borderCurve: "continuous",
    boxShadow: "0 -4px 24px rgba(26, 22, 18, 0.10)",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderStrong,
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
    backgroundColor: COLORS.bgMuted,
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
    gap: SPACING.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  blockTitle: {
    fontFamily: FONT_FAMILY.headingSemibold,
    color: COLORS.text,
    fontSize: 18,
    letterSpacing: 0.5,
  },
  infoSection: {
    gap: SPACING.sm,
  },
  label: {
    fontFamily: FONT_FAMILY.bodySemibold,
    color: COLORS.textSecondary,
    fontSize: 12,
    letterSpacing: 0.5,
    width: 54,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  value: {
    fontFamily: FONT_FAMILY.mono,
    color: COLORS.text,
    fontSize: 14,
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
    borderColor: COLORS.border,
  },
});
