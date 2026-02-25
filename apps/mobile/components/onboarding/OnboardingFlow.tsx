import React, { useEffect, useRef, useCallback } from "react";
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
import TitleReveal from "./TitleReveal";
import { BLOCK_COLORS, BLOCK_ICONS } from "@monolith/common";
import { COLORS, FONT_FAMILY, SPACING, RADIUS, SHADOW, BLUR } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { playCustomize, playButtonTap, playChargeTap, playPokeSend } from "@/utils/audio";
import { useClaimCelebration } from "@/hooks/useClaimCelebration";

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

/** Step indicator — 5 steps starting from claim */
function StepDots({ current, total }: { current: number; total: number }) {
    return (
        <View style={styles.stepDotsRow}>
            {Array.from({ length: total }, (_, i) => (
                <View
                    key={i}
                    style={[
                        styles.stepDot,
                        i < current && styles.stepDotCompleted,
                        i === current && styles.stepDotActive,
                    ]}
                />
            ))}
        </View>
    );
}

/** Step label — "Step N of M" */
function StepLabel({ step, total }: { step: number; total: number }) {
    return (
        <Text style={styles.stepLabel}>
            Step {step} of {total}
        </Text>
    );
}

export default function OnboardingFlow() {
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
    const setShowConnectSheet = useWalletStore((s) => s.setShowConnectSheet);
    const { triggerCelebration } = useClaimCelebration();

    // Animations
    const claimFade = useRef(new Animated.Value(0)).current;
    const claimScale = useRef(new Animated.Value(0.8)).current;
    const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const panelFade = useRef(new Animated.Value(0)).current;
    const panelSlide = useRef(new Animated.Value(60)).current;

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
                tension: 60,
                friction: 8,
                delay: 800,
                useNativeDriver: true,
            }),
        ]).start();
    }, [phase, claimFade, claimScale]);

    // ─── Animate panel entrance (reused for customize/charge/poke/wallet) ──
    useEffect(() => {
        if (phase !== "customize" && phase !== "charge" && phase !== "poke" && phase !== "wallet") return;
        panelFade.setValue(0);
        panelSlide.setValue(60);
        Animated.parallel([
            Animated.timing(panelFade, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.spring(panelSlide, {
                toValue: 0,
                tension: 50,
                friction: 10,
                useNativeDriver: true,
            }),
        ]).start();
    }, [phase, panelFade, panelSlide]);

    // ─── Celebration auto-advance ────────────────
    useEffect(() => {
        if (phase !== "celebration") return;
        // Wait for the celebration VFX to mostly finish, then fly camera back to block
        celebrationTimer.current = setTimeout(() => {
            // Re-select the ghost block so camera flies back for customize phase
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
        // Trigger full claim celebration
        const block = getDemoBlockById(ghostBlockId);
        if (block) {
            triggerCelebration(block.position, -1, true);
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

    const handleCustomizeDone = useCallback(() => {
        hapticButtonPress();
        playButtonTap();
        // Don't selectBlock(null) — keep block selected for charge phase
        advancePhase(); // → charge
    }, [advancePhase]);

    // ─── Phase: CHARGE ────────────────────────────
    const handleCharge = useCallback(() => {
        if (!ghostBlockId) return;
        hapticButtonPress();
        playChargeTap();
        ghostChargeBlock(ghostBlockId);
        // Show charge flash
        setRecentlyChargedId(ghostBlockId);
        // Brief pause then advance
        setTimeout(() => {
            advancePhase(); // → poke
        }, 800);
    }, [ghostBlockId, ghostChargeBlock, setRecentlyChargedId, advancePhase]);

    // ─── Phase: POKE ──────────────────────────────
    const handlePoke = useCallback(() => {
        if (!ghostBlockId) return;
        hapticButtonPress();
        playPokeSend();
        const nearbyId = pickNearbyBotBlock(ghostBlockId, demoBlocks as any);
        if (nearbyId) {
            selectBlock(nearbyId);
            // Visual feedback
            setRecentlyChargedId(nearbyId);
        }
        setTimeout(() => {
            advancePhase(); // → wallet
        }, 600);
    }, [ghostBlockId, demoBlocks, selectBlock, setRecentlyChargedId, advancePhase]);

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
        // On successful connect, the wallet store will handle state
        // For now, complete onboarding
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

    // Step mapping for the 5-step indicator
    const stepMap: Record<string, number> = {
        claim: 0, celebration: 0,
        customize: 1,
        charge: 2,
        poke: 3,
        wallet: 4,
    };
    const currentStep = stepMap[phase] ?? -1;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Skip button — visible from title phase onward (not during cinematic) */}
            {phase !== "cinematic" && (
                <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
            )}

            {/* ─── CINEMATIC ──────────────────────── */}
            {/* No UI during cinematic — pure camera spectacle */}
            {/* The useTowerReveal hook handles advancing cinematic → title */}

            {/* ─── TITLE ──────────────────────────── */}
            <TitleReveal
                visible={phase === "title"}
                onComplete={handleTitleComplete}
            />

            {/* ─── CLAIM ──────────────────────────── */}
            {phase === "claim" && (
                <Animated.View style={[
                    styles.claimContainer,
                    { opacity: claimFade, transform: [{ scale: claimScale }] },
                ]}>
                    <Text style={styles.claimSubtitle}>
                        This block is yours to keep. Or lose.
                    </Text>

                    <TouchableOpacity
                        style={styles.claimButton}
                        onPress={handleClaim}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.claimButtonText}>CLAIM THIS BLOCK</Text>
                    </TouchableOpacity>

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
                <Animated.View style={[
                    styles.panelContainer,
                    { opacity: panelFade, transform: [{ translateY: panelSlide }] },
                ]}>
                    <StepLabel step={2} total={5} />
                    <StepDots current={1} total={5} />

                    <Text style={styles.panelTitle}>Make it yours</Text>
                    <Text style={styles.panelSub}>Pick a color and emoji</Text>

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
                            />
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
                            >
                                <Text style={styles.emojiText}>{emoji}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <TouchableOpacity
                        style={styles.goldButton}
                        onPress={handleCustomizeDone}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.goldButtonText}>LOOKS GOOD →</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* ─── CHARGE ──────────────────────────── */}
            {phase === "charge" && (
                <Animated.View style={[
                    styles.panelContainer,
                    { opacity: panelFade, transform: [{ translateY: panelSlide }] },
                ]}>
                    <StepLabel step={3} total={5} />
                    <StepDots current={2} total={5} />

                    <Text style={styles.panelTitle}>Charge your block daily</Text>
                    <Text style={styles.chargeWarning}>
                        Miss 3 days and anyone can take it
                    </Text>

                    <TouchableOpacity
                        style={styles.chargeButton}
                        onPress={handleCharge}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.chargeButtonText}>⚡ CHARGE</Text>
                    </TouchableOpacity>

                    <Text style={styles.panelHint}>
                        Your block decays every 24 hours.{"\n"}
                        Come back to keep it alive.
                    </Text>
                </Animated.View>
            )}

            {/* ─── POKE ────────────────────────────── */}
            {phase === "poke" && (
                <Animated.View style={[
                    styles.panelContainer,
                    { opacity: panelFade, transform: [{ translateY: panelSlide }] },
                ]}>
                    <StepLabel step={4} total={5} />
                    <StepDots current={3} total={5} />

                    <Text style={styles.panelTitle}>Poke your neighbors 👋</Text>
                    <Text style={styles.panelSub}>Give them a boost of energy</Text>

                    <View style={styles.pokeButtons}>
                        <TouchableOpacity
                            style={styles.goldButton}
                            onPress={handlePoke}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.goldButtonText}>POKE</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={handlePokeSkip}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.secondaryButtonText}>SKIP →</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            )}

            {/* ─── WALLET ──────────────────────────── */}
            {phase === "wallet" && (
                <Animated.View style={[
                    styles.panelContainer,
                    { opacity: panelFade, transform: [{ translateY: panelSlide }] },
                ]}>
                    <StepLabel step={5} total={5} />
                    <StepDots current={4} total={5} />

                    <Text style={styles.walletTitle}>You're in.</Text>
                    <Text style={styles.panelSub}>
                        Connect a wallet to stake real USDC{"\n"}
                        and compete on the leaderboard.
                    </Text>

                    <View style={styles.walletButtons}>
                        <TouchableOpacity
                            style={styles.goldButton}
                            onPress={handleConnectWallet}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.goldButtonText}>CONNECT WALLET</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={handlePlayDemo}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.secondaryButtonText}>PLAY DEMO →</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.walletHint}>
                        Seed Vault · Phantom · Solflare
                    </Text>
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    skipButton: {
        position: "absolute",
        top: 54,
        right: SPACING.md,
        zIndex: 300,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.full,
        backgroundColor: BLUR.fallbackHudBg,
        borderWidth: 1,
        borderColor: COLORS.hudBorder,
    },
    skipText: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 13,
        color: COLORS.textMuted,
        letterSpacing: 0.5,
    },

    // ─── Step indicator ───────────────────────
    stepDotsRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    stepDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    stepDotActive: {
        backgroundColor: COLORS.gold,
        width: 24,
        borderRadius: 4,
    },
    stepDotCompleted: {
        backgroundColor: COLORS.goldLight,
    },
    stepLabel: {
        fontFamily: FONT_FAMILY.body,
        fontSize: 12,
        color: COLORS.textMuted,
        textAlign: "center",
        letterSpacing: 0.5,
        marginBottom: SPACING.xs,
    },

    // ─── Claim ────────────────────────────────
    claimContainer: {
        position: "absolute",
        bottom: 120,
        left: SPACING.lg,
        right: SPACING.lg,
        alignItems: "center",
        zIndex: 100,
    },
    claimButton: {
        backgroundColor: COLORS.gold,
        paddingHorizontal: SPACING.xxl * 1.5,
        paddingVertical: SPACING.md + 4,
        borderRadius: RADIUS.md,
        borderCurve: "continuous",
        alignItems: "center",
        boxShadow: SHADOW.gold,
    },
    claimButtonText: {
        fontFamily: FONT_FAMILY.heading,
        fontSize: 22,
        color: COLORS.textOnGold,
        letterSpacing: 2,
    },
    claimSubtitle: {
        fontFamily: FONT_FAMILY.bodyMedium,
        fontSize: 15,
        color: COLORS.textOnDark,
        marginBottom: SPACING.md,
        letterSpacing: 0.3,
        textShadowColor: "rgba(0, 0, 0, 0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 8,
    },
    claimBlockInfo: {
        fontFamily: FONT_FAMILY.body,
        fontSize: 13,
        color: COLORS.textMuted,
        marginTop: SPACING.sm,
        letterSpacing: 0.3,
    },

    // ─── Shared panel container ───────────────
    panelContainer: {
        position: "absolute",
        bottom: 80,
        left: SPACING.md,
        right: SPACING.md,
        alignItems: "center",
        zIndex: 100,
        backgroundColor: "rgba(10, 12, 20, 0.90)",
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.goldGlow,
        borderCurve: "continuous",
        paddingTop: SPACING.md,
        paddingBottom: SPACING.lg,
        paddingHorizontal: SPACING.lg,
    },

    // ─── Panel text ───────────────────────────
    panelTitle: {
        fontFamily: FONT_FAMILY.heading,
        fontSize: 20,
        color: COLORS.goldLight,
        letterSpacing: 0.5,
        textAlign: "center",
    },
    panelSub: {
        fontFamily: FONT_FAMILY.body,
        fontSize: 13,
        color: COLORS.textMuted,
        marginTop: SPACING.xs,
        marginBottom: SPACING.md,
        textAlign: "center",
    },
    panelHint: {
        fontFamily: FONT_FAMILY.body,
        fontSize: 13,
        color: COLORS.textMuted,
        marginTop: SPACING.md,
        textAlign: "center",
        lineHeight: 20,
    },

    // ─── Section headers ──────────────────────
    sectionHeader: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 11,
        color: COLORS.textMuted,
        letterSpacing: 2,
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
        backgroundColor: "rgba(255, 255, 255, 0.06)",
    },
    emojiText: {
        fontSize: 24,
    },

    // ─── Buttons ──────────────────────────────
    goldButton: {
        backgroundColor: COLORS.gold,
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.sm + 2,
        borderRadius: RADIUS.md,
        borderCurve: "continuous",
        boxShadow: SHADOW.gold,
    },
    goldButtonText: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 15,
        color: COLORS.textOnGold,
        letterSpacing: 1,
    },
    secondaryButton: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm + 2,
        borderRadius: RADIUS.md,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: COLORS.hudBorder,
    },
    secondaryButtonText: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 15,
        color: COLORS.textMuted,
        letterSpacing: 0.5,
    },

    // ─── Charge ───────────────────────────────
    chargeWarning: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 14,
        color: COLORS.fading,
        textAlign: "center",
        marginTop: SPACING.xs,
        marginBottom: SPACING.lg,
    },
    chargeButton: {
        backgroundColor: COLORS.blazing,
        paddingHorizontal: SPACING.xxl,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.md,
        borderCurve: "continuous",
        boxShadow: "0 0 20px rgba(255, 184, 0, 0.4)",
    },
    chargeButtonText: {
        fontFamily: FONT_FAMILY.heading,
        fontSize: 18,
        color: COLORS.textOnGold,
        letterSpacing: 1,
    },

    // ─── Poke ─────────────────────────────────
    pokeButtons: {
        flexDirection: "row",
        gap: SPACING.md,
        marginTop: SPACING.sm,
    },

    // ─── Wallet ───────────────────────────────
    walletTitle: {
        fontFamily: FONT_FAMILY.heading,
        fontSize: 24,
        color: COLORS.goldLight,
        letterSpacing: 0.5,
        textAlign: "center",
    },
    walletButtons: {
        flexDirection: "row",
        gap: SPACING.md,
        marginTop: SPACING.sm,
    },
    walletHint: {
        fontFamily: FONT_FAMILY.body,
        fontSize: 12,
        color: COLORS.textMuted,
        marginTop: SPACING.md,
        textAlign: "center",
    },
});
