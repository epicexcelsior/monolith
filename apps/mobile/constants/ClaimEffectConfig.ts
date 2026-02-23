/**
 * ClaimEffectConfig — Single source of truth for the block claim celebration.
 *
 * ARC: Long low-bass hum builds (0 → IMPACT_OFFSET) → angelic explosion
 *
 * IMPACT_OFFSET_SECS = 2.5s — the moment everything fires.
 * Used by VFX (ClaimVFX), sound (generate-claim-sound), and haptics.
 *
 * Phase timing (fractions of total duration):
 *   buildup     (0–45%)    — converging violet particles, bass hum swells
 *   impact      (45–55%)   — shockwave, screen flash, camera shake, VFX explosion
 *   celebration (55–88%)   — angelic particles fill the sky, bell tones
 *   settle      (88–100%)  — gentle fade, aurora drift lingers
 */

// ─── Absolute impact time (seconds from celebration start) ────
// Used by: ClaimVFX.tsx (VFX phase 2), generate-claim-sound.js, haptics
export const CLAIM_IMPACT_OFFSET_SECS = 2.5;

// ─── Duration Presets ──────────────────────────────────────────
export const CLAIM_DURATIONS = {
  normal:     5.5,
  firstClaim: 7.5,
} as const;

// ─── Phase Timing (fractions of total duration) ────────────────
// For normal 5.5s: buildup 0-2.475s, impact 2.475-3.025s, etc.
export const CLAIM_PHASES = {
  buildup:     { start: 0.00, end: 0.45 },
  impact:      { start: 0.45, end: 0.55 },
  celebration: { start: 0.55, end: 0.88 },
  settle:      { start: 0.88, end: 1.00 },
} as const;

// ─── Particle Budget (ClaimParticles.tsx shader — legacy) ─────
export const CLAIM_PARTICLES = {
  convergeCount: 40,
  sparkCount:    100,
  emberCount:    50,
  trailCount:    30,
  get total() { return this.convergeCount + this.sparkCount + this.emberCount + this.trailCount; },
} as const;

// ─── Shockwave ────────────────────────────────────────────────
export const CLAIM_SHOCKWAVE = {
  maxRadius:     15.0,
  ringWidth:      2.5,
  peakIntensity:  2.5,
  speed:         12.0,
} as const;

// ─── Fake Point Light ─────────────────────────────────────────
export const CLAIM_LIGHT = {
  peakIntensity: 4.0,
  radius:       12.0,
} as const;

// ─── Screen Flash ─────────────────────────────────────────────
// Golden-white: angelic light surge at the moment of claiming
export const CLAIM_FLASH = {
  peakOpacity:      0.20,
  fadeInDuration:   0.07,
  fadeOutDuration:  0.60,
  color: [1.0, 0.97, 0.88] as const,  // warm white-gold
} as const;

// ─── Camera Shake ────────────────────────────────────────────
// Primary shake at impact — physical, aggressive. Aftershock at +0.4s.
export const CLAIM_SHAKE = {
  magnitude: 0.55,    // up from 0.28 — you FEEL this in your hand
  frequency: 24,
  decay:      5,
  duration:  0.80,
  axes:       3,
  aftershock: {
    delay:     0.40,  // seconds after impact
    magnitude: 0.22,
    duration:  0.45,
    decay:     8,
  },
} as const;

// ─── Cinematic Camera Orbit ────────────────────────────────
// Celebration camera behavior: zoom toward block + slow orbit
export const CLAIM_CAMERA = {
  orbitSpeed:     0.008,  // radians/frame at 60fps ≈ 27° over 3s of celebration
  zoomInFactor:   0.72,   // multiply current zoom by this at impact (zoom in 28%)
  zoomRestoreMs:  1200,   // ms after celebration end to restore zoom
} as const;

// ─── Haptic Timing ────────────────────────────────────────────
// All times in ms, relative to celebration start.
// Buildup taps escalate over 2.2s → heavy impact at 2500ms.
export const CLAIM_HAPTICS = {
  normal: {
    buildup: [
      { delay: 0,    style: "Light"  as const },
      { delay: 300,  style: "Light"  as const },
      { delay: 600,  style: "Light"  as const },
      { delay: 900,  style: "Medium" as const },
      { delay: 1200, style: "Medium" as const },
      { delay: 1600, style: "Heavy"  as const },
      { delay: 2000, style: "Heavy"  as const },
      { delay: 2300, style: "Heavy"  as const },
    ],
    impactDelay:  2500,   // matches CLAIM_IMPACT_OFFSET_SECS × 1000
    successDelay: 2580,
    settle: [
      { delay: 4400, style: "Light" as const },
      { delay: 4700, style: "Light" as const },
      { delay: 5000, style: "Light" as const },
    ],
  },
  firstClaim: {
    buildup: [
      { delay: 0,    style: "Light"  as const },
      { delay: 300,  style: "Light"  as const },
      { delay: 600,  style: "Light"  as const },
      { delay: 900,  style: "Medium" as const },
      { delay: 1200, style: "Medium" as const },
      { delay: 1500, style: "Heavy"  as const },
      { delay: 1800, style: "Heavy"  as const },
      { delay: 2100, style: "Heavy"  as const },
      { delay: 2300, style: "Heavy"  as const },
    ],
    impactDelay:  2500,
    successDelay: 2580,
    settle: [
      { delay: 5500, style: "Light" as const },
      { delay: 5800, style: "Light" as const },
      { delay: 6100, style: "Light" as const },
      { delay: 6500, style: "Light" as const },
    ],
  },
} as const;

// ─── Particle Colors (ClaimParticles shader — legacy) ────────
export const CLAIM_PARTICLE_COLORS = {
  converge: [1.2, 0.9, 0.2] as const,
  spark:    [1.5, 1.3, 0.8] as const,
  ember:    [1.2, 0.6, 0.1] as const,
  trail:    [1.4, 1.2, 0.9] as const,
} as const;

// ─── Particle Types (ClaimParticles shader) ──────────────────
export const PARTICLE_TYPE = {
  CONVERGE: 0,
  SPARK:    1,
  EMBER:    2,
  TRAIL:    3,
} as const;
