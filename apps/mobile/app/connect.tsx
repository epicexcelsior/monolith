import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

/**
 * Wallet connect modal screen.
 * Uses MWA to connect to a Solana wallet app (Phantom, Solflare, etc.)
 * On Seeker, this will trigger the Seed Vault sign-in.
 */
export default function ConnectScreen() {
  const router = useRouter();

  const handleConnect = () => {
    // TODO: Implement MWA authorization
    // The useAuthorization hook will handle the actual MWA flow
    console.log("Connect wallet pressed — MWA flow TBD");
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>🔐</Text>
        <Text style={styles.title}>Connect Your Wallet</Text>
        <Text style={styles.subtitle}>
          Connect a Solana wallet to stake, claim blocks, and earn yield on The
          Monolith.
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={handleConnect}>
          <Text style={styles.primaryText}>Connect with MWA</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          On Seeker, this will use the Seed Vault for secure signing.
        </Text>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
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
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  primaryButton: {
    backgroundColor: "#00ffff",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  primaryText: {
    color: "#0a0a0f",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
  },
  hint: {
    color: "#555566",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 24,
  },
  cancelButton: {
    padding: 12,
  },
  cancelText: {
    color: "#666680",
    fontSize: 14,
  },
});
