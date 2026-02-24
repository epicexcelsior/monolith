import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, TEXT, TIMING } from "@/constants/theme";
import Input from "./Input";
import Button from "./Button";
import { BLOCK_COLORS } from "@monolith/common";
import { hapticButtonPress, hapticError } from "@/utils/haptics";
import { playButtonTap, playError } from "@/utils/audio";

interface ClaimModalProps {
  visible: boolean;
  blockId: string;
  layer: number;
  index: number;
  onClaim: (amount: number, color: string) => Promise<void>;
  onClose: () => void;
}

export default function ClaimModal({
  visible,
  blockId,
  layer,
  index,
  onClaim,
  onClose,
}: ClaimModalProps) {
  const [amount, setAmount] = useState("1");
  const [selectedColor, setSelectedColor] = useState<string>(BLOCK_COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = parseFloat(amount) || 0;
  const isValidAmount = amountNum >= 0.10;

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

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
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
              placeholder="1.00"
              error={amount.length > 0 && !isValidAmount ? "Minimum 0.10 USDC" : undefined}
              hint="Stake USDC to claim this block"
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
    marginBottom: SPACING.lg,
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
});
