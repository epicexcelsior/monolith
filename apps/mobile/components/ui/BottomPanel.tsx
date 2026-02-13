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
import { COLORS, RADIUS, SPACING, TIMING, FONT_FAMILY } from "@/constants/theme";

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
}

/**
 * Reusable animated BottomPanel — slides up from the bottom with spring physics.
 * Safe-area aware: accounts for gesture bar / home indicator on Seeker.
 *
 * @example
 * ```tsx
 * <BottomPanel visible={showPanel} onClose={() => setShowPanel(false)} title="Block Details">
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

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    height: totalHeight,
                    paddingBottom: insets.bottom,
                    transform: [{ translateY: slideAnim }],
                },
            ]}
        >
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Header row */}
            {title && (
                <View style={styles.headerRow}>
                    <Text style={styles.title}>{title}</Text>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={onClose}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <Text style={styles.closeText}>✕</Text>
                    </TouchableOpacity>
                </View>
            )}

            {!title && (
                <TouchableOpacity
                    style={styles.closeButtonAbsolute}
                    onPress={onClose}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <Text style={styles.closeText}>✕</Text>
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
        backgroundColor: COLORS.bgCard,
        borderTopLeftRadius: RADIUS.xl,
        borderTopRightRadius: RADIUS.xl,
        borderTopWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.sm,
        borderCurve: "continuous",
        boxShadow: "0 -4px 24px rgba(26, 22, 18, 0.10)",
    },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.borderStrong,
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
        color: COLORS.text,
        letterSpacing: 0.3,
    },
    closeButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.bgMuted,
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
        backgroundColor: COLORS.bgMuted,
        alignItems: "center",
        justifyContent: "center",
    },
    closeText: {
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: "700",
    },
    content: {
        flex: 1,
    },
});
