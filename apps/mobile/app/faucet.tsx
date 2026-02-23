/**
 * Faucet screen — Get test SOL and USDC for devnet.
 */

import { useState, useCallback } from "react";
import { View, Text, StyleSheet, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useWalletStore } from "@/stores/wallet-store";
import { ScreenLayout, Card, Button } from "@/components/ui";
import { TEXT, COLORS, SPACING, FONT_FAMILY } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";
import { CONFIG } from "@/constants/config";

type FaucetState = "idle" | "loading" | "success" | "error";

export default function FaucetScreen() {
  const router = useRouter();
  const publicKey = useWalletStore((s) => s.publicKey);
  const [solState, setSolState] = useState<FaucetState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleAirdrop = useCallback(async () => {
    if (!publicKey) return;
    hapticButtonPress();
    playButtonTap();
    setSolState("loading");
    setErrorMsg("");

    try {
      const connection = new Connection(CONFIG.solana.rpcUrl, "confirmed");
      await connection.requestAirdrop(publicKey, 2 * LAMPORTS_PER_SOL);
      setSolState("success");

      // Balance will refresh on next check
    } catch (err: any) {
      setSolState("error");
      setErrorMsg(err.message || "Airdrop failed");
    }
  }, [publicKey]);

  const handleUsdcFaucet = useCallback(() => {
    hapticButtonPress();
    playButtonTap();
    Linking.openURL("https://faucet.circle.com/");
  }, []);

  if (!publicKey) {
    return (
      <ScreenLayout title="Test Tokens" subtitle="Devnet">
        <Card>
          <Text style={TEXT.bodySm}>Connect your wallet first to get test tokens.</Text>
          <Button
            title="Go Back"
            variant="secondary"
            onPress={() => router.back()}
          />
        </Card>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout title="Test Tokens" subtitle="Devnet">
      {/* SOL Airdrop */}
      <Card>
        <Text style={TEXT.overline}>DEVNET SOL</Text>
        <Text style={[TEXT.bodySm, { marginTop: SPACING.xs }]}>
          Get 2 SOL for transaction fees on devnet.
        </Text>
        <View style={{ marginTop: SPACING.md }}>
          <Button
            title={
              solState === "loading"
                ? "Requesting..."
                : solState === "success"
                ? "Airdrop Sent!"
                : "Get Test SOL"
            }
            variant="primary"
            onPress={handleAirdrop}
            disabled={solState === "loading" || solState === "success"}
          />
        </View>
        {solState === "error" && (
          <Text style={styles.errorText}>{errorMsg}</Text>
        )}
        {solState === "success" && (
          <Text style={styles.successText}>
            2 SOL sent! Balance updates in ~10 seconds.
          </Text>
        )}
      </Card>

      {/* USDC Faucet */}
      <Card>
        <Text style={TEXT.overline}>DEVNET USDC</Text>
        <Text style={[TEXT.bodySm, { marginTop: SPACING.xs }]}>
          Get test USDC from Circle's faucet. Copy your wallet address and paste it on their site.
        </Text>
        <Text style={[TEXT.monoSm, { marginTop: SPACING.sm, color: COLORS.gold }]}>
          {publicKey.toBase58()}
        </Text>
        <View style={{ marginTop: SPACING.md }}>
          <Button
            title="Open USDC Faucet"
            variant="secondary"
            onPress={handleUsdcFaucet}
          />
        </View>
      </Card>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  errorText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    color: COLORS.error,
    marginTop: SPACING.sm,
  },
  successText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    color: COLORS.success,
    marginTop: SPACING.sm,
  },
});
