import React from "react";
import { View, StyleSheet, type ViewStyle, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { COLORS, BLUR, RADIUS, SPACING, SHADOW } from "@/constants/theme";

type GlassVariant = "card" | "panel" | "hud" | "button" | "pill";

interface GlassViewProps {
    /** Glass surface variant */
    variant?: GlassVariant;
    /** Whether this overlays a dark background (e.g. tower scene) */
    dark?: boolean;
    /** Additional styles */
    style?: ViewStyle;
    /** Children */
    children: React.ReactNode;
}

/**
 * GlassView — Frosted glass surface with backdrop blur.
 *
 * Uses expo-blur BlurView on supported platforms with a solid
 * semi-transparent fallback. All glassmorphic UI in the app should
 * use this component for consistency.
 *
 * Two modes:
 *   - `dark={false}` (default) — warm white frost for standard screens
 *   - `dark={true}` — translucent frost on dark backgrounds (tower HUD)
 *
 * @example
 * ```tsx
 * // Standard glass card
 * <GlassView variant="card">
 *   <Text style={TEXT.headingSm}>Balance</Text>
 * </GlassView>
 *
 * // HUD element overlaying the tower
 * <GlassView variant="hud" dark>
 *   <Text style={{ color: COLORS.textOnDark }}>Layer 5</Text>
 * </GlassView>
 * ```
 */
export default function GlassView({
    variant = "card",
    dark = false,
    style,
    children,
}: GlassViewProps) {
    const variantConfig = VARIANT_CONFIGS[variant];
    const tint = dark ? BLUR.hudTint : BLUR.tint;
    const intensity = dark ? BLUR.hudIntensity : BLUR.intensity;
    const borderColor = dark ? COLORS.bgGlassDarkBorder : COLORS.bgGlassBorder;
    const fallbackBg = dark ? BLUR.fallbackHudBg : BLUR.fallbackBg;

    const containerStyle: ViewStyle = {
        borderRadius: variantConfig.borderRadius,
        borderCurve: "continuous",
        overflow: "hidden",
        borderWidth: variantConfig.showBorder ? 1 : 0,
        borderColor: variantConfig.showBorder ? borderColor : "transparent",
    };

    return (
        <View style={[containerStyle, style]}>
            <BlurView
                tint={tint}
                intensity={intensity}
                experimentalBlurMethod={BLUR.androidMethod}
                style={StyleSheet.absoluteFill}
            />
            {/* Warm glass tint overlay */}
            <View
                style={[
                    StyleSheet.absoluteFill,
                    {
                        backgroundColor: dark
                            ? COLORS.bgGlassDark
                            : COLORS.bgGlass,
                    },
                ]}
            />
            {/* Content */}
            <View style={variantConfig.contentStyle}>{children}</View>
        </View>
    );
}

// ─── Variant Configurations ──────────────────

interface VariantConfig {
    borderRadius: number;
    showBorder: boolean;
    contentStyle: ViewStyle;
}

const VARIANT_CONFIGS: Record<GlassVariant, VariantConfig> = {
    card: {
        borderRadius: RADIUS.lg,
        showBorder: true,
        contentStyle: { padding: SPACING.md },
    },
    panel: {
        borderRadius: RADIUS.xl,
        showBorder: true,
        contentStyle: { padding: SPACING.md },
    },
    hud: {
        borderRadius: RADIUS.sm,
        showBorder: true,
        contentStyle: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
    },
    button: {
        borderRadius: RADIUS.md,
        showBorder: true,
        contentStyle: {},
    },
    pill: {
        borderRadius: RADIUS.full,
        showBorder: true,
        contentStyle: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
    },
};
