import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { COLORS, FONT_FAMILY, SPACING, RADIUS, SHADOW } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";

/**
 * TitleReveal — First thing the user sees over the live tower.
 *
 * Communicates the value prop in 3 seconds:
 * - "THE MONOLITH" (branding)
 * - "650 blocks. One tower. Yours to keep — or lose." (stakes)
 * - "Find Your Spot" CTA
 *
 * Dark scrim ensures text reads over any tower state.
 */

interface TitleRevealProps {
    visible: boolean;
    onComplete?: () => void;
}

export default function TitleReveal({ visible, onComplete }: TitleRevealProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const subtitleFade = useRef(new Animated.Value(0)).current;
    const ctaFade = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }).start(() => {
                Animated.timing(subtitleFade, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }).start(() => {
                    Animated.timing(ctaFade, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: true,
                    }).start();
                });
            });
        }
    }, [visible]);

    if (!visible) return null;

    const handleFindSpot = () => {
        hapticButtonPress();
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(subtitleFade, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(ctaFade, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onComplete?.();
        });
    };

    return (
        <View style={styles.container} pointerEvents="box-none">
            {/* Full-screen dark scrim — guarantees text contrast */}
            <View style={styles.scrim} pointerEvents="none" />

            {/* Title + value prop */}
            <View style={styles.titleArea} pointerEvents="none">
                <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
                    THE MONOLITH
                </Animated.Text>

                <Animated.View style={[styles.taglineContainer, { opacity: subtitleFade }]}>
                    <Text style={styles.tagline}>
                        650 blocks. Real people. Real stakes.
                    </Text>
                    <Text style={styles.taglineAccent}>
                        Yours to keep — or lose.
                    </Text>
                </Animated.View>
            </View>

            {/* CTA at bottom */}
            <Animated.View style={[styles.ctaContainer, { opacity: ctaFade }]}>
                <TouchableOpacity
                    style={styles.ctaButton}
                    onPress={handleFindSpot}
                    activeOpacity={0.8}
                >
                    <Text style={styles.ctaText}>Find Your Spot</Text>
                </TouchableOpacity>

                <Animated.Text style={[styles.ctaHint, { opacity: ctaFade }]}>
                    Charge daily or someone takes it
                </Animated.Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 200,
        justifyContent: "space-between",
    },
    scrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(6, 8, 16, 0.6)",
    },
    titleArea: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 60,
    },
    title: {
        fontFamily: FONT_FAMILY.headingBlack,
        fontSize: 36,
        letterSpacing: 8,
        color: COLORS.goldLight,
        textShadowColor: "rgba(0, 0, 0, 0.9)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 30,
        textAlign: "center",
    },
    taglineContainer: {
        alignItems: "center",
        marginTop: SPACING.lg,
    },
    tagline: {
        fontFamily: FONT_FAMILY.bodyMedium,
        fontSize: 17,
        color: COLORS.textOnDark,
        letterSpacing: 0.5,
        textAlign: "center",
        textShadowColor: "rgba(0, 0, 0, 0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 12,
    },
    taglineAccent: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 17,
        color: COLORS.gold,
        letterSpacing: 0.5,
        marginTop: SPACING.xs,
        textAlign: "center",
        textShadowColor: "rgba(0, 0, 0, 0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 12,
    },
    ctaContainer: {
        alignItems: "center",
        paddingBottom: 120,
    },
    ctaButton: {
        backgroundColor: COLORS.gold,
        paddingHorizontal: SPACING.xxl,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.md,
        borderCurve: "continuous",
        boxShadow: SHADOW.gold,
    },
    ctaText: {
        fontFamily: FONT_FAMILY.bodyBold,
        fontSize: 18,
        color: COLORS.textOnGold,
        letterSpacing: 1,
    },
    ctaHint: {
        fontFamily: FONT_FAMILY.body,
        fontSize: 13,
        color: COLORS.textMuted,
        marginTop: SPACING.sm,
        letterSpacing: 0.3,
        textShadowColor: "rgba(0, 0, 0, 0.7)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 8,
    },
});
