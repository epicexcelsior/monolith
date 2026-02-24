import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuthorization } from "@/hooks/useAuthorization";
import { useWalletStore, useTruncatedAddress } from "@/stores/wallet-store";
import { Button, Card } from "@/components/ui";
import { TEXT, COLORS, SPACING } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";

/**
 * Wallet connect modal screen.
 *
 * Uses MWA to connect to a Solana wallet app (Phantom, Solflare, Seed Vault).
 * On Seeker, this will trigger the Seed Vault sign-in via bottom sheet.
 *
 * @see https://docs.solanamobile.com/react-native/using_mobile_wallet_adapter
 */
export default function ConnectScreen() {
  const router = useRouter();
  const { connect } = useAuthorization();
  const isConnected = useWalletStore((s) => s.isConnected);
  const isLoading = useWalletStore((s) => s.isLoading);
  const error = useWalletStore((s) => s.error);
  const truncatedAddress = useTruncatedAddress();

  const handleConnect = async () => {
    try {
      hapticButtonPress();
      playButtonTap();
      await connect();
      // Success — navigate back to the tower
      router.back();
    } catch {
      // Error is already set in the store by useAuthorization
      // and displayed below via the error state
    }
  };

  // Already connected — show success state
  if (isConnected && truncatedAddress) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.bg,
          justifyContent: "center",
          paddingHorizontal: SPACING.lg,
        }}
      >
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 64, marginBottom: SPACING.lg }}>✅</Text>
          <Text style={[TEXT.displaySm, { textAlign: "center", marginBottom: SPACING.sm }]}>
            Wallet Connected
          </Text>
          <Text
            style={[
              TEXT.mono,
              { color: COLORS.gold, fontSize: 18, marginBottom: SPACING.sm },
            ]}
          >
            {truncatedAddress}
          </Text>
          <Text
            style={[
              TEXT.bodySm,
              { textAlign: "center", marginBottom: SPACING.xl },
            ]}
          >
            You're ready to stake, claim blocks, and earn yield on The Monolith.
          </Text>
          <Button
            title="Back to Tower"
            variant="primary"
            onPress={() => router.back()}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.bg,
        justifyContent: "center",
        paddingHorizontal: SPACING.lg,
      }}
    >
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 64, marginBottom: SPACING.lg }}>🔐</Text>
        <Text
          style={[
            TEXT.displaySm,
            { textAlign: "center", marginBottom: SPACING.sm },
          ]}
        >
          Connect Your Wallet
        </Text>
        <Text
          style={[
            TEXT.bodySm,
            {
              textAlign: "center",
              marginBottom: SPACING.lg,
              paddingHorizontal: SPACING.md,
            },
          ]}
        >
          Connect a Solana wallet to stake, claim blocks, and earn yield on The
          Monolith.
        </Text>

        {/* Error display */}
        {error && (
          <Card variant="muted" style={{ width: "100%", marginBottom: SPACING.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 16, marginRight: SPACING.sm }}>⚠️</Text>
              <Text
                style={[TEXT.bodySm, { color: COLORS.error, flex: 1 }]}
              >
                {error}
              </Text>
            </View>
          </Card>
        )}

        {/* Connect button with loading state */}
        <View style={{ width: "100%", marginBottom: SPACING.md }}>
          <Button
            title={isLoading ? "Connecting..." : "Connect with MWA"}
            variant="primary"
            onPress={handleConnect}
            loading={isLoading}
            disabled={isLoading}
          />
        </View>

        <Text
          style={[
            TEXT.caption,
            { textAlign: "center", marginBottom: SPACING.lg },
          ]}
        >
          On Seeker, this will use the Seed Vault for secure signing.
        </Text>

        {/* Wallet discovery hint */}
        <Card variant="accent" style={{ width: "100%", marginBottom: SPACING.lg }}>
          <Text style={[TEXT.overline, { color: COLORS.gold, marginBottom: SPACING.xs }]}>
            SUPPORTED WALLETS
          </Text>
          <Text style={TEXT.bodySm}>
            Seed Vault • Phantom • Solflare • Any MWA-compatible wallet
          </Text>
        </Card>

        <Button
          title="Cancel"
          variant="ghost"
          onPress={() => router.back()}
          disabled={isLoading}
        />
      </View>
    </View>
  );
}
