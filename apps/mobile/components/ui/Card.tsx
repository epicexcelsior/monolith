import React from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { COLORS, GLASS_STYLE, RADIUS, SPACING } from "@/constants/theme";
import GlassView from "./GlassView";

type CardVariant = "default" | "accent" | "muted";

interface CardProps {
    /** Visual variant */
    variant?: CardVariant;
    /** Additional styles */
    style?: ViewStyle;
    /** Card content */
    children: React.ReactNode;
}

/**
 * Card — Liquid glass content container.
 *
 * Variants:
 *   - `default` — standard glass card with shimmer
 *   - `accent`  — gold-bordered glass card
 *   - `muted`   — subtle, lower-prominence glass
 *
 * @example
 * ```tsx
 * <Card>
 *   <Text style={TEXT.headingSm}>Balance</Text>
 *   <Text style={TEXT.mono}>$42.00 USDC</Text>
 * </Card>
 * ```
 */
export default function Card({
    variant = "default",
    style,
    children,
}: CardProps) {
    if (variant === "accent") {
        return (
            <Animated.View entering={FadeIn.duration(250)}>
                <GlassView
                    variant="card"
                    style={[
                        { borderColor: COLORS.gold, borderWidth: 1.5 },
                        style,
                    ]}
                >
                    {children}
                </GlassView>
            </Animated.View>
        );
    }

    if (variant === "muted") {
        return (
            <Animated.View
                entering={FadeIn.duration(250)}
                style={[GLASS_STYLE.muted, { padding: SPACING.md }, style]}
            >
                {children}
            </Animated.View>
        );
    }

    // Default: liquid glass card with fade-in
    return (
        <Animated.View entering={FadeIn.duration(250)}>
            <GlassView variant="card" style={style}>
                {children}
            </GlassView>
        </Animated.View>
    );
}
