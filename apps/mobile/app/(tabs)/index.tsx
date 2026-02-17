import { useEffect } from "react";
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
import { OnboardingFlow } from "@/components/onboarding";
import ActionPrompt from "@/components/ui/ActionPrompt";
import TowerStats from "@/components/ui/TowerStats";
import { useWalletStore, useTruncatedAddress } from "@/stores/wallet-store";
import { useTowerStore } from "@/stores/tower-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useMultiplayer } from "@/hooks/useMultiplayer";
import { COLORS, SPACING, FONT_FAMILY, RADIUS } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { initAudio } from "@/utils/audio";

export default function TowerScreen() {
  const router = useRouter();
  const isConnected = useWalletStore((s) => s.isConnected);
  const truncatedAddress = useTruncatedAddress();

  const initTower = useTowerStore((s) => s.initTower);
  const startDecayLoop = useTowerStore((s) => s.startDecayLoop);
  const startBotSimulation = useTowerStore((s) => s.startBotSimulation);
  const setMultiplayerMode = useTowerStore((s) => s.setMultiplayerMode);
  const initialized = useTowerStore((s) => s.initialized);
  const onboardingDone = useTowerStore((s) => s.onboardingDone);

  const { connect: connectMultiplayer, connected: multiplayerConnected } = useMultiplayer();

  // Onboarding state
  const onboardingPhase = useOnboardingStore((s) => s.phase);
  const initOnboarding = useOnboardingStore((s) => s.init);
  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);
  const isOnboarding = onboardingPhase !== "done";

  // Initialize tower: try multiplayer first, fall back to local
  useEffect(() => {
    const init = async () => {
      try {
        setMultiplayerMode(true);
        await connectMultiplayer();
        // Server provides state; just mark initialized
        initTower();
      } catch {
        // Server unavailable — fall back to local mode
        console.log("[Tower] Multiplayer unavailable, using local mode");
        setMultiplayerMode(false);
        initTower();
      }
      initOnboarding();
      initAudio();
    };
    init();
  }, [initTower, initOnboarding, connectMultiplayer, setMultiplayerMode]);

  // Start decay loop + bot simulation only when NOT in multiplayer (server handles these)
  useEffect(() => {
    if (!initialized || multiplayerConnected) return;
    const cleanupDecay = startDecayLoop();
    const cleanupBots = startBotSimulation();
    return () => {
      cleanupDecay();
      cleanupBots();
    };
  }, [initialized, multiplayerConnected, startDecayLoop, startBotSimulation]);

  return (
    <View style={styles.container}>
      {/* 3D Tower (full screen) */}
      <View style={styles.canvasContainer}>
        <TowerScene />
      </View>

      {/* HUD Overlay — hidden during onboarding for cleaner experience */}
      {!isOnboarding && (
        <View style={styles.hud} pointerEvents="box-none">
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onLongPress={() => {
                hapticButtonPress();
                resetOnboarding();
              }}
              delayLongPress={800}
              activeOpacity={0.7}
            >
              <Text style={styles.title}>THE MONOLITH</Text>
            </TouchableOpacity>
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

          {/* Tower stats bar */}
          {initialized && <TowerStats />}

          {/* Spacer to push bottom content down */}
          <View style={{ flex: 1 }} />

          {/* Bottom hint */}
          <View style={styles.bottomArea}>
            <Text style={styles.hintText}>
              Drag to orbit {"\u2022"} Pinch to zoom {"\u2022"} Tap a block to inspect
            </Text>
          </View>
        </View>
      )}

      {/* Layer Indicator */}
      <LayerIndicator />

      {/* Contextual action prompt */}
      {initialized && onboardingDone && !isOnboarding && <ActionPrompt />}

      {/* Block Inspector panel */}
      <BlockInspector />

      {/* Interactive onboarding flow (first launch only) */}
      {initialized && isOnboarding && <OnboardingFlow />}
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
    backgroundColor: COLORS.goldSubtle,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  connectedButton: {
    backgroundColor: "rgba(46, 139, 87, 0.12)",
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
