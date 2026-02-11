import { View, Text, StyleSheet, ScrollView } from "react-native";

/**
 * My Blocks screen — shows the user's block portfolio.
 * Lists all blocks they own with energy status, stake amounts, etc.
 */
export default function BlocksScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Blocks</Text>
      <Text style={styles.subtitle}>
        Connect your wallet to see your portfolio
      </Text>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        {/* Placeholder — will be populated when wallet is connected */}
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💎</Text>
          <Text style={styles.emptyTitle}>No Blocks Yet</Text>
          <Text style={styles.emptyText}>
            Stake USDC on the Tower tab to claim your first block and start
            earning.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 1,
  },
  subtitle: {
    color: "#666680",
    fontSize: 14,
    marginTop: 4,
  },
  list: {
    flex: 1,
    marginTop: 24,
  },
  listContent: {
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: "center",
    marginTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyText: {
    color: "#666680",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
});
