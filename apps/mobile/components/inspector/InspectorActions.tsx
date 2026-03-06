import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { COLORS, SPACING, RADIUS, FONT_FAMILY, TEXT } from "@/constants/theme";
import { useWalletStore } from "@/stores/wallet-store";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";
import { truncateAddress, formatUsdc } from "@/hooks/useBlockActions";
import { getLayerMinPrice, getLayerTierLabel, getEvolutionTier, getEvolutionTierInfo, chargesToNextTier, ACTIVE_EVOLUTION_TIERS } from "@monolith/common";
import type { DemoBlock } from "@/stores/tower-store";

interface InspectorActionsProps {
  block: DemoBlock;
  isOwner: boolean;
  isUnclaimed: boolean;
  isDormant: boolean | null | undefined | 0 | "";
  isWalletConnected: boolean;
  mpConnected: boolean;
  cooldownText: string | null;
  pokeStatus: string | null;
  streak: number;
  multiplier: number;
  canPoke: (blockId: string) => boolean;
  onClaim: () => void;
  onCharge: () => void;
  onPoke: () => void;
  onCustomizeToggle: () => void;
  onShare: () => void;
  onTweet: () => void;
  showCustomize: boolean;
  isOnboarding?: boolean;
  showSharePrompt?: boolean;
  // Tapestry social
  tapestryProfileId?: string | null;
  blockContentId?: string | null;
  isFollowing?: boolean;
  hasLiked?: boolean;
  likeCount?: number;
  commentCount?: number;
  showComments?: boolean;
  onCommentsToggle?: () => void;
  onFollow?: () => void;
  onUnfollow?: () => void;
  onLike?: () => void;
  onUnlike?: () => void;
}

export default function InspectorActions({
  block,
  isOwner,
  isUnclaimed,
  isDormant,
  isWalletConnected,
  mpConnected,
  cooldownText,
  pokeStatus,
  streak,
  multiplier,
  canPoke,
  onClaim,
  onCharge,
  onPoke,
  onCustomizeToggle,
  onShare,
  onTweet,
  showCustomize,
  isOnboarding,
  showSharePrompt,
  tapestryProfileId,
  blockContentId,
  isFollowing,
  hasLiked,
  likeCount,
  commentCount,
  showComments,
  onCommentsToggle,
  onFollow,
  onUnfollow,
  onLike,
  onUnlike,
}: InspectorActionsProps) {

  // Evolution progress (computed once, used in owner + other-player sections)
  const totalCharges = block.totalCharges ?? 0;
  const bestStreak = block.bestStreak ?? 0;
  const evolutionTier = getEvolutionTier(totalCharges, bestStreak);
  const evolutionTierInfo = getEvolutionTierInfo(evolutionTier);
  const nextEvolutionTier = chargesToNextTier(totalCharges, bestStreak);
  const isCloseToEvolving = nextEvolutionTier != null && nextEvolutionTier.needed <= 3;
  const isMaxTier = evolutionTier >= ACTIVE_EVOLUTION_TIERS.length - 1;

  // Pulse animation when close to evolving
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isCloseToEvolving) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.02, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isCloseToEvolving, pulseAnim]);

  return (
    <View style={styles.ctaSection}>
      {isUnclaimed && (
        <>
          {(isOnboarding || isWalletConnected) ? (
            <Button
              title="CLAIM THIS BLOCK"
              variant="primary"
              size="lg"
              onPress={onClaim}
            />
          ) : (
            <Button
              title="Connect Wallet to Claim"
              variant="secondary"
              size="lg"
              onPress={() => { hapticButtonPress(); playButtonTap(); useWalletStore.getState().setShowConnectSheet(true); }}
            />
          )}
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>
              ${getLayerMinPrice(block.layer).toFixed(2)} minimum stake
            </Text>
            {block.layer >= 16 && (
              <Text style={styles.premiumBadge}>{getLayerTierLabel(block.layer)}</Text>
            )}
          </View>
        </>
      )}

      {isOwner && (
        <>
          {/* Evolution progress card — ABOVE charge button */}
          <Animated.View style={[styles.evolutionCard, isCloseToEvolving && { transform: [{ scale: pulseAnim }] }]}>
            {isMaxTier ? (
              <View style={styles.evolutionFullyEvolved}>
                <Text style={styles.evolutionFullyEvolvedText}>FULLY EVOLVED</Text>
                <Text style={styles.evolutionTierLabel}>{evolutionTierInfo.name}</Text>
              </View>
            ) : (
              <>
                <View style={styles.evolutionHeader}>
                  <Text style={styles.evolutionTierText}>{evolutionTierInfo.name}</Text>
                  {nextEvolutionTier && (
                    <Text style={styles.evolutionTierText}>{nextEvolutionTier.nextTierName}</Text>
                  )}
                </View>
                {nextEvolutionTier && (
                  <View style={styles.evolutionBar}>
                    <View style={[styles.evolutionBarFill, { width: `${Math.round(nextEvolutionTier.progress * 100)}%` }]} />
                  </View>
                )}
                <View style={styles.evolutionDetails}>
                  <Text style={styles.evolutionProgressText}>
                    {totalCharges}/{ACTIVE_EVOLUTION_TIERS[evolutionTier + 1].charges} charges
                  </Text>
                  {nextEvolutionTier && ACTIVE_EVOLUTION_TIERS[evolutionTier + 1].streakReq > 0 && (
                    <Text style={styles.evolutionStreakReq}>
                      Streak: {bestStreak}/{ACTIVE_EVOLUTION_TIERS[evolutionTier + 1].streakReq} days
                    </Text>
                  )}
                </View>
              </>
            )}
          </Animated.View>
          {/* Streak info */}
          <View style={styles.streakBadge}>
            {streak > 0 ? (
              <Text style={styles.streakBadgeText}>
                {"\uD83D\uDD25"} {streak}-day streak {multiplier > 1 ? `\u00B7 ${multiplier}\u00D7` : ""}
              </Text>
            ) : (
              <Text style={styles.streakHintText}>
                Charge daily to keep your Spark alive
              </Text>
            )}
          </View>
          <Button
            title={cooldownText || "\u26A1 CHARGE"}
            variant="primary"
            size="lg"
            onPress={onCharge}
            disabled={!!cooldownText}
            pulsing={!cooldownText}
          />
          <Text style={styles.chargeExplainer}>
            Energy decays daily. 0% for 3 days = anyone can reclaim it.
          </Text>
          {/* Prominent share CTA — highlighted after charge */}
          <Button
            title={showSharePrompt ? "Share Your Block!" : "Share Your Block"}
            variant="gold"
            size="md"
            onPress={() => { hapticButtonPress(); playButtonTap(); onShare(); }}
            pulsing={!!showSharePrompt}
          />
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionChip}
              onPress={() => { onCustomizeToggle(); hapticButtonPress(); playButtonTap(); }}
            >
              <Text style={styles.actionChipText}>
                {showCustomize ? "Done" : "Customize"}
              </Text>
            </TouchableOpacity>
            {blockContentId != null && (
              <TouchableOpacity
                style={[styles.actionChip, showComments && styles.actionChipActive]}
                onPress={() => { onCommentsToggle?.(); }}
              >
                <Text style={styles.actionChipText}>
                  💬 {commentCount ?? 0}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionChip}
              onPress={() => { hapticButtonPress(); playButtonTap(); onTweet(); }}
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
          {/* Read-only evolution tier for other players */}
          <View style={styles.otherEvoRow}>
            <Text style={styles.otherEvoTier}>{evolutionTierInfo.name}</Text>
            {!isMaxTier && nextEvolutionTier && (
              <View style={styles.otherEvoBarWrap}>
                <View style={[styles.evolutionBarFill, { width: `${Math.round(nextEvolutionTier.progress * 100)}%` }]} />
              </View>
            )}
            {isMaxTier && <Text style={styles.otherEvoMax}>FULLY EVOLVED</Text>}
          </View>
          {isWalletConnected && mpConnected && !isDormant && (
            <View style={styles.pokeRow}>
              <Button
                title={pokeStatus || (canPoke(block.id) ? "POKE \uD83D\uDC49" : "Poked today")}
                variant="secondary"
                size="md"
                onPress={onPoke}
                disabled={!canPoke(block.id) || !!pokeStatus}
              />
              {pokeStatus && (
                <Text style={styles.pokeStatusText}>{pokeStatus}</Text>
              )}
            </View>
          )}
          {/* Tapestry social row — Follow + Like + Comments */}
          {tapestryProfileId && (
            <View style={styles.actionRow}>
              {blockContentId != null && (
                <>
                  <TouchableOpacity
                    style={[styles.actionChip, hasLiked && styles.actionChipActive]}
                    onPress={() => {
                      hapticButtonPress();
                      playButtonTap();
                      hasLiked ? onUnlike?.() : onLike?.();
                    }}
                  >
                    <Text style={styles.actionChipText}>
                      {hasLiked ? "\u2764\uFE0F" : "\uD83E\uDD0D"} {likeCount ?? 0}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionChip, showComments && styles.actionChipActive]}
                    onPress={() => { onCommentsToggle?.(); }}
                  >
                    <Text style={styles.actionChipText}>
                      💬 {commentCount ?? 0}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={[styles.actionChip, isFollowing && styles.actionChipActive]}
                onPress={() => {
                  hapticButtonPress();
                  playButtonTap();
                  isFollowing ? onUnfollow?.() : onFollow?.();
                }}
              >
                <Text style={styles.actionChipText}>
                  {isFollowing ? "Following \u2713" : "+ Follow"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {isDormant && (
            <>
              <Badge label="DORMANT" color={COLORS.dormant} />
              {isWalletConnected ? (
                <Button
                  title="RECLAIM THIS BLOCK"
                  variant="primary"
                  size="lg"
                  onPress={onClaim}
                />
              ) : (
                <Button
                  title="Connect Wallet to Reclaim"
                  variant="secondary"
                  size="lg"
                  onPress={() => { hapticButtonPress(); playButtonTap(); useWalletStore.getState().setShowConnectSheet(true); }}
                />
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ctaSection: {
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  streakBadge: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.goldSubtle,
    alignItems: "center",
  },
  streakBadgeText: {
    ...TEXT.bodySm,
    fontFamily: FONT_FAMILY.bodySemibold,
    color: COLORS.gold,
  },
  streakHintText: {
    ...TEXT.caption,
  },
  actionRow: {
    flexDirection: "row",
    gap: SPACING.xs,
  },
  actionChip: {
    flex: 1,
    paddingVertical: 6, // 6px: visually balanced, not a token multiple
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgMuted,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionChipActive: {
    backgroundColor: COLORS.goldSubtle,
    borderColor: COLORS.goldMid,
  },
  actionChipText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
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
    fontFamily: FONT_FAMILY.bodySemibold,
    color: COLORS.text,
    flex: 1,
  },
  stakedText: {
    ...TEXT.monoSm,
  },
  pokeRow: {
    gap: SPACING.xs,
  },
  pokeStatusText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 12,
    color: COLORS.gold,
    textAlign: "center",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  priceText: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  evolutionCard: {
    backgroundColor: COLORS.goldSubtle,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.goldAccentDim,
    padding: SPACING.sm,
    gap: 6,
  },
  evolutionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  evolutionTierText: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 13,
    color: COLORS.goldAccent,
    letterSpacing: 0.5,
  },
  evolutionDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  evolutionProgressText: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  evolutionStreakReq: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  evolutionTierLabel: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 13,
    color: COLORS.goldAccent,
    letterSpacing: 0.5,
  },
  evolutionFullyEvolved: {
    alignItems: "center",
    gap: 2,
  },
  evolutionFullyEvolvedText: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 14,
    color: COLORS.goldAccent,
    letterSpacing: 1,
  },
  evolutionBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.bgMuted,
    overflow: "hidden" as const,
  },
  evolutionBarFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: COLORS.goldAccent,
  },
  otherEvoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  otherEvoTier: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 12,
    color: COLORS.goldAccent,
    letterSpacing: 0.5,
  },
  otherEvoBarWrap: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.bgMuted,
    overflow: "hidden" as const,
  },
  otherEvoMax: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 11,
    color: COLORS.goldAccent,
  },
  chargeExplainer: {
    ...TEXT.caption,
    textAlign: "center",
  },
  premiumBadge: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 10,
    color: COLORS.gold,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.goldSubtle,
    overflow: "hidden",
    letterSpacing: 0.3,
  },
});
