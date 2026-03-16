import React, { useEffect, useRef, useCallback, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    ScrollView,
} from "react-native";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useTowerStore } from "@/stores/tower-store";
import { useWalletStore } from "@/stores/wallet-store";
import { usePlayerStore } from "@/stores/player-store";
import TitleReveal from "./TitleReveal";
import { BLOCK_COLORS, BLOCK_ICONS } from "@monolith/common";
import { COLORS, SPACING, RADIUS, TEXT, TIMING } from "@/constants/theme";
import { hapticButtonPress, hapticChargeTap } from "@/utils/haptics";
import { playCustomize, playButtonTap, playChargeTap, playPokeSend, playPokeReceive } from "@/utils/audio";
import { useClaimCelebration } from "@/hooks/useClaimCelebration";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "@/components/ui/Button";
import StepCard from "@/components/ui/StepCard";
import CameraTutorial from "./CameraTutorial";

/**
 * OnboardingFlow — 60-second first session: jaw-dropping immersion → intuitive game entry.
 *
 * Flow:
 *   cinematic   → Camera fly-around (no UI, pure spectacle)
 *   title       → "MONOLITH" + "Own your piece of the tower" + GET STARTED
 *   claim       → Dedicated big CLAIM THIS BLOCK button
 *   celebration → VFX plays out (no UI)
 *   customize   → Color + emoji picker
 *   charge      → Charge tutorial — teach the daily loop
 *   poke        → Optional poke prompt (dismissible)
 *   wallet      → Wallet connect or "Play Demo"
 */

const ONBOARDING_COLORS = BLOCK_COLORS.slice(0, 8);
const ONBOARDING_ICONS = BLOCK_ICONS.slice(0, 16);
const ONBOARDING_PERSONALITIES = [
    { name: "Happy", kaomoji: "^_^" },
    { name: "Cool", kaomoji: "B-)" },
    { name: "Sleepy", kaomoji: "-_-" },
    { name: "Fierce", kaomoji: ">_<" },
    { name: "Derp", kaomoji: ":P" },
] as const;

/** Find a good unclaimed block for the tutorial */
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

/** Find a nearby bot-owned block for the poke tutorial */
function pickNearbyBotBlock(
    ghostBlockId: string,
    demoBlocks: { id: string; owner: string | null; layer: number; index: number }[],
): string | null {
    const ghost = demoBlocks.find(b => b.id === ghostBlockId);
    if (!ghost) return null;
    const candidates = demoBlocks.filter(b =>
        b.owner !== null &&
        b.id !== ghostBlockId &&
        Math.abs(b.layer - ghost.layer) <= 2
    );
    if (candidates.length === 0) return null;
    return candidates.sort((a, b) =>
        Math.abs(a.index - ghost.index) - Math.abs(b.index - ghost.index)
    )[0].id;
}

/** Step mapping: onboarding phase → 1-based step index (5 steps total) */
const STEP_MAP: Record<string, number> = {
    claim: 1, celebration: 1,
    customize: 2,
    charge: 3,
    poke: 4,
    wallet: 5,
};
const TOTAL_STEPS = 5;

export default function OnboardingFlow() {
    const insets = useSafeAreaInsets();
    const phase = useOnboardingStore((s) => s.phase);
    const advancePhase = useOnboardingStore((s) => s.advancePhase);
    const ghostBlockId = useOnboardingStore((s) => s.ghostBlockId);
    const setGhostBlock = useOnboardingStore((s) => s.setGhostBlock);
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
    const setRecentlyPokedId = useTowerStore((s) => s.setRecentlyPokedId);
    const setShowConnectSheet = useWalletStore((s) => s.setShowConnectSheet);
    const addPoints = usePlayerStore((s) => s.addPoints);
    const { triggerCelebration } = useClaimCelebration();

    // Track charge animation state
    const [chargeAnimating, setChargeAnimating] = useState(false);
    const chargeBarWidth = useRef(new Animated.Value(0)).current;

    // Animations
    const claimFade = useRef(new Animated.Value(0)).current;
    const claimScale = useRef(new Animated.Value(0.8)).current;
    const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── Animate claim entrance ──────────────────
    useEffect(() => {
        if (phase !== "claim") return;
        claimFade.setValue(0);
        claimScale.setValue(0.8);
        Animated.parallel([
            Animated.timing(claimFade, {
                toValue: 1,
                duration: 400,
                delay: 800,
                useNativeDriver: true,
            }),
            Animated.spring(claimScale, {
                toValue: 1,
                ...TIMING.springOnboarding,
                delay: 800,
                useNativeDriver: true,
            }),
        ]).start();
    }, [phase, claimFade, claimScale]);

    // ─── Celebration auto-advance ────────────────
    useEffect(() => {
        if (phase !== "celebration") return;
        celebrationTimer.current = setTimeout(() => {
            if (ghostBlockId) {
                selectBlock(ghostBlockId);
            }
            advancePhase(); // → customize
        }, 3500);
        return () => {
            if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
        };
    }, [phase, advancePhase, ghostBlockId, selectBlock]);

    // ─── Phase: TITLE ─────────────────────────────
    const handleTitleComplete = useCallback(() => {
        const blockId = pickTutorialBlock(demoBlocks);
        if (blockId) {
            setGhostBlock(blockId);
            selectBlock(blockId);
            advancePhase(); // → claim
        } else {
            skipOnboarding();
        }
    }, [demoBlocks, setGhostBlock, selectBlock, advancePhase, skipOnboarding]);

    // ─── Phase: CLAIM ─────────────────────────────
    const handleClaim = useCallback(() => {
        if (!ghostBlockId) return;
        hapticButtonPress();
        ghostClaimBlock(ghostBlockId);
        const block = getDemoBlockById(ghostBlockId);
        if (block) {
            triggerCelebration(block.position, -1, true, ghostBlockId);
        }
        advancePhase(); // → celebration
    }, [ghostBlockId, ghostClaimBlock, advancePhase, getDemoBlockById, triggerCelebration]);

    // ─── Phase: CUSTOMIZE ─────────────────────────
    const handleColorPick = useCallback((color: string) => {
        if (!ghostBlockId) return;
        ghostCustomizeBlock(ghostBlockId, { color });
        hapticButtonPress();
        playCustomize();
    }, [ghostBlockId, ghostCustomizeBlock]);

    const handleEmojiPick = useCallback((emoji: string) => {
        if (!ghostBlockId) return;
        ghostCustomizeBlock(ghostBlockId, { emoji });
        hapticButtonPress();
        playCustomize();
    }, [ghostBlockId, ghostCustomizeBlock]);

    const handlePersonalityPick = useCallback((personality: number) => {
        if (!ghostBlockId) return;
        ghostCustomizeBlock(ghostBlockId, { personality });
        hapticButtonPress();
        playCustomize();
    }, [ghostBlockId, ghostCustomizeBlock]);

    const handleCustomizeDone = useCallback(() => {
        hapticButtonPress();
        playButtonTap();
        advancePhase(); // → charge
    }, [advancePhase]);

    // ─── Phase: CHARGE ────────────────────────────
    const handleCharge = useCallback(() => {
        if (!ghostBlockId) return;
        hapticChargeTap();
        playChargeTap();
        ghostChargeBlock(ghostBlockId);
        setRecentlyChargedId(ghostBlockId);

        // Trigger FloatingPoints "+1 Charge"
        addPoints({ pointsEarned: 25, chargeAmount: 1 });

        // Animate energy bar fill
        setChargeAnimating(true);
        chargeBarWidth.setValue(0);
        Animated.timing(chargeBarWidth, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
        }).start();

        setTimeout(() => {
            advancePhase(); // → poke
        }, 1200);
    }, [ghostBlockId, ghostChargeBlock, setRecentlyChargedId, addPoints, advancePhase, chargeBarWidth]);

    // ─── Phase: POKE ──────────────────────────────
    const [pokeStatus, setPokeStatus] = useState<string | null>(null);
    const handlePoke = useCallback(() => {
        if (!ghostBlockId) return;
        hapticButtonPress();
        playPokeSend();
        const nearbyId = pickNearbyBotBlock(ghostBlockId, demoBlocks as any);
        if (nearbyId) {
            // Fly camera to the bot block first
            selectBlock(nearbyId);
            // Delay shake 300ms so camera arrives before the visual feedback
            setTimeout(() => {
                setRecentlyPokedId(nearbyId);
                playPokeReceive();
                setPokeStatus("Poke sent!");
                addPoints({ pointsEarned: 10 });
            }, 300);
        }
        // After 1.5s: fly camera back to ghost block, then advance
        setTimeout(() => {
            selectBlock(ghostBlockId);
            setTimeout(() => {
                advancePhase(); // → wallet
            }, 400);
        }, 1500);
    }, [ghostBlockId, demoBlocks, selectBlock, setRecentlyPokedId, addPoints, advancePhase]);

    const handlePokeSkip = useCallback(() => {
        hapticButtonPress();
        playButtonTap();
        advancePhase(); // → wallet
    }, [advancePhase]);

    // ─── Phase: WALLET ────────────────────────────
    const handleConnectWallet = useCallback(() => {
        hapticButtonPress();
        playButtonTap();
        setShowConnectSheet(true);
        completeOnboarding();
        skipOnboarding();
    }, [setShowConnectSheet, completeOnboarding, skipOnboarding]);

    const handlePlayDemo = useCallback(() => {
        hapticButtonPress();
        playButtonTap();
        completeOnboarding();
        skipOnboarding();
    }, [completeOnboarding, skipOnboarding]);

    // ─── Skip handler ─────────────────────────────
    const handleSkip = useCallback(() => {
        hapticButtonPress();
        playButtonTap();
        if (typeof clearGhostBlock === 'function') clearGhostBlock();
        completeOnboarding();
        skipOnboarding();
    }, [clearGhostBlock, completeOnboarding, skipOnboarding]);

    if (phase === "done") return null;

    const ghostBlock = ghostBlockId ? getDemoBlockById(ghostBlockId) : null;
    const currentStep = STEP_MAP[phase];

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Skip button — visible from title phase onward */}
            {phase !== "cinematic" && (
                <View style={[styles.skipContainer, { top: insets.top + SPACING.xs }]}>
                    <Button
                        title="Skip"
                        variant="ghost"
                        size="sm"
                        onPress={handleSkip}
                    />
                </View>
            )}

            {/* ─── CINEMATIC ──────────────────────── */}
            {/* No UI during cinematic — pure camera spectacle */}

            {/* ─── CAMERA TUTORIAL ─────────────────── */}
            {phase === "cameraTutorial" && (
                <CameraTutorial onComplete={advancePhase} />
            )}

            {/* ─── TITLE ──────────────────────────── */}
            <TitleReveal
                visible={phase === "title"}
                onComplete={handleTitleComplete}
            />

            {/* ─── CLAIM ──────────────────────────── */}
            {phase === "claim" && (
                <Animated.View style={[
                    styles.claimContainer,
                    { bottom: Math.max(insets.bottom, 12) + SPACING.xxl, opacity: claimFade, transform: [{ scale: claimScale }] },
                ]}>
                    <Text style={styles.claimSubtitle}>
                        Choose a Spark to care for
                    </Text>

                    <Button
                        title="WAKE UP THIS SPARK"
                        variant="primary"
                        size="lg"
                        onPress={handleClaim}
                    />

                    {ghostBlock && (
                        <Text style={styles.claimBlockInfo}>
                            Layer {ghostBlock.layer}
                        </Text>
                    )}
                </Animated.View>
            )}

            {/* ─── CELEBRATION ─────────────────────── */}
            {/* No UI during celebration — VFX plays out */}

            {/* ─── CUSTOMIZE ───────────────────────── */}
            {phase === "customize" && (
                <View style={[styles.stepCardContainer, { bottom: Math.max(insets.bottom, 12) + SPACING.md }]}>
                    <StepCard
                        title="What color is your Spark?"
                        subtitle="Make it yours"
                        step={currentStep}
                        totalSteps={TOTAL_STEPS}
                    >
                        <Text style={styles.sectionHeader}>COLOR</Text>
                        <View style={styles.colorRow}>
                            {ONBOARDING_COLORS.map((color) => (
                                <TouchableOpacity
                                    key={color}
                                    style={[
                                        styles.colorSwatch,
                                        { backgroundColor: color },
                                        ghostBlock?.ownerColor === color && styles.swatchSelected,
                                    ]}
                                    onPress={() => handleColorPick(color)}
                                    activeOpacity={0.7}
                                />
                            ))}
                        </View>

                        <Text style={styles.sectionHeader}>FACE</Text>
                        <View style={styles.personalityRow}>
                            {ONBOARDING_PERSONALITIES.map((p, i) => (
                                <TouchableOpacity
                                    key={p.name}
                                    style={[
                                        styles.personalitySwatch,
                                        ghostBlock?.personality === i && styles.swatchSelected,
                                    ]}
                                    onPress={() => handlePersonalityPick(i)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.personalityKaomoji}>{p.kaomoji}</Text>
                                    <Text style={styles.personalityLabel}>{p.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.sectionHeader}>EMOJI</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.emojiRow}
                        >
                            {ONBOARDING_ICONS.map((emoji) => (
                                <TouchableOpacity
                                    key={emoji}
                                    style={[
                                        styles.emojiSwatch,
                                        ghostBlock?.emoji === emoji && styles.swatchSelected,
                                    ]}
                                    onPress={() => handleEmojiPick(emoji)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.emojiText}>{emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={styles.buttonRow}>
                            <Button
                                title="LOOKS GOOD →"
                                variant="primary"
                                size="md"
                                onPress={handleCustomizeDone}
                            />
                        </View>
                    </StepCard>
                </View>
            )}

            {/* ─── CHARGE ──────────────────────────── */}
            {phase === "charge" && (
                <View style={[styles.stepCardContainer, { bottom: Math.max(insets.bottom, 12) + SPACING.md }]}>
                    <StepCard
                        title="Charge your Spark!"
                        step={currentStep}
                        totalSteps={TOTAL_STEPS}
                    >
                        <Text style={styles.chargeWarning}>
                            Your Spark needs energy! Miss 3 days and it fades away.
                        </Text>

                        {/* Energy bar */}
                        <View style={styles.energyBarContainer}>
                            <View style={styles.energyBarTrack}>
                                <Animated.View
                                    style={[
                                        styles.energyBarFill,
                                        {
                                            width: chargeAnimating
                                                ? chargeBarWidth.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: ["60%", "100%"],
                                                })
                                                : "60%",
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={styles.energyBarLabel}>
                                {chargeAnimating ? "FULL" : "60%"}
                            </Text>
                        </View>

                        <View style={styles.buttonRow}>
                            <Button
                                title={chargeAnimating ? "⚡ CHARGED!" : "⚡ CHARGE"}
                                variant="gold"
                                size="lg"
                                onPress={handleCharge}
                                disabled={chargeAnimating}
                            />
                        </View>

                        <Text style={styles.panelHint}>
                            Your Spark gets drowsy over time.{"\n"}
                            Come back to keep it happy!
                        </Text>
                    </StepCard>
                </View>
            )}

            {/* ─── POKE ────────────────────────────── */}
            {phase === "poke" && (
                <View style={[styles.stepCardContainer, { bottom: Math.max(insets.bottom, 12) + SPACING.md }]}>
                    <StepCard
                        title="Say hi to a neighbor Spark 👋"
                        subtitle="Give them a boost of energy"
                        step={currentStep}
                        totalSteps={TOTAL_STEPS}
                    >
                        {pokeStatus && (
                            <Text style={styles.pokeStatusText}>{pokeStatus}</Text>
                        )}
                        <View style={styles.pokeButtons}>
                            <Button
                                title="POKE"
                                variant="secondary"
                                size="md"
                                onPress={handlePoke}
                                disabled={!!pokeStatus}
                            />
                            <Button
                                title="SKIP →"
                                variant="secondary"
                                size="md"
                                onPress={handlePokeSkip}
                            />
                        </View>
                    </StepCard>
                </View>
            )}

            {/* ─── WALLET ──────────────────────────── */}
            {phase === "wallet" && (
                <View style={[styles.stepCardContainer, { bottom: Math.max(insets.bottom, 12) + SPACING.md }]}>
                    <StepCard
                        title="Take care of your Spark!"
                        subtitle={"Your ghost block is free to play.\nConnect a wallet for full power."}
                        step={currentStep}
                        totalSteps={TOTAL_STEPS}
                    >
                        <View style={styles.walletButtons}>
                            <Button
                                title="START PLAYING"
                                variant="primary"
                                size="lg"
                                onPress={handlePlayDemo}
                            />
                            <Button
                                title="CONNECT WALLET"
                                variant="secondary"
                                size="md"
                                onPress={handleConnectWallet}
                            />
                        </View>

                        <Text style={styles.walletHint}>
                            Wallet optional · Stake later for full power
                        </Text>
                    </StepCard>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    skipContainer: {
        position: "absolute",
        right: SPACING.md,
        zIndex: 300,
    },

    // ─── Claim ────────────────────────────────
    claimContainer: {
        position: "absolute",
        left: SPACING.lg,
        right: SPACING.lg,
        alignItems: "center",
        zIndex: 100,
    },
    claimSubtitle: {
        ...TEXT.bodyLg,
        color: COLORS.textOnDark,
        marginBottom: SPACING.md,
        textShadowColor: "rgba(0, 0, 0, 0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 8,
    },
    claimBlockInfo: {
        ...TEXT.caption,
        color: COLORS.textMuted,
        marginTop: SPACING.sm,
    },

    // ─── StepCard positioning ─────────────────
    stepCardContainer: {
        position: "absolute",
        left: SPACING.md,
        right: SPACING.md,
        zIndex: 100,
    },

    // ─── Section headers (overline preset) ────
    sectionHeader: {
        ...TEXT.overline,
        color: COLORS.textMuted,
        alignSelf: "flex-start",
        marginBottom: SPACING.sm,
        marginTop: SPACING.sm,
    },

    // ─── Color swatches ───────────────────────
    colorRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    colorSwatch: {
        width: 48,
        height: 48,
        borderRadius: RADIUS.sm,
        borderWidth: 3,
        borderColor: "transparent",
    },
    swatchSelected: {
        borderColor: COLORS.gold,
        borderWidth: 3,
    },

    // ─── Emoji row ────────────────────────────
    emojiRow: {
        flexDirection: "row",
        gap: SPACING.sm,
        paddingBottom: SPACING.md,
    },
    emojiSwatch: {
        width: 48,
        height: 48,
        borderRadius: RADIUS.sm,
        borderWidth: 3,
        borderColor: "transparent",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: COLORS.hudHighlight,
    },
    emojiText: {
        fontSize: 24,
    },

    // ─── Personality row ─────────────────────────
    personalityRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    personalitySwatch: {
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: RADIUS.sm,
        backgroundColor: COLORS.hudHighlight,
        borderWidth: 3,
        borderColor: "transparent",
    },
    personalityKaomoji: {
        fontSize: 14,
        color: COLORS.textOnDark,
    },
    personalityLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
        marginTop: 1,
    },

    // ─── Button row (centered) ────────────────
    buttonRow: {
        alignItems: "center",
        marginTop: SPACING.sm,
    },

    // ─── Charge ───────────────────────────────
    chargeWarning: {
        ...TEXT.bodySm,
        color: COLORS.fading,
        textAlign: "center",
        marginBottom: SPACING.md,
    },
    energyBarContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.sm,
        marginBottom: SPACING.md,
        paddingHorizontal: SPACING.sm,
    },
    energyBarTrack: {
        flex: 1,
        height: 12,
        borderRadius: 6,
        backgroundColor: COLORS.hudHighlight,
        overflow: "hidden",
    },
    energyBarFill: {
        height: "100%",
        borderRadius: 6,
        backgroundColor: COLORS.blazing,
    },
    energyBarLabel: {
        ...TEXT.caption,
        color: COLORS.textMuted,
        width: 32,
    },
    panelHint: {
        ...TEXT.bodySm,
        color: COLORS.textMuted,
        marginTop: SPACING.md,
        textAlign: "center",
    },

    // ─── Poke ─────────────────────────────────
    pokeButtons: {
        flexDirection: "row",
        gap: SPACING.md,
        justifyContent: "center",
        marginTop: SPACING.sm,
    },

    // ─── Poke status ─────────────────────────
    pokeStatusText: {
        ...TEXT.bodySm,
        color: COLORS.gold,
        textAlign: "center",
        marginBottom: SPACING.xs,
    },

    // ─── Wallet ───────────────────────────────
    walletButtons: {
        flexDirection: "column",
        gap: SPACING.sm,
        alignItems: "center",
        marginTop: SPACING.sm,
    },
    walletHint: {
        ...TEXT.caption,
        color: COLORS.textMuted,
        marginTop: SPACING.md,
        textAlign: "center",
    },
});
