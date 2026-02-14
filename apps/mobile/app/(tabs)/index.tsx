import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import TowerScene from "@/components/tower/TowerScene";
import BlockInspector from "@/components/ui/BlockInspector";
import LayerIndicator from "@/components/ui/LayerIndicator";
import OnboardingOverlay from "@/components/ui/OnboardingOverlay";
import { useWalletStore, useTruncatedAddress } from "@/stores/wallet-store";
import { useTowerStore } from "@/stores/tower-store";
import { useStaking, type TowerInfo, type UserDepositInfo } from "@/hooks/useStaking";
import { COLORS, SPACING, FONT_FAMILY, TEXT, RADIUS } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";

export default function TowerScreen() {
  const router = useRouter();
  const isConnected = useWalletStore((s) => s.isConnected);
  const truncatedAddress = useTruncatedAddress();
  const { fetchTowerState, fetchUserDeposit } = useStaking();

  const initTower = useTowerStore((s) => s.initTower);
  const startDecayLoop = useTowerStore((s) => s.startDecayLoop);
  const initialized = useTowerStore((s) => s.initialized);
  const onboardingDone = useTowerStore((s) => s.onboardingDone);

  const [towerInfo, setTowerInfo] = useState<TowerInfo | null>(null);
  const [userDeposit, setUserDeposit] = useState<UserDepositInfo | null>(null);

  // Initialize tower (load from storage or seed)
  useEffect(() => {
    initTower();
  }, [initTower]);

  // Start decay loop once tower is initialized
  useEffect(() => {
    if (!initialized) return;
    const cleanup = startDecayLoop();
    return cleanup;
  }, [initialized, startDecayLoop]);

  // Fetch on-chain tower stats + user deposit periodically
  const refreshStats = useCallback(async () => {
    const info = await fetchTowerState();
    if (info) setTowerInfo(info);
    const deposit = await fetchUserDeposit();
    if (deposit) setUserDeposit(deposit);
  }, [fetchTowerState, fetchUserDeposit]);

  useEffect(() => {
    refreshStats();
    const interval = setInterval(refreshStats, 15_000);
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
            onPress={() => {
              hapticButtonPress();
              router.push("/connect");
            }}
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
              {towerInfo
                ? `$${towerInfo.totalDeposited.toFixed(2)}`
                : "\u2014"}
            </Text>
            <Text style={styles.statLabel}>TVL</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {towerInfo ? towerInfo.totalUsers.toString() : "\u2014"}
            </Text>
            <Text style={styles.statLabel}>Users</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: COLORS.success }]}>
              {userDeposit
                ? `$${userDeposit.amount.toFixed(2)}`
                : isConnected
                  ? "$0.00"
                  : "\u2014"}
            </Text>
            <Text style={styles.statLabel}>My Vault</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: isConnected ? COLORS.success : COLORS.textMuted }]}>
              {isConnected ? "\u25CF" : "\u25CB"}
            </Text>
            <Text style={styles.statLabel}>
              {isConnected ? "Live" : "Offline"}
            </Text>
          </View>
        </View>

        {/* Bottom hint */}
        <View style={styles.bottomArea}>
          <Text style={styles.hintText}>
            Drag to orbit {"\u2022"} Pinch to zoom {"\u2022"} Double-tap to reset
          </Text>
        </View>
      </View>

      {/* Layer Indicator */}
      <LayerIndicator />

      {/* Block Inspector panel */}
      <BlockInspector />

      {/* Onboarding overlay (first launch only) */}
      {initialized && !onboardingDone && <OnboardingOverlay />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgTower,
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
    paddingHorizontal: SPACING.md,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: COLORS.goldLight,
    fontFamily: FONT_FAMILY.headingBlack,
    fontSize: 18,
    letterSpacing: 4,
    textShadowColor: COLORS.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  connectButton: {
    backgroundColor: "rgba(200, 153, 62, 0.15)",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  connectedButton: {
    backgroundColor: "rgba(46, 139, 87, 0.15)",
    borderColor: COLORS.success,
  },
  connectText: {
    color: COLORS.gold,
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 13,
    letterSpacing: 1,
  },
  connectedText: {
    color: COLORS.success,
    fontFamily: FONT_FAMILY.mono,
  },
  statsBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: COLORS.bgOverlay,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    color: COLORS.textOnDark,
    fontFamily: FONT_FAMILY.mono,
    fontSize: 16,
  },
  statLabel: {
    ...TEXT.overline,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  bottomArea: {
    alignItems: "center",
  },
  hintText: {
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
