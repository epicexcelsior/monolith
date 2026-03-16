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
import InspectorActions from "@/components/inspector/InspectorActions";
import InspectorCustomize from "@/components/inspector/InspectorCustomize";
import InspectorComments from "@/components/inspector/InspectorComments";
import { useBlockActions } from "@/hooks/useBlockActions";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, TIMING } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";
import { useTowerStore } from "@/stores/tower-store";
import { useTapestryStore } from "@/stores/tapestry-store";
import {
  getProfile,
  getBlockContentId,
  ensureBlockContent,
  followProfile,
  unfollowProfile,
  checkFollowing,
  checkLiked,
  getLikeCount,
  likeContent,
  unlikeContent,
  getComments,
} from "@/utils/tapestry";
import { isBotOwner } from "@/utils/seed-tower";

const PANEL_HEIGHT_COMPACT = 280;
const PANEL_HEIGHT_EXPANDED = 540;
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
    handlePersonalityChange,
    handleImageUpload,
    resetPanelState,
    canPoke,
    showSharePrompt,
  } = useBlockActions();

  const slideAnim = useRef(new Animated.Value(PANEL_HEIGHT_EXPANDED)).current;
  const panelHeight = useRef(new Animated.Value(PANEL_HEIGHT_COMPACT)).current;
  const dragOffset = useRef(new Animated.Value(0)).current;
  const shareCardRef = useRef<View>(null);
  const isVisible = selectedBlockId !== null;

  const [showCustomize, setShowCustomize] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const isExpanded = showCustomize || showComments;

  // ─── Tapestry social state ─────────────────────────────
  const tapestryProfileId = useTapestryStore((s) => s.profileId);
  const [isFollowingOwner, setIsFollowingOwner] = useState(false);
  const [hasLikedBlock, setHasLikedBlock] = useState(false);
  const [blockLikeCount, setBlockLikeCount] = useState(0);
  const [blockCommentCount, setBlockCommentCount] = useState(0);
  const [ownerTapestryId, setOwnerTapestryId] = useState<string | null>(null);

  // Deterministic content ID — always available for any non-unclaimed block
  const currentBlockContentId = block?.id && !isUnclaimed ? getBlockContentId(block.id) : undefined;
  // Track whether the Tapestry content node exists (to avoid 404s on like/comment)
  const contentReadyRef = useRef(false);

  const showSocial =
    !!tapestryProfileId &&
    !isOwner &&
    !isUnclaimed &&
    !!block?.owner;

  // Ensure block content exists + check follow/like/comment status
  useEffect(() => {
    contentReadyRef.current = false;

    if (!block?.id || isUnclaimed) {
      setIsFollowingOwner(false);
      setHasLikedBlock(false);
      setBlockLikeCount(0);
      setBlockCommentCount(0);
      setOwnerTapestryId(null);
      return;
    }

    let cancelled = false;
    const contentId = getBlockContentId(block.id);

    // Step 1: Ensure the content node exists (lazy create), then check social state
    const ensureAndCheck = async () => {
      // We need a profileId to create content — use the block owner's Tapestry profile
      // or our own profileId as fallback (content is keyed by contentId, not profileId)
      const creatorId = tapestryProfileId || "system";
      try {
        await ensureBlockContent(
          creatorId,
          block.id,
          `Block ${block.id} on The Monolith`,
        );
        if (cancelled) return;
        contentReadyRef.current = true;
      } catch {
        // Content creation failed — social features won't work for this block
        if (cancelled) return;
        contentReadyRef.current = false;
        return;
      }

      // Step 2: Now that content exists, check like/comment counts
      if (tapestryProfileId) {
        checkLiked(tapestryProfileId, contentId)
          .then((result) => { if (!cancelled) setHasLikedBlock(result.hasLiked); })
          .catch(() => { });
      }
      getLikeCount(contentId)
        .then((count) => { if (!cancelled) setBlockLikeCount(count); })
        .catch(() => { });
      getComments(contentId, tapestryProfileId ?? undefined, 1, 1)
        .then((result) => { if (!cancelled) setBlockCommentCount(result.comments?.length ?? 0); })
        .catch(() => { });
    };

    ensureAndCheck().catch(console.warn);

    // Follow state — only for other people's blocks
    if (showSocial && block.owner) {
      // Bot profiles use their name as ID; real players use username or truncated wallet
      const ownerName = isBotOwner(block.owner)
        ? block.owner
        : (block.name || block.owner.slice(0, 8));
      getProfile(ownerName)
        .then((result) => {
          if (cancelled) return;
          const ownerId = result.profile.id;
          setOwnerTapestryId(ownerId);
          return checkFollowing(tapestryProfileId!, ownerId);
        })
        .then((result) => {
          if (!cancelled && result) setIsFollowingOwner(result.isFollowing);
        })
        .catch(() => {
          if (!cancelled) setOwnerTapestryId(null);
        });
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block?.id, tapestryProfileId, showSocial, isUnclaimed]);

  const handleTapestryFollow = useCallback(() => {
    if (!tapestryProfileId || !ownerTapestryId) return;
    setIsFollowingOwner(true);
    followProfile(tapestryProfileId, ownerTapestryId)
      .catch(() => setIsFollowingOwner(false));
  }, [tapestryProfileId, ownerTapestryId]);

  const handleTapestryUnfollow = useCallback(() => {
    if (!tapestryProfileId || !ownerTapestryId) return;
    setIsFollowingOwner(false);
    unfollowProfile(tapestryProfileId, ownerTapestryId)
      .catch(() => setIsFollowingOwner(true));
  }, [tapestryProfileId, ownerTapestryId]);

  const handleTapestryLike = useCallback(() => {
    if (!tapestryProfileId || !currentBlockContentId || !contentReadyRef.current) return;
    setHasLikedBlock(true);
    setBlockLikeCount((c) => c + 1);
    likeContent(tapestryProfileId, currentBlockContentId).catch(() => {
      setHasLikedBlock(false);
      setBlockLikeCount((c) => c - 1);
    });
  }, [tapestryProfileId, currentBlockContentId]);

  const handleTapestryUnlike = useCallback(() => {
    if (!tapestryProfileId || !currentBlockContentId || !contentReadyRef.current) return;
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
              toValue: PANEL_HEIGHT_EXPANDED,
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
      toValue: isVisible ? 0 : PANEL_HEIGHT_EXPANDED,
      ...TIMING.spring,
      useNativeDriver: true,
    }).start();

    if (!isVisible) {
      setShowCustomize(false);
      setShowComments(false);
      resetPanelState();
      dragOffset.setValue(0);
    }
  }, [isVisible, slideAnim, dragOffset, resetPanelState]);

  // Animate panel height when expanding/collapsing
  useEffect(() => {
    Animated.spring(panelHeight, {
      toValue: isExpanded ? PANEL_HEIGHT_EXPANDED : PANEL_HEIGHT_COMPACT,
      useNativeDriver: false,
      friction: 8,
      tension: 65,
    }).start();
  }, [isExpanded, panelHeight]);

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
            height: panelHeight,
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
            scrollEnabled={isExpanded}
          >
            <View style={styles.fixedSection}>
              <InspectorHeader
                block={block}
                isUnclaimed={isUnclaimed}
                isOwner={isOwner}
                energyPct={energyPct}
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
                onCustomizeToggle={() => { setShowCustomize(!showCustomize); setShowComments(false); hapticButtonPress(); playButtonTap(); }}
                onShare={() => handleShare(block, shareCardRef)}
                onTweet={() => handleTweet(block)}
                showCustomize={showCustomize}
                showSharePrompt={showSharePrompt}
                tapestryProfileId={showSocial ? tapestryProfileId : null}
                blockContentId={currentBlockContentId ?? null}
                isFollowing={isFollowingOwner}
                hasLiked={hasLikedBlock}
                likeCount={blockLikeCount}
                commentCount={blockCommentCount}
                showComments={showComments}
                onCommentsToggle={() => { setShowComments(!showComments); setShowCustomize(false); hapticButtonPress(); playButtonTap(); }}
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
                onPersonalityChange={handlePersonalityChange}
                onImageUpload={handleImageUpload}
                isPostClaim={recentlyClaimedId === selectedBlockId}
              />
            )}

            {showComments && currentBlockContentId && (
              <InspectorComments
                blockId={block.id}
                contentId={currentBlockContentId}
                profileId={tapestryProfileId}
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

// Twitter intent with Blink URL
async function handleTweet(block: { layer: number; index: number; energy: number; emoji?: string; name?: string }) {
  const label = block.name || `Layer ${block.layer}`;
  const charge = Math.round(block.energy);
  const icon = block.emoji || "";
  const blockId = `block-${block.layer}-${block.index}`;
  const blinkUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(
    `https://monolith-server-production.up.railway.app/api/actions/block/${blockId}`
  )}`;
  const text = `${icon} My block on The Monolith \u2014 ${label}, ${charge}% charged!\n\nPoke it \u{1F447}\n${blinkUrl}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  try { await Linking.openURL(twitterUrl); } catch { }
}

// Share helper with Blink URL
async function handleShare(block: { layer: number; index: number; energy: number; emoji?: string; name?: string; ownerColor: string; owner: string | null; streak?: number }, shareCardRef: React.RefObject<View | null>) {
  const label = block.name || `Layer ${block.layer}`;
  const charge = Math.round(block.energy);
  const icon = block.emoji || "";
  const blockId = `block-${block.layer}-${block.index}`;
  const blinkUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(
    `https://monolith-server-production.up.railway.app/api/actions/block/${blockId}`
  )}`;
  const textMessage = `${icon} My block on The Monolith \u2014 ${label}, ${charge}% charged! Poke it: ${blinkUrl}`;

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
  } catch { }

  try { await Share.share({ message: textMessage }); } catch { }
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
    backgroundColor: COLORS.inspectorBg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 1,
    borderColor: COLORS.inspectorBorder,
    paddingHorizontal: SPACING.md,
    borderCurve: "continuous",
    boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.30)",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.20)",
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
    backgroundColor: COLORS.inspectorBgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: COLORS.inspectorTextSecondary,
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
