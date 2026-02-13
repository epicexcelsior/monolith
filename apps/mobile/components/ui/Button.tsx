import React from "react";
import {
    TouchableOpacity,
    Text,
    ActivityIndicator,
    StyleSheet,
    View,
} from "react-native";
import { COLORS, RADIUS, SPACING, TEXT, TIMING } from "@/constants/theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
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
    /** Press handler */
    onPress?: () => void;
}

/**
 * Reusable Button component — the primary interactive element.
 *
 * @example
 * ```tsx
 * <Button title="Claim Block" variant="primary" onPress={handleClaim} />
 * <Button title="Cancel" variant="ghost" onPress={handleCancel} />
 * <Button title="Depositing..." variant="primary" loading />
 * <Button title="Disconnect" variant="danger" onPress={handleDisconnect} />
 * ```
 */
export default function Button({
    title,
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    icon,
    onPress,
}: ButtonProps) {
    const isDisabled = disabled || loading;

    const containerStyle = [
        styles.base,
        sizeStyles[size],
        variantStyles[variant].container,
        isDisabled && styles.disabled,
    ];

    const textStyle = [
        size === "sm" ? TEXT.buttonSm : TEXT.button,
        variantStyles[variant].text,
    ];

    return (
        <TouchableOpacity
            style={containerStyle}
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.8}
        >
            {loading ? (
                <View style={styles.loadingRow}>
                    <ActivityIndicator
                        size="small"
                        color={variant === "primary" ? COLORS.textOnGold : COLORS.gold}
                    />
                    <Text style={[...textStyle, styles.loadingText]}>{title}</Text>
                </View>
            ) : (
                <View style={styles.contentRow}>
                    {icon && <View style={styles.iconContainer}>{icon}</View>}
                    <Text style={textStyle}>{title}</Text>
                </View>
            )}
        </TouchableOpacity>
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

const sizeStyles = StyleSheet.create({
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
});

const variantStyles = {
    primary: StyleSheet.create({
        container: {
            backgroundColor: COLORS.gold,
            boxShadow: "0 4px 16px rgba(200, 153, 62, 0.20)",
        },
        text: {
            color: COLORS.textOnGold,
        },
    }),
    secondary: StyleSheet.create({
        container: {
            backgroundColor: "transparent",
            borderWidth: 1.5,
            borderColor: COLORS.gold,
        },
        text: {
            color: COLORS.gold,
        },
    }),
    ghost: StyleSheet.create({
        container: {
            backgroundColor: "transparent",
        },
        text: {
            color: COLORS.textSecondary,
        },
    }),
    danger: StyleSheet.create({
        container: {
            backgroundColor: "transparent",
            borderWidth: 1.5,
            borderColor: COLORS.error,
        },
        text: {
            color: COLORS.error,
        },
    }),
};
