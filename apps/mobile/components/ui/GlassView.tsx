import React from "react";
import { View, type ViewStyle, type StyleProp } from "react-native";
import { GLASS_STYLE } from "@/constants/theme";

type GlassVariant = "card" | "elevated" | "pill" | "hud" | "muted";

interface GlassViewProps {
    /** Glass surface variant */
    variant?: GlassVariant;
    /** Whether this overlays a dark background (e.g. tower scene) */
    dark?: boolean;
    /** Additional styles */
    style?: StyleProp<ViewStyle>;
    /** Children */
    children: React.ReactNode;
}

/**
 * GlassView — Liquid glass surface without blur.
 *
 * Uses solid semi-transparent backgrounds with CSS gradient shimmer
 * and inset highlight for the liquid glass "lip" effect.
 * Zero GPU blur cost — pure CSS/layout rendering.
 *
 * Two modes:
 *   - `dark={false}` (default) — warm crystal glass for standard screens
 *   - `dark={true}` — dark translucent glass on tower HUD
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
    // Select the right preset
    const preset = dark ? GLASS_STYLE.hudDark : VARIANT_MAP[variant];

    return (
        <View style={[preset, CONTENT_PADDING[variant], style]}>
            {children}
        </View>
    );
}

// ─── Variant → GLASS_STYLE mapping ──────────

const VARIANT_MAP: Record<GlassVariant, ViewStyle> = {
    card: GLASS_STYLE.card,
    elevated: GLASS_STYLE.elevated,
    pill: GLASS_STYLE.pill,
    hud: GLASS_STYLE.hudDark,
    muted: GLASS_STYLE.muted,
};

// ─── Default content padding per variant ─────

const CONTENT_PADDING: Record<GlassVariant, ViewStyle> = {
    card: { padding: 16 },
    elevated: { padding: 16 },
    pill: { paddingHorizontal: 16, paddingVertical: 4 },
    hud: { paddingHorizontal: 8, paddingVertical: 4 },
    muted: { padding: 16 },
};
