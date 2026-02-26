import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { COLORS, SPACING, RADIUS, FONT_FAMILY } from "@/constants/theme";
import { useWalletStore } from "@/stores/wallet-store";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";
import { truncateAddress, formatUsdc } from "@/hooks/useBlockActions";
import { getLayerMinPrice, getLayerTierLabel } from "@monolith/common";
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
}: InspectorActionsProps) {

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
          />
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
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 13,
    color: COLORS.gold,
  },
  streakHintText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    color: COLORS.textMuted,
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
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
  },
  stakedText: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 12,
    color: COLORS.textMuted,
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
  chargeExplainer: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 15,
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
