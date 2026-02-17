import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import {
    COLORS,
    RADIUS,
    SPACING,
    FONT_FAMILY,
    TIMING,
    SHADOW,
    getChargeColor,
    getChargeLabel,
    getChargeState,
} from "@/constants/theme";

type ChargeBarSize = "sm" | "md" | "lg";

interface ChargeBarProps {
    /** Charge level 0-100 */
    charge: number;
    /** Size preset */
    size?: ChargeBarSize;
    /** Show state label (e.g. "Blazing 🔥") */
    showLabel?: boolean;
    /** Show numeric percentage */
    showPercentage?: boolean;
}

const BAR_HEIGHTS: Record<ChargeBarSize, number> = {
    sm: 6,
    md: 10,
    lg: 14,
};

/**
 * Animated Charge bar — auto-colors based on charge level.
 * Uses spring animation for smooth fill transitions.
 *
 * @example
 * ```tsx
 * <ChargeBar charge={85} />                          // Gold, medium
 * <ChargeBar charge={30} size="sm" />                // Orange, compact
 * <ChargeBar charge={5} showLabel showPercentage />  // Red, with labels
 * ```
 */
export default function ChargeBar({
    charge,
    size = "md",
    showLabel = false,
    showPercentage = false,
}: ChargeBarProps) {
    const clampedCharge = Math.min(100, Math.max(0, charge));
    const fillAnim = useRef(new Animated.Value(0)).current;
    const color = getChargeColor(clampedCharge);
    const barHeight = BAR_HEIGHTS[size];

    useEffect(() => {
        Animated.spring(fillAnim, {
            toValue: clampedCharge,
            ...TIMING.spring,
            useNativeDriver: false,
        }).start();
    }, [clampedCharge, fillAnim]);

    const fillWidth = fillAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ["0%", "100%"],
    });

    return (
        <View style={styles.container}>
            {(showLabel || showPercentage) && (
                <View style={styles.labelRow}>
                    {showLabel && (
                        <Text style={[styles.stateLabel, { color }]}>
                            {getChargeLabel(clampedCharge)}
                        </Text>
                    )}
                    {showPercentage && (
                        <Text
                            style={[
                                styles.percentLabel,
                                { color },
                                { fontVariant: ["tabular-nums"] },
                            ]}
                        >
                            {Math.round(clampedCharge)}%
                        </Text>
                    )}
                </View>
            )}
            <View style={[styles.barBg, { height: barHeight }]}>
                <Animated.View
                    style={[
                        styles.barFill,
                        {
                            height: barHeight,
                            width: fillWidth,
                            backgroundColor: color,
                        },
                    ]}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
    },
    labelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: SPACING.xs,
    },
    stateLabel: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 12,
        letterSpacing: 0.5,
    },
    percentLabel: {
        fontFamily: FONT_FAMILY.mono,
        fontSize: 13,
    },
    barBg: {
        width: "100%",
        borderRadius: RADIUS.full,
        backgroundColor: COLORS.glassMuted,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        overflow: "hidden",
        boxShadow: SHADOW.insetDepth,
    },
    barFill: {
        borderRadius: RADIUS.full,
    },
});
