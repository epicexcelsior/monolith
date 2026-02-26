/**
 * Monolith Design System — Liquid Glass Theme
 *
 * All colors, typography, spacing, radii, and shadows for the app.
 * RULE: Never hardcode hex values in components. Always import from here.
 *
 * Design language: Polished translucent crystal — mostly-opaque warm surfaces
 * with specular edge highlights and CSS gradient shimmer. No heavy blur.
 *
 * Two visual contexts:
 *   1. Tower HUD  — dark translucent glass on 3D background
 *   2. Standard   — warm crystal glass on off-white background
 *
 * @see /docs/design/UI_SYSTEM.md for the full design system spec.
 */

import type { ViewStyle } from "react-native";

// ─────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────

export const COLORS = {
  // ─── Backgrounds ──────────────────────────
  bg: "#F5F0E8",                               // Warm off-white — primary screen background
  bgCard: "rgba(255, 252, 245, 0.82)",         // Liquid glass card surface
  bgMuted: "rgba(255, 252, 245, 0.65)",        // Secondary glass surface
  bgOverlay: "rgba(245, 240, 232, 0.88)",      // Translucent warm overlay
  bgTower: "#060810",                          // Tower 3D scene — deep dark

  // ─── Liquid Glass Tokens ──────────────────
  glass: "rgba(255, 252, 245, 0.82)",              // Primary liquid glass surface
  glassElevated: "rgba(255, 253, 248, 0.92)",      // Modals, focused panels
  glassMuted: "rgba(255, 252, 245, 0.60)",          // Badges, chips, secondary
  glassBorder: "rgba(200, 180, 150, 0.18)",         // Subtle warm border
  glassHighlight: "rgba(255, 255, 255, 0.50)",      // Specular top-edge highlight
  glassShimmer: "rgba(255, 255, 255, 0.15)",        // Gradient shimmer start

  // ─── Tower HUD Glass ─────────────────────
  hudGlass: "rgba(10, 12, 20, 0.70)",              // Dark glass for tower overlays
  hudGlassStrong: "rgba(10, 12, 20, 0.90)",        // Opaque dark glass (onboarding panels)
  hudBorder: "rgba(255, 255, 255, 0.08)",           // Subtle light border on dark
  hudHighlight: "rgba(255, 255, 255, 0.06)",        // Subtle top-edge on dark

  // ─── Gold Accent ──────────────────────────
  gold: "#D4A847",                 // Primary actions, links, highlights
  goldLight: "#F0BC5E",            // Hover/active states, chart fills
  goldDark: "#B08A30",             // Pressed states, text on gold bg
  goldSubtle: "rgba(212, 168, 71, 0.15)",   // Tinted glass backgrounds
  goldGlow: "rgba(212, 168, 71, 0.30)",     // Gold glow effect
  goldMid: "rgba(212, 168, 71, 0.70)",      // Medium gold (CoachMark arrows, overlays)

  // ─── Text ─────────────────────────────────
  text: "#1A1612",                 // Primary text (headings, body)
  textSecondary: "#5C554B",        // Secondary text (labels, captions)
  textMuted: "#9E9690",            // Placeholder, hint, disabled text
  textOnGold: "#FFFFFF",           // Text on gold-filled buttons
  textOnDark: "#F0ECE6",           // Text on dark/tower backgrounds

  // ─── Borders & Dividers ───────────────────
  border: "rgba(200, 180, 150, 0.18)",     // Matches glassBorder
  borderStrong: "rgba(180, 160, 130, 0.30)", // Visible edge
  borderAccent: "#D4A847",                   // Gold accent border

  // ─── Block States (Charge System) ─────────
  blazingLight: "#FFD54F",              // Bright amber — gradient top for gold buttons
  blazing: "#FFB800",
  thriving: "#5C9E31",
  fading: "#E07A2F",
  flickering: "#C4402A",
  dormant: "#9E9189",

  // ─── Legacy aliases (mapped to liquid glass tokens) ──
  bgGlassStrong: "rgba(255, 253, 248, 0.92)",     // → glassElevated
  bgGlassMuted: "rgba(255, 252, 245, 0.60)",      // → glassMuted
  bgGlassBorder: "rgba(200, 180, 150, 0.18)",     // → glassBorder

  // ─── Semantic ─────────────────────────────
  success: "#2E8B57",
  successSubtle: "rgba(46, 139, 87, 0.12)",
  warning: "#E8A94D",
  error: "#C4402A",
  info: "#5B8FB9",

  // ─── HUD-specific tokens ────────────────
  hudHandle: "rgba(255, 255, 255, 0.30)",
  hudPillBg: "rgba(0, 0, 0, 0.55)",
  textShadowDark: "rgba(0, 0, 0, 0.9)",
} as const;

// ─────────────────────────────────────────────
// SPACING
// ─────────────────────────────────────────────

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ─────────────────────────────────────────────
// BORDER RADIUS
// ─────────────────────────────────────────────

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// ─────────────────────────────────────────────
// SHADOWS (use with boxShadow style prop)
// ─────────────────────────────────────────────

export const SHADOW = {
  /** Barely visible, for chips/badges */
  sm: "0 1px 2px rgba(26, 22, 18, 0.04), 0 2px 6px rgba(26, 22, 18, 0.03)",
  /** Standard card shadow */
  md: "0 2px 8px rgba(26, 22, 18, 0.05), 0 4px 16px rgba(26, 22, 18, 0.04)",
  /** Elevated panels, modals */
  lg: "0 4px 12px rgba(26, 22, 18, 0.06), 0 8px 32px rgba(26, 22, 18, 0.05)",
  /** Gold glow for primary actions */
  gold: "0 4px 20px rgba(212, 168, 71, 0.25)",
  /** Blazing amber glow for charge/energy CTAs */
  blazing: "0 0 20px rgba(255, 184, 0, 0.4)",
  /** Liquid glass inset highlight — the signature "lip" */
  glassInset: `inset 0 1px 0 ${COLORS.glassHighlight}`,
  /** Inset depth for inputs / tracks */
  insetDepth: "inset 0 1px 3px rgba(0, 0, 0, 0.04)",
} as const;

// ─────────────────────────────────────────────
// LIQUID GLASS STYLE PRESETS
// ─────────────────────────────────────────────

/**
 * Pre-composed style objects for liquid glass surfaces.
 * Apply directly to View components — no BlurView needed.
 *
 * Each preset includes:
 * - Semi-transparent warm background (70-92% opaque)
 * - Subtle warm border
 * - Inset highlight (the liquid glass "lip")
 * - CSS gradient shimmer (specular edge highlight)
 */
export const GLASS_STYLE = {
  /** Standard content card — the workhorse */
  card: {
    backgroundColor: COLORS.glass,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderCurve: "continuous",
    boxShadow: `${SHADOW.md}, ${SHADOW.glassInset}`,
    experimental_backgroundImage:
      "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 50%)",
  } as ViewStyle,

  /** Elevated surface — modals, sheets, focused panels */
  elevated: {
    backgroundColor: COLORS.glassElevated,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderCurve: "continuous",
    boxShadow: `${SHADOW.lg}, ${SHADOW.glassInset}`,
    experimental_backgroundImage:
      "linear-gradient(135deg, rgba(255,255,255,0.22) 0%, transparent 40%)",
  } as ViewStyle,

  /** Pill-shaped elements — badges, chips, small buttons */
  pill: {
    backgroundColor: COLORS.glassMuted,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderCurve: "continuous",
    boxShadow: SHADOW.glassInset,
  } as ViewStyle,

  /** Dark glass for tower HUD overlays */
  hudDark: {
    backgroundColor: COLORS.hudGlass,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.hudBorder,
    borderCurve: "continuous",
    boxShadow: `inset 0 1px 0 ${COLORS.hudHighlight}`,
  } as ViewStyle,

  /** Muted card variant — less prominent */
  muted: {
    backgroundColor: COLORS.glassMuted,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderCurve: "continuous",
    boxShadow: SHADOW.glassInset,
  } as ViewStyle,
} as const;

// ─────────────────────────────────────────────
// BLUR CONFIG (limited to BottomPanel + tab bar)
// ─────────────────────────────────────────────

/** Blur settings for the 2 surfaces that use real blur */
export const BLUR = {
  /** Blur intensity for BottomPanel / tab bar */
  intensity: 40,
  /** Tint for light-background blur */
  tint: "light" as const,
  /** Tint for tower HUD blur */
  hudTint: "dark" as const,
  /** HUD intensity */
  hudIntensity: 30,
  /** Fallback when blur unavailable */
  fallbackBg: "rgba(245, 240, 232, 0.92)",
  /** Dark fallback */
  fallbackHudBg: "rgba(10, 12, 20, 0.80)",
  /** Android blur method */
  androidMethod: "dimezisBlurView" as const,
} as const;

// ─────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────

/**
 * Font family constants.
 * These map to fonts loaded in app/_layout.tsx via expo-font.
 */
export const FONT_FAMILY = {
  heading: "Outfit_700Bold",
  headingBlack: "Outfit_900Black",
  headingSemibold: "Outfit_600SemiBold",
  headingRegular: "Outfit_400Regular",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemibold: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
  mono: "JetBrainsMono_400Regular",
  monoBold: "JetBrainsMono_700Bold",
} as const;

/**
 * Pre-composed text styles for consistent typography.
 * Usage: <Text style={TEXT.displayLg}>Title</Text>
 */
export const TEXT = {
  displayLg: {
    fontFamily: FONT_FAMILY.headingBlack,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: 0.5,
    color: COLORS.text,
  },
  displaySm: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 0.5,
    color: COLORS.text,
  },
  headingLg: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 0.3,
    color: COLORS.text,
  },
  headingSm: {
    fontFamily: FONT_FAMILY.headingSemibold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.3,
    color: COLORS.text,
  },
  bodyLg: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.text,
  },
  bodySm: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  caption: {
    fontFamily: FONT_FAMILY.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    color: COLORS.textMuted,
  },
  overline: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: COLORS.textMuted,
  },
  mono: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text,
  },
  monoSm: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.textSecondary,
  },
  button: {
    fontFamily: FONT_FAMILY.bodyBold,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  buttonSm: {
    fontFamily: FONT_FAMILY.bodySemibold,
    fontSize: 14,
    letterSpacing: 0.5,
  },
} as const;

// ─────────────────────────────────────────────
// ANIMATION TIMING
// ─────────────────────────────────────────────

export const TIMING = {
  fast: 150,
  normal: 250,
  slow: 350,

  // ─── RN Animated springs (tension/friction) ────────
  // Used with: Animated.spring(), RN Animated API
  /** Standard spring — buttons, cards */
  spring: { tension: 65, friction: 11 },
  /** Snappier spring — short interactions */
  springSnappy: { tension: 80, friction: 12 },

  // ─── Reanimated springs (damping/stiffness) ────────
  // Used with: withSpring(), FadeIn.springify(), Layout.springify()
  /** Micro spring — press feedback, scale */
  microSpring: { damping: 15, stiffness: 150 },
  /** Gentle spring — entrance animations, slides */
  gentleSpring: { damping: 20, stiffness: 90 },

  // ─── Onboarding springs (both APIs) ────────────────
  // Provides matching feel across RN Animated and Reanimated
  /** Onboarding — RN Animated (Animated.spring config) */
  springOnboarding: { tension: 60, friction: 8 },
  /** Onboarding — Reanimated (withSpring / springify config) */
  springOnboardingReanimated: { damping: 14, stiffness: 120 },
} as const;

// ─────────────────────────────────────────────
// CHARGE STATE HELPERS
// ─────────────────────────────────────────────

export type ChargeState = "blazing" | "thriving" | "fading" | "flickering" | "dormant";

export function getChargeState(charge: number): ChargeState {
  if (charge >= 80) return "blazing";
  if (charge >= 50) return "thriving";
  if (charge >= 20) return "fading";
  if (charge >= 1) return "flickering";
  return "dormant";
}

export function getChargeColor(charge: number): string {
  return COLORS[getChargeState(charge)];
}

export function getChargeLabel(charge: number): string {
  const labels: Record<ChargeState, string> = {
    blazing: "Blazing 🔥",
    thriving: "Thriving ✨",
    fading: "Fading 💫",
    flickering: "Flickering ⚡",
    dormant: "Dormant 💤",
  };
  return labels[getChargeState(charge)];
}
