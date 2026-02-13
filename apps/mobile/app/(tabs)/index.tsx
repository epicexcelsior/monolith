import { useEffect, useState, useCallback } from "react";
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
import LayerIndicator from "@/components/ui/LayerIndicator";
import { useWalletStore, useTruncatedAddress } from "@/stores/wallet-store";
import { useStaking, type TowerInfo } from "@/hooks/useStaking";

const { width, height } = Dimensions.get("window");

/**
 * Main Tower screen — the heart of the app.
 * Full-screen 3D R3F canvas showing the tower.
 * Overlay HUD shows wallet status, on-chain stats, and key actions.
 */
export default function TowerScreen() {
  const router = useRouter();
  const isConnected = useWalletStore((s) => s.isConnected);
  const truncatedAddress = useTruncatedAddress();
  const { fetchTowerState } = useStaking();

  const [towerInfo, setTowerInfo] = useState<TowerInfo | null>(null);

  // Fetch on-chain tower stats on mount and periodically
  const refreshStats = useCallback(async () => {
    const info = await fetchTowerState();
    if (info) setTowerInfo(info);
  }, [fetchTowerState]);

  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, 15_000); // refresh every 15s
    return () => clearInterval(interval);
  }, [refreshStats]);

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
            style={[
              styles.connectButton,
              isConnected && styles.connectedButton,
            ]}
            onPress={() => router.push("/connect")}
          >
            <Text
              style={[
                styles.connectText,
                isConnected && styles.connectedText,
              ]}
            >
              {isConnected && truncatedAddress
                ? truncatedAddress
                : "Connect Wallet"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats bar — live on-chain data */}
        <View style={styles.statsBar}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {towerInfo ? towerInfo.totalBlocksClaimed.toString() : "—"}
            </Text>
            <Text style={styles.statLabel}>Blocks</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {towerInfo ? `$${towerInfo.totalStaked.toFixed(2)}` : "—"}
            </Text>
            <Text style={styles.statLabel}>Staked</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, styles.liveIndicator]}>
              {isConnected ? "●" : "○"}
            </Text>
            <Text style={styles.statLabel}>
              {isConnected ? "Live" : "Offline"}
            </Text>
          </View>
        </View>

        {/* Bottom action area */}
        <View style={styles.bottomArea}>
          {isConnected ? (
            <TouchableOpacity
              style={styles.stakeButton}
              onPress={() =>
                router.push({
                  pathname: "/deposit" as any,
                  params: {
                    blockId: "0",
                    posX: "0",
                    posY: "0",
                    posZ: "0",
                  },
                })
              }
            >
              <Text style={styles.stakeButtonText}>Stake USDC</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.hintText}>
              Drag to orbit • Pinch to zoom • Double-tap to reset
            </Text>
          )}
        </View>
      </View>

      {/* Layer Indicator */}
      <LayerIndicator />

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
  connectedButton: {
    backgroundColor: "rgba(0, 255, 100, 0.15)",
    borderColor: "#00ff64",
  },
  connectText: {
    color: "#00ffff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
  },
  connectedText: {
    color: "#00ff64",
    fontFamily: "monospace",
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
  liveIndicator: {
    color: "#00ff64",
  },
  bottomArea: {
    alignItems: "center",
  },
  stakeButton: {
    backgroundColor: "#00ffff",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  stakeButtonText: {
    color: "#0a0a0f",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
  },
  hintText: {
    color: "#444466",
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
