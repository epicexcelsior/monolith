import React, { useEffect, useRef, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, Animated, PanResponder, useWindowDimensions } from "react-native";
import { COLORS, SPACING, TIMING } from "@/constants/theme";
import { useTowerStore } from "@/stores/tower-store";
import { DEFAULT_TOWER_CONFIG, getLayerY } from "@monolith/common";
import { hapticBlockSelect, hapticLayerCross } from "@/utils/haptics";
import { playLayerScroll } from "@/utils/audio";

const INDICATOR_HEIGHT_RATIO = 0.55; // 55% of screen height
const DOT_SIZE = 10;
const BAR_WIDTH = 3;
const FADE_DURATION = 800;
const TOUCH_WIDTH = 52; // generous touch target

/**
 * LayerIndicator — Interactive vertical scrubber on the right edge.
 *
 * - Thin glowing vertical line (55% screen height)
 * - Glowing diamond that tracks focused layer
 * - Tap anywhere on bar → fly camera to that layer
 * - Drag along bar → scrub camera through layers in real-time
 * - Fades out after 2s of inactivity
 */
export default function LayerIndicator() {
    const focusedLayer = useTowerStore((s) => s.focusedLayer);
    const cameraStateRef = useTowerStore((s) => s.cameraStateRef);
    const { height: screenHeight } = useWindowDimensions();

    const opacity = useRef(new Animated.Value(0.6)).current;
    const dotPosition = useRef(new Animated.Value(0)).current;
    const fadeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isDraggingRef = useRef(false);
    const prevScrubLayerRef = useRef(-1);

    // Use refs for values the PanResponder needs — avoids stale closures
    const containerRef = useRef<View>(null);
    const layoutRef = useRef({ pageY: 0, height: 0 });

    const indicatorHeight = screenHeight * INDICATOR_HEIGHT_RATIO;
    const layerCount = DEFAULT_TOWER_CONFIG.layerCount;

    // Measure container position on layout
    const onLayout = useCallback(() => {
        containerRef.current?.measureInWindow((_, y, __, h) => {
            if (y !== undefined && h !== undefined) {
                layoutRef.current = { pageY: y, height: h };
            }
        });
    }, []);

    // Map absolute pageY to a layer number
    const pageYToLayer = useCallback((pageY: number): number => {
        const { pageY: containerY, height } = layoutRef.current;
        const h = height || indicatorHeight;
        const relativeY = pageY - containerY;
        const clamped = Math.max(0, Math.min(relativeY, h));
        // Top = highest layer, bottom = layer 0
        const normalizedY = clamped / h;
        const layer = Math.round((1 - normalizedY) * (layerCount - 1));
        return Math.max(0, Math.min(layerCount - 1, layer));
    }, [indicatorHeight, layerCount]);

    const setLookAtForLayer = useCallback((layer: number, transition: boolean) => {
        if (!cameraStateRef?.current) return;
        const cs = cameraStateRef.current;
        const targetY = getLayerY(layer, DEFAULT_TOWER_CONFIG.layerCount);
        cs.targetLookAt.y = targetY;
        cs.velocityLookAtY = 0;
        if (transition) {
            cs.isTransitioning = true;
        }
    }, [cameraStateRef]);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                // Prevent parent (TowerScene) from stealing touches
                onPanResponderTerminationRequest: () => false,

                onPanResponderGrant: (evt) => {
                    isDraggingRef.current = false;
                    const layer = pageYToLayer(evt.nativeEvent.pageY);
                    prevScrubLayerRef.current = layer;

                    // Fly-to with smooth transition on initial tap
                    setLookAtForLayer(layer, true);
                    hapticBlockSelect();

                    // Brighten indicator while touching
                    Animated.timing(opacity, {
                        toValue: 1.0,
                        duration: 100,
                        useNativeDriver: true,
                    }).start();
                },

                onPanResponderMove: (evt) => {
                    isDraggingRef.current = true;
                    const layer = pageYToLayer(evt.nativeEvent.pageY);

                    // Direct tracking — no transition lerp for responsive scrubbing
                    setLookAtForLayer(layer, false);

                    if (layer !== prevScrubLayerRef.current) {
                        hapticLayerCross();
                        playLayerScroll();
                        prevScrubLayerRef.current = layer;
                    }
                },

                onPanResponderRelease: () => {
                    isDraggingRef.current = false;
                    prevScrubLayerRef.current = -1;

                    // Fade back after release
                    if (fadeTimeout.current) clearTimeout(fadeTimeout.current);
                    fadeTimeout.current = setTimeout(() => {
                        Animated.timing(opacity, {
                            toValue: 0.2,
                            duration: FADE_DURATION,
                            useNativeDriver: true,
                        }).start();
                    }, 1500);
                },
            }),
        [pageYToLayer, setLookAtForLayer, opacity],
    );

    // Animate the dot position when layer changes
    useEffect(() => {
        // Normalize: layer 0 = bottom, max = top
        const normalizedY = 1 - focusedLayer / (layerCount - 1);
        const targetY = normalizedY * (indicatorHeight - DOT_SIZE);

        Animated.spring(dotPosition, {
            toValue: targetY,
            useNativeDriver: true,
            ...TIMING.springSnappy,
        }).start();

        // Show indicator on change (but don't override bright state while dragging)
        if (!isDraggingRef.current) {
            Animated.timing(opacity, {
                toValue: 0.8,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }

        if (fadeTimeout.current) clearTimeout(fadeTimeout.current);
        fadeTimeout.current = setTimeout(() => {
            if (!isDraggingRef.current) {
                Animated.timing(opacity, {
                    toValue: 0.2,
                    duration: FADE_DURATION,
                    useNativeDriver: true,
                }).start();
            }
        }, 2000);

        return () => {
            if (fadeTimeout.current) clearTimeout(fadeTimeout.current);
        };
    }, [focusedLayer, indicatorHeight, layerCount, dotPosition, opacity]);

    const zoneLabel = getZoneLabel(focusedLayer, layerCount);

    return (
        <Animated.View
            ref={containerRef}
            onLayout={onLayout}
            style={[
                styles.container,
                {
                    height: indicatorHeight,
                    opacity,
                },
            ]}
            {...panResponder.panHandlers}
        >
            {/* Invisible wider touch target */}
            <View style={styles.touchTarget} />

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
        right: SPACING.sm,
        top: "22%",
        alignItems: "flex-end",
        justifyContent: "flex-start",
        width: TOUCH_WIDTH,
    },
    touchTarget: {
        position: "absolute",
        top: -12,
        bottom: -12,
        right: -8,
        width: TOUCH_WIDTH + 16,
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
        borderRadius: 1.5,
        backgroundColor: COLORS.gold,
        opacity: 0.3,
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
        color: COLORS.gold,
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
        backgroundColor: COLORS.gold + "44",
        alignItems: "center",
        justifyContent: "center",
    },
    dotInner: {
        width: DOT_SIZE - 4,
        height: DOT_SIZE - 4,
        borderRadius: (DOT_SIZE - 4) / 2,
        backgroundColor: COLORS.gold,
    },
});
