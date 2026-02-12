import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import TowerScene from "@/components/tower/TowerScene";
import BlockInspector from "@/components/ui/BlockInspector";

const { width, height } = Dimensions.get("window");

/**
 * Main Tower screen — the heart of the app.
 * Full-screen 3D R3F canvas showing the tower.
 * Overlay HUD shows wallet status and key actions.
 */
export default function TowerScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* 3D Tower (full screen) */}
      <View style={styles.canvasContainer}>
        <TowerScene />
      </View>

      {/* HUD Overlay */}
      <View style={styles.hud} pointerEvents="box-none">
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.title}>THE MONOLITH</Text>
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => router.push("/connect")}
          >
            <Text style={styles.connectText}>Connect Wallet</Text>
          </TouchableOpacity>
        </View>

        {/* Stats bar */}
        <View style={styles.statsBar}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>Blocks</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>Staked</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>Online</Text>
          </View>
        </View>

        {/* Action Button hint */}
        <View style={styles.bottomHint}>
          <Text style={styles.hintText}>
            Tap a block to inspect • Pinch to zoom
          </Text>
        </View>
      </View>

      {/* Block Inspector panel */}
      <BlockInspector />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  canvasContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hud: {
    flex: 1,
    justifyContent: "space-between",
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#00ffff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 4,
    textShadowColor: "#00ffff",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  connectButton: {
    backgroundColor: "rgba(0, 255, 255, 0.15)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#00ffff",
  },
  connectText: {
    color: "#00ffff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
  },
  statsBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(13, 13, 21, 0.85)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1a1a2e",
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  statLabel: {
    color: "#666680",
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  bottomHint: {
    alignItems: "center",
  },
  hintText: {
    color: "#444466",
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
