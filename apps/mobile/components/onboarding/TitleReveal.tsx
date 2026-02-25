import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { COLORS, FONT_FAMILY, SPACING, RADIUS, SHADOW } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";

/**
 * TitleReveal — "MONOLITH" overlay during the final moments of the cinematic orbit.
 *
 * Minimal design: title + one-line tagline + CTA button.
 * Light 20% scrim behind text area only — don't dim the whole tower.
 */

interface TitleRevealProps {
    visible: boolean;
    onComplete?: () => void;
}

export default function TitleReveal({ visible, onComplete }: TitleRevealProps) {
    const titleFade = useRef(new Animated.Value(0)).current;
    const taglineFade = useRef(new Animated.Value(0)).current;
    const ctaFade = useRef(new Animated.Value(0)).current;
    const ctaScale = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        if (visible) {
            // Title fades in
            Animated.timing(titleFade, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }).start();

            // Tagline follows 400ms later
            Animated.timing(taglineFade, {
                toValue: 1,
                duration: 400,
                delay: 400,
                useNativeDriver: true,
            }).start();

            // CTA springs in 600ms after title
            Animated.parallel([
                Animated.timing(ctaFade, {
                    toValue: 1,
                    duration: 300,
                    delay: 600,
                    useNativeDriver: true,
                }),
                Animated.spring(ctaScale, {
                    toValue: 1,
                    tension: 60,
                    friction: 8,
                    delay: 600,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible, titleFade, taglineFade, ctaFade, ctaScale]);

    if (!visible) return null;

    const handleGetStarted = () => {
        hapticButtonPress();
        playButtonTap();
        // Fade out all elements quickly
        Animated.parallel([
            Animated.timing(titleFade, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(taglineFade, {
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
            {/* Subtle scrim — only behind text area, ~20% opacity */}
            <View style={styles.scrim} pointerEvents="none" />

            {/* Title + tagline — centered */}
            <View style={styles.titleArea} pointerEvents="none">
                <Animated.Text style={[styles.title, { opacity: titleFade }]}>
                    MONOLITH
                </Animated.Text>

                <Animated.Text style={[styles.tagline, { opacity: taglineFade }]}>
                    Own your piece of the tower
                </Animated.Text>
            </View>

            {/* CTA at bottom */}
            <Animated.View style={[
                styles.ctaContainer,
                { opacity: ctaFade, transform: [{ scale: ctaScale }] },
            ]}>
                <TouchableOpacity
                    style={styles.ctaButton}
                    onPress={handleGetStarted}
                    activeOpacity={0.8}
                >
                    <Text style={styles.ctaText}>GET STARTED</Text>
                </TouchableOpacity>
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
        backgroundColor: "rgba(6, 8, 16, 0.20)",
    },
    titleArea: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 60,
    },
    title: {
        fontFamily: FONT_FAMILY.headingBlack,
        fontSize: 48,
        letterSpacing: 6,
        color: COLORS.textOnDark,
        textShadowColor: "rgba(0, 0, 0, 0.9)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 30,
        textAlign: "center",
    },
    tagline: {
        fontFamily: FONT_FAMILY.bodyMedium,
        fontSize: 16,
        color: COLORS.textMuted,
        letterSpacing: 0.5,
        marginTop: SPACING.md,
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
        paddingHorizontal: SPACING.xxl * 1.5,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.full,
        borderCurve: "continuous",
        boxShadow: SHADOW.gold,
    },
    ctaText: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 16,
        color: COLORS.textOnGold,
        letterSpacing: 1,
    },
});
