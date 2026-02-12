import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthorization } from "@/hooks/useAuthorization";
import { useWalletStore, useTruncatedAddress } from "@/stores/wallet-store";
import { getClusterName } from "@/services/mwa";
import { getRpcUrl } from "@/services/solana";

/**
 * Settings screen — wallet info, network config, and app preferences.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { disconnect } = useAuthorization();
  const isConnected = useWalletStore((s) => s.isConnected);
  const isLoading = useWalletStore((s) => s.isLoading);
  const truncatedAddress = useTruncatedAddress();
  const cluster = getClusterName();
  const rpcUrl = getRpcUrl();

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect Wallet",
      "Are you sure you want to disconnect your wallet?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              await disconnect();
            } catch (err) {
              console.error("Disconnect failed:", err);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* Wallet Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>WALLET</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Status</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                isConnected
                  ? styles.statusDotConnected
                  : styles.statusDotDisconnected,
              ]}
            />
            <Text
              style={[
                styles.cardValue,
                isConnected ? styles.cardValueCyan : undefined,
              ]}
            >
              {isConnected ? "Connected" : "Not Connected"}
            </Text>
          </View>
        </View>

        {isConnected && truncatedAddress && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Address</Text>
            <Text style={styles.cardValueMono}>{truncatedAddress}</Text>
          </View>
        )}

        {isConnected ? (
          <TouchableOpacity
            style={styles.disconnectButton}
            onPress={handleDisconnect}
            disabled={isLoading}
          >
            <Text style={styles.disconnectButtonText}>
              {isLoading ? "Disconnecting..." : "Disconnect Wallet"}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => router.push("/connect")}
          >
            <Text style={styles.connectButtonText}>Connect Wallet</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Network Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NETWORK</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Cluster</Text>
          <Text style={styles.cardValueCyan}>
            {cluster.charAt(0).toUpperCase() + cluster.slice(1)}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>RPC</Text>
          <Text style={styles.cardValueMono} numberOfLines={1}>
            {rpcUrl.replace("https://", "")}
          </Text>
        </View>
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ABOUT</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Version</Text>
          <Text style={styles.cardValue}>1.0.0</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Build</Text>
          <Text style={styles.cardValue}>Hackathon MVP</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: "#666680",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#0d0d15",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1a1a2e",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardLabel: {
    color: "#999999",
    fontSize: 14,
  },
  cardValue: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  cardValueCyan: {
    color: "#00ffff",
    fontSize: 14,
    fontWeight: "600",
  },
  cardValueMono: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "monospace",
  },
  // Status indicator
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusDotConnected: {
    backgroundColor: "#00ff88",
    shadowColor: "#00ff88",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  statusDotDisconnected: {
    backgroundColor: "#555566",
  },
  // Buttons
  connectButton: {
    backgroundColor: "rgba(0, 255, 255, 0.1)",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#00ffff",
    marginTop: 8,
  },
  connectButtonText: {
    color: "#00ffff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1,
  },
  disconnectButton: {
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.4)",
    marginTop: 8,
  },
  disconnectButtonText: {
    color: "#ff6b6b",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1,
  },
});
