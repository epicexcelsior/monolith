import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  PanResponder,
  ScrollView,
  Share,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ShareCard from "./ShareCard";
import ClaimModal from "@/components/ui/ClaimModal";
import InspectorHeader from "@/components/inspector/InspectorHeader";
import InspectorStats from "@/components/inspector/InspectorStats";
import InspectorActions from "@/components/inspector/InspectorActions";
import InspectorCustomize from "@/components/inspector/InspectorCustomize";
import { useBlockActions } from "@/hooks/useBlockActions";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, TIMING } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";
import { useTowerStore } from "@/stores/tower-store";
import { useTapestryStore } from "@/stores/tapestry-store";
import {
  findOrCreateProfile,
  followProfile,
  unfollowProfile,
  checkFollowing,
  checkLiked,
  getLikeCount,
  likeContent,
  unlikeContent,
} from "@/utils/tapestry";
import { isBotOwner } from "@/utils/seed-tower";

const PANEL_HEIGHT = 420;
const DISMISS_THRESHOLD = 80;

export default function BlockInspector() {
  const insets = useSafeAreaInsets();
  const selectBlock = useTowerStore((s) => s.selectBlock);

  const {
    block,
    selectedBlockId,
    isOwner,
    isUnclaimed,
    isDormant,
    energyPct,
    streak,
    multiplier,
    isWalletConnected,
    mpConnected,
    cooldownText,
    pokeStatus,
    showClaimModal,
    setShowClaimModal,
    recentlyClaimedId,
    isOnboardingClaim,
    handleOnboardingClaim,
    handleClaim,
    handleCharge,
    handlePoke,
    handleDismiss,
    handleStyleChange,
    handleColorChange,
    handleEmojiChange,
    handleNameSubmit,
    handleTextureChange,
    resetPanelState,
    canPoke,
  } = useBlockActions();

  const slideAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const dragOffset = useRef(new Animated.Value(0)).current;
  const shareCardRef = useRef<View>(null);
  const isVisible = selectedBlockId !== null;

  const [showCustomize, setShowCustomize] = useState(false);

  // ─── Tapestry social state ─────────────────────────────
  const tapestryProfileId = useTapestryStore((s) => s.profileId);
  const blockContentMap = useTapestryStore((s) => s.blockContentMap);
  const [isFollowingOwner, setIsFollowingOwner] = useState(false);
  const [hasLikedBlock, setHasLikedBlock] = useState(false);
  const [blockLikeCount, setBlockLikeCount] = useState(0);
  const [ownerTapestryId, setOwnerTapestryId] = useState<string | null>(null);

  const currentBlockContentId = block?.id ? blockContentMap[block.id] : undefined;
  const showSocial =
    !!tapestryProfileId &&
    !isOwner &&
    !isUnclaimed &&
    !!block?.owner &&
    !isBotOwner(block.owner);

  // Check follow/like status when viewing another player's block
  useEffect(() => {
    if (!showSocial || !block?.owner) {
      setIsFollowingOwner(false);
      setHasLikedBlock(false);
      setBlockLikeCount(0);
      setOwnerTapestryId(null);
      return;
    }

    const ownerAddr = block.owner;
    const ownerName = block.name || ownerAddr.slice(0, 8);

    findOrCreateProfile(ownerAddr, ownerName)
      .then((result) => {
        const ownerId = result.profile.id;
        setOwnerTapestryId(ownerId);
        return checkFollowing(tapestryProfileId!, ownerId);
      })
      .then((result) => setIsFollowingOwner(result.isFollowing))
      .catch(console.warn);

    if (currentBlockContentId) {
      checkLiked(tapestryProfileId!, currentBlockContentId)
        .then((result) => setHasLikedBlock(result.hasLiked))
        .catch(console.warn);
      getLikeCount(currentBlockContentId)
        .then((count) => setBlockLikeCount(count))
        .catch(console.warn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block?.id, tapestryProfileId, showSocial, currentBlockContentId]);

  const handleTapestryFollow = useCallback(() => {
    if (!tapestryProfileId || !ownerTapestryId) return;
    setIsFollowingOwner(true);
    followProfile(tapestryProfileId, ownerTapestryId)
      .then(() => useTapestryStore.getState().addFollowing(ownerTapestryId))
      .catch(() => setIsFollowingOwner(false));
  }, [tapestryProfileId, ownerTapestryId]);

  const handleTapestryUnfollow = useCallback(() => {
    if (!tapestryProfileId || !ownerTapestryId) return;
    setIsFollowingOwner(false);
    unfollowProfile(tapestryProfileId, ownerTapestryId)
      .then(() => useTapestryStore.getState().removeFollowing(ownerTapestryId))
      .catch(() => setIsFollowingOwner(true));
  }, [tapestryProfileId, ownerTapestryId]);

  const handleTapestryLike = useCallback(() => {
    if (!tapestryProfileId || !currentBlockContentId) return;
    setHasLikedBlock(true);
    setBlockLikeCount((c) => c + 1);
    likeContent(tapestryProfileId, currentBlockContentId).catch(() => {
      setHasLikedBlock(false);
      setBlockLikeCount((c) => c - 1);
    });
  }, [tapestryProfileId, currentBlockContentId]);

  const handleTapestryUnlike = useCallback(() => {
    if (!tapestryProfileId || !currentBlockContentId) return;
    setHasLikedBlock(false);
    setBlockLikeCount((c) => c - 1);
    unlikeContent(tapestryProfileId, currentBlockContentId).catch(() => {
      setHasLikedBlock(true);
      setBlockLikeCount((c) => c + 1);
    });
  }, [tapestryProfileId, currentBlockContentId]);

  // Swipe-to-dismiss — works from anywhere on the panel
  const handleDismissRef = useRef(handleDismiss);
  handleDismissRef.current = handleDismiss;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) dragOffset.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > DISMISS_THRESHOLD || gesture.vy > 0.4) {
            // Fast slide out then dismiss
            Animated.timing(dragOffset, {
              toValue: PANEL_HEIGHT,
              duration: 150,
              useNativeDriver: true,
            }).start(() => {
              handleDismissRef.current();
              dragOffset.setValue(0);
            });
          } else {
            // Snap back with snappy spring
            Animated.spring(dragOffset, {
              toValue: 0,
              tension: 200,
              friction: 20,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [dragOffset],
  );

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isVisible ? 0 : PANEL_HEIGHT,
      ...TIMING.spring,
      useNativeDriver: true,
    }).start();

    if (!isVisible) {
      setShowCustomize(false);
      resetPanelState();
      dragOffset.setValue(0);
    }
  }, [isVisible, slideAnim, dragOffset, resetPanelState]);

  // Auto-expand customize after claiming
  useEffect(() => {
    if (recentlyClaimedId && selectedBlockId && recentlyClaimedId === selectedBlockId) {
      setShowCustomize(true);
    }
  }, [recentlyClaimedId, selectedBlockId]);

  if (!block && !isVisible) return null;

  return (
    <>
      <Animated.View
        testID="block-inspector-panel"
        {...panResponder.panHandlers}
        style={[
          styles.container,
          {
            bottom: 0,
            paddingBottom: Math.max(insets.bottom, 8) + SPACING.sm,
            transform: [
              { translateY: Animated.add(slideAnim, dragOffset) },
            ],
          },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.handleHitArea}>
          <View style={styles.handle} />
        </View>

        {/* Close */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {block && (
          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            nestedScrollEnabled
          >
            <View style={styles.fixedSection}>
              <InspectorHeader
                block={block}
                isUnclaimed={isUnclaimed}
                isOwner={isOwner}
              />
              <InspectorStats
                energyPct={energyPct}
                isUnclaimed={isUnclaimed}
              />
              <InspectorActions
                block={block}
                isOwner={isOwner}
                isUnclaimed={isUnclaimed}
                isDormant={isDormant}
                isWalletConnected={isWalletConnected}
                mpConnected={mpConnected}
                cooldownText={cooldownText}
                pokeStatus={pokeStatus}
                streak={streak}
                multiplier={multiplier}
                canPoke={canPoke}
                isOnboarding={isOnboardingClaim}
                onClaim={isOnboardingClaim ? handleOnboardingClaim : () => setShowClaimModal(true)}
                onCharge={handleCharge}
                onPoke={handlePoke}
                onCustomizeToggle={() => { setShowCustomize(!showCustomize); hapticButtonPress(); playButtonTap(); }}
                onShare={() => handleShare(block, shareCardRef)}
                onTweet={() => handleTweet(block)}
                showCustomize={showCustomize}
                tapestryProfileId={showSocial ? tapestryProfileId : null}
                blockContentId={currentBlockContentId ?? null}
                isFollowing={isFollowingOwner}
                hasLiked={hasLikedBlock}
                likeCount={blockLikeCount}
                onFollow={handleTapestryFollow}
                onUnfollow={handleTapestryUnfollow}
                onLike={handleTapestryLike}
                onUnlike={handleTapestryUnlike}
              />
            </View>

            {showCustomize && isOwner && (
              <InspectorCustomize
                block={block}
                onColorChange={handleColorChange}
                onEmojiChange={handleEmojiChange}
                onStyleChange={handleStyleChange}
                onTextureChange={handleTextureChange}
                onNameSubmit={handleNameSubmit}
                isPostClaim={recentlyClaimedId === selectedBlockId}
              />
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
    fontFamily: FONT_FAMILY.bodySemibold,
  },
  scrollContent: {
    flex: 1,
  },
  fixedSection: {
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  offscreen: {
    position: "absolute",
    left: -9999,
    top: -9999,
  },
});
