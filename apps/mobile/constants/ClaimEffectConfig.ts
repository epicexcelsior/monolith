/**
 * ClaimEffectConfig — Single source of truth for the block claim celebration.
 *
 * ARC: Long low-bass hum builds (0 → IMPACT_OFFSET) → angelic explosion
 *
 * IMPACT_OFFSET_SECS = 1.5s — the moment everything fires.
 * Used by VFX (ClaimVFX), sound (generate-claim-sound), and haptics.
 *
 * Phase timing (fractions of total duration):
 *   buildup     (0–42%)    — converging particles, bass hum swells
 *   impact      (42–55%)   — shockwave, screen flash, camera shake, VFX explosion
 *   celebration (55–88%)   — particles fill the sky, bell tones
 *   settle      (88–100%)  — gentle fade, aurora drift lingers
 */

// ─── Absolute impact time (seconds from celebration start) ────
// Used by: ClaimVFX.tsx (VFX phase 2), generate-claim-sound.js, haptics
export const CLAIM_IMPACT_OFFSET_SECS = 1.5;

// ─── Duration Presets ──────────────────────────────────────────
export const CLAIM_DURATIONS = {
  normal:     5.5,
  firstClaim: 7.0,
} as const;

// ─── Phase Timing (fractions of total duration) ────────────────
// For normal 4.0s: buildup 0-1.68s, impact 1.68-2.2s, etc.
export const CLAIM_PHASES = {
  buildup:     { start: 0.00, end: 0.42 },
  impact:      { start: 0.42, end: 0.55 },
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
// Visible glow on nearby blocks without washing out block details.
export const CLAIM_LIGHT = {
  peakIntensity: 3.0,  // was 4.0 (hardcoded as 8.0 in TowerGrid) — dialed back for readability
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
// Primary shake at impact — physical, aggressive.
export const CLAIM_SHAKE = {
  magnitude: 0.70,    // BIG shake — you FEEL this in your hand
  frequency: 22,      // slightly slower for more weighty feel
  decay:      4,       // slower decay = shake lingers longer
  duration:  1.0,      // full second of rumble
  axes:       3,
} as const;

// ─── Cinematic Camera Orbit ────────────────────────────────
// Sequence: buildup (camera still) → BOOM → zoom OUT (see full tower ripple) → zoom IN (see block)
export const CLAIM_CAMERA = {
  orbitSpeed:     0.004,  // radians/frame at 60fps — noticeable cinematic drift
  zoomOutFactor:  1.80,   // pull back 80% at impact so shockwave ring fits the screen
  zoomInFactor:   0.70,   // zoom in 30% after shockwave (closer inspection)
  zoomInDelay:    1.20,   // seconds after impact to start zoom in (faster transition)
  zoomRestoreMs:  1200,   // ms after celebration end to restore zoom
  buildupHoldSecs: 0.8,   // camera holds close before impact — buildup tension
  zoomReturnDelay: 3.5,   // seconds after start to stop orbit + begin zoom-back
  glowUpDuration:  1.2,   // gold→owner color lerp after zoom-back
} as const;

// ─── Haptic Timing ────────────────────────────────────────────
// All times in ms, relative to celebration start.
// Buildup taps escalate over 1.3s → heavy impact at 1500ms.
export const CLAIM_HAPTICS = {
  normal: {
    buildup: [
      { delay: 0,    style: "Light"  as const },
      { delay: 200,  style: "Light"  as const },
      { delay: 400,  style: "Medium" as const },
      { delay: 700,  style: "Medium" as const },
      { delay: 1000, style: "Heavy"  as const },
      { delay: 1300, style: "Heavy"  as const },
    ],
    impactDelay:  1500,   // matches CLAIM_IMPACT_OFFSET_SECS × 1000
    successDelay: 1580,
    settle: [
      { delay: 2400, style: "Light" as const },
      { delay: 2600, style: "Light" as const },
      { delay: 2800, style: "Light" as const },
    ],
  },
  firstClaim: {
    buildup: [
      { delay: 0,    style: "Light"  as const },
      { delay: 200,  style: "Light"  as const },
      { delay: 400,  style: "Medium" as const },
      { delay: 700,  style: "Medium" as const },
      { delay: 1000, style: "Heavy"  as const },
      { delay: 1300, style: "Heavy"  as const },
    ],
    impactDelay:  1500,
    successDelay: 1580,
    settle: [
      { delay: 3500, style: "Light" as const },
      { delay: 3800, style: "Light" as const },
      { delay: 4100, style: "Light" as const },
      { delay: 4400, style: "Light" as const },
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
