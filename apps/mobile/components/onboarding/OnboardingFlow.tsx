import React, { useEffect, useRef, useCallback, useState } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Animated,
    TouchableOpacity,
    ScrollView,
} from "react-native";
import { useOnboardingStore, getRandomSparkName } from "@/stores/onboarding-store";
import { useTowerStore } from "@/stores/tower-store";
import { useWalletStore } from "@/stores/wallet-store";
import { usePlayerStore } from "@/stores/player-store";
import TitleReveal from "./TitleReveal";
import { BLOCK_COLORS, BLOCK_ICONS } from "@monolith/common";
import { COLORS, SPACING, RADIUS, TEXT, TIMING, FONT_FAMILY } from "@/constants/theme";
import { hapticButtonPress, hapticChargeTap } from "@/utils/haptics";
import { playCustomize, playButtonTap, playChargeTap } from "@/utils/audio";
import { useClaimCelebration } from "@/hooks/useClaimCelebration";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "@/components/ui/Button";
import StepCard from "@/components/ui/StepCard";
import CameraTutorial from "./CameraTutorial";

const ONBOARDING_COLORS = BLOCK_COLORS.slice(0, 8);
const ONBOARDING_ICONS = BLOCK_ICONS.slice(0, 16);
const ONBOARDING_PERSONALITIES = [
    { name: "Happy", kaomoji: "^_^" },
    { name: "Cool", kaomoji: "B-)" },
    { name: "Sleepy", kaomoji: "-_-" },
    { name: "Fierce", kaomoji: ">_<" },
    { name: "Derp", kaomoji: ":P" },
] as const;

function pickTutorialBlock(
    demoBlocks: { id: string; owner: string | null; layer: number }[],
): string | null {
    const unclaimed = demoBlocks.filter((b) => b.owner === null);
    if (unclaimed.length === 0) return null;
    const sorted = [...unclaimed].sort(
        (a, b) => Math.abs(a.layer - 8) - Math.abs(b.layer - 8),
    );
    return sorted[0].id;
}

const STEP_MAP: Record<string, number> = {
    claim: 1, celebration: 1,
    customize: 2,
    charge: 3,
    wallet: 4,
};
const TOTAL_STEPS = 4;

export default function OnboardingFlow() {
    const insets = useSafeAreaInsets();
    const phase = useOnboardingStore((s) => s.phase);
    const advancePhase = useOnboardingStore((s) => s.advancePhase);
    const ghostBlockId = useOnboardingStore((s) => s.ghostBlockId);
    const setGhostBlock = useOnboardingStore((s) => s.setGhostBlock);
    const setSparkName = useOnboardingStore((s) => s.setSparkName);
    const skipOnboarding = useOnboardingStore((s) => s.skipOnboarding);

    const demoBlocks = useTowerStore((s) => s.demoBlocks);
    const ghostClaimBlock = useTowerStore((s) => s.ghostClaimBlock);
    const ghostCustomizeBlock = useTowerStore((s) => s.ghostCustomizeBlock);
    const ghostChargeBlock = useTowerStore((s) => s.ghostChargeBlock);
    const clearGhostBlock = useTowerStore((s) => s.clearGhostBlock);
    const selectBlock = useTowerStore((s) => s.selectBlock);
    const completeOnboarding = useTowerStore((s) => s.completeOnboarding);
    const getDemoBlockById = useTowerStore((s) => s.getDemoBlockById);
    const setRecentlyChargedId = useTowerStore((s) => s.setRecentlyChargedId);
    const revealComplete = useTowerStore((s) => s.revealComplete);
    const setShowConnectSheet = useWalletStore((s) => s.setShowConnectSheet);
    const addPoints = usePlayerStore((s) => s.addPoints);
    const { triggerCelebration } = useClaimCelebration();

    const [nameInput, setNameInput] = useState("");
    const [cameraTutorialDone, setCameraTutorialDone] = useState(false);
    const [chargeAnimating, setChargeAnimating] = useState(false);
    const chargeBarWidth = useRef(new Animated.Value(0)).current;
    const claimFade = useRef(new Animated.Value(0)).current;
    const claimScale = useRef(new Animated.Value(0.8)).current;
    const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (phase !== "claim") return;
        claimFade.setValue(0);
        claimScale.setValue(0.8);
        Animated.parallel([
            Animated.timing(claimFade, { toValue: 1, duration: 400, delay: 800, useNativeDriver: true }),
            Animated.spring(claimScale, { toValue: 1, ...TIMING.springOnboarding, delay: 800, useNativeDriver: true }),
        ]).start();
    }, [phase, claimFade, claimScale]);

    useEffect(() => {
        if (phase !== "celebration") return;
        celebrationTimer.current = setTimeout(() => {
            if (ghostBlockId) selectBlock(ghostBlockId);
            advancePhase();
        }, 3500);
        return () => { if (celebrationTimer.current) clearTimeout(celebrationTimer.current); };
    }, [phase, advancePhase, ghostBlockId, selectBlock]);

    const handleGetStarted = useCallback(() => {
        const blockId = pickTutorialBlock(demoBlocks);
        if (blockId) { setGhostBlock(blockId); selectBlock(blockId); advancePhase(); }
        else { skipOnboarding(); }
    }, [demoBlocks, setGhostBlock, selectBlock, advancePhase, skipOnboarding]);

    const handleClaim = useCallback(() => {
        if (!ghostBlockId) return;
        hapticButtonPress();
        ghostClaimBlock(ghostBlockId);
        const block = getDemoBlockById(ghostBlockId);
        if (block) triggerCelebration(block.position, -1, true, ghostBlockId);
        advancePhase();
    }, [ghostBlockId, ghostClaimBlock, advancePhase, getDemoBlockById, triggerCelebration]);

    const handleColorPick = useCallback((color: string) => {
        if (!ghostBlockId) return;
        ghostCustomizeBlock(ghostBlockId, { color }); hapticButtonPress(); playCustomize();
    }, [ghostBlockId, ghostCustomizeBlock]);

    const handleEmojiPick = useCallback((emoji: string) => {
        if (!ghostBlockId) return;
        ghostCustomizeBlock(ghostBlockId, { emoji }); hapticButtonPress(); playCustomize();
    }, [ghostBlockId, ghostCustomizeBlock]);

    const handlePersonalityPick = useCallback((personality: number) => {
        if (!ghostBlockId) return;
        ghostCustomizeBlock(ghostBlockId, { personality }); hapticButtonPress(); playCustomize();
    }, [ghostBlockId, ghostCustomizeBlock]);

    const handleCustomizeDone = useCallback(() => {
        hapticButtonPress(); playButtonTap();
        const finalName = nameInput.trim() || getRandomSparkName();
        setSparkName(finalName);
        if (ghostBlockId) ghostCustomizeBlock(ghostBlockId, { name: finalName });
        advancePhase();
    }, [advancePhase, nameInput, setSparkName, ghostBlockId, ghostCustomizeBlock]);

    const handleCharge = useCallback(() => {
        if (!ghostBlockId) return;
        hapticChargeTap(); playChargeTap();
        ghostChargeBlock(ghostBlockId); setRecentlyChargedId(ghostBlockId);
        addPoints({ pointsEarned: 25, chargeAmount: 1 });
        setChargeAnimating(true);
        chargeBarWidth.setValue(0);
        Animated.timing(chargeBarWidth, { toValue: 1, duration: 600, useNativeDriver: false }).start();
        setTimeout(() => { advancePhase(); }, 1200);
    }, [ghostBlockId, ghostChargeBlock, setRecentlyChargedId, addPoints, advancePhase, chargeBarWidth]);

    const handleConnectWallet = useCallback(() => {
        hapticButtonPress(); playButtonTap();
        setShowConnectSheet(true); completeOnboarding(); skipOnboarding();
    }, [setShowConnectSheet, completeOnboarding, skipOnboarding]);

    const handlePlayDemo = useCallback(() => {
        hapticButtonPress(); playButtonTap(); completeOnboarding(); skipOnboarding();
    }, [completeOnboarding, skipOnboarding]);

    const handleSkip = useCallback(() => {
        hapticButtonPress(); playButtonTap();
        if (typeof clearGhostBlock === 'function') clearGhostBlock();
        completeOnboarding(); skipOnboarding();
    }, [clearGhostBlock, completeOnboarding, skipOnboarding]);

    if (phase === "done") return null;

    const ghostBlock = ghostBlockId ? getDemoBlockById(ghostBlockId) : null;
    const currentStep = STEP_MAP[phase];

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {(cameraTutorialDone || phase !== "intro") && (
                <View style={[styles.skipContainer, { top: insets.top + SPACING.xs }]}>
                    <Button title="Skip" variant="ghost" size="sm" onPress={handleSkip} />
                </View>
            )}

            {phase === "intro" && (
                <>
                    {!cameraTutorialDone && <CameraTutorial onComplete={() => setCameraTutorialDone(true)} />}
                    {cameraTutorialDone && <TitleReveal visible={revealComplete} onComplete={handleGetStarted} />}
                </>
            )}

            {phase === "claim" && (
                <Animated.View style={[styles.claimContainer, { bottom: Math.max(insets.bottom, 12) + SPACING.xxl, opacity: claimFade, transform: [{ scale: claimScale }] }]}>
                    <Text style={styles.claimSubtitle}>Choose a Spark to care for</Text>
                    <Button title="WAKE UP THIS SPARK" variant="primary" size="lg" onPress={handleClaim} />
                    {ghostBlock && <Text style={styles.claimBlockInfo}>Layer {ghostBlock.layer}</Text>}
                </Animated.View>
            )}

            {phase === "customize" && (
                <View style={[styles.stepCardContainer, { bottom: Math.max(insets.bottom, 12) + SPACING.md }]}>
                    <StepCard title="Name your Spark" subtitle="Make it yours" step={currentStep} totalSteps={TOTAL_STEPS}>
                        <View style={styles.nameRow}>
                            <TextInput style={styles.nameInput} value={nameInput} onChangeText={setNameInput}
                                placeholder="e.g., Luna, Blaze, Pixel" placeholderTextColor={COLORS.textMuted}
                                maxLength={16} autoCorrect={false} />
                            <TouchableOpacity style={styles.surpriseButton} onPress={() => { hapticButtonPress(); setNameInput(getRandomSparkName()); }} activeOpacity={0.7}>
                                <Text style={styles.surpriseText}>🎲</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.sectionHeader}>COLOR</Text>
                        <View style={styles.colorRow}>
                            {ONBOARDING_COLORS.map((color) => (
                                <TouchableOpacity key={color} style={[styles.colorSwatch, { backgroundColor: color }, ghostBlock?.ownerColor === color && styles.swatchSelected]}
                                    onPress={() => handleColorPick(color)} activeOpacity={0.7} />
                            ))}
                        </View>

                        <Text style={styles.sectionHeader}>FACE</Text>
                        <View style={styles.personalityRow}>
                            {ONBOARDING_PERSONALITIES.map((p, i) => (
                                <TouchableOpacity key={p.name} style={[styles.personalitySwatch, ghostBlock?.personality === i && styles.swatchSelected]}
                                    onPress={() => handlePersonalityPick(i)} activeOpacity={0.7}>
                                    <Text style={styles.personalityKaomoji}>{p.kaomoji}</Text>
                                    <Text style={styles.personalityLabel}>{p.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.sectionHeader}>EMOJI</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiRow}>
                            {ONBOARDING_ICONS.map((emoji) => (
                                <TouchableOpacity key={emoji} style={[styles.emojiSwatch, ghostBlock?.emoji === emoji && styles.swatchSelected]}
                                    onPress={() => handleEmojiPick(emoji)} activeOpacity={0.7}>
                                    <Text style={styles.emojiText}>{emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={styles.buttonRow}>
                            <Button title="LOOKS GOOD →" variant="primary" size="md" onPress={handleCustomizeDone} />
                        </View>
                    </StepCard>
                </View>
            )}

            {phase === "charge" && (
                <View style={[styles.stepCardContainer, { bottom: Math.max(insets.bottom, 12) + SPACING.md }]}>
                    <StepCard title="Charge your Spark!" step={currentStep} totalSteps={TOTAL_STEPS}>
                        <Text style={styles.chargeWarning}>Your Spark needs energy! Miss 3 days and it fades away.</Text>
                        <View style={styles.energyBarContainer}>
                            <View style={styles.energyBarTrack}>
                                <Animated.View style={[styles.energyBarFill, {
                                    width: chargeAnimating ? chargeBarWidth.interpolate({ inputRange: [0, 1], outputRange: ["60%", "100%"] }) : "60%",
                                }]} />
                            </View>
                            <Text style={styles.energyBarLabel}>{chargeAnimating ? "FULL" : "60%"}</Text>
                        </View>
                        <View style={styles.buttonRow}>
                            <Button title={chargeAnimating ? "⚡ CHARGED!" : "⚡ CHARGE"} variant="gold" size="lg" onPress={handleCharge} disabled={chargeAnimating} />
                        </View>
                        <Text style={styles.panelHint}>Your Spark gets drowsy over time.{"\n"}Come back to keep it happy!</Text>
                    </StepCard>
                </View>
            )}

            {phase === "wallet" && (
                <View style={[styles.stepCardContainer, { bottom: Math.max(insets.bottom, 12) + SPACING.md }]}>
                    <StepCard title="Take care of your Spark!" subtitle={"Your ghost block is free to play.\nConnect a wallet for full power."} step={currentStep} totalSteps={TOTAL_STEPS}>
                        <View style={styles.walletButtons}>
                            <Button title="START PLAYING" variant="primary" size="lg" onPress={handlePlayDemo} />
                            <Button title="CONNECT WALLET" variant="secondary" size="md" onPress={handleConnectWallet} />
                        </View>
                        <Text style={styles.walletHint}>Wallet optional · Stake later for full power</Text>
                    </StepCard>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    skipContainer: { position: "absolute", right: SPACING.md, zIndex: 300 },
    claimContainer: { position: "absolute", left: SPACING.lg, right: SPACING.lg, alignItems: "center", zIndex: 100 },
    claimSubtitle: { ...TEXT.bodyLg, color: COLORS.textOnDark, marginBottom: SPACING.md, textShadowColor: "rgba(0, 0, 0, 0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
    claimBlockInfo: { ...TEXT.caption, color: COLORS.textMuted, marginTop: SPACING.sm },
    stepCardContainer: { position: "absolute", left: SPACING.md, right: SPACING.md, zIndex: 100 },
    sectionHeader: { ...TEXT.overline, color: COLORS.textMuted, alignSelf: "flex-start", marginBottom: SPACING.sm, marginTop: SPACING.sm },
    nameRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "center", marginBottom: SPACING.sm },
    nameInput: { flex: 1, height: 44, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.hudBorder, backgroundColor: COLORS.hudHighlight, paddingHorizontal: SPACING.md, fontFamily: FONT_FAMILY.body, fontSize: 16, color: COLORS.textOnDark },
    surpriseButton: { width: 44, height: 44, borderRadius: RADIUS.sm, backgroundColor: COLORS.hudHighlight, borderWidth: 1, borderColor: COLORS.hudBorder, justifyContent: "center", alignItems: "center" },
    surpriseText: { fontSize: 22 },
    colorRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: SPACING.sm, marginBottom: SPACING.sm },
    colorSwatch: { width: 48, height: 48, borderRadius: RADIUS.sm, borderWidth: 3, borderColor: "transparent" },
    swatchSelected: { borderColor: COLORS.gold, borderWidth: 3 },
    emojiRow: { flexDirection: "row", gap: SPACING.sm, paddingBottom: SPACING.md },
    emojiSwatch: { width: 48, height: 48, borderRadius: RADIUS.sm, borderWidth: 3, borderColor: "transparent", justifyContent: "center", alignItems: "center", backgroundColor: COLORS.hudHighlight },
    emojiText: { fontSize: 24 },
    personalityRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs, marginBottom: SPACING.sm },
    personalitySwatch: { alignItems: "center", justifyContent: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.hudHighlight, borderWidth: 3, borderColor: "transparent" },
    personalityKaomoji: { fontSize: 14, color: COLORS.textOnDark },
    personalityLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 1 },
    buttonRow: { alignItems: "center", marginTop: SPACING.sm },
    chargeWarning: { ...TEXT.bodySm, color: COLORS.fading, textAlign: "center", marginBottom: SPACING.md },
    energyBarContainer: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.md, paddingHorizontal: SPACING.sm },
    energyBarTrack: { flex: 1, height: 12, borderRadius: 6, backgroundColor: COLORS.hudHighlight, overflow: "hidden" },
    energyBarFill: { height: "100%", borderRadius: 6, backgroundColor: COLORS.blazing },
    energyBarLabel: { ...TEXT.caption, color: COLORS.textMuted, width: 32 },
    panelHint: { ...TEXT.bodySm, color: COLORS.textMuted, marginTop: SPACING.md, textAlign: "center" },
    walletButtons: { flexDirection: "column", gap: SPACING.sm, alignItems: "center", marginTop: SPACING.sm },
    walletHint: { ...TEXT.caption, color: COLORS.textMuted, marginTop: SPACING.md, textAlign: "center" },
});
