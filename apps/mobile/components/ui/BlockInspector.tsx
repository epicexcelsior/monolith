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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ShareCard from "./ShareCard";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, TIMING, TEXT, GLASS_STYLE, SHADOW, getChargeColor } from "@/constants/theme";
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
import { useMultiplayerStore, onChargeResult, onClaimResult, onCustomizeResult } from "@/stores/multiplayer-store";
import type { ChargeResult, ClaimResult } from "@/stores/multiplayer-store";
import { usePlayerStore } from "@/stores/player-store";
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

const PANEL_HEIGHT = 420;
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
  return `${addr.slice(0, 4)}..${addr.slice(-4)}`;
}

function formatUsdc(lamports: number): string {
  return `${(lamports / 1_000_000).toFixed(2)} USDC`;
}

export default function BlockInspector() {
  const insets = useSafeAreaInsets();
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
  const mpConnected = useMultiplayerStore((s) => s.connected && !s.reconnecting);
  const sendClaim = useMultiplayerStore((s) => s.sendClaim);
  const sendCharge = useMultiplayerStore((s) => s.sendCharge);
  const sendCustomize = useMultiplayerStore((s) => s.sendCustomize);

  const slideAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const dragOffset = useRef(new Animated.Value(0)).current;
  const shareCardRef = useRef<View>(null);
  const isVisible = selectedBlockId !== null;

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [cooldownText, setCooldownText] = useState<string | null>(null);

  // Swipe-to-dismiss — only on drag handle, not content
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) dragOffset.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > DISMISS_THRESHOLD || gesture.vy > 0.5) {
            hapticBlockDeselect();
            selectBlock(null);
          }
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

  // Dormant detection: 0 energy, not your block, not bot, old lastChargeTime
  const DORMANT_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;
  const isDormant = block && !isUnclaimed && !isOwner && block.owner
    && block.energy === 0
    && block.lastChargeTime
    && (Date.now() - block.lastChargeTime) > DORMANT_THRESHOLD_MS;

  // Handle claim
  const handleClaim = useCallback(async (amount: number, color: string) => {
    if (!publicKey || !selectedBlockId) throw new Error("Wallet not connected");
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
      const wallet = publicKey?.toBase58() || "";
      sendCharge({ blockId: selectedBlockId, wallet });
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

  // Listen for server charge results
  useEffect(() => {
    if (!mpConnected) return;
    onChargeResult((result: ChargeResult) => {
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
        // Feed XP to player store
        if (result.pointsEarned) {
          usePlayerStore.getState().addPoints({
            pointsEarned: result.pointsEarned,
            combo: result.combo,
            totalXp: result.totalXp,
            level: result.level,
            levelUp: result.levelUp,
          });
        }
      }
    });

    onClaimResult((result: ClaimResult) => {
      if (result.success && result.pointsEarned) {
        usePlayerStore.getState().addPoints({
          pointsEarned: result.pointsEarned,
          combo: result.combo,
          totalXp: result.totalXp,
          level: result.level,
          levelUp: result.levelUp,
        });
      }
    });
  }, [mpConnected]);

  // Customize helper
  const applyCustomize = useCallback((changes: { color?: string; emoji?: string; name?: string; style?: number; textureId?: number }) => {
    if (!selectedBlockId) return;
    if (mpConnected) {
      const wallet = publicKey?.toBase58() || "";
      sendCustomize({ blockId: selectedBlockId, wallet, changes });
    } else {
      customizeBlock(selectedBlockId, changes);
    }
  }, [selectedBlockId, mpConnected, sendCustomize, customizeBlock]);

  const handleStyleChange = useCallback((style: number) => {
    applyCustomize({ style });
    hapticButtonPress();
  }, [applyCustomize]);

  const handleColorChange = useCallback((color: string) => {
    applyCustomize({ color });
  }, [applyCustomize]);

  const handleEmojiChange = useCallback((emoji: string) => {
    applyCustomize({ emoji });
  }, [applyCustomize]);

  const handleNameSubmit = useCallback(() => {
    if (!nameInput.trim()) return;
    applyCustomize({ name: nameInput.trim().slice(0, 12) });
  }, [nameInput, applyCustomize]);

  const handleTextureChange = useCallback((textureId: number) => {
    applyCustomize({ textureId });
    hapticButtonPress();
  }, [applyCustomize]);

  if (!block && !isVisible) return null;

  const state = block ? getBlockState(block.energy) : "dead";
  const energyPct = block ? Math.min(100, Math.max(0, block.energy)) : 0;
  const streak = block?.streak ?? 0;
  const multiplier = getStreakMultiplier(streak);

  return (
    <>
      <Animated.View
        style={[
          styles.container,
          {
            // Sit above the tab bar (60px + safe area inset)
            bottom: 60 + Math.max(insets.bottom, 8),
            paddingBottom: SPACING.sm,
            transform: [
              { translateY: Animated.add(slideAnim, dragOffset) },
            ],
          },
        ]}
      >
        {/* Drag handle — swipe down to dismiss */}
        <View {...panResponder.panHandlers} style={styles.handleHitArea}>
          <View style={styles.handle} />
        </View>

        {/* Close */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => { hapticBlockDeselect(); selectBlock(null); }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {block && (
          <>
            {/* ─── Fixed header + CTA (always visible, never scrolled away) ─── */}
            <View style={styles.fixedSection}>
              {/* Header: identity + status */}
              <View style={styles.headerRow}>
                <View style={styles.identity}>
                  {block.emoji && <Text style={styles.emoji}>{block.emoji}</Text>}
                  <View style={styles.titleCol}>
                    <Text style={styles.blockName} numberOfLines={1}>
                      {block.name || `L${block.layer} / B${block.index}`}
                    </Text>
                    {!isUnclaimed && block.owner && (
                      <Text style={styles.ownerLabel}>
                        {isOwner ? "Your block" : truncateAddress(block.owner)}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.statusCol}>
                  <Badge
                    label={isUnclaimed ? "OPEN" : state.toUpperCase()}
                    color={isUnclaimed ? COLORS.gold : stateColor(state)}
                  />
                  {streak > 0 && (
                    <Text style={styles.streakBadge}>
                      {streak}d {multiplier > 1 ? `${multiplier}×` : ""}
                    </Text>
                  )}
                </View>
              </View>

              {/* Energy bar (claimed blocks only) */}
              {!isUnclaimed && (
                <View style={styles.energyRow}>
                  <ChargeBar charge={energyPct} size="sm" />
                  <Text style={[styles.energyPct, { color: getChargeColor(energyPct) }]}>
                    {Math.round(energyPct)}%
                  </Text>
                </View>
              )}

              {/* Primary CTA */}
              <View style={styles.ctaSection}>
                {isUnclaimed && (
                  isWalletConnected ? (
                    <Button
                      title="CLAIM THIS BLOCK"
                      variant="primary"
                      size="lg"
                      onPress={() => setShowClaimModal(true)}
                    />
                  ) : (
                    <Button
                      title="Connect Wallet to Claim"
                      variant="secondary"
                      size="lg"
                      onPress={() => { hapticButtonPress(); router.push("/connect"); }}
                    />
                  )
                )}

                {isOwner && (
                  <>
                    <Button
                      title={cooldownText || "CHARGE"}
                      variant="primary"
                      size="lg"
                      onPress={handleCharge}
                      disabled={!!cooldownText}
                    />
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.actionChip}
                        onPress={() => { setShowCustomize(!showCustomize); hapticButtonPress(); }}
                      >
                        <Text style={styles.actionChipText}>
                          {showCustomize ? "Done" : "Customize"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionChip}
                        onPress={() => { hapticButtonPress(); handleShare(block, shareCardRef); }}
                      >
                        <Text style={styles.actionChipText}>Share</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionChip}
                        onPress={() => { hapticButtonPress(); handleTweet(block); }}
                      >
                        <Text style={styles.actionChipText}>Tweet</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {!isUnclaimed && !isOwner && block.owner && (
                  <>
                    <View style={styles.otherOwnerRow}>
                      <View style={[styles.ownerDot, { backgroundColor: block.ownerColor }]} />
                      <Text style={styles.otherOwnerText}>
                        {block.name || truncateAddress(block.owner)}
                      </Text>
                      {block.stakedAmount > 0 && (
                        <Text style={styles.stakedText}>{formatUsdc(block.stakedAmount)}</Text>
                      )}
                    </View>
                    {isDormant && (
                      <>
                        <Badge label="DORMANT" color={COLORS.dormant} />
                        {isWalletConnected ? (
                          <Button
                            title="RECLAIM THIS BLOCK"
                            variant="primary"
                            size="lg"
                            onPress={() => setShowClaimModal(true)}
                          />
                        ) : (
                          <Button
                            title="Connect Wallet to Reclaim"
                            variant="secondary"
                            size="lg"
                            onPress={() => { hapticButtonPress(); router.push("/connect"); }}
                          />
                        )}
                      </>
                    )}
                  </>
                )}
              </View>
            </View>

            {/* ─── Scrollable customize panel (only when expanded) ─── */}
            {showCustomize && isOwner && (
              <ScrollView
                style={styles.contentScroll}
                contentContainerStyle={styles.customizeContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
                <Text style={styles.sectionLabel}>STYLE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
                  {BLOCK_STYLES.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.cell, (block.style ?? 0) === s.id && styles.cellSelected]}
                      onPress={() => handleStyleChange(s.id)}
                    >
                      <Text style={styles.cellIcon}>{s.icon}</Text>
                      <Text style={[styles.cellLabel, (block.style ?? 0) === s.id && styles.cellLabelSelected]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.sectionLabel}>COLOR</Text>
                <ColorPicker selected={block.ownerColor} onSelect={handleColorChange} />

                <Text style={styles.sectionLabel}>EMOJI</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
                  {BLOCK_ICONS.slice(0, 20).map((icon) => (
                    <TouchableOpacity
                      key={icon}
                      style={[styles.emojiCell, block.emoji === icon && styles.cellSelected]}
                      onPress={() => handleEmojiChange(icon)}
                    >
                      <Text style={styles.emojiText}>{icon}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.sectionLabel}>TEXTURE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
                  {BLOCK_TEXTURES.map((tex) => (
                    <TouchableOpacity
                      key={tex.id}
                      style={[styles.cell, (block.textureId ?? 0) === tex.id && styles.cellSelected]}
                      onPress={() => handleTextureChange(tex.id)}
                    >
                      <Text style={styles.cellIcon}>{tex.icon}</Text>
                      <Text style={[styles.cellLabel, (block.textureId ?? 0) === tex.id && styles.cellLabelSelected]}>
                        {tex.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.sectionLabel}>NAME</Text>
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
                  <TouchableOpacity style={styles.nameButton} onPress={handleNameSubmit}>
                    <Text style={styles.nameButtonText}>Set</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </>
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

      {/* Off-screen ShareCard */}
      {block && isOwner && (
        <View style={styles.offscreen} pointerEvents="none">
          <ShareCard ref={shareCardRef} block={block} />
        </View>
      )}
    </>
  );
}

// Twitter intent
async function handleTweet(block: { layer: number; index: number; energy: number; emoji?: string; name?: string }) {
  const label = block.name || `Layer ${block.layer}`;
  const charge = Math.round(block.energy);
  const icon = block.emoji || "";
  const deepLink = `https://monolith.gg/block/${block.layer}/${block.index}`;
  const text = `${icon} My block on The Monolith \u2014 ${label}, ${charge}% charged!\n\n${deepLink}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  try { await Linking.openURL(twitterUrl); } catch {}
}

// Share helper
async function handleShare(block: { layer: number; index: number; energy: number; emoji?: string; name?: string; ownerColor: string; owner: string | null; streak?: number }, shareCardRef: React.RefObject<View | null>) {
  const label = block.name || `Layer ${block.layer}`;
  const charge = Math.round(block.energy);
  const icon = block.emoji || "";
  const deepLink = `https://monolith.gg/block/${block.layer}/${block.index}`;
  const textMessage = `${icon} My block on The Monolith \u2014 ${label}, ${charge}% charged! ${deepLink}`;

  try {
    const ViewShot = await import("react-native-view-shot");
    const Sharing = await import("expo-sharing");
    if (shareCardRef.current) {
      const uri = await ViewShot.captureRef(shareCardRef, { format: "png", quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your block" });
        return;
      }
    }
  } catch {}

  try { await Share.share({ message: textMessage }); } catch {}
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    minHeight: 180,
    maxHeight: "50%",
    backgroundColor: COLORS.glassElevated,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: SPACING.md,
    borderCurve: "continuous",
    boxShadow: "0 -4px 24px rgba(26, 22, 18, 0.08)",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderStrong,
    alignSelf: "center",
  },
  handleHitArea: {
    paddingVertical: SPACING.sm,
    alignSelf: "stretch",
    alignItems: "center",
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
  fixedSection: {
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  contentScroll: {
    flexShrink: 1,
    maxHeight: 220,
  },
  customizeContent: {
    paddingBottom: SPACING.md,
  },
  // ─── Header ───
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  emoji: {
    fontSize: 24,
  },
  titleCol: {
    flex: 1,
  },
  blockName: {
    fontFamily: FONT_FAMILY.heading,
    color: COLORS.text,
    fontSize: 18,
    letterSpacing: 0.3,
  },
  ownerLabel: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  statusCol: {
    alignItems: "flex-end",
    gap: 3,
  },
  streakBadge: {
    fontFamily: FONT_FAMILY.monoBold,
    fontSize: 11,
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  // ─── Energy ───
  energyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  energyPct: {
    fontFamily: FONT_FAMILY.monoBold,
    fontSize: 13,
    width: 36,
    textAlign: "right",
  },
  // ─── CTA ───
  ctaSection: {
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  actionRow: {
    flexDirection: "row",
    gap: SPACING.xs,
  },
  actionChip: {
    flex: 1,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgMuted,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionChipText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
  // ─── Other owner ───
  otherOwnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.bgMuted,
    borderRadius: RADIUS.sm,
  },
  ownerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  otherOwnerText: {
    ...TEXT.bodySm,
    flex: 1,
  },
  stakedText: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  // ─── Customize ───
  customizeSection: {
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  sectionLabel: {
    ...TEXT.overline,
    color: COLORS.gold,
    marginTop: SPACING.xs,
  },
  hScroll: {
    flexDirection: "row",
    maxHeight: 56,
  },
  cell: {
    width: 52,
    height: 48,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bgMuted,
    marginRight: SPACING.xs,
  },
  cellSelected: {
    borderWidth: 2,
    borderColor: COLORS.gold,
    backgroundColor: COLORS.goldSubtle,
  },
  cellIcon: {
    fontSize: 16,
  },
  cellLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  cellLabelSelected: {
    color: COLORS.gold,
  },
  emojiCell: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bgMuted,
    marginRight: SPACING.xs,
  },
  emojiText: {
    fontSize: 18,
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
    fontSize: 13,
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
  offscreen: {
    position: "absolute",
    left: -9999,
    top: -9999,
  },
});
