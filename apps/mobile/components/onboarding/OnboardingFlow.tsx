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
import { COLORS, SPACING, RADIUS, TEXT, TIMING } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { playCustomize, playButtonTap, playChargeTap, playPokeSend } from "@/utils/audio";
import { useClaimCelebration } from "@/hooks/useClaimCelebration";
import Button from "@/components/ui/Button";
import StepCard from "@/components/ui/StepCard";

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
        advancePhase(); // → charge
    }, [advancePhase]);

    // ─── Phase: CHARGE ────────────────────────────
    const handleCharge = useCallback(() => {
        if (!ghostBlockId) return;
        hapticButtonPress();
        playChargeTap();
        ghostChargeBlock(ghostBlockId);
        setRecentlyChargedId(ghostBlockId);
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
                <View style={styles.skipContainer}>
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

                    <Button
                        title="CLAIM THIS BLOCK"
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
                <View style={styles.stepCardContainer}>
                    <StepCard
                        title="Make it yours"
                        subtitle="Pick a color and emoji"
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
                <View style={styles.stepCardContainer}>
                    <StepCard
                        title="Charge your block daily"
                        step={currentStep}
                        totalSteps={TOTAL_STEPS}
                    >
                        <Text style={styles.chargeWarning}>
                            Miss 3 days and anyone can take it
                        </Text>

                        <View style={styles.buttonRow}>
                            <Button
                                title="⚡ CHARGE"
                                variant="gold"
                                size="lg"
                                onPress={handleCharge}
                            />
                        </View>

                        <Text style={styles.panelHint}>
                            Your block decays every 24 hours.{"\n"}
                            Come back to keep it alive.
                        </Text>
                    </StepCard>
                </View>
            )}

            {/* ─── POKE ────────────────────────────── */}
            {phase === "poke" && (
                <View style={styles.stepCardContainer}>
                    <StepCard
                        title="Poke your neighbors 👋"
                        subtitle="Give them a boost of energy"
                        step={currentStep}
                        totalSteps={TOTAL_STEPS}
                    >
                        <View style={styles.pokeButtons}>
                            <Button
                                title="POKE"
                                variant="secondary"
                                size="md"
                                onPress={handlePoke}
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
                <View style={styles.stepCardContainer}>
                    <StepCard
                        title="You're in."
                        subtitle={"Connect a wallet to stake real USDC\nand compete on the leaderboard."}
                        step={currentStep}
                        totalSteps={TOTAL_STEPS}
                    >
                        <View style={styles.walletButtons}>
                            <Button
                                title="CONNECT WALLET"
                                variant="primary"
                                size="md"
                                onPress={handleConnectWallet}
                            />
                            <Button
                                title="PLAY DEMO →"
                                variant="secondary"
                                size="md"
                                onPress={handlePlayDemo}
                            />
                        </View>

                        <Text style={styles.walletHint}>
                            Seed Vault · Phantom · Solflare
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
        top: 54,
        right: SPACING.md,
        zIndex: 300,
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
        bottom: 80,
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
        backgroundColor: "rgba(255, 255, 255, 0.06)",
    },
    emojiText: {
        fontSize: 24,
    },

    // ─── Button row (centered) ────────────────
    buttonRow: {
        alignItems: "center",
        marginTop: SPACING.sm,
    },

    // ─── Charge ───────────────────────────────
    chargeWarning: {
        ...TEXT.bodySm,
        fontWeight: "600",
        color: COLORS.fading,
        textAlign: "center",
        marginBottom: SPACING.md,
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

    // ─── Wallet ───────────────────────────────
    walletButtons: {
        flexDirection: "row",
        gap: SPACING.md,
        justifyContent: "center",
        marginTop: SPACING.sm,
    },
    walletHint: {
        ...TEXT.caption,
        color: COLORS.textMuted,
        marginTop: SPACING.md,
        textAlign: "center",
    },
});
