import { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import TowerScene from "@/components/tower/TowerScene";
import BlockInspector from "@/components/ui/BlockInspector";
import LayerIndicator from "@/components/ui/LayerIndicator";
import { OnboardingFlow } from "@/components/onboarding";
import ActionPrompt from "@/components/ui/ActionPrompt";
import TowerStats from "@/components/ui/TowerStats";
import FloatingPoints from "@/components/ui/FloatingPoints";
import LevelUpCelebration from "@/components/ui/LevelUpCelebration";
import ActivityTicker from "@/components/ui/ActivityTicker";
import ConnectionBanner from "@/components/ui/ConnectionBanner";
import ScreenFlash from "@/components/ui/ScreenFlash";
import { useWalletStore, useTruncatedAddress } from "@/stores/wallet-store";
import { useTowerStore } from "@/stores/tower-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useMultiplayerStore, onPlayerSync } from "@/stores/multiplayer-store";
import { usePlayerStore } from "@/stores/player-store";
import { COLORS, SPACING, FONT_FAMILY, RADIUS, GLASS_STYLE } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { initAudio, playButtonTap } from "@/utils/audio";

export default function TowerScreen() {
  const router = useRouter();
  const isConnected = useWalletStore((s) => s.isConnected);
  const truncatedAddress = useTruncatedAddress();

  const initTower = useTowerStore((s) => s.initTower);
  const startDecayLoop = useTowerStore((s) => s.startDecayLoop);
  const startBotSimulation = useTowerStore((s) => s.startBotSimulation);
  const setMultiplayerMode = useTowerStore((s) => s.setMultiplayerMode);
  const resetOnboardingFlag = useTowerStore((s) => s.resetOnboardingFlag);
  const initialized = useTowerStore((s) => s.initialized);
  const onboardingDone = useTowerStore((s) => s.onboardingDone);
  const selectedBlockId = useTowerStore((s) => s.selectedBlockId);
  const cinematicMode = useTowerStore((s) => s.cinematicMode);

  // Animated value for cinematic UI hide — slides down + fades on enter, reverses on exit
  const cinematicAnim = useRef(new Animated.Value(0)).current; // 0 = visible, 1 = hidden

  const multiplayerConnected = useMultiplayerStore((s) => s.connected);

  // Onboarding state
  const onboardingPhase = useOnboardingStore((s) => s.phase);
  const initOnboarding = useOnboardingStore((s) => s.init);
  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);
  const isOnboarding = onboardingPhase !== "done";

  // Register player sync handler
  useEffect(() => {
    onPlayerSync((data) => {
      usePlayerStore.getState().setFromServer(data);
    });
  }, []);

  // Initialize tower: try multiplayer, fall back to local
  useEffect(() => {
    const init = async () => {
      const mpConnect = useMultiplayerStore.getState().connect;
      setMultiplayerMode(true);
      const ok = await mpConnect();
      if (!ok) {
        console.log("[Tower] Multiplayer unavailable, using local mode");
        setMultiplayerMode(false);
      }
      // Audio must be ready before tower UI — user can claim block during onboarding
      await initAudio();
      await initTower();
      await initOnboarding();
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate UI hide/show during cinematic mode (claim celebration)
  useEffect(() => {
    Animated.spring(cinematicAnim, {
      toValue: cinematicMode ? 1 : 0,
      tension: cinematicMode ? 80 : 40,
      friction: cinematicMode ? 8 : 7,
      useNativeDriver: true,
    }).start();
  }, [cinematicMode, cinematicAnim]);

  // Start decay loop + bot simulation only when NOT in multiplayer
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
      <StatusBar style="light" />
      <ScreenFlash />

      {/* 3D Tower (full screen) */}
      <View style={styles.canvasContainer}>
        {initialized ? (
          <TowerScene />
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.gold} />
            <Text style={styles.loadingText}>Loading tower...</Text>
          </View>
        )}
      </View>

      {/* ── Cinematic overlay: all UI slides away during claim celebration ── */}
      <Animated.View
        pointerEvents={cinematicMode ? "none" : "box-none"}
        style={[
          styles.cinematicWrapper,
          {
            opacity: cinematicAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [{
              translateY: cinematicAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }),
            }],
          },
        ]}
      >
        {/* Activity ticker — visible during onboarding title phase for social proof */}
        {(onboardingPhase === "title" || !isOnboarding) && !selectedBlockId && (
          <View style={styles.tickerOverlay} pointerEvents="none">
            <ActivityTicker />
          </View>
        )}

        {/* HUD Overlay — hidden during onboarding for cleaner experience */}
        {!isOnboarding && (
          <View testID="tower-hud" style={styles.hud} pointerEvents="box-none">
            {/* Top bar */}
            <View style={styles.topBar}>
              <TouchableOpacity
                onLongPress={() => {
                  hapticButtonPress();
                  playButtonTap();
                  resetOnboarding();
                  resetOnboardingFlag();
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
                  playButtonTap();
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

            {/* Connection status */}
            <ConnectionBanner />

            {/* Tower stats bar */}
            {initialized && <TowerStats />}

            {/* Activity ticker (hidden during block inspect, already shown via overlay during onboarding) */}
            {!selectedBlockId && <ActivityTicker />}

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

        {/* Floating XP points animation */}
        <FloatingPoints />

        {/* Level up celebration */}
        <LevelUpCelebration />

        {/* Block Inspector — inside cinematicWrapper so it positions against full screen */}
        <BlockInspector />

        {/* Onboarding — inside wrapper so it hides during claim celebration */}
        {initialized && isOnboarding && <OnboardingFlow />}
      </Animated.View>
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
  cinematicWrapper: {
    // Full-screen wrapper that animates away during claim celebration
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: SPACING.md,
  },
  loadingText: {
    color: COLORS.textOnDark,
    fontFamily: FONT_FAMILY.bodyMedium,
    fontSize: 14,
    opacity: 0.6,
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
  tickerOverlay: {
    position: "absolute",
    top: SPACING.xxl * 2,
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 50,
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
