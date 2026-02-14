import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, TIMING, TEXT } from "@/constants/theme";
import Badge from "./Badge";
import ChargeBar from "./ChargeBar";
import Button from "./Button";
import ColorPicker from "@/components/ui/ColorPicker";
import ClaimModal from "@/components/ui/ClaimModal";
import { useTowerStore } from "@/stores/tower-store";
import { useWalletStore } from "@/stores/wallet-store";
import { useStaking } from "@/hooks/useStaking";
import { ENERGY_THRESHOLDS, BLOCK_ICONS } from "@monolith/common";
import type { BlockState } from "@monolith/common";
import {
  hapticBlockDeselect,
  hapticBlockClaimed,
  hapticButtonPress,
  hapticError,
} from "@/utils/haptics";

const PANEL_HEIGHT = 380;

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

export default function BlockInspector() {
  const selectedBlockId = useTowerStore((s) => s.selectedBlockId);
  const getDemoBlockById = useTowerStore((s) => s.getDemoBlockById);
  const selectBlock = useTowerStore((s) => s.selectBlock);
  const claimBlock = useTowerStore((s) => s.claimBlock);
  const chargeBlock = useTowerStore((s) => s.chargeBlock);
  const customizeBlock = useTowerStore((s) => s.customizeBlock);
  const publicKey = useWalletStore((s) => s.publicKey);
  const isWalletConnected = useWalletStore((s) => s.isConnected);
  const { deposit } = useStaking();

  const slideAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const isVisible = selectedBlockId !== null;

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [cooldownText, setCooldownText] = useState<string | null>(null);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isVisible ? 0 : PANEL_HEIGHT,
      ...TIMING.spring,
      useNativeDriver: true,
    }).start();

    // Reset customization panel when block changes
    if (!isVisible) {
      setShowCustomize(false);
      setShowClaimModal(false);
    }
  }, [isVisible, slideAnim]);

  const block = selectedBlockId ? getDemoBlockById(selectedBlockId) : null;
  const isOwner = block?.owner && publicKey
    ? block.owner === publicKey.toBase58()
    : false;
  const isUnclaimed = block ? block.owner === null : false;

  // Handle claim
  const handleClaim = useCallback(async (amount: number, color: string) => {
    if (!publicKey || !selectedBlockId) throw new Error("Wallet not connected");

    // Call on-chain deposit
    const sig = await deposit(amount);
    if (!sig) throw new Error("Transaction failed or rejected");

    // Update local state
    claimBlock(selectedBlockId, publicKey.toBase58(), amount * 1_000_000, color);
    hapticBlockClaimed();
  }, [publicKey, selectedBlockId, deposit, claimBlock]);

  // Handle charge
  const handleCharge = useCallback(() => {
    if (!selectedBlockId) return;
    hapticButtonPress();

    const result = chargeBlock(selectedBlockId);
    if (!result.success && result.cooldownRemaining) {
      const secs = Math.ceil(result.cooldownRemaining / 1000);
      setCooldownText(`Wait ${secs}s`);
      setTimeout(() => setCooldownText(null), 2000);
      hapticError();
    }
  }, [selectedBlockId, chargeBlock]);

  // Handle color change
  const handleColorChange = useCallback((color: string) => {
    if (!selectedBlockId) return;
    customizeBlock(selectedBlockId, { color });
  }, [selectedBlockId, customizeBlock]);

  // Handle emoji change
  const handleEmojiChange = useCallback((emoji: string) => {
    if (!selectedBlockId) return;
    customizeBlock(selectedBlockId, { emoji });
  }, [selectedBlockId, customizeBlock]);

  // Handle name change
  const handleNameSubmit = useCallback(() => {
    if (!selectedBlockId || !nameInput.trim()) return;
    customizeBlock(selectedBlockId, { name: nameInput.trim().slice(0, 12) });
  }, [selectedBlockId, nameInput, customizeBlock]);

  if (!block && !isVisible) return null;

  const state = block ? getBlockState(block.energy) : "dead";
  const energyPct = block ? Math.min(100, Math.max(0, block.energy)) : 0;

  return (
    <>
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

        <View style={styles.handle} />

        {block && (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Header row */}
            <View style={styles.headerRow}>
              <View style={styles.titleRow}>
                {block.emoji && <Text style={styles.emoji}>{block.emoji}</Text>}
                <Text style={styles.blockTitle}>
                  {block.name || `Layer ${block.layer} / Block ${block.index}`}
                </Text>
              </View>
              <Badge
                label={isUnclaimed ? "UNCLAIMED" : state.toUpperCase()}
                color={isUnclaimed ? COLORS.gold : stateColor(state)}
              />
            </View>

            {/* Energy bar (only for owned blocks) */}
            {!isUnclaimed && (
              <ChargeBar charge={energyPct} size="md" showLabel showPercentage />
            )}

            {/* Info rows */}
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Owner</Text>
                <Text style={styles.value}>
                  {block.owner ? truncateAddress(block.owner) : "Available"}
                </Text>
              </View>

              {block.stakedAmount > 0 && (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Staked</Text>
                  <Text style={styles.value}>{formatUsdc(block.stakedAmount)}</Text>
                </View>
              )}

              {!isUnclaimed && (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Color</Text>
                  <View style={styles.colorRow}>
                    <View
                      style={[styles.colorSwatch, { backgroundColor: block.ownerColor }]}
                    />
                    <Text style={styles.value}>{block.ownerColor}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* ─── Action Buttons ─────────────────── */}

            {/* Unclaimed block: Show Claim button */}
            {isUnclaimed && (
              <View style={styles.actionSection}>
                {isWalletConnected ? (
                  <Button
                    title="Claim This Block"
                    variant="primary"
                    size="lg"
                    onPress={() => setShowClaimModal(true)}
                  />
                ) : (
                  <Button
                    title="Connect Wallet to Claim"
                    variant="secondary"
                    size="md"
                    onPress={() => hapticButtonPress()}
                  />
                )}
              </View>
            )}

            {/* Owned block: Charge + Customize + Share */}
            {isOwner && (
              <View style={styles.actionSection}>
                <Button
                  title={cooldownText || "CHARGE"}
                  variant="primary"
                  size="lg"
                  onPress={handleCharge}
                  disabled={!!cooldownText}
                />

                <View style={styles.buttonRow}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={showCustomize ? "Done" : "Customize"}
                      variant="secondary"
                      size="sm"
                      onPress={() => {
                        setShowCustomize(!showCustomize);
                        hapticButtonPress();
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Share"
                      variant="ghost"
                      size="sm"
                      onPress={() => {
                        hapticButtonPress();
                        // Share handled by ShareButton
                        handleShare(block);
                      }}
                    />
                  </View>
                </View>

                {/* Customize panel */}
                {showCustomize && (
                  <View style={styles.customizeSection}>
                    <Text style={styles.sectionLabel}>COLOR</Text>
                    <ColorPicker
                      selected={block.ownerColor}
                      onSelect={handleColorChange}
                    />

                    <Text style={styles.sectionLabel}>EMOJI</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.emojiRow}
                    >
                      {BLOCK_ICONS.slice(0, 20).map((icon) => (
                        <TouchableOpacity
                          key={icon}
                          style={[
                            styles.emojiCell,
                            block.emoji === icon && styles.emojiCellSelected,
                          ]}
                          onPress={() => handleEmojiChange(icon)}
                        >
                          <Text style={styles.emojiText}>{icon}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text style={styles.sectionLabel}>NAME TAG</Text>
                    <View style={styles.nameRow}>
                      <TextInput
                        style={styles.nameInput}
                        value={nameInput}
                        onChangeText={(t) => setNameInput(t.slice(0, 12))}
                        placeholder={block.name || "My Block"}
                        placeholderTextColor={COLORS.textMuted}
                        maxLength={12}
                        returnKeyType="done"
                        onSubmitEditing={handleNameSubmit}
                      />
                      <TouchableOpacity
                        style={styles.nameButton}
                        onPress={handleNameSubmit}
                      >
                        <Text style={styles.nameButtonText}>Set</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Bot-owned block info */}
            {!isUnclaimed && !isOwner && block.owner && (
              <View style={styles.actionSection}>
                <Text style={styles.botOwnerText}>
                  Owned by {block.owner}
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </Animated.View>

      {/* Claim Modal */}
      {block && (
        <ClaimModal
          visible={showClaimModal}
          blockId={block.id}
          layer={block.layer}
          index={block.index}
          onClaim={handleClaim}
          onClose={() => setShowClaimModal(false)}
        />
      )}
    </>
  );
}

// Share helper
async function handleShare(block: { layer: number; energy: number; emoji?: string; name?: string }) {
  try {
    const { Share } = require("react-native");
    const label = block.name || `Layer ${block.layer}`;
    const charge = Math.round(block.energy);
    const icon = block.emoji || "";
    const message = `${icon} My block on The Monolith \u2014 ${label}, ${charge}% charged! https://monolith.gg`;
    await Share.share({ message });
  } catch {
    // User cancelled or share not available
  }
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
    marginBottom: SPACING.sm,
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
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    flex: 1,
  },
  emoji: {
    fontSize: 20,
  },
  blockTitle: {
    fontFamily: FONT_FAMILY.headingSemibold,
    color: COLORS.text,
    fontSize: 18,
    letterSpacing: 0.5,
  },
  infoSection: {
    gap: SPACING.xs,
    marginTop: SPACING.sm,
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
  actionSection: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  buttonRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  botOwnerText: {
    ...TEXT.bodySm,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  // Customize section
  customizeSection: {
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  sectionLabel: {
    ...TEXT.overline,
    color: COLORS.gold,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  emojiRow: {
    flexDirection: "row",
    maxHeight: 48,
  },
  emojiCell: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bgMuted,
    marginRight: SPACING.xs,
  },
  emojiCellSelected: {
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  emojiText: {
    fontSize: 20,
  },
  nameRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "center",
  },
  nameInput: {
    flex: 1,
    backgroundColor: COLORS.bgMuted,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: FONT_FAMILY.mono,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  nameButton: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  nameButtonText: {
    color: COLORS.textOnGold,
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 13,
  },
});
