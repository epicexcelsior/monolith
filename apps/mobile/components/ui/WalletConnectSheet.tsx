import React from "react";
import { View, Text, StyleSheet } from "react-native";
import BottomPanel from "./BottomPanel";
import Button from "./Button";
import { useAuthorization } from "@/hooks/useAuthorization";
import { useWalletStore, useTruncatedAddress } from "@/stores/wallet-store";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, TEXT } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";

/**
 * WalletConnectSheet — Compact card-style wallet connection overlay.
 * Replaces the old full-screen connect page.
 */
export default function WalletConnectSheet() {
  const { connect, disconnect } = useAuthorization();
  const isConnected = useWalletStore((s) => s.isConnected);
  const isLoading = useWalletStore((s) => s.isLoading);
  const error = useWalletStore((s) => s.error);
  const visible = useWalletStore((s) => s.showConnectSheet);
  const setShow = useWalletStore((s) => s.setShowConnectSheet);
  const truncatedAddress = useTruncatedAddress();

  const handleConnect = async () => {
    try {
      hapticButtonPress();
      playButtonTap();
      await connect();
      // Auto-close after successful connection
      setTimeout(() => setShow(false), 600);
    } catch {
      // Error is set in the store by useAuthorization
    }
  };

  const handleDisconnect = async () => {
    hapticButtonPress();
    playButtonTap();
    await disconnect();
    setShow(false);
  };

  const onClose = () => {
    setShow(false);
  };

  return (
    <BottomPanel
      visible={visible}
      onClose={onClose}
      height={isConnected ? 220 : 300}
      dark
    >
      <View style={styles.content}>
        {isConnected && truncatedAddress ? (
          <>
            <View style={styles.connectedRow}>
              <View style={styles.greenDot} />
              <Text style={styles.connectedLabel}>Connected</Text>
            </View>
            <Text style={styles.address}>{truncatedAddress}</Text>
            <Text style={styles.hint}>
              Your wallet is active. You can claim blocks and earn yield.
            </Text>
            <View style={styles.buttonRow}>
              <Button
                title="Done"
                variant="primary"
                size="md"
                onPress={onClose}
              />
              <Button
                title="Disconnect"
                variant="ghost"
                size="md"
                onPress={handleDisconnect}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title}>Connect Wallet</Text>
            <Text style={styles.description}>
              Link a Solana wallet to claim blocks, stake, and earn yield on the tower.
            </Text>

            {error && (
              <View style={styles.errorRow}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Button
              title={isLoading ? "Connecting..." : "Connect with MWA"}
              variant="primary"
              size="lg"
              onPress={handleConnect}
              loading={isLoading}
              disabled={isLoading}
            />

            <Text style={styles.walletHint}>
              Seed Vault · Phantom · Solflare · Any MWA wallet
            </Text>
          </>
        )}
      </View>
    </BottomPanel>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
    gap: SPACING.md,
  },
  title: {
    ...TEXT.displaySm,
    color: COLORS.goldLight,
  },
  description: {
    ...TEXT.bodySm,
    textAlign: "center",
    maxWidth: "90%",
    alignSelf: "center",
  },
  errorRow: {
    backgroundColor: COLORS.errorSubtle,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    width: "100%",
  },
  errorText: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 12,
    color: COLORS.error,
    textAlign: "center",
  },
  connectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
  },
  connectedLabel: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 14,
    color: COLORS.success,
    letterSpacing: 0.3,
  },
  address: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 20,
    color: COLORS.goldLight,
    letterSpacing: 1,
  },
  hint: {
    ...TEXT.bodySm,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    width: "100%",
  },
  walletHint: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
});
