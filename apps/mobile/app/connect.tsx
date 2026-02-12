import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthorization } from "@/hooks/useAuthorization";
import { useWalletStore, useTruncatedAddress } from "@/stores/wallet-store";

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
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.icon}>✅</Text>
          <Text style={styles.title}>Wallet Connected</Text>
          <Text style={styles.addressText}>{truncatedAddress}</Text>
          <Text style={styles.subtitle}>
            You're ready to stake, claim blocks, and earn yield on The Monolith.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryText}>Back to Tower</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>🔐</Text>
        <Text style={styles.title}>Connect Your Wallet</Text>
        <Text style={styles.subtitle}>
          Connect a Solana wallet to stake, claim blocks, and earn yield on The
          Monolith.
        </Text>

        {/* Error display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Connect button with loading state */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            isLoading && styles.primaryButtonDisabled,
          ]}
          onPress={handleConnect}
          disabled={isLoading}
        >
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#0a0a0f" />
              <Text style={[styles.primaryText, styles.loadingText]}>
                Connecting...
              </Text>
            </View>
          ) : (
            <Text style={styles.primaryText}>Connect with MWA</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.hint}>
          On Seeker, this will use the Seed Vault for secure signing.
        </Text>

        {/* Wallet discovery hint */}
        <View style={styles.walletInfo}>
          <Text style={styles.walletInfoTitle}>Supported Wallets</Text>
          <Text style={styles.walletInfoText}>
            Seed Vault • Phantom • Solflare • Any MWA-compatible wallet
          </Text>
        </View>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={isLoading}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  content: {
    alignItems: "center",
  },
  icon: {
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 12,
    letterSpacing: 1,
  },
  subtitle: {
    color: "#888899",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  addressText: {
    color: "#00ffff",
    fontSize: 18,
    fontFamily: "monospace",
    fontWeight: "700",
    marginBottom: 12,
    letterSpacing: 2,
  },
  // Error styles
  errorContainer: {
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.3)",
    padding: 14,
    marginBottom: 20,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  errorIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  // Button styles
  primaryButton: {
    backgroundColor: "#00ffff",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryText: {
    color: "#0a0a0f",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  loadingText: {
    marginLeft: 10,
  },
  hint: {
    color: "#555566",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 20,
  },
  // Wallet info section
  walletInfo: {
    backgroundColor: "rgba(0, 255, 255, 0.05)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 255, 255, 0.15)",
    padding: 14,
    width: "100%",
    marginBottom: 24,
  },
  walletInfoTitle: {
    color: "#00ffff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  walletInfoText: {
    color: "#888899",
    fontSize: 13,
    lineHeight: 20,
  },
  cancelButton: {
    padding: 12,
  },
  cancelText: {
    color: "#666680",
    fontSize: 14,
  },
});
