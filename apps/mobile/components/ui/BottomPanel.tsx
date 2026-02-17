import React, { useEffect, useRef } from "react";
import {
    View,
    StyleSheet,
    Animated,
    TouchableOpacity,
    useWindowDimensions,
    Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SPACING, TIMING, FONT_FAMILY, BLUR } from "@/constants/theme";

// Safe BlurView import — falls back when native module isn't compiled into the build
let BlurViewComponent: any = null;
try {
    BlurViewComponent = require("expo-blur").BlurView;
} catch {
    // Native module not available — will use solid fallback
}

interface BottomPanelProps {
    /** Whether the panel is visible */
    visible: boolean;
    /** Called when the user dismisses the panel */
    onClose: () => void;
    /** Panel content */
    children: React.ReactNode;
    /** Panel height (excluding safe area). Defaults to 280. */
    height?: number;
    /** Optional title shown in the panel header */
    title?: string;
    /** Whether the panel sits on a dark background (e.g. tower view) */
    dark?: boolean;
}

/**
 * Reusable animated BottomPanel — frosted glass slide-up panel.
 * Safe-area aware: accounts for gesture bar / home indicator on Seeker.
 *
 * @example
 * ```tsx
 * <BottomPanel visible={showPanel} onClose={() => setShowPanel(false)} title="Block Details" dark>
 *   <Text>Panel content here</Text>
 * </BottomPanel>
 * ```
 */
export default function BottomPanel({
    visible,
    onClose,
    children,
    height = 280,
    title,
    dark = false,
}: BottomPanelProps) {
    const insets = useSafeAreaInsets();
    const totalHeight = height + insets.bottom;
    const slideAnim = useRef(new Animated.Value(totalHeight)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                ...TIMING.spring,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: totalHeight,
                duration: TIMING.normal,
                useNativeDriver: true,
            }).start();
        }
    }, [visible, slideAnim, totalHeight]);

    if (!visible) return null;

    const tint = dark ? BLUR.hudTint : BLUR.tint;
    const intensity = dark ? BLUR.hudIntensity : BLUR.intensity;
    const borderColor = dark ? COLORS.hudBorder : COLORS.glassBorder;
    const bgOverlay = dark ? COLORS.hudGlass : COLORS.glass;
    const handleColor = dark ? "rgba(255,255,255,0.30)" : COLORS.borderStrong;
    const textColor = dark ? COLORS.textOnDark : COLORS.text;
    const closeBg = dark ? "rgba(255,255,255,0.12)" : COLORS.glassMuted;
    const closeTextColor = dark ? COLORS.textOnDark : COLORS.textSecondary;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    height: totalHeight,
                    paddingBottom: insets.bottom,
                    borderColor,
                    transform: [{ translateY: slideAnim }],
                },
            ]}
        >
            {/* Blur backdrop */}
            {BlurViewComponent ? (
                <BlurViewComponent
                    tint={tint}
                    intensity={intensity}
                    experimentalBlurMethod={BLUR.androidMethod}
                    style={StyleSheet.absoluteFill}
                />
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? BLUR.fallbackHudBg : BLUR.fallbackBg }]} />
            )}
            {/* Glass tint overlay */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: bgOverlay }]} />

            {/* Handle bar */}
            <View style={[styles.handleBar, { backgroundColor: handleColor }]} />

            {/* Header row */}
            {title && (
                <View style={styles.headerRow}>
                    <Text style={[styles.title, { color: textColor }]}>{title}</Text>
                    <TouchableOpacity
                        style={[styles.closeButton, { backgroundColor: closeBg }]}
                        onPress={onClose}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <Text style={[styles.closeText, { color: closeTextColor }]}>✕</Text>
                    </TouchableOpacity>
                </View>
            )}

            {!title && (
                <TouchableOpacity
                    style={[styles.closeButtonAbsolute, { backgroundColor: closeBg }]}
                    onPress={onClose}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <Text style={[styles.closeText, { color: closeTextColor }]}>✕</Text>
                </TouchableOpacity>
            )}

            {/* Content */}
            <View style={styles.content}>{children}</View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: RADIUS.xl,
        borderTopRightRadius: RADIUS.xl,
        borderTopWidth: 1,
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.sm,
        borderCurve: "continuous",
        overflow: "hidden",
    },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: "center",
        marginBottom: SPACING.md,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: SPACING.md,
    },
    title: {
        fontFamily: FONT_FAMILY.heading,
        fontSize: 18,
        letterSpacing: 0.3,
    },
    closeButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    closeButtonAbsolute: {
        position: "absolute",
        top: SPACING.sm,
        right: SPACING.md,
        zIndex: 10,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    closeText: {
        fontSize: 12,
        fontWeight: "700",
    },
    content: {
        flex: 1,
    },
});
