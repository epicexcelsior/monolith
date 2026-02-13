import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, useWindowDimensions } from "react-native";
import { COLORS, SPACING } from "@/constants/theme";
import { useTowerStore } from "@/stores/tower-store";
import { DEFAULT_TOWER_CONFIG } from "@monolith/common";

const INDICATOR_HEIGHT_RATIO = 0.55; // 55% of screen height
const DOT_SIZE = 10;
const BAR_WIDTH = 2;
const FADE_DURATION = 800;

/**
 * LayerIndicator — Vertical bar on the right edge showing the
 * camera's current focused layer position.
 *
 * - Thin glowing vertical line (55% screen height)
 * - Small glowing diamond that moves up/down per layer
 * - Layer number label next to the diamond
 * - Fades out after 2s of no change
 *
 * Non-intrusive: positioned far right, semi-transparent.
 */
export default function LayerIndicator() {
    const focusedLayer = useTowerStore((s) => s.focusedLayer);
    const zoomTier = useTowerStore((s) => s.zoomTier);
    const { height: screenHeight } = useWindowDimensions();

    const opacity = useRef(new Animated.Value(0.6)).current;
    const dotPosition = useRef(new Animated.Value(0)).current;
    const fadeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const indicatorHeight = screenHeight * INDICATOR_HEIGHT_RATIO;
    const layerCount = DEFAULT_TOWER_CONFIG.layerCount;

    // Animate the dot position when layer changes
    useEffect(() => {
        // Normalize: layer 0 = bottom, max = top
        const normalizedY =
            1 - focusedLayer / (layerCount - 1);
        const targetY = normalizedY * (indicatorHeight - DOT_SIZE);

        Animated.spring(dotPosition, {
            toValue: targetY,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
        }).start();

        // Show indicator on change, fade out after idle
        Animated.timing(opacity, {
            toValue: 0.8,
            duration: 200,
            useNativeDriver: true,
        }).start();

        if (fadeTimeout.current) clearTimeout(fadeTimeout.current);
        fadeTimeout.current = setTimeout(() => {
            Animated.timing(opacity, {
                toValue: 0.2,
                duration: FADE_DURATION,
                useNativeDriver: true,
            }).start();
        }, 2000);

        return () => {
            if (fadeTimeout.current) clearTimeout(fadeTimeout.current);
        };
    }, [focusedLayer, indicatorHeight, layerCount, dotPosition, opacity]);

    // Zone label for the focused layer
    const zoneLabel = getZoneLabel(focusedLayer, layerCount);

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    height: indicatorHeight,
                    opacity,
                },
            ]}
            pointerEvents="none"
        >
            {/* Vertical glow bar */}
            <View style={styles.barTrack}>
                <View style={styles.barLine} />
            </View>

            {/* Moving indicator dot + label */}
            <Animated.View
                style={[
                    styles.dotContainer,
                    {
                        transform: [{ translateY: dotPosition }],
                    },
                ]}
            >
                {/* Label */}
                <View style={styles.labelContainer}>
                    <Text style={styles.layerNumber}>L{focusedLayer + 1}</Text>
                    <Text style={styles.zoneLabel}>{zoneLabel}</Text>
                </View>

                {/* Diamond dot */}
                <View style={styles.dot}>
                    <View style={styles.dotInner} />
                </View>
            </Animated.View>
        </Animated.View>
    );
}

/**
 * Returns a zone label for the layer position.
 */
function getZoneLabel(layer: number, totalLayers: number): string {
    const ratio = layer / (totalLayers - 1);
    if (ratio >= 0.9) return "Crown";
    if (ratio >= 0.75) return "Spire";
    if (ratio >= 0.5) return "Skyline";
    if (ratio >= 0.25) return "Core";
    if (ratio >= 0.1) return "Base";
    return "Foundation";
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        right: SPACING.md,
        top: "22%",
        alignItems: "flex-end",
        justifyContent: "flex-start",
    },
    barTrack: {
        position: "absolute",
        right: DOT_SIZE / 2 - BAR_WIDTH / 2,
        top: 0,
        bottom: 0,
        width: BAR_WIDTH,
        justifyContent: "center",
    },
    barLine: {
        flex: 1,
        width: BAR_WIDTH,
        borderRadius: 1,
        backgroundColor: COLORS.cyan,
        opacity: 0.25,
    },
    dotContainer: {
        flexDirection: "row",
        alignItems: "center",
        position: "absolute",
        right: 0,
    },
    labelContainer: {
        marginRight: SPACING.sm,
        alignItems: "flex-end",
    },
    layerNumber: {
        color: COLORS.cyan,
        fontSize: 11,
        fontWeight: "700",
        fontVariant: ["tabular-nums"],
        letterSpacing: 0.5,
    },
    zoneLabel: {
        color: COLORS.textMuted,
        fontSize: 9,
        fontWeight: "500",
        letterSpacing: 0.5,
    },
    dot: {
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
        backgroundColor: COLORS.cyan + "44",
        alignItems: "center",
        justifyContent: "center",
    },
    dotInner: {
        width: DOT_SIZE - 4,
        height: DOT_SIZE - 4,
        borderRadius: (DOT_SIZE - 4) / 2,
        backgroundColor: COLORS.cyan,
    },
});
