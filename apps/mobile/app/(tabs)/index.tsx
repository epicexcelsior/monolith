import { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Animated,
} from "react-native";
import Reanimated, { FadeIn } from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import TowerScene from "@/components/tower/TowerScene";
import BlockInspector from "@/components/ui/BlockInspector";
import LayerIndicator from "@/components/ui/LayerIndicator";
import { OnboardingFlow } from "@/components/onboarding";
import ActionPrompt from "@/components/ui/ActionPrompt";
import FloatingPoints from "@/components/ui/FloatingPoints";
import LevelUpCelebration from "@/components/ui/LevelUpCelebration";
import ConnectionBanner from "@/components/ui/ConnectionBanner";
import ScreenFlash from "@/components/ui/ScreenFlash";
import HotBlockTicker from "@/components/ui/HotBlockTicker";
import AchievementToast from "@/components/ui/AchievementToast";
import LoadingScreen from "@/components/ui/LoadingScreen";
import FloatingNav from "@/components/ui/FloatingNav";
import MyBlockFAB from "@/components/ui/MyBlockFAB";
import MyBlocksPanel from "@/components/ui/MyBlocksPanel";
import BoardSheet from "@/components/ui/BoardSheet";
import SettingsSheet from "@/components/ui/SettingsSheet";
import TopHUD from "@/components/ui/TopHUD";
import WalletConnectSheet from "@/components/ui/WalletConnectSheet";
import { useTowerStore } from "@/stores/tower-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useMultiplayerStore, onPlayerSync } from "@/stores/multiplayer-store";
import { usePlayerStore } from "@/stores/player-store";
import { useWalletStore } from "@/stores/wallet-store";
import { COLORS } from "@/constants/theme";

export default function TowerScreen() {
  const initTower = useTowerStore((s) => s.initTower);
  const startDecayLoop = useTowerStore((s) => s.startDecayLoop);
  const startBotSimulation = useTowerStore((s) => s.startBotSimulation);
  const setMultiplayerMode = useTowerStore((s) => s.setMultiplayerMode);
  const resetOnboardingFlag = useTowerStore((s) => s.resetOnboardingFlag);
  const initialized = useTowerStore((s) => s.initialized);
  const onboardingDone = useTowerStore((s) => s.onboardingDone);
  const cinematicMode = useTowerStore((s) => s.cinematicMode);
  const revealComplete = useTowerStore((s) => s.revealComplete);
  const selectedBlockId = useTowerStore((s) => s.selectedBlockId);
  const selectBlock = useTowerStore((s) => s.selectBlock);
  const [activeNav, setActiveNav] = useState<"tower" | "board" | "me">("tower");
  const [showBoard, setShowBoard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMyBlocks, setShowMyBlocks] = useState(false);
  const showWalletConnect = useWalletStore((s) => s.showConnectSheet);

  // FloatingNav hides when any overlay/sheet is open — single derived boolean
  const anyOverlayOpen = !!selectedBlockId || showBoard || showSettings || showWalletConnect || showMyBlocks;

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

  // Handle floating nav tab press
  const handleNavTab = (tab: "tower" | "board" | "me") => {
    setActiveNav(tab);
    if (tab === "tower") {
      setShowBoard(false);
      setShowSettings(false);
      // Deselect block + reset camera handled naturally
      if (selectedBlockId) selectBlock(null);
    } else if (tab === "board") {
      setShowBoard(true);
      setShowSettings(false);
    } else if (tab === "me") {
      setShowSettings(true);
      setShowBoard(false);
    }
  };

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
        <TowerScene />
        <LoadingScreen visible={!initialized} />
      </View>

      {/* ── HUD: hidden until tower reveal completes, then fades in ── */}
      {revealComplete && (
      <Reanimated.View entering={FadeIn.duration(600)} style={styles.cinematicWrapper} pointerEvents="box-none">
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
        {/* HUD Overlay — hidden during onboarding for cleaner experience */}
        {!isOnboarding && (
          <View testID="tower-hud" style={styles.hud} pointerEvents="box-none">
            {/* Minimal top bar */}
            <TopHUD onReplayOnboarding={() => { resetOnboarding(); resetOnboardingFlag(); }} />

            {/* Connection status */}
            <ConnectionBanner />
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

        {/* Block Inspector — hidden during onboarding (OnboardingFlow handles its own UI) */}
        {!isOnboarding && <BlockInspector />}

        {/* Onboarding — inside wrapper so it hides during claim celebration */}
        {initialized && isOnboarding && <OnboardingFlow />}

        {/* Hot block ticker — bottom-right, notable blocks needing attention */}
        {initialized && !isOnboarding && <HotBlockTicker />}

        {/* Achievement toast — slides in from top, auto-dismisses */}
        <AchievementToast />
      </Animated.View>
      </Reanimated.View>
      )}

      {/* Floating Nav Pills — always above tower, replaces tab bar */}
      <FloatingNav
        activeTab={activeNav}
        onTabPress={handleNavTab}
        visible={revealComplete && !isOnboarding && !cinematicMode && !anyOverlayOpen}
      />

      {/* My Blocks FAB — quick access to owned blocks */}
      <MyBlockFAB
        visible={revealComplete && !isOnboarding && !cinematicMode && !anyOverlayOpen}
        onOpenPanel={() => setShowMyBlocks(true)}
      />

      {/* My Blocks panel — opened by FAB for multi-block owners */}
      <MyBlocksPanel
        visible={showMyBlocks}
        onClose={() => setShowMyBlocks(false)}
      />

      {/* Board sheet — opens over tower */}
      <BoardSheet
        visible={showBoard}
        onClose={() => { setShowBoard(false); setActiveNav("tower"); }}
      />

      {/* Settings sheet — opens over tower */}
      <SettingsSheet
        visible={showSettings}
        onClose={() => { setShowSettings(false); setActiveNav("tower"); }}
      />

      {/* Wallet connect sheet */}
      <WalletConnectSheet />

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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hud: {
    pointerEvents: "box-none",
  },
});
