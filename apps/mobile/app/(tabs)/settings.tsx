import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";

/**
 * Settings screen — wallet info, network config, and app preferences.
 */
export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* Wallet Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>WALLET</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Status</Text>
          <Text style={styles.cardValue}>Not Connected</Text>
        </View>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Connect Wallet</Text>
        </TouchableOpacity>
      </View>

      {/* Network Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NETWORK</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Network</Text>
          <Text style={styles.cardValueCyan}>Devnet</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>RPC</Text>
          <Text style={styles.cardValueMono}>api.devnet.solana.com</Text>
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
  button: {
    backgroundColor: "rgba(0, 255, 255, 0.1)",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#00ffff",
    marginTop: 8,
  },
  buttonText: {
    color: "#00ffff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1,
  },
});
