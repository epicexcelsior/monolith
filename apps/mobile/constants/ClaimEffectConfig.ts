/**
 * ClaimEffectConfig — Single source of truth for the block claim celebration.
 *
 * ARC: Camera holds close with building tension → sound climaxes →
 *      camera pulls back revealing tower as VFX explodes → block pulses with light.
 *
 * AUDIO: claim-celebration.wav is 5.5s with a 2.5s internal buildup → explosion at 2.5s.
 *        Sound plays immediately (no delay) so audio climax lands on visual IMPACT.
 *
 * TIMELINE (all synced to audio):
 *   T+0.0  Sound + camera: sub-bass hum begins, camera holds close, gentle pull-back starts
 *   T+0.0–2.5  BUILDUP: audio crescendo + camera slowly drifts back + escalating jitter
 *   T+2.5  IMPACT: audio 808 slam + camera snaps to full tower + big shake + VFX explodes
 *   T+2.5–4.5  HOLD: synth pad sustains, camera holds at overview, particles fill sky
 *   T+5.3  RETURN: audio faded, camera slowly zooms back to block
 *   T+6.3  Glow-up + exit cinematic, re-select block
 *   T+6.8  Safety cleanup
 *
 * Phase timing (fractions of total duration):
 *   buildup     (0–42%)    — converging particles, bass hum swells
 *   impact      (42–55%)   — shockwave, screen flash, camera shake, VFX explosion
 *   celebration (55–88%)   — particles fill the sky, bell tones
 *   settle      (88–100%)  — gentle fade, aurora drift lingers
 */

// ─── Absolute impact time (seconds from celebration start) ────
// Used by: ClaimVFX.tsx (VFX phase 2), generate-claim-sound.js, haptics
// Matches the audio's internal buildup → explosion at exactly 2.5s.
export const CLAIM_IMPACT_OFFSET_SECS = 2.5;

// ─── Sound Delay ─────────────────────────────────────────────
// claim-celebration.wav has a 2.5s internal buildup to climax (IMPACT = 2.50 in generator).
// No delay needed — audio buildup matches CLAIM_IMPACT_OFFSET_SECS exactly.
export const CLAIM_SOUND_DELAY = 0.0;

// ─── Duration Presets ──────────────────────────────────────────
export const CLAIM_DURATIONS = {
  normal:     6.8,
  firstClaim: 8.3,
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

// ─── Cinematic Camera ──────────────────────────────────────
// Sequence:
//   BUILDUP (0–2.5s): slow pull-back from block inspect so block is clearly visible + jitter
//   IMPACT  (at 2.5s): zoom OUT to full tower overview, VFX fills screen
//   HOLD    (2.5–5.3s): camera stays at overview watching particles + tower pulse
//   RETURN  (at 5.3s): gentle zoom back to block for intimate reveal + glow-up
export const CLAIM_CAMERA = {
  buildupZoom:     13,     // gentle pull-back from ZOOM_BLOCK(10) — block stays prominent
  impactZoom:      42,     // full tower overview (slightly beyond ZOOM_OVERVIEW=40)
  returnZoomFactor: 0.70,  // zoom in 30% closer than original for intimate reveal
  zoomReturnDelay: 5.3,    // seconds after start to begin zoom-back (longer hold for pulse)
  glowUpDuration:  1.2,    // gold→owner color lerp after zoom-back
  // Phase-specific camera lerp rates (delta-corrected, 0–1, lower = slower/more cinematic)
  lerpBuildup:     0.020,  // very slow pull-back over 2.5s — block stays centered
  lerpImpact:      0.055,  // punchy zoom-out (~0.7s to 90%) — dramatic reveal
  lerpReturn:      0.025,  // gentle settle (~1.5s to 90%) — matches audio fade-out
} as const;

// ─── Haptic Timing ────────────────────────────────────────────
// All times in ms, relative to celebration start.
// Buildup taps escalate over 2.3s → heavy impact at 2500ms.
export const CLAIM_HAPTICS = {
  normal: {
    buildup: [
      { delay: 0,    style: "Light"  as const },
      { delay: 300,  style: "Light"  as const },
      { delay: 600,  style: "Light"  as const },
      { delay: 900,  style: "Medium" as const },
      { delay: 1200, style: "Medium" as const },
      { delay: 1500, style: "Medium" as const },
      { delay: 1800, style: "Heavy"  as const },
      { delay: 2100, style: "Heavy"  as const },
      { delay: 2300, style: "Heavy"  as const },
    ],
    impactDelay:  2500,   // matches CLAIM_IMPACT_OFFSET_SECS × 1000
    successDelay: 2580,
    settle: [
      { delay: 3400, style: "Light" as const },
      { delay: 3600, style: "Light" as const },
      { delay: 3800, style: "Light" as const },
    ],
  },
  firstClaim: {
    buildup: [
      { delay: 0,    style: "Light"  as const },
      { delay: 300,  style: "Light"  as const },
      { delay: 600,  style: "Light"  as const },
      { delay: 900,  style: "Medium" as const },
      { delay: 1200, style: "Medium" as const },
      { delay: 1500, style: "Medium" as const },
      { delay: 1800, style: "Heavy"  as const },
      { delay: 2100, style: "Heavy"  as const },
      { delay: 2300, style: "Heavy"  as const },
    ],
    impactDelay:  2500,
    successDelay: 2580,
    settle: [
      { delay: 4500, style: "Light" as const },
      { delay: 4800, style: "Light" as const },
      { delay: 5100, style: "Light" as const },
      { delay: 5400, style: "Light" as const },
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
