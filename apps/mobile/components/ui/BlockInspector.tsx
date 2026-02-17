import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  TextInput,
  ScrollView,
  PanResponder,
  Share,
  Linking,
} from "react-native";
import ShareCard from "./ShareCard";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, TIMING, TEXT } from "@/constants/theme";
import { useRouter } from "expo-router";
import Badge from "./Badge";
import ChargeBar from "./ChargeBar";
import Button from "./Button";
import ColorPicker from "@/components/ui/ColorPicker";
import ClaimModal from "@/components/ui/ClaimModal";
import { useTowerStore, getStreakMultiplier, getNextStreakMilestone } from "@/stores/tower-store";
import { useWalletStore } from "@/stores/wallet-store";
import { useStaking } from "@/hooks/useStaking";
import { ENERGY_THRESHOLDS, BLOCK_ICONS, BLOCK_TEXTURES } from "@monolith/common";
import type { BlockState } from "@monolith/common";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import {
  hapticBlockDeselect,
  hapticBlockClaimed,
  hapticButtonPress,
  hapticError,
} from "@/utils/haptics";
import {
  playBlockClaim,
  playChargeTap,
  playBlockSelect,
  playBlockDeselect,
  playStreakMilestone,
  playError,
} from "@/utils/audio";

const BLOCK_STYLES = [
  { id: 0, label: "Default", icon: "🔲" },
  { id: 1, label: "Holo", icon: "🌈" },
  { id: 2, label: "Neon", icon: "💜" },
  { id: 3, label: "Matte", icon: "🪨" },
  { id: 4, label: "Glass", icon: "💎" },
  { id: 5, label: "Fire", icon: "🔥" },
  { id: 6, label: "Ice", icon: "❄️" },
] as const;

const PANEL_HEIGHT = 380;
const DISMISS_THRESHOLD = 80;

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
  const router = useRouter();
  const { connected: mpConnected, sendClaim, sendCharge, sendCustomize, onChargeResult } = useMultiplayer();

  const slideAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const dragOffset = useRef(new Animated.Value(0)).current;
  const shareCardRef = useRef<View>(null);
  const isVisible = selectedBlockId !== null;

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [cooldownText, setCooldownText] = useState<string | null>(null);

  // Swipe-to-dismiss gesture
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 5 && gesture.dy > 0,
        onPanResponderMove: (_, gesture) => {
          // Only allow dragging down (positive dy)
          if (gesture.dy > 0) {
            dragOffset.setValue(gesture.dy);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > DISMISS_THRESHOLD || gesture.vy > 0.5) {
            // Dismiss — animate out and deselect
            hapticBlockDeselect();
            selectBlock(null);
          }
          // Spring back
          Animated.spring(dragOffset, {
            toValue: 0,
            ...TIMING.spring,
            useNativeDriver: true,
          }).start();
        },
      }),
    [dragOffset, selectBlock],
  );

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isVisible ? 0 : PANEL_HEIGHT,
      ...TIMING.spring,
      useNativeDriver: true,
    }).start();

    // Reset customization panel and drag when block changes
    if (!isVisible) {
      setShowCustomize(false);
      setShowClaimModal(false);
      dragOffset.setValue(0);
    }
  }, [isVisible, slideAnim, dragOffset]);

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

    const wallet = publicKey.toBase58();
    if (mpConnected) {
      sendClaim({ blockId: selectedBlockId, wallet, amount: amount * 1_000_000, color });
    } else {
      claimBlock(selectedBlockId, wallet, amount * 1_000_000, color);
    }
    hapticBlockClaimed();
    playBlockClaim();
  }, [publicKey, selectedBlockId, deposit, claimBlock, mpConnected, sendClaim]);

  // Handle charge
  const handleCharge = useCallback(() => {
    if (!selectedBlockId) return;
    hapticButtonPress();

    if (mpConnected) {
      sendCharge({ blockId: selectedBlockId });
      // Feedback comes async via charge_result message
      playChargeTap();
    } else {
      const result = chargeBlock(selectedBlockId);
      if (!result.success && result.cooldownRemaining) {
        const secs = Math.ceil(result.cooldownRemaining / 1000);
        setCooldownText(`Wait ${secs}s`);
        setTimeout(() => setCooldownText(null), 2000);
        hapticError();
        playError();
      } else if (result.success) {
        playChargeTap();
        if (result.streak && [3, 7, 14, 30].includes(result.streak)) {
          playStreakMilestone();
        }
      }
    }
  }, [selectedBlockId, chargeBlock, mpConnected, sendCharge]);

  // Listen for server charge results (multiplayer)
  useEffect(() => {
    if (!mpConnected) return;
    onChargeResult((result) => {
      if (!result.success && result.cooldownRemaining) {
        const secs = Math.ceil(result.cooldownRemaining / 1000);
        setCooldownText(`Wait ${secs}s`);
        setTimeout(() => setCooldownText(null), 2000);
        hapticError();
        playError();
      } else if (result.success) {
        if (result.streak && [3, 7, 14, 30].includes(result.streak)) {
          playStreakMilestone();
        }
      }
    });
  }, [mpConnected, onChargeResult]);

  // Customize helper — routes through multiplayer or local store
  const applyCustomize = useCallback((changes: { color?: string; emoji?: string; name?: string; style?: number; textureId?: number }) => {
    if (!selectedBlockId) return;
    if (mpConnected) {
      sendCustomize({ blockId: selectedBlockId, changes });
    } else {
      customizeBlock(selectedBlockId, changes);
    }
  }, [selectedBlockId, mpConnected, sendCustomize, customizeBlock]);

  // Handle style change
  const handleStyleChange = useCallback((style: number) => {
    applyCustomize({ style });
    hapticButtonPress();
  }, [applyCustomize]);

  // Handle color change
  const handleColorChange = useCallback((color: string) => {
    applyCustomize({ color });
  }, [applyCustomize]);

  // Handle emoji change
  const handleEmojiChange = useCallback((emoji: string) => {
    applyCustomize({ emoji });
  }, [applyCustomize]);

  // Handle name change
  const handleNameSubmit = useCallback(() => {
    if (!nameInput.trim()) return;
    applyCustomize({ name: nameInput.trim().slice(0, 12) });
  }, [nameInput, applyCustomize]);

  // Handle texture change
  const handleTextureChange = useCallback((textureId: number) => {
    applyCustomize({ textureId });
    hapticButtonPress();
  }, [applyCustomize]);

  if (!block && !isVisible) return null;

  const state = block ? getBlockState(block.energy) : "dead";
  const energyPct = block ? Math.min(100, Math.max(0, block.energy)) : 0;

  return (
    <>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [
              { translateY: Animated.add(slideAnim, dragOffset) },
            ],
          },
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

        {/* Draggable handle bar */}
        <View {...panResponder.panHandlers} style={styles.handleHitArea}>
          <View style={styles.handle} />
        </View>

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

            {/* Streak display (for owned blocks with streaks) */}
            {!isUnclaimed && (block.streak ?? 0) > 0 && (
              <View style={styles.streakRow}>
                <Text style={styles.streakEmoji}>🔥</Text>
                <Text style={styles.streakText}>
                  Day {block.streak}
                </Text>
                {getStreakMultiplier(block.streak ?? 0) > 1 && (
                  <Badge
                    label={`${getStreakMultiplier(block.streak ?? 0)}× Charge`}
                    color={COLORS.gold}
                  />
                )}
                <Text style={styles.nextMilestone}>
                  Next: Day {getNextStreakMilestone(block.streak ?? 0)}
                </Text>
              </View>
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

            {/* Unclaimed block: Show Claim button + hint */}
            {isUnclaimed && (
              <View style={styles.actionSection}>
                <Text style={styles.hintText}>
                  Stake USDC to make this block yours. Your money earns yield while it glows.
                </Text>
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
                    onPress={() => {
                      hapticButtonPress();
                      router.push("/connect");
                    }}
                  />
                )}
              </View>
            )}

            {/* Owned block: Charge + Customize + Share */}
            {isOwner && (
              <View style={styles.actionSection}>
                {block.energy < 50 && (
                  <Text style={styles.hintText}>
                    Your block is losing charge! Tap to recharge and protect your streak.
                  </Text>
                )}
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
                        handleShare(block, shareCardRef);
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Tweet"
                      variant="ghost"
                      size="sm"
                      onPress={() => {
                        hapticButtonPress();
                        handleTweet(block);
                      }}
                    />
                  </View>
                </View>

                {/* Customize panel */}
                {showCustomize && (
                  <View style={styles.customizeSection}>
                    <Text style={styles.sectionLabel}>STYLE</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.styleRow}
                    >
                      {BLOCK_STYLES.map((s) => (
                        <TouchableOpacity
                          key={s.id}
                          style={[
                            styles.styleCell,
                            (block.style ?? 0) === s.id && styles.styleCellSelected,
                          ]}
                          onPress={() => handleStyleChange(s.id)}
                        >
                          <Text style={styles.styleIcon}>{s.icon}</Text>
                          <Text style={[
                            styles.styleLabel,
                            (block.style ?? 0) === s.id && styles.styleLabelSelected,
                          ]}>
                            {s.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

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

                    <Text style={styles.sectionLabel}>TEXTURE</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.styleRow}
                    >
                      {BLOCK_TEXTURES.map((tex) => (
                        <TouchableOpacity
                          key={tex.id}
                          style={[
                            styles.styleCell,
                            (block.textureId ?? 0) === tex.id && styles.styleCellSelected,
                          ]}
                          onPress={() => handleTextureChange(tex.id)}
                        >
                          <Text style={styles.styleIcon}>{tex.icon}</Text>
                          <Text style={[
                            styles.styleLabel,
                            (block.textureId ?? 0) === tex.id && styles.styleLabelSelected,
                          ]}>
                            {tex.label}
                          </Text>
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

            {/* Other player's block info */}
            {!isUnclaimed && !isOwner && block.owner && (
              <View style={styles.actionSection}>
                <Text style={styles.botOwnerText}>
                  Owned by {block.name || truncateAddress(block.owner)}
                </Text>
                {block.energy < 30 && (
                  <Text style={styles.hintText}>
                    This block is fading... find an unclaimed one nearby to claim!
                  </Text>
                )}
                {block.energy >= 80 && (
                  <Text style={styles.hintText}>
                    This keeper is active! Can you keep your block brighter?
                  </Text>
                )}
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

      {/* Off-screen ShareCard for image capture */}
      {block && isOwner && (
        <View style={styles.offscreen} pointerEvents="none">
          <ShareCard ref={shareCardRef} block={block} />
        </View>
      )}
    </>
  );
}

// Twitter intent — opens compose with pre-filled text + deep link
async function handleTweet(block: { layer: number; index: number; energy: number; emoji?: string; name?: string }) {
  const label = block.name || `Layer ${block.layer}`;
  const charge = Math.round(block.energy);
  const icon = block.emoji || "";
  const deepLink = `https://monolith.gg/block/${block.layer}/${block.index}`;
  const text = `${icon} My block on The Monolith \u2014 ${label}, ${charge}% charged!\n\n${deepLink}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

  try {
    await Linking.openURL(twitterUrl);
  } catch {
    // Linking failed — no-op
  }
}

// Share helper — captures ShareCard as image, falls back to text
async function handleShare(block: { layer: number; index: number; energy: number; emoji?: string; name?: string; ownerColor: string; owner: string | null; streak?: number }, shareCardRef: React.RefObject<View | null>) {
  const label = block.name || `Layer ${block.layer}`;
  const charge = Math.round(block.energy);
  const icon = block.emoji || "";
  const deepLink = `https://monolith.gg/block/${block.layer}/${block.index}`;
  const textMessage = `${icon} My block on The Monolith \u2014 ${label}, ${charge}% charged! ${deepLink}`;

  try {
    // Try image share via react-native-view-shot
    const ViewShot = await import("react-native-view-shot");
    const Sharing = await import("expo-sharing");

    if (shareCardRef.current) {
      const uri = await ViewShot.captureRef(shareCardRef, {
        format: "png",
        quality: 1,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share your block",
        });
        return;
      }
    }
  } catch {
    // Image capture failed, fall back to text
  }

  try {
    await Share.share({ message: textMessage });
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
    backgroundColor: COLORS.glassElevated,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    borderCurve: "continuous",
    boxShadow: "0 -4px 24px rgba(26, 22, 18, 0.06), 0 -1px 4px rgba(26, 22, 18, 0.03)",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderStrong,
    alignSelf: "center",
  },
  handleHitArea: {
    paddingVertical: SPACING.sm,
    alignSelf: "stretch",
    alignItems: "center",
    marginBottom: SPACING.xs,
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
  hintText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 13,
    color: COLORS.goldDark,
    backgroundColor: COLORS.goldSubtle,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    textAlign: "center",
    lineHeight: 18,
    overflow: "hidden",
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
  styleRow: {
    flexDirection: "row",
    maxHeight: 60,
  },
  styleCell: {
    width: 56,
    height: 52,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bgMuted,
    marginRight: SPACING.xs,
    paddingVertical: 4,
  },
  styleCellSelected: {
    borderWidth: 2,
    borderColor: COLORS.gold,
    backgroundColor: COLORS.goldSubtle,
  },
  styleIcon: {
    fontSize: 18,
  },
  styleLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  styleLabelSelected: {
    color: COLORS.gold,
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
  // Streak display
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.goldSubtle,
    borderRadius: RADIUS.sm,
  },
  streakEmoji: {
    fontSize: 18,
  },
  streakText: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 16,
    color: COLORS.gold,
  },
  nextMilestone: {
    ...TEXT.caption,
    color: COLORS.textMuted,
    marginLeft: "auto",
  },
  offscreen: {
    position: "absolute",
    left: -9999,
    top: -9999,
  },
});
