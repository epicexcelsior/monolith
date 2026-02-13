import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { COLORS, RADIUS, SPACING, FONT_FAMILY } from "@/constants/theme";

interface ChipProps {
    /** Chip label */
    label: string;
    /** Whether this chip is currently selected */
    selected?: boolean;
    /** Press handler */
    onPress?: () => void;
    /** Disable interaction */
    disabled?: boolean;
}

/**
 * Selectable Chip/Pill — for quick amount selection, filters, and toggles.
 *
 * @example
 * ```tsx
 * <View style={{ flexDirection: 'row', gap: 8 }}>
 *   {[0.10, 0.50, 1.00, 5.00].map((amt) => (
 *     <Chip
 *       key={amt}
 *       label={`$${amt}`}
 *       selected={amount === amt}
 *       onPress={() => setAmount(amt)}
 *     />
 *   ))}
 * </View>
 * ```
 */
export default function Chip({
    label,
    selected = false,
    onPress,
    disabled = false,
}: ChipProps) {
    return (
        <TouchableOpacity
            style={[
                styles.chip,
                selected && styles.chipSelected,
                disabled && styles.chipDisabled,
            ]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
        >
            <Text style={[styles.label, selected && styles.labelSelected]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    chip: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.full,
        backgroundColor: COLORS.bgMuted,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderCurve: "continuous",
    },
    chipSelected: {
        backgroundColor: COLORS.goldSubtle,
        borderColor: COLORS.gold,
    },
    chipDisabled: {
        opacity: 0.4,
    },
    label: {
        fontFamily: FONT_FAMILY.bodySemibold,
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    labelSelected: {
        color: COLORS.goldDark,
    },
});
