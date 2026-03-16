import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, TEXT } from "@/constants/theme";
import Input from "./Input";
import Button from "./Button";
import { BLOCK_COLORS, getLayerMinPrice, getLayerTierLabel, GHOST_BLOCK_LAYERS } from "@monolith/common";
import { hapticButtonPress, hapticError } from "@/utils/haptics";
import { playButtonTap, playError } from "@/utils/audio";

interface ClaimModalProps {
  visible: boolean;
  blockId: string;
  layer: number;
  index: number;
  onClaim: (amount: number, color: string) => Promise<void>;
  onGhostClaim?: (color: string) => void;
  onClose: () => void;
}

export default function ClaimModal({
  visible,
  blockId,
  layer,
  index,
  onClaim,
  onGhostClaim,
  onClose,
}: ClaimModalProps) {
  const isGhostEligible = GHOST_BLOCK_LAYERS.includes(layer);
  const minPrice = getLayerMinPrice(layer);
  const tierLabel = getLayerTierLabel(layer);
  const [amount, setAmount] = useState(minPrice.toFixed(2));
  const [selectedColor, setSelectedColor] = useState<string>(BLOCK_COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset amount when modal opens for a (potentially different) block
  useEffect(() => {
    if (visible) {
      setAmount(minPrice.toFixed(2));
      setSelectedColor(BLOCK_COLORS[0]);
      setError(null);
    }
  }, [visible, minPrice]);

  const amountNum = parseFloat(amount) || 0;
  const isValidAmount = amountNum >= minPrice;

  const handleClaim = async () => {
    if (!isValidAmount || isLoading) return;
    hapticButtonPress();
    playButtonTap();
    setIsLoading(true);
    setError(null);

    try {
      await onClaim(amountNum, selectedColor);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Transaction failed");
      hapticError();
      playError();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Claim Block</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Layer {layer} / Block {index}
          </Text>
          <View style={styles.tierBadge}>
            <Text style={styles.tierLabel}>{tierLabel}</Text>
            <Text style={styles.tierPrice}>${minPrice.toFixed(2)} minimum</Text>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Ghost claim option — free on eligible layers */}
            {isGhostEligible && onGhostClaim && (
              <View style={styles.ghostSection}>
                <Button
                  title="FREE CLAIM"
                  variant="secondary"
                  size="lg"
                  onPress={() => {
                    hapticButtonPress();
                    playButtonTap();
                    onGhostClaim(selectedColor);
                    onClose();
                  }}
                />
                <Text style={styles.ghostHint}>
                  Try free — lower energy cap, faster decay
                </Text>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>
              </View>
            )}

            {/* Amount input */}
            <Input
              label="STAKE AMOUNT"
              value={amount}
              onChangeText={(text) => {
                setAmount(text);
                setError(null);
              }}
              prefix="$"
              suffix="USDC"
              keyboardType="decimal-pad"
              placeholder={minPrice.toFixed(2)}
              error={amount.length > 0 && !isValidAmount ? `Minimum $${minPrice.toFixed(2)} for Layer ${layer}` : undefined}
              hint={`Layer ${layer} minimum: $${minPrice.toFixed(2)} USDC`}
            />

            {/* Color picker */}
            <Text style={styles.sectionLabel}>CHOOSE YOUR COLOR</Text>
            <View style={styles.colorGrid}>
              {BLOCK_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorCell,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorCellSelected,
                  ]}
                  onPress={() => {
                    setSelectedColor(color);
                    hapticButtonPress();
                    playButtonTap();
                  }}
                />
              ))}
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.actions}>
            <Button
              title={isLoading ? "Staking..." : `Stake $${amountNum.toFixed(2)} USDC`}
              variant="primary"
              size="lg"
              loading={isLoading}
              disabled={!isValidAmount}
              onPress={handleClaim}
            />
            <Button
              title="Cancel"
              variant="ghost"
              size="sm"
              onPress={onClose}
              disabled={isLoading}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(6, 8, 16, 0.65)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: COLORS.glassElevated,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
    maxHeight: "80%",
    borderTopWidth: 1,
    borderColor: COLORS.glassBorder,
    borderCurve: "continuous",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    ...TEXT.displaySm,
  },
  closeText: {
    color: COLORS.textSecondary,
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    ...TEXT.caption,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.goldSubtle,
    marginBottom: SPACING.lg,
  },
  tierLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 12,
    color: COLORS.gold,
    letterSpacing: 0.3,
  },
  tierPrice: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 12,
    color: COLORS.gold,
  },
  body: {
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    ...TEXT.overline,
    color: COLORS.gold,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  colorCell: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorCellSelected: {
    borderColor: COLORS.text,
    borderWidth: 3,
  },
  errorText: {
    color: COLORS.error,
    fontFamily: FONT_FAMILY.bodyMedium,
    fontSize: 13,
    marginTop: SPACING.md,
  },
  actions: {
    gap: SPACING.sm,
  },
  ghostSection: {
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  ghostHint: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
