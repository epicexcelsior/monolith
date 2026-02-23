/**
 * ClaimEffectConfig — Single source of truth for the block claim celebration system.
 *
 * DESIGN GOAL: Premium, Duolingo-level celebration that makes claiming feel INCREDIBLE.
 * Multiple simultaneous effect layers: particles, shockwave, screen flash, camera shake,
 * haptic chain, deep bass+chime sound — all coordinated by phase timing.
 *
 * Two duration presets: normal (3.0s) and firstClaim (5.0s).
 * Phase timing as fractions of total duration:
 *   buildup     (0–20%)   — converging gold streams, escalating haptics, rising energy
 *   impact      (20–30%)  — BOOM: shockwave, screen flash, camera shake, bass thump
 *   celebration (30–80%)  — explosive sparks, confetti rain, rising embers, tower glow
 *   settle      (80–100%) — gentle fade, soft pulses, embers drift away
 */

// ─── Duration Presets ──────────────────────────────────────

export const CLAIM_DURATIONS = {
  normal: 3.0,
  firstClaim: 5.0,
} as const;

// ─── Phase Timing (fractions of total duration) ────────────

export const CLAIM_PHASES = {
  buildup:     { start: 0.0,  end: 0.20 },
  impact:      { start: 0.20, end: 0.30 },
  celebration: { start: 0.30, end: 0.80 },
  settle:      { start: 0.80, end: 1.0  },
} as const;

// ─── Particle Budget ───────────────────────────────────────
// 220 particles total — still 1 draw call via InstancedMesh

export const CLAIM_PARTICLES = {
  convergeCount: 40,    // gold streams spiraling inward (buildup)
  sparkCount: 100,      // explosive radial burst (impact) — the money shot
  emberCount: 50,       // rising glowing embers (celebration)
  trailCount: 30,       // starburst trail lines (impact → celebration)
  get total() { return this.convergeCount + this.sparkCount + this.emberCount + this.trailCount; },
} as const;

// ─── Shockwave ─────────────────────────────────────────────

export const CLAIM_SHOCKWAVE = {
  /** Maximum radius the shockwave ring travels (world units) */
  maxRadius: 15.0,
  /** Ring thickness (world units) — wider = more visible */
  ringWidth: 2.5,
  /** Peak intensity at impact — cranked up for drama */
  peakIntensity: 2.5,
  /** Expansion speed (world units per second) */
  speed: 12.0,
} as const;

// ─── Fake Point Light ──────────────────────────────────────

export const CLAIM_LIGHT = {
  /** Peak intensity at impact — makes the whole tower light up */
  peakIntensity: 4.0,
  /** Attenuation distance (world units) — wider reach */
  radius: 12.0,
} as const;

// ─── Screen Flash ──────────────────────────────────────────

export const CLAIM_FLASH = {
  /** Peak opacity (0-1) of the white/gold overlay */
  peakOpacity: 0.5,
  /** Flash in duration (seconds) */
  fadeInDuration: 0.06,
  /** Flash out duration (seconds) */
  fadeOutDuration: 0.3,
  /** Color: white with gold tint */
  color: [1.0, 0.95, 0.8] as const,
} as const;

// ─── Camera Shake ──────────────────────────────────────────

export const CLAIM_SHAKE = {
  /** Maximum displacement magnitude (world units) — bigger = more dramatic */
  magnitude: 0.3,
  /** Shake frequency (oscillations per second) — more oscillations */
  frequency: 30,
  /** Exponential decay constant — higher = faster falloff */
  decay: 6,
  /** Duration of shake in seconds */
  duration: 0.5,
  /** Number of axes to shake on (x, y, z) */
  axes: 3,
} as const;

// ─── Haptic Timing ─────────────────────────────────────────
// All times in milliseconds, relative to celebration start

export const CLAIM_HAPTICS = {
  normal: {
    buildup: [
      { delay: 0,   style: "Light" as const },
      { delay: 120, style: "Light" as const },
      { delay: 240, style: "Medium" as const },
      { delay: 360, style: "Medium" as const },
      { delay: 480, style: "Heavy" as const },
    ],
    impactDelay: 600,    // 20% of 3000ms
    successDelay: 680,   // impactDelay + 80ms gap
    settle: [
      { delay: 2400, style: "Light" as const },
      { delay: 2600, style: "Light" as const },
    ],
  },
  firstClaim: {
    buildup: [
      { delay: 0,    style: "Light" as const },
      { delay: 150,  style: "Light" as const },
      { delay: 300,  style: "Light" as const },
      { delay: 450,  style: "Medium" as const },
      { delay: 600,  style: "Medium" as const },
      { delay: 750,  style: "Heavy" as const },
      { delay: 900,  style: "Heavy" as const },
    ],
    impactDelay: 1000,   // 20% of 5000ms
    successDelay: 1080,
    settle: [
      { delay: 4000, style: "Light" as const },
      { delay: 4200, style: "Light" as const },
      { delay: 4400, style: "Light" as const },
    ],
  },
} as const;

// ─── Particle Colors ──────────────────────────────────────
// HDR values (>1.0) for additive blending punch

export const CLAIM_PARTICLE_COLORS = {
  /** Bright gold converge streams (buildup) */
  converge: [1.2, 0.9, 0.2] as const,
  /** Brilliant white-gold sparks (impact) — the star */
  spark: [1.5, 1.3, 0.8] as const,
  /** Warm amber rising embers (celebration) */
  ember: [1.2, 0.6, 0.1] as const,
  /** White starburst trails */
  trail: [1.4, 1.2, 0.9] as const,
} as const;

// ─── Particle Types (encoded as float in shader) ──────────

export const PARTICLE_TYPE = {
  CONVERGE: 0,
  SPARK: 1,
  EMBER: 2,
  TRAIL: 3,
} as const;
