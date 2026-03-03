import React, { useEffect } from "react";
import {
    Text,
    ActivityIndicator,
    StyleSheet,
    View,
    Pressable,
    type ViewStyle,
} from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withRepeat,
    withSequence,
    withTiming,
    cancelAnimation,
} from "react-native-reanimated";
import { COLORS, GLASS_STYLE, RADIUS, SPACING, TEXT, SHADOW, TIMING } from "@/constants/theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
    /** Button label text */
    title: string;
    /** Visual variant */
    variant?: ButtonVariant;
    /** Size preset */
    size?: ButtonSize;
    /** Show loading spinner */
    loading?: boolean;
    /** Disable interaction */
    disabled?: boolean;
    /** Optional icon element (rendered left of title) */
    icon?: React.ReactNode;
    /** Enable breathing pulse animation (e.g. charge button when ready) */
    pulsing?: boolean;
    /** Press handler */
    onPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Button — Primary interactive element with press scale animation.
 *
 * Variants:
 *   - `primary`   — gold gradient fill with glow
 *   - `secondary` — liquid glass pill with gold border
 *   - `ghost`     — text-only, no background
 *   - `danger`    — liquid glass pill with red border
 *   - `gold`      — blazing amber gradient with glow (charge/energy CTAs)
 */
export default function Button({
    title,
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    icon,
    pulsing = false,
    onPress,
}: ButtonProps) {
    const isDisabled = disabled || loading;
    const scale = useSharedValue(1);
    const pulseScale = useSharedValue(1);

    // Breathing pulse: 1.0 → 1.04 → 1.0 (subtle, continuous)
    useEffect(() => {
        if (pulsing && !isDisabled) {
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(1.04, { duration: 800 }),
                    withTiming(1.0, { duration: 800 }),
                ),
                -1, // infinite
                false,
            );
        } else {
            cancelAnimation(pulseScale);
            pulseScale.value = withTiming(1, { duration: 200 });
        }
    }, [pulsing, isDisabled, pulseScale]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value * pulseScale.value }],
    }));

    const handlePressIn = () => {
        // Deeper press for pulsing buttons — feels more "punchy"
        scale.value = withSpring(pulsing ? 0.94 : 0.97, TIMING.microSpring);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, TIMING.microSpring);
    };

    const textStyle = [
        size === "sm" ? TEXT.buttonSm : TEXT.button,
        variantTextStyles[variant],
    ];

    const content = loading ? (
        <View style={styles.loadingRow}>
            <ActivityIndicator
                size="small"
                color={variant === "primary" || variant === "gold" ? COLORS.textOnGold : COLORS.gold}
            />
            <Text style={[...textStyle, styles.loadingText]}>{title}</Text>
        </View>
    ) : (
        <View style={styles.contentRow}>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text style={textStyle}>{title}</Text>
        </View>
    );

    return (
        <AnimatedPressable
            style={[
                animatedStyle,
                styles.base,
                sizeStyles[size],
                variantStyles[variant],
                isDisabled && styles.disabled,
            ]}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={isDisabled}
        >
            {content}
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create({
    base: {
        alignItems: "center",
        justifyContent: "center",
        borderCurve: "continuous",
    },
    disabled: {
        opacity: 0.5,
    },
    loadingRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    loadingText: {
        marginLeft: SPACING.sm,
    },
    contentRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconContainer: {
        marginRight: SPACING.sm,
    },
});

const variantStyles: Record<ButtonVariant, ViewStyle> = {
    primary: {
        backgroundColor: COLORS.gold,
        boxShadow: SHADOW.gold,
        experimental_backgroundImage:
            `linear-gradient(to bottom, ${COLORS.goldLight} 0%, ${COLORS.gold} 100%)`,
    } as ViewStyle,
    secondary: {
        backgroundColor: COLORS.glassMuted,
        borderWidth: 1,
        borderColor: COLORS.gold,
        boxShadow: SHADOW.glassInset,
    },
    ghost: {
        backgroundColor: "transparent",
    },
    danger: {
        backgroundColor: COLORS.glassMuted,
        borderWidth: 1,
        borderColor: COLORS.error,
        boxShadow: SHADOW.glassInset,
    },
    gold: {
        backgroundColor: COLORS.blazing,
        boxShadow: SHADOW.blazing,
        experimental_backgroundImage:
            `linear-gradient(to bottom, ${COLORS.blazingLight} 0%, ${COLORS.blazing} 100%)`,
    } as ViewStyle,
};

const sizeStyles: Record<ButtonSize, ViewStyle> = {
    sm: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.sm,
    },
    md: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: 14,
        borderRadius: RADIUS.md,
    },
    lg: {
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.md,
    },
};

const variantTextStyles: Record<ButtonVariant, { color: string }> = {
    primary: { color: COLORS.textOnGold },
    secondary: { color: COLORS.gold },
    ghost: { color: COLORS.textSecondary },
    danger: { color: COLORS.error },
    gold: { color: COLORS.textOnGold },
};
