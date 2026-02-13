import React from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import { COLORS, RADIUS, SPACING, SHADOW } from "@/constants/theme";

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
 * Reusable Card component — content container with warm shadow.
 *
 * @example
 * ```tsx
 * <Card>
 *   <Text style={TEXT.headingSm}>Balance</Text>
 *   <Text style={TEXT.mono}>$42.00 USDC</Text>
 * </Card>
 *
 * <Card variant="accent">
 *   <Text>Gold-highlighted important info</Text>
 * </Card>
 * ```
 */
export default function Card({
    variant = "default",
    style,
    children,
}: CardProps) {
    return (
        <View style={[styles.base, variantStyles[variant], style]}>{children}</View>
    );
}

const styles = StyleSheet.create({
    base: {
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        borderCurve: "continuous",
        boxShadow: SHADOW.sm,
    },
});

const variantStyles = StyleSheet.create({
    default: {
        backgroundColor: COLORS.bgCard,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    accent: {
        backgroundColor: COLORS.goldSubtle,
        borderWidth: 1,
        borderColor: COLORS.borderAccent,
    },
    muted: {
        backgroundColor: COLORS.bgMuted,
        borderWidth: 0,
    },
});
