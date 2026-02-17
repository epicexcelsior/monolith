import React from "react";
import { View, Text, TextInput, StyleSheet, type KeyboardTypeOptions } from "react-native";
import { COLORS, RADIUS, SPACING, FONT_FAMILY, TEXT, SHADOW } from "@/constants/theme";

interface InputProps {
    /** Label text above the input */
    label?: string;
    /** Current value */
    value: string;
    /** Change handler */
    onChangeText: (text: string) => void;
    /** Placeholder text */
    placeholder?: string;
    /** Error message (shown in red below input) */
    error?: string;
    /** Hint text (shown below input when no error) */
    hint?: string;
    /** Text/element shown before the input value */
    prefix?: string;
    /** Text/element shown after the input value */
    suffix?: string;
    /** Keyboard type */
    keyboardType?: KeyboardTypeOptions;
    /** Disable input */
    disabled?: boolean;
    /** Font size for the input value (default: 18) */
    inputFontSize?: number;
}

/**
 * Styled text input with label, prefix/suffix, error state, and hint.
 *
 * @example
 * ```tsx
 * <Input
 *   label="DEPOSIT AMOUNT"
 *   value={amount}
 *   onChangeText={setAmount}
 *   prefix="$"
 *   suffix="USDC"
 *   keyboardType="decimal-pad"
 *   error={amount < 0.10 ? "Minimum 0.10 USDC" : undefined}
 * />
 * ```
 */
export default function Input({
    label,
    value,
    onChangeText,
    placeholder = "",
    error,
    hint,
    prefix,
    suffix,
    keyboardType,
    disabled = false,
    inputFontSize = 18,
}: InputProps) {
    const hasError = !!error;

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}

            <View
                style={[
                    styles.inputRow,
                    hasError && styles.inputRowError,
                    disabled && styles.inputRowDisabled,
                ]}
            >
                {prefix && <Text style={styles.prefix}>{prefix}</Text>}
                <TextInput
                    style={[styles.input, { fontSize: inputFontSize }]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType={keyboardType}
                    returnKeyType="done"
                    editable={!disabled}
                />
                {suffix && <Text style={styles.suffix}>{suffix}</Text>}
            </View>

            {hasError && <Text style={styles.error}>{error}</Text>}
            {!hasError && hint && <Text style={styles.hint}>{hint}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
    },
    label: {
        ...TEXT.overline,
        color: COLORS.gold,
        marginBottom: SPACING.sm,
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.glassElevated,
        borderRadius: RADIUS.md,
        borderWidth: 1.5,
        borderColor: COLORS.glassBorder,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderCurve: "continuous",
        boxShadow: SHADOW.insetDepth,
    },
    inputRowError: {
        borderColor: COLORS.error,
    },
    inputRowDisabled: {
        opacity: 0.5,
    },
    prefix: {
        fontFamily: FONT_FAMILY.headingSemibold,
        fontSize: 22,
        color: COLORS.gold,
        marginRight: SPACING.xs,
    },
    input: {
        flex: 1,
        fontFamily: FONT_FAMILY.mono,
        color: COLORS.text,
        fontVariant: ["tabular-nums"],
        paddingVertical: SPACING.sm + 2,
    },
    suffix: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 13,
        color: COLORS.textMuted,
        letterSpacing: 1,
        marginLeft: SPACING.xs,
    },
    error: {
        fontFamily: FONT_FAMILY.bodyMedium,
        fontSize: 12,
        color: COLORS.error,
        marginTop: SPACING.xs + 2,
    },
    hint: {
        ...TEXT.caption,
        marginTop: SPACING.xs + 2,
    },
});
