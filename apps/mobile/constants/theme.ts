/**
 * Monolith Design System — Solarpunk Theme
 *
 * All colors, typography, spacing, radii, and shadows for the app.
 * RULE: Never hardcode hex values in components. Always import from here.
 *
 * @see /docs/design/UI_SYSTEM.md for the full design system spec.
 */

// ─────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────

export const COLORS = {
  // ─── Backgrounds ──────────────────────────
  bg: "#FAF7F2",
  bgCard: "#FFFFFF",
  bgMuted: "#F0EBE3",
  bgOverlay: "rgba(250, 247, 242, 0.92)",
  bgTower: "#080604", // Tower 3D scene — warm dark

  // ─── Gold Accent ──────────────────────────
  gold: "#C8993E",
  goldLight: "#E8A94D",
  goldDark: "#A67C2E",
  goldSubtle: "rgba(200, 153, 62, 0.10)",

  // ─── Text ─────────────────────────────────
  text: "#1A1612",
  textSecondary: "#5C554B",
  textMuted: "#9E9690",
  textOnGold: "#FFFFFF",
  textOnDark: "#FAF7F2",

  // ─── Borders & Dividers ───────────────────
  border: "#E8E2D9",
  borderStrong: "#D4CEC4",
  borderAccent: "#C8993E",

  // ─── Block States (Charge System) ─────────
  blazing: "#FFB800",
  thriving: "#5C9E31",
  fading: "#E07A2F",
  flickering: "#C4402A",
  dormant: "#9E9189",

  // ─── Semantic ─────────────────────────────
  success: "#2E8B57",
  warning: "#E8A94D",
  error: "#C4402A",
  info: "#5B8FB9",
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
  sm: "0 1px 3px rgba(26, 22, 18, 0.06)",
  md: "0 4px 12px rgba(26, 22, 18, 0.08)",
  lg: "0 8px 24px rgba(26, 22, 18, 0.12)",
  gold: "0 4px 16px rgba(200, 153, 62, 0.20)",
} as const;

// ─────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────

/**
 * Font family constants.
 * These map to the fonts loaded in app/_layout.tsx via expo-font.
 * Use these instead of raw string names.
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
  spring: { tension: 65, friction: 11 },
  springSnappy: { tension: 80, friction: 12 },
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
