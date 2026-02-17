import React, { useEffect, useRef, useCallback, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useTowerStore } from "@/stores/tower-store";
import TitleReveal from "./TitleReveal";
import CoachMark from "./CoachMark";
import { COLORS, FONT_FAMILY, SPACING, RADIUS, TIMING } from "@/constants/theme";
import { hapticBlockClaimed, hapticButtonPress } from "@/utils/haptics";
import { playBlockClaim, playChargeTap } from "@/utils/audio";

/**
 * OnboardingFlow — Main orchestrator for the interactive onboarding.
 *
 * Replaces the old 3-card text overlay with a learn-by-doing flow:
 *   0. Title reveal → camera flies to dormant block
 *   1. User taps block → ghost claim with celebration
 *   2. Block decays → user charges it
 *   3. Completion card → Connect Wallet / Keep Exploring
 */

/** Find a good dormant block to use for the tutorial */
function pickTutorialBlock(
    demoBlocks: { id: string; owner: string | null; layer: number }[],
): string | null {
    // Prefer unclaimed blocks in mid layers (more visually interesting)
    const unclaimed = demoBlocks.filter((b) => b.owner === null);
    if (unclaimed.length === 0) return null;

    // Pick from middle layers for better camera framing
    const sorted = [...unclaimed].sort(
        (a, b) => Math.abs(a.layer - 8) - Math.abs(b.layer - 8),
    );
    return sorted[0].id;
}

export default function OnboardingFlow() {
    const router = useRouter();
    const { height } = useWindowDimensions();

    // Onboarding state
    const phase = useOnboardingStore((s) => s.phase);
    const advancePhase = useOnboardingStore((s) => s.advancePhase);
    const ghostBlockId = useOnboardingStore((s) => s.ghostBlockId);
    const setGhostBlock = useOnboardingStore((s) => s.setGhostBlock);
    const skipOnboarding = useOnboardingStore((s) => s.skipOnboarding);

    // Tower state
    const demoBlocks = useTowerStore((s) => s.demoBlocks);
    const ghostClaimBlock = useTowerStore((s) => s.ghostClaimBlock);
    const ghostChargeBlock = useTowerStore((s) => s.ghostChargeBlock);
    const ghostDecayBlock = useTowerStore((s) => s.ghostDecayBlock);
    const clearGhostBlock = useTowerStore((s) => s.clearGhostBlock);
    const selectBlock = useTowerStore((s) => s.selectBlock);
    const selectedBlockId = useTowerStore((s) => s.selectedBlockId);
    const completeOnboarding = useTowerStore((s) => s.completeOnboarding);
    const getDemoBlockById = useTowerStore((s) => s.getDemoBlockById);

    // Animations
    const cardAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const toastAnim = useRef(new Animated.Value(0)).current;

    // Local state
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [hasDecayed, setHasDecayed] = useState(false);
    const decayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── Phase: TITLE ─────────────────────────────
    // After title reveal fades, pick a tutorial block and advance to claim
    const handleTitleComplete = useCallback(() => {
        const blockId = pickTutorialBlock(demoBlocks);
        if (blockId) {
            setGhostBlock(blockId);
            selectBlock(blockId); // This triggers camera fly-to
        }
        advancePhase(); // → claim
    }, [demoBlocks, setGhostBlock, selectBlock, advancePhase]);

    // ─── Phase: CLAIM ─────────────────────────────
    // When user taps "Claim This Block" in the claim card
    const handleGhostClaim = useCallback(() => {
        if (!ghostBlockId) return;
        ghostClaimBlock(ghostBlockId);
        hapticBlockClaimed();
        playBlockClaim();

        // Show toast
        setToastMessage("🔥 Your block is BLAZING!");
        setShowToast(true);
        Animated.sequence([
            Animated.timing(toastAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.delay(1800),
            Animated.timing(toastAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setShowToast(false);
            advancePhase(); // → charge
        });
    }, [ghostBlockId, ghostClaimBlock, advancePhase, toastAnim]);

    // ─── Phase: CHARGE ────────────────────────────
    // Start accelerated decay when entering charge phase
    useEffect(() => {
        if (phase !== "charge" || !ghostBlockId) return;

        // Start rapid decay after a short delay
        decayTimerRef.current = setTimeout(() => {
            ghostDecayBlock(ghostBlockId, 60); // Drop from 100 to ~40
            setHasDecayed(true);
        }, 1500);

        return () => {
            if (decayTimerRef.current) clearTimeout(decayTimerRef.current);
        };
    }, [phase, ghostBlockId, ghostDecayBlock]);

    // Handle charge tap
    const handleGhostCharge = useCallback(() => {
        if (!ghostBlockId) return;
        const result = ghostChargeBlock(ghostBlockId);
        if (result.success) {
            hapticButtonPress();
            playChargeTap();

            // Show streak info toast
            setToastMessage("Charge daily → build streaks → earn multipliers 🔥");
            setShowToast(true);
            Animated.sequence([
                Animated.timing(toastAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.delay(2500),
                Animated.timing(toastAnim, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setShowToast(false);
                advancePhase(); // → complete
            });
        }
    }, [ghostBlockId, ghostChargeBlock, advancePhase, toastAnim]);

    // ─── Phase: COMPLETE ──────────────────────────
    // Show completion card with slide-up animation
    useEffect(() => {
        if (phase === "complete") {
            selectBlock(null); // Deselect block, camera pulls back
            Animated.spring(cardAnim, {
                toValue: 1,
                ...TIMING.spring,
                useNativeDriver: true,
            }).start();
        }
    }, [phase, cardAnim, selectBlock]);

    const handleConnectWallet = useCallback(() => {
        hapticButtonPress();
        clearGhostBlock();
        completeOnboarding();
        skipOnboarding();
        router.push("/connect");
    }, [clearGhostBlock, completeOnboarding, skipOnboarding, router]);

    const handleKeepExploring = useCallback(() => {
        hapticButtonPress();
        clearGhostBlock();
        completeOnboarding();
        skipOnboarding();
    }, [clearGhostBlock, completeOnboarding, skipOnboarding]);

    const handleSkip = useCallback(() => {
        hapticButtonPress();
        clearGhostBlock();
        completeOnboarding();
        skipOnboarding();
    }, [clearGhostBlock, completeOnboarding, skipOnboarding]);

    // ─── Don't render if done ─────────────────────
    if (phase === "done") return null;

    // Get the ghost block's current energy for charge phase UI
    const ghostBlock = ghostBlockId ? getDemoBlockById(ghostBlockId) : null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Skip button (always visible during onboarding) */}
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            {/* ─── Phase: TITLE ────────────────────── */}
            <TitleReveal
                visible={phase === "title"}
                onComplete={handleTitleComplete}
            />

            {/* ─── Phase: CLAIM ────────────────────── */}
            {phase === "claim" && (
                <>
                    <CoachMark
                        message="This dark block needs a keeper. Tap below to claim it!"
                        position="center"
                        arrow="down"
                        visible
                    />

                    {/* Ghost claim action card */}
                    <View style={styles.actionCardContainer}>
                        <View style={styles.actionCard}>
                            <Text style={styles.actionCardTitle}>
                                {ghostBlock
                                    ? `Layer ${ghostBlock.layer} / Block ${ghostBlock.index}`
                                    : "Unclaimed Block"}
                            </Text>
                            <Text style={styles.actionCardSubtitle}>
                                Stake to make it yours. Your block glows when you're active.
                            </Text>
                            <TouchableOpacity
                                style={styles.claimButton}
                                onPress={handleGhostClaim}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.claimButtonText}>Claim This Block</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </>
            )}

            {/* ─── Phase: CHARGE ───────────────────── */}
            {phase === "charge" && (
                <>
                    {!hasDecayed && (
                        <CoachMark
                            message="Watch your block glow..."
                            position="center"
                            visible
                        />
                    )}

                    {hasDecayed && (
                        <>
                            <CoachMark
                                message="Your block is fading! Tap to charge it"
                                position="center"
                                arrow="down"
                                visible
                            />

                            <View style={styles.actionCardContainer}>
                                <View style={styles.actionCard}>
                                    {/* Mini charge bar */}
                                    <View style={styles.chargeBarContainer}>
                                        <View
                                            style={[
                                                styles.chargeBarFill,
                                                {
                                                    width: `${ghostBlock?.energy ?? 0}%`,
                                                    backgroundColor:
                                                        (ghostBlock?.energy ?? 0) > 50
                                                            ? COLORS.blazing
                                                            : (ghostBlock?.energy ?? 0) > 20
                                                                ? COLORS.fading
                                                                : COLORS.flickering,
                                                },
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.chargeLabel}>
                                        {Math.round(ghostBlock?.energy ?? 0)}% Charge
                                    </Text>

                                    <TouchableOpacity
                                        style={styles.chargeButton}
                                        onPress={handleGhostCharge}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.chargeButtonText}>⚡ CHARGE</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </>
                    )}
                </>
            )}

            {/* ─── Phase: COMPLETE ─────────────────── */}
            {phase === "complete" && (
                <View style={styles.completionOverlay}>
                    <Animated.View
                        style={[
                            styles.completionCard,
                            {
                                transform: [
                                    {
                                        translateY: cardAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [300, 0],
                                        }),
                                    },
                                ],
                                opacity: cardAnim,
                            },
                        ]}
                    >
                        <Text style={styles.completionEmoji}>🏛️</Text>
                        <Text style={styles.completionTitle}>Ready to play for real?</Text>
                        <Text style={styles.completionSubtitle}>
                            Connect your wallet to claim a block on the live tower.
                            Your stake earns yield while your block glows.
                        </Text>

                        <TouchableOpacity
                            style={styles.walletButton}
                            onPress={handleConnectWallet}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.walletButtonText}>Connect Wallet</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.exploreButton}
                            onPress={handleKeepExploring}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.exploreButtonText}>Keep Exploring</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            )}

            {/* ─── Toast overlay ───────────────────── */}
            {showToast && (
                <Animated.View
                    style={[styles.toast, { opacity: toastAnim }]}
                    pointerEvents="none"
                >
                    <Text style={styles.toastText}>{toastMessage}</Text>
                </Animated.View>
            )}
        </View>
    );
}

// ─── Styles ─────────────────────────────────────

const styles = StyleSheet.create({
    skipButton: {
        position: "absolute",
        top: 54,
        right: 16,
        zIndex: 300,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.full,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.15)",
    },
    skipText: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 13,
        color: "rgba(255, 255, 255, 0.7)",
        letterSpacing: 0.5,
    },

    // Action card (claim / charge phases)
    actionCardContainer: {
        position: "absolute",
        bottom: 60,
        left: SPACING.md,
        right: SPACING.md,
        alignItems: "center",
        zIndex: 100,
    },
    actionCard: {
        backgroundColor: "rgba(10, 12, 20, 0.88)",
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: "rgba(212, 168, 71, 0.3)",
        borderCurve: "continuous",
        padding: SPACING.lg,
        width: "100%",
        maxWidth: 360,
        alignItems: "center",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
    },
    actionCardTitle: {
        fontFamily: FONT_FAMILY.headingSemibold,
        fontSize: 17,
        color: COLORS.textOnDark,
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    actionCardSubtitle: {
        fontFamily: FONT_FAMILY.body,
        fontSize: 13,
        color: "rgba(240, 236, 230, 0.65)",
        textAlign: "center",
        lineHeight: 18,
        marginBottom: SPACING.md,
    },

    // Claim button
    claimButton: {
        backgroundColor: COLORS.gold,
        paddingHorizontal: SPACING.xl,
        paddingVertical: 14,
        borderRadius: RADIUS.md,
        borderCurve: "continuous",
        width: "100%",
        alignItems: "center",
        boxShadow: "0 4px 20px rgba(212, 168, 71, 0.35)",
    },
    claimButtonText: {
        fontFamily: FONT_FAMILY.bodyBold,
        fontSize: 16,
        color: COLORS.textOnGold,
        letterSpacing: 0.5,
    },

    // Charge bar
    chargeBarContainer: {
        width: "100%",
        height: 8,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        borderRadius: 4,
        overflow: "hidden",
        marginBottom: SPACING.sm,
    },
    chargeBarFill: {
        height: "100%",
        borderRadius: 4,
    },
    chargeLabel: {
        fontFamily: FONT_FAMILY.mono,
        fontSize: 13,
        color: COLORS.textOnDark,
        marginBottom: SPACING.md,
    },

    // Charge button
    chargeButton: {
        backgroundColor: COLORS.blazing,
        paddingHorizontal: SPACING.xl,
        paddingVertical: 14,
        borderRadius: RADIUS.md,
        borderCurve: "continuous",
        width: "100%",
        alignItems: "center",
        boxShadow: "0 4px 20px rgba(255, 184, 0, 0.35)",
    },
    chargeButtonText: {
        fontFamily: FONT_FAMILY.bodyBold,
        fontSize: 16,
        color: "#1A1612",
        letterSpacing: 1,
    },

    // Completion card
    completionOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(6, 8, 16, 0.6)",
        zIndex: 200,
        paddingHorizontal: SPACING.lg,
    },
    completionCard: {
        backgroundColor: "rgba(10, 12, 20, 0.92)",
        borderRadius: RADIUS.xl,
        borderWidth: 1,
        borderColor: "rgba(212, 168, 71, 0.25)",
        borderCurve: "continuous",
        padding: SPACING.xl,
        width: "100%",
        maxWidth: 340,
        alignItems: "center",
        boxShadow: "0 12px 48px rgba(0, 0, 0, 0.6)",
    },
    completionEmoji: {
        fontSize: 48,
        marginBottom: SPACING.md,
    },
    completionTitle: {
        fontFamily: FONT_FAMILY.heading,
        fontSize: 22,
        color: COLORS.goldLight,
        textAlign: "center",
        letterSpacing: 0.5,
        marginBottom: SPACING.sm,
    },
    completionSubtitle: {
        fontFamily: FONT_FAMILY.body,
        fontSize: 14,
        color: "rgba(240, 236, 230, 0.7)",
        textAlign: "center",
        lineHeight: 20,
        marginBottom: SPACING.lg,
    },
    walletButton: {
        backgroundColor: COLORS.gold,
        paddingHorizontal: SPACING.xl,
        paddingVertical: 14,
        borderRadius: RADIUS.md,
        borderCurve: "continuous",
        width: "100%",
        alignItems: "center",
        marginBottom: SPACING.sm,
        boxShadow: "0 4px 20px rgba(212, 168, 71, 0.35)",
    },
    walletButtonText: {
        fontFamily: FONT_FAMILY.bodyBold,
        fontSize: 16,
        color: COLORS.textOnGold,
        letterSpacing: 0.5,
    },
    exploreButton: {
        paddingVertical: 12,
        paddingHorizontal: SPACING.lg,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.15)",
        width: "100%",
        alignItems: "center",
    },
    exploreButtonText: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 14,
        color: "rgba(240, 236, 230, 0.7)",
        letterSpacing: 0.3,
    },

    // Toast
    toast: {
        position: "absolute",
        top: 100,
        left: SPACING.lg,
        right: SPACING.lg,
        alignItems: "center",
        zIndex: 250,
    },
    toastText: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 15,
        color: COLORS.textOnDark,
        backgroundColor: "rgba(10, 12, 20, 0.85)",
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: "rgba(212, 168, 71, 0.3)",
        borderCurve: "continuous",
        textAlign: "center",
        overflow: "hidden",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
    },
});
