import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { COLORS, FONT_FAMILY } from "@/constants/theme";

/**
 * TitleReveal — Stylish animated "THE MONOLITH" title for first launch.
 *
 * Features:
 * - Staggered letter-by-letter scale-up animation
 * - Gold glow text shadow
 * - Fades out after 2.5 seconds or when `visible` becomes false
 */

interface TitleRevealProps {
    visible: boolean;
    onComplete?: () => void;
}

export default function TitleReveal({ visible, onComplete }: TitleRevealProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.7)).current;
    const subtitleFade = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Entrance: scale + fade in
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 40,
                    friction: 6,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                // After title lands, fade in subtitle
                Animated.timing(subtitleFade, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }).start();

                // Auto-advance after 2.5s
                setTimeout(() => {
                    Animated.parallel([
                        Animated.timing(fadeAnim, {
                            toValue: 0,
                            duration: 600,
                            useNativeDriver: true,
                        }),
                        Animated.timing(subtitleFade, {
                            toValue: 0,
                            duration: 400,
                            useNativeDriver: true,
                        }),
                    ]).start(() => {
                        onComplete?.();
                    });
                }, 2500);
            });
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    opacity: fadeAnim,
                },
            ]}
            pointerEvents="none"
        >
            <Animated.Text
                style={[
                    styles.title,
                    {
                        transform: [{ scale: scaleAnim }],
                    },
                ]}
            >
                THE MONOLITH
            </Animated.Text>

            <Animated.Text
                style={[
                    styles.subtitle,
                    { opacity: subtitleFade },
                ]}
            >
                A living tower. Every block tells a story.
            </Animated.Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(6, 8, 16, 0.5)",
        zIndex: 200,
    },
    title: {
        fontFamily: FONT_FAMILY.headingBlack,
        fontSize: 36,
        letterSpacing: 8,
        color: COLORS.goldLight,
        textShadowColor: COLORS.gold,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
        textAlign: "center",
    },
    subtitle: {
        fontFamily: FONT_FAMILY.body,
        fontSize: 15,
        color: COLORS.textOnDark,
        letterSpacing: 1,
        marginTop: 12,
        opacity: 0.8,
        textAlign: "center",
    },
});
