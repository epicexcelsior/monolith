import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { COLORS, SPACING, RADIUS, FONT_FAMILY } from "@/constants/theme";
import { useWalletStore } from "@/stores/wallet-store";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";
import { truncateAddress, formatUsdc } from "@/hooks/useBlockActions";
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
        (isOnboarding || isWalletConnected) ? (
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
        )
      )}

      {isOwner && (
        <>
          <Button
            title={cooldownText || "CHARGE"}
            variant="primary"
            size="lg"
            onPress={onCharge}
            disabled={!!cooldownText}
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
});
