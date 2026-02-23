import React, { useEffect, useRef, useCallback, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
} from "react-native";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useTowerStore } from "@/stores/tower-store";
import TitleReveal from "./TitleReveal";
import CoachMark from "./CoachMark";
import { BLOCK_COLORS } from "@monolith/common";
import { COLORS, FONT_FAMILY, SPACING, RADIUS, SHADOW, BLUR } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { useClaimCelebration } from "@/hooks/useClaimCelebration";

/**
 * OnboardingFlow — 30-second first session that communicates the GAME, not just the UI.
 *
 * What the user should understand after onboarding:
 *   1. This is a shared tower where real people own blocks
 *   2. You just claimed YOUR block on it
 *   3. You must come back and charge it, or you lose it
 *   4. Your block is now visible to everyone
 *
 * Flow:
 *   title     → "650 blocks. One tower. Yours to keep — or lose."
 *   claim     → Camera flies to block → "CLAIM IT" with urgency
 *   customize → Pick a color (only — high visual impact, fast)
 *   reveal    → Camera pulls back → "Block #N is yours. Charge it daily or lose it."
 */

const ONBOARDING_COLORS = BLOCK_COLORS.slice(0, 8);

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

/** Step indicator */
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

export default function OnboardingFlow() {
    const phase = useOnboardingStore((s) => s.phase);
    const advancePhase = useOnboardingStore((s) => s.advancePhase);
    const ghostBlockId = useOnboardingStore((s) => s.ghostBlockId);
    const setGhostBlock = useOnboardingStore((s) => s.setGhostBlock);
    const skipOnboarding = useOnboardingStore((s) => s.skipOnboarding);

    const demoBlocks = useTowerStore((s) => s.demoBlocks);
    const ghostClaimBlock = useTowerStore((s) => s.ghostClaimBlock);
    const ghostCustomizeBlock = useTowerStore((s) => s.ghostCustomizeBlock);
    const clearGhostBlock = useTowerStore((s) => s.clearGhostBlock);
    const selectBlock = useTowerStore((s) => s.selectBlock);
    const completeOnboarding = useTowerStore((s) => s.completeOnboarding);
    const getDemoBlockById = useTowerStore((s) => s.getDemoBlockById);
    const { triggerCelebration } = useClaimCelebration();

    // Animations
    const revealFade = useRef(new Animated.Value(0)).current;
    const claimFade = useRef(new Animated.Value(0)).current;
    const claimScale = useRef(new Animated.Value(0.8)).current;
    const customizeFade = useRef(new Animated.Value(0)).current;
    const customizeSlide = useRef(new Animated.Value(60)).current;

    const [keeperNumber, setKeeperNumber] = useState(0);

    useEffect(() => {
        const occupied = demoBlocks.filter((b) => b.owner !== null).length;
        setKeeperNumber(occupied);
    }, [demoBlocks]);

    // ─── Animate claim entrance ──────────────────
    useEffect(() => {
        if (phase !== "claim") return;
        Animated.parallel([
            Animated.timing(claimFade, {
                toValue: 1,
                duration: 400,
                delay: 600,
                useNativeDriver: true,
            }),
            Animated.spring(claimScale, {
                toValue: 1,
                tension: 60,
                friction: 8,
                delay: 600,
                useNativeDriver: true,
            }),
        ]).start();
    }, [phase, claimFade, claimScale]);

    // ─── Animate customize entrance ──────────────
    useEffect(() => {
        if (phase !== "customize") return;
        Animated.parallel([
            Animated.timing(customizeFade, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.spring(customizeSlide, {
                toValue: 0,
                tension: 50,
                friction: 10,
                useNativeDriver: true,
            }),
        ]).start();
    }, [phase, customizeFade, customizeSlide]);

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
        ghostClaimBlock(ghostBlockId);
        // Trigger full claim celebration (particles, shockwave, haptics, sound)
        const block = getDemoBlockById(ghostBlockId);
        if (block) {
            triggerCelebration(block.position, -1, true);
        }
        customizeFade.setValue(0);
        customizeSlide.setValue(60);
        advancePhase(); // → customize
    }, [ghostBlockId, ghostClaimBlock, advancePhase, customizeFade, customizeSlide, getDemoBlockById, triggerCelebration]);

    // ─── Phase: CUSTOMIZE ─────────────────────────
    const handleColorPick = useCallback((color: string) => {
        if (!ghostBlockId) return;
        ghostCustomizeBlock(ghostBlockId, { color });
        hapticButtonPress();
    }, [ghostBlockId, ghostCustomizeBlock]);

    const handleCustomizeDone = useCallback(() => {
        hapticButtonPress();
        selectBlock(null);
        advancePhase(); // → reveal
    }, [selectBlock, advancePhase]);

    // Auto-advance from customize after 8s
    useEffect(() => {
        if (phase !== "customize") return;
        const timer = setTimeout(handleCustomizeDone, 8000);
        return () => clearTimeout(timer);
    }, [phase, handleCustomizeDone]);

    // ─── Phase: REVEAL ────────────────────────────
    useEffect(() => {
        if (phase !== "reveal") return;

        Animated.timing(revealFade, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start();

        const timer = setTimeout(() => {
            Animated.timing(revealFade, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }).start(() => {
                completeOnboarding();
                skipOnboarding();
            });
        }, 5000);

        return () => clearTimeout(timer);
    }, [phase, revealFade, completeOnboarding, skipOnboarding]);

    // ─── Skip handler ─────────────────────────────
    const handleSkip = useCallback(() => {
        hapticButtonPress();
        if (typeof clearGhostBlock === 'function') clearGhostBlock();
        completeOnboarding();
        skipOnboarding();
    }, [clearGhostBlock, completeOnboarding, skipOnboarding]);

    if (phase === "done") return null;

    const ghostBlock = ghostBlockId ? getDemoBlockById(ghostBlockId) : null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Skip button */}
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            {/* ─── TITLE ─────────────────────────── */}
            <TitleReveal
                visible={phase === "title"}
                onComplete={handleTitleComplete}
            />

            {/* ─── CLAIM ─────────────────────────── */}
            {phase === "claim" && (
                <>
                    <CoachMark
                        message="This block is unclaimed"
                        position="center"
                        arrow="down"
                        visible
                    />

                    <Animated.View style={[
                        styles.claimContainer,
                        { opacity: claimFade, transform: [{ scale: claimScale }] },
                    ]}>
                        <StepDots current={0} total={3} />
                        <TouchableOpacity
                            testID="onboarding-claim-button"
                            style={styles.claimButton}
                            onPress={handleClaim}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.claimButtonText}>CLAIM IT</Text>
                        </TouchableOpacity>
                        <Text style={styles.claimHint}>
                            Make it yours before someone else does
                        </Text>
                    </Animated.View>
                </>
            )}

            {/* ─── CUSTOMIZE ─────────────────────── */}
            {phase === "customize" && (
                <Animated.View style={[
                    styles.customizeContainer,
                    { opacity: customizeFade, transform: [{ translateY: customizeSlide }] },
                ]}>
                    <StepDots current={1} total={3} />
                    <Text style={styles.customizeLabel}>Pick your color</Text>
                    <Text style={styles.customizeSub}>
                        Everyone on the tower will see this
                    </Text>

                    <View style={styles.colorRow}>
                        {ONBOARDING_COLORS.map((color) => (
                            <TouchableOpacity
                                key={color}
                                style={[
                                    styles.colorSwatch,
                                    { backgroundColor: color },
                                    ghostBlock?.ownerColor === color && styles.colorSwatchSelected,
                                ]}
                                onPress={() => handleColorPick(color)}
                            />
                        ))}
                    </View>

                    <TouchableOpacity
                        style={styles.doneButton}
                        onPress={handleCustomizeDone}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* ─── REVEAL ────────────────────────── */}
            {phase === "reveal" && (
                <Animated.View
                    style={[styles.revealContainer, { opacity: revealFade }]}
                    pointerEvents="none"
                >
                    <View style={styles.revealScrim} />
                    <StepDots current={2} total={3} />
                    <Text style={styles.revealTitle}>
                        You're keeper #{keeperNumber}
                    </Text>
                    <View style={styles.revealDivider} />
                    <Text style={styles.revealStakes}>
                        Your block decays every day.{"\n"}
                        Charge it to keep it alive.
                    </Text>
                    <Text style={styles.revealWarning}>
                        Miss 3 days and anyone can take it.
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

    // ─── Step dots ──────────────────────────────
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

    // ─── Claim ──────────────────────────────────
    claimContainer: {
        position: "absolute",
        bottom: 100,
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
        fontFamily: FONT_FAMILY.headingBlack,
        fontSize: 24,
        color: COLORS.textOnGold,
        letterSpacing: 3,
    },
    claimHint: {
        fontFamily: FONT_FAMILY.bodyMedium,
        fontSize: 14,
        color: COLORS.textOnDark,
        marginTop: SPACING.md,
        letterSpacing: 0.3,
        textShadowColor: "rgba(0, 0, 0, 0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 8,
    },

    // ─── Customize ──────────────────────────────
    customizeContainer: {
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
    customizeLabel: {
        fontFamily: FONT_FAMILY.heading,
        fontSize: 20,
        color: COLORS.goldLight,
        letterSpacing: 0.5,
    },
    customizeSub: {
        fontFamily: FONT_FAMILY.body,
        fontSize: 13,
        color: COLORS.textMuted,
        marginTop: SPACING.xs,
        marginBottom: SPACING.md,
    },
    colorRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    colorSwatch: {
        width: 48,
        height: 48,
        borderRadius: RADIUS.sm,
        borderWidth: 3,
        borderColor: "transparent",
    },
    colorSwatchSelected: {
        borderColor: COLORS.textOnDark,
        borderWidth: 3,
    },
    doneButton: {
        backgroundColor: COLORS.gold,
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.sm + 2,
        borderRadius: RADIUS.md,
        borderCurve: "continuous",
    },
    doneButtonText: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 15,
        color: COLORS.textOnGold,
        letterSpacing: 0.5,
    },

    // ─── Reveal ─────────────────────────────────
    revealContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: SPACING.xl,
        zIndex: 200,
    },
    revealScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(6, 8, 16, 0.55)",
    },
    revealTitle: {
        fontFamily: FONT_FAMILY.heading,
        fontSize: 26,
        color: COLORS.goldLight,
        textAlign: "center",
        letterSpacing: 0.5,
        textShadowColor: "rgba(0, 0, 0, 0.9)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 16,
    },
    revealDivider: {
        width: 40,
        height: 2,
        backgroundColor: COLORS.goldGlow,
        marginVertical: SPACING.md,
        borderRadius: 1,
    },
    revealStakes: {
        fontFamily: FONT_FAMILY.bodyMedium,
        fontSize: 16,
        color: COLORS.textOnDark,
        textAlign: "center",
        lineHeight: 24,
        textShadowColor: "rgba(0, 0, 0, 0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 10,
    },
    revealWarning: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 14,
        color: COLORS.fading,
        textAlign: "center",
        marginTop: SPACING.md,
        textShadowColor: "rgba(0, 0, 0, 0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 8,
    },
});
