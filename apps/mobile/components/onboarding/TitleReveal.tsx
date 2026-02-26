import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { COLORS, FONT_FAMILY, SPACING, TEXT, TIMING } from "@/constants/theme";
import { hapticButtonPress } from "@/utils/haptics";
import { playButtonTap } from "@/utils/audio";
import Button from "@/components/ui/Button";

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
            Animated.timing(titleFade, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }).start();

            Animated.timing(taglineFade, {
                toValue: 1,
                duration: 400,
                delay: 400,
                useNativeDriver: true,
            }).start();

            Animated.parallel([
                Animated.timing(ctaFade, {
                    toValue: 1,
                    duration: 300,
                    delay: 600,
                    useNativeDriver: true,
                }),
                Animated.spring(ctaScale, {
                    toValue: 1,
                    ...TIMING.springOnboarding,
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
            <View style={styles.scrim} pointerEvents="none" />

            <View style={styles.titleArea} pointerEvents="none">
                <Animated.Text style={[styles.title, { opacity: titleFade }]}>
                    MONOLITH
                </Animated.Text>

                <Animated.Text style={[styles.tagline, { opacity: taglineFade }]}>
                    Own your piece of the tower
                </Animated.Text>
            </View>

            <Animated.View style={[
                styles.ctaContainer,
                { opacity: ctaFade, transform: [{ scale: ctaScale }] },
            ]}>
                <Button
                    title="GET STARTED"
                    variant="primary"
                    size="lg"
                    onPress={handleGetStarted}
                />
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
        ...TEXT.bodyLg,
        color: COLORS.textMuted,
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
});
