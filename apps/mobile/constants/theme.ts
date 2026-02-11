/**
 * Neon cyberpunk theme constants.
 * All colors, spacing, and typography for the app.
 */

export const COLORS = {
  // ─── Backgrounds ──────────────────────────
  bg: "#0a0a0f",
  bgCard: "#0d0d15",
  bgOverlay: "rgba(13, 13, 21, 0.85)",

  // ─── Borders ──────────────────────────────
  border: "#1a1a2e",
  borderAccent: "#00ffff",

  // ─── Text ─────────────────────────────────
  text: "#ffffff",
  textSecondary: "#888899",
  textMuted: "#555566",
  textDim: "#444466",

  // ─── Accents ──────────────────────────────
  cyan: "#00ffff",
  magenta: "#ff00ff",
  neonGreen: "#00ff66",
  neonOrange: "#ff6600",
  electricPurple: "#6600ff",
  hotPink: "#ff0066",
  electricBlue: "#0066ff",

  // ─── Block States ─────────────────────────
  blazing: "#00ffff",
  thriving: "#0066ff",
  fading: "#6600ff",
  dying: "#ff0066",
  dead: "#1a1a2e",

  // ─── Semantic ─────────────────────────────
  success: "#00ff66",
  warning: "#ffcc00",
  error: "#ff3300",
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FONTS = {
  regular: { fontWeight: "400" as const },
  medium: { fontWeight: "500" as const },
  semibold: { fontWeight: "600" as const },
  bold: { fontWeight: "700" as const },
  heavy: { fontWeight: "800" as const },
  black: { fontWeight: "900" as const },
} as const;
