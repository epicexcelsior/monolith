import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, RADIUS, SPACING, FONT_FAMILY } from "@/constants/theme";

type BadgeVariant = "solid" | "outline" | "dot";

interface BadgeProps {
    /** Badge label text */
    label: string;
    /** Badge color */
    color?: string;
    /** Visual variant */
    variant?: BadgeVariant;
}

/**
 * Reusable Badge component — for block states, streaks, and status indicators.
 *
 * @example
 * ```tsx
 * <Badge label="BLAZING" color={COLORS.blazing} />
 * <Badge label="Day 7 🏅" variant="outline" color={COLORS.gold} />
 * <Badge label="Connected" variant="dot" color={COLORS.success} />
 * ```
 */
export default function Badge({
    label,
    color = COLORS.gold,
    variant = "solid",
}: BadgeProps) {
    if (variant === "dot") {
        return (
            <View style={styles.dotContainer}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={[styles.dotLabel, { color }]}>{label}</Text>
            </View>
        );
    }

    const containerStyle =
        variant === "solid"
            ? [styles.base, { backgroundColor: COLORS.glassMuted, borderColor: color + "40", borderWidth: 1, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)" }]
            : [styles.base, styles.outlineBase, { borderColor: color }];

    return (
        <View style={containerStyle}>
            <Text style={[styles.label, { color }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 3,
        borderRadius: RADIUS.sm,
        borderCurve: "continuous",
        alignSelf: "flex-start",
    },
    outlineBase: {
        backgroundColor: "transparent",
        borderWidth: 1,
    },
    label: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 11,
        letterSpacing: 1,
        textTransform: "uppercase",
    },
    // Dot variant
    dotContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.xs + 2,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dotLabel: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 13,
    },
});
