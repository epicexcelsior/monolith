import React, { useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    Animated,
    useWindowDimensions,
} from "react-native";
import { COLORS, FONT_FAMILY, SPACING } from "@/constants/theme";

/**
 * CoachMark — Floating tooltip bubble for onboarding guidance.
 *
 * Shows a brief message with a directional arrow, pulsing gold border,
 * and spring entrance animation. Used to direct users to tap target elements.
 *
 * NOTE: Scale (native driver) and borderColor (JS driver) must live on
 * separate Animated.Views to avoid the RN native-driver conflict error.
 */

interface CoachMarkProps {
    /** Short message, max ~8 words */
    message: string;
    /** Where to position the bubble */
    position?: "top" | "center" | "bottom";
    /** Arrow direction pointing toward the target */
    arrow?: "up" | "down" | "none";
    /** Whether the coach mark is visible */
    visible: boolean;
}

export default function CoachMark({
    message,
    position = "bottom",
    arrow = "none",
    visible,
}: CoachMarkProps) {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const { height } = useWindowDimensions();

    useEffect(() => {
        if (visible) {
            // Spring entrance (native driver — transform only)
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 60,
                friction: 8,
                useNativeDriver: true,
            }).start();

            // Pulsing glow loop (JS driver — borderColor)
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1200,
                        useNativeDriver: false,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 0,
                        duration: 1200,
                        useNativeDriver: false,
                    }),
                ]),
            ).start();
        } else {
            Animated.timing(scaleAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    if (!visible) return null;

    const borderColor = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["rgba(212, 168, 71, 0.4)", "rgba(212, 168, 71, 0.9)"],
    });

    // Position styles
    const positionStyle =
        position === "top"
            ? { top: height * 0.15 }
            : position === "center"
                ? { top: height * 0.42 }
                : { bottom: height * 0.18 };

    return (
        <View style={[styles.container, positionStyle]} pointerEvents="none">
            {arrow === "up" && <View style={styles.arrowUp} />}

            {/* Outer: JS-driven pulse (borderColor) — no transform here */}
            <Animated.View style={[styles.bubble, { borderColor }]}>
                {/* Inner: native-driven scale — no color props here */}
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                    <Text style={styles.message}>{message}</Text>
                </Animated.View>
            </Animated.View>

            {arrow === "down" && <View style={styles.arrowDown} />}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 100,
    },
    bubble: {
        backgroundColor: "rgba(10, 12, 20, 0.92)",
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderRadius: 16,
        borderWidth: 1.5,
        borderCurve: "continuous",
        maxWidth: 300,
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4), 0 0 30px rgba(212, 168, 71, 0.2)",
    },
    message: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 15,
        lineHeight: 21,
        color: COLORS.textOnDark,
        textAlign: "center",
        letterSpacing: 0.3,
    },
    arrowUp: {
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderBottomWidth: 10,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderBottomColor: "rgba(212, 168, 71, 0.7)",
        marginBottom: -1,
    },
    arrowDown: {
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderTopWidth: 10,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderTopColor: "rgba(212, 168, 71, 0.7)",
        marginTop: -1,
    },
});
