import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { COLORS, SPACING, RADIUS, FONT_FAMILY, TEXT } from "@/constants/theme";
import { useWalletStore } from "@/stores/wallet-store";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";
import { truncateAddress, formatUsdc } from "@/hooks/useBlockActions";
import { getLayerMinPrice, getLayerTierLabel, getEvolutionTier, getEvolutionTierInfo, chargesToNextTier, EVOLUTION_TIERS } from "@monolith/common";
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

  // Evolution progress (computed once, used in owner section)
  const totalCharges = block.totalCharges ?? 0;
  const evolutionTier = getEvolutionTier(totalCharges, block.bestStreak ?? 0);
  const evolutionTierInfo = getEvolutionTierInfo(evolutionTier);
  const nextEvolutionTier = chargesToNextTier(totalCharges, block.bestStreak ?? 0);

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
          {/* Streak info */}
          <View style={styles.streakBadge}>
            {streak > 0 ? (
              <Text style={styles.streakBadgeText}>
                {"\uD83D\uDD25"} {streak}-day streak {multiplier > 1 ? `\u00B7 ${multiplier}\u00D7 XP` : ""}
              </Text>
            ) : (
              <Text style={styles.streakHintText}>
                Charge daily to keep your block alive
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
          {/* Evolution progress */}
          <View style={styles.evolutionSection}>
            <View style={styles.evolutionHeader}>
              <Text style={styles.evolutionTierText}>{evolutionTierInfo.name}</Text>
              {nextEvolutionTier ? (
                <Text style={styles.evolutionProgressText}>
                  {totalCharges}/{EVOLUTION_TIERS[evolutionTier + 1].charges} to {nextEvolutionTier.nextTierName}
                </Text>
              ) : (
                <Text style={styles.evolutionMaxText}>Max Tier</Text>
              )}
            </View>
            {nextEvolutionTier && (
              <View style={styles.evolutionBar}>
                <View style={[styles.evolutionBarFill, { width: `${Math.round(nextEvolutionTier.progress * 100)}%` }]} />
              </View>
            )}
          </View>
          <Text style={styles.chargeExplainer}>
            Energy decays daily. 0% for 3 days = anyone can reclaim it.
          </Text>
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
              onPress={() => { hapticButtonPress(); playButtonTap(); onShare(); }}
            >
              <Text style={styles.actionChipText}>Share</Text>
            </TouchableOpacity>
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
  evolutionSection: {
    gap: 4,
  },
  evolutionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  evolutionTierText: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 12,
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  evolutionProgressText: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  evolutionMaxText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 11,
    color: COLORS.gold,
  },
  evolutionBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.bgMuted,
    overflow: "hidden" as const,
  },
  evolutionBarFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: COLORS.gold,
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
