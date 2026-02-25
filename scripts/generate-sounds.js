#!/usr/bin/env node
/**
 * WAV sound effect generator for The Monolith.
 * Pure Node.js — zero dependencies.
 *
 * ─── Audio Identity ──────────────────────────────────────────────────────────
 * All synthesized sounds share the A Dorian modal palette:
 *   A3=220  E4=330  A4=440  C#5=554  E5=659  A5=880  E6=1319
 *
 * Texture: crystal sine waves + FM shimmer. Feels like touching glowing glass.
 * Character: premium, clean, satisfying — not cartoony.
 *
 * ─── Volume Hierarchy ────────────────────────────────────────────────────────
 * UI taps      (select/deselect/button/scroll): ~0.20 peak  (-14dB)
 * Feedback     (charge/customize/error):        ~0.38 peak  (-8dB)
 * Celebrations (claim/streak/levelup):          ~0.52 peak  (-6dB)
 * claim-celebration.wav: untouched epic
 *
 * ─── Timing rules ────────────────────────────────────────────────────────────
 * Zero leading silence (instant attack, no pre-delay)
 * UI < 80ms, Feedback < 180ms, Celebrations < 900ms
 *
 * Skips block-select, block-deselect, button-tap if they exist (Kenney CC0).
 * Never overwrites claim-celebration.wav.
 *
 * Usage: node scripts/generate-sounds.js
 */

const fs = require("fs");
const path = require("path");

const SR = 44100;
const OUT_DIR = path.join(__dirname, "..", "apps", "mobile", "assets", "sfx");

// ─── WAV Writer ───────────────────────────────────────────────────────────────

function writeWav(filename, samples) {
  const n = samples.length;
  const dataSize = n * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);      // PCM
  buf.writeUInt16LE(1, 22);      // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT_DIR, filename), buf);
  const ms = Math.round((n / SR) * 1000);
  console.log(`  ✓ ${filename} (${(buf.length / 1024).toFixed(1)} KB, ${ms}ms)`);
}

// ─── DSP Helpers ─────────────────────────────────────────────────────────────

const TAU = 2 * Math.PI;
const sin = (f, t) => Math.sin(TAU * f * t);

/** Exponential decay from 1.0 → 0.0 */
const xdecay = (t, rate) => Math.exp(-t * rate);

/** ADSR envelope */
function adsr(t, a, d, s, r, total) {
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < total - r) return s;
  return s * Math.max(0, 1 - (t - (total - r)) / r);
}

/** Soft-clip to keep hot signals from hard-clipping */
const softClip = (x) => Math.tanh(x * 1.5) / Math.tanh(1.5);

/** Peak-normalize samples to target amplitude */
function normalize(s, target) {
  let peak = 0;
  for (let i = 0; i < s.length; i++) peak = Math.max(peak, Math.abs(s[i]));
  if (peak < 1e-6) return;
  const scale = target / peak;
  for (let i = 0; i < s.length; i++) s[i] *= scale;
}

/** Trim trailing silence below thresholdDb */
function trim(s, thresholdDb = -42) {
  const thr = Math.pow(10, thresholdDb / 20);
  let last = s.length - 1;
  while (last > 0 && Math.abs(s[last]) < thr) last--;
  return s.slice(0, Math.min(s.length, last + Math.floor(SR * 0.008)));
}

/** Simple comb-filter reverb: single early reflection */
function reverb(s, delayMs, gainDb) {
  const d = Math.floor((delayMs / 1000) * SR);
  const g = Math.pow(10, gainDb / 20);
  for (let i = d; i < s.length; i++) s[i] += s[i - d] * g;
}

/** FM synthesis: carrier freq, modulator freq, modulation index */
const fm = (fc, fm_, idx, t) => Math.sin(TAU * fc * t + idx * Math.sin(TAU * fm_ * t));

/** Alloc float array of n frames */
const buf = (dur) => new Float32Array(Math.floor(SR * dur));

// ─── A Dorian reference frequencies ──────────────────────────────────────────
// A2=110 A3=220 E4=330 A4=440 C#5=554 D5=587 E5=659 G5=784 A5=880 E6=1319

// ─── Layer Scroll ─────────────────────────────────────────────────────────────
/**
 * layer-scroll.wav — Tiny crystal tick, one per layer crossed.
 * 30ms, D6 (1175Hz). So subtle it's almost subliminal.
 */
function genLayerScroll() {
  const s = buf(0.03);
  for (let i = 0; i < s.length; i++) {
    const t = i / SR;
    const env = xdecay(t, 100); // super fast
    s[i] = sin(1175, t) * env * 0.5
         + sin(2350, t) * env * 0.12; // 2nd harmonic shimmer
  }
  normalize(s, 0.18);
  return trim(s);
}

// ─── Panel Open ──────────────────────────────────────────────────────────────
/**
 * panel-open.wav — Soft glass whoosh, slides down A5→E5.
 * Signals "something opened". 70ms.
 */
function genPanelOpen() {
  const dur = 0.07;
  const s = buf(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SR;
    const p = t / dur;
    // Frequency glide: A5(880) → E5(659) — landing on the dominant
    const freq = 880 - (880 - 659) * (1 - Math.pow(1 - p, 2));
    const env = adsr(t, 0.004, 0.015, 0.55, 0.025, dur);
    s[i] = sin(freq, t) * env * 0.6
         + sin(freq * 2, t) * env * 0.12; // subtle overtone
  }
  reverb(s, 20, -22);
  normalize(s, 0.22);
  return trim(s);
}

// ─── Charge Tap ───────────────────────────────────────────────────────────────
/**
 * charge-tap.wav — FM electric zap rooted on E4 (330Hz).
 * The modulation index sweeps 4→0, collapsing the FM distortion into a clean tone.
 * 140ms. Feels like sending a pulse of energy into a block.
 */
function genChargeTap() {
  const dur = 0.14;
  const s = buf(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SR;
    const p = t / dur;

    // FM zap: modulation index sweeps from 4 → 0 (distorted → clean)
    const idx = 4 * Math.pow(1 - p, 1.5);
    const env = adsr(t, 0.001, 0.02, 0.5, 0.05, dur);

    // Primary: E4 carrier, A4 modulator (ratio 4:3 = perfect fourth shimmer)
    s[i] = fm(330, 440, idx, t) * env * 0.55;

    // Sub thud (5ms): gives it body on headphones
    if (t < 0.005) {
      s[i] += sin(80, t) * (1 - t / 0.005) * 0.25;
    }

    // Shimmer: A5 (880Hz) bright ring at attack
    if (t < 0.03) {
      s[i] += sin(880, t) * xdecay(t, 80) * 0.2;
    }
  }
  reverb(s, 18, -20);
  normalize(s, 0.38);
  return trim(s);
}

// ─── Customize ───────────────────────────────────────────────────────────────
/**
 * customize.wav — Satisfying stamp + A5 crystal ping.
 * Two-part: short noise burst (stamp) → clean A5 tone (confirm).
 * 90ms.
 */
function genCustomize() {
  const dur = 0.09;
  const s = buf(dur);

  // Seeded pseudo-noise for stamp character (deterministic)
  let noiseSeed = 12345;
  const noise = () => {
    noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0;
    return (noiseSeed / 0x80000000) - 1;
  };

  for (let i = 0; i < s.length; i++) {
    const t = i / SR;

    // Stamp: high-passed noise burst (first 15ms)
    if (t < 0.015) {
      const env = xdecay(t, 120);
      s[i] += noise() * env * 0.45;
    }

    // Crystal ping: A5 = 880Hz, instant attack, fast ring
    const pingEnv = xdecay(t, 28);
    s[i] += sin(880, t) * pingEnv * 0.5
           + sin(1760, t) * pingEnv * 0.12; // 2nd harmonic

    // Sub click (1ms): tactile body
    if (t < 0.001) s[i] += 0.3;
  }

  reverb(s, 25, -22);
  normalize(s, 0.38);
  return trim(s);
}

// ─── Error ────────────────────────────────────────────────────────────────────
/**
 * error.wav — Descending minor 3rd: E5(659Hz) → C#5(554Hz).
 * Slightly detuned second note for mild tension. 180ms.
 */
function genError() {
  const dur = 0.18;
  const s = buf(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SR;

    // First note: E5, 0–80ms
    if (t < 0.08) {
      const env = adsr(t, 0.002, 0.015, 0.55, 0.03, 0.08);
      s[i] += sin(659, t) * env * 0.45;
      s[i] += sin(659 * 2, t) * env * 0.08; // slight overtone for body
    }

    // Second note: C#5 (slightly flat = 540Hz for dissonance), 70–180ms
    if (t >= 0.07) {
      const lt = t - 0.07;
      const env = adsr(lt, 0.002, 0.02, 0.45, 0.04, dur - 0.07);
      s[i] += sin(540, t) * env * 0.45; // detuned C#5 — tension
      s[i] += sin(540 * 1.5, t) * env * 0.06;
    }
  }
  normalize(s, 0.35);
  return trim(s);
}

// ─── Block Claim ─────────────────────────────────────────────────────────────
/**
 * block-claim.wav — Glass impact → rising A major shimmer.
 * Stage 1 (0-60ms): hard transient, feels physical and satisfying.
 * Stage 2 (50-350ms): ascending A→E→A crystal tones.
 * 350ms total.
 */
function genBlockClaim() {
  const dur = 0.35;
  const s = buf(dur);

  // Stage 1: impact — FM punch on A4
  for (let i = 0; i < Math.floor(SR * 0.06); i++) {
    const t = i / SR;
    const env = xdecay(t, 50);
    const idx = 6 * xdecay(t, 40); // FM index sweeps fast
    s[i] += fm(440, 880, idx, t) * env * 0.65;
    // Sub thud
    if (t < 0.008) s[i] += sin(60, t) * xdecay(t, 100) * 0.3;
  }

  // Stage 2: ascending shimmer — A4(440) → E5(659) → A5(880)
  const shimmerNotes = [
    { freq: 440, start: 0.05, gain: 0.4 },
    { freq: 659, start: 0.12, gain: 0.35 },
    { freq: 880, start: 0.19, gain: 0.3 },
  ];

  for (const { freq, start, gain } of shimmerNotes) {
    for (let i = Math.floor(SR * start); i < s.length; i++) {
      const lt = i / SR - start;
      const remaining = dur - start;
      const env = adsr(lt, 0.003, 0.02, 0.5, 0.08, remaining);
      s[i] += sin(freq, i / SR) * env * gain;
      s[i] += sin(freq + 0.5, i / SR) * env * gain * 0.15; // shimmer detuning
    }
  }

  reverb(s, 35, -16);
  normalize(s, 0.52);
  return trim(s);
}

// ─── Streak Milestone ─────────────────────────────────────────────────────────
/**
 * streak-milestone.wav — 3-note crystal arpeggio: A4 → E5 → A5.
 * Perfect octave/fifth relationship. Each note rings with shimmer.
 * 380ms.
 */
function genStreakMilestone() {
  const dur = 0.38;
  const s = buf(dur);
  const notes = [
    { freq: 440,  start: 0.00, gain: 0.38 }, // A4 — root
    { freq: 659,  start: 0.10, gain: 0.33 }, // E5 — perfect 5th
    { freq: 880,  start: 0.20, gain: 0.30 }, // A5 — octave, ring out
  ];

  for (const { freq, start, gain } of notes) {
    const isLast = freq === 880;
    for (let i = Math.floor(SR * start); i < s.length; i++) {
      const lt = i / SR - start;
      const remaining = dur - start;
      const env = isLast
        ? adsr(lt, 0.003, 0.03, 0.45, 0.12, remaining)
        : xdecay(lt, 10);
      s[i] += sin(freq, i / SR) * env * gain;
      s[i] += sin(freq * 2, i / SR) * env * gain * 0.12; // 2nd harmonic
      if (isLast) {
        // Shimmer detuning on last note — makes it sparkle
        s[i] += sin(freq + 0.8, i / SR) * env * gain * 0.18;
        s[i] += sin(freq - 0.8, i / SR) * env * gain * 0.18;
      }
    }
  }

  reverb(s, 30, -16);
  normalize(s, 0.52);
  return trim(s);
}

// ─── Level Up ─────────────────────────────────────────────────────────────────
/**
 * level-up.wav — Full A major fanfare: A3→E4→A4→C#5→E5→A5 arpeggio → chord.
 * Steps 55ms apart for snappy velocity. Chord sustains with shimmer.
 * 780ms.
 */
function genLevelUp() {
  const dur = 0.78;
  const s = buf(dur);
  const notes = [
    { freq: 220,  start: 0.000 }, // A3
    { freq: 330,  start: 0.055 }, // E4
    { freq: 440,  start: 0.110 }, // A4
    { freq: 554,  start: 0.165 }, // C#5
    { freq: 659,  start: 0.220 }, // E5
    { freq: 880,  start: 0.275 }, // A5
  ];

  for (let ni = 0; ni < notes.length; ni++) {
    const { freq, start } = notes[ni];
    const isLast = ni === notes.length - 1;
    for (let i = Math.floor(SR * start); i < s.length; i++) {
      const lt = i / SR - start;
      const remaining = dur - start;
      const env = adsr(lt, 0.004, 0.04, 0.45, 0.15, remaining);
      const gain = isLast ? 0.22 : 0.18;
      s[i] += sin(freq, i / SR) * env * gain;
      s[i] += sin(freq * 2, i / SR) * env * gain * 0.3;   // octave
      s[i] += sin(freq * 1.5, i / SR) * env * gain * 0.12; // 5th
      if (isLast) {
        // Shimmer detuning on final note
        s[i] += sin(freq + 0.6, i / SR) * env * 0.15;
        s[i] += sin(freq - 0.6, i / SR) * env * 0.15;
      }
    }
  }

  // Sustained chord shimmer after arpeggio (from 0.33s)
  for (let i = Math.floor(SR * 0.33); i < s.length; i++) {
    const lt = i / SR - 0.33;
    const env = adsr(lt, 0.02, 0.06, 0.35, 0.18, dur - 0.33);
    s[i] += sin(440, i / SR) * env * 0.055;
    s[i] += sin(659, i / SR) * env * 0.050;
    s[i] += sin(880, i / SR) * env * 0.045;
  }

  reverb(s, 45, -15);
  normalize(s, 0.52);
  return trim(s);
}

// ─── Tower Rise ──────────────────────────────────────────────────────────────
/**
 * tower-rise.wav — Low rumble rising in pitch + warm cinematic pad.
 * Plays during tower reveal (3s build) + cinematic orbit (5s orbit).
 * Phase A (0-3s): Sub bass sweep, rumble, rising tones, crystal shimmer.
 * Phase B (3-8.5s): Warm A major pad blooms, reverb tail, gentle fade.
 * ~8500ms total.
 */
function genTowerRise() {
  const dur = 8.5;
  const buildEnd = 3.0; // Phase A ends
  const s = buf(dur);

  // Seeded pseudo-noise for rumble
  let noiseSeed = 99999;
  const noise = () => {
    noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0;
    return (noiseSeed / 0x80000000) - 1;
  };

  for (let i = 0; i < s.length; i++) {
    const t = i / SR;
    const p = t / dur;

    // ── Phase A: Build reveal (0-3s) ──────────────────────────────
    if (t < buildEnd) {
      const bp = t / buildEnd; // 0→1 over build phase
      const bEnv = adsr(t, 0.3, 0.2, 0.7, 0.5, buildEnd);

      // Sub bass sweep: 40Hz → 110Hz (A2)
      const bassFreq = 40 + 70 * bp;
      s[i] += sin(bassFreq, t) * bEnv * 0.3;

      // Rumble: filtered noise, fades as pitch rises
      const rumbleEnv = bEnv * Math.max(0, 1 - bp * 1.2);
      s[i] += noise() * rumbleEnv * 0.08;

      // Rising tone 1: A3(220) → A4(440), enters at 20%
      if (bp > 0.2) {
        const lp = (bp - 0.2) / 0.8;
        const freq1 = 220 + 220 * lp;
        const env1 = adsr(t - buildEnd * 0.2, 0.4, 0.2, 0.5, 0.3, buildEnd * 0.8) * lp;
        s[i] += sin(freq1, t) * env1 * 0.15;
      }

      // Rising tone 2: E4(330) → E5(659), enters at 40%
      if (bp > 0.4) {
        const lp = (bp - 0.4) / 0.6;
        const freq2 = 330 + 329 * lp;
        const env2 = adsr(t - buildEnd * 0.4, 0.3, 0.15, 0.45, 0.2, buildEnd * 0.6) * lp;
        s[i] += sin(freq2, t) * env2 * 0.12;
      }

      // Crystal shimmer: A5(880) enters in last 40%, grows brighter
      if (bp > 0.6) {
        const lp = (bp - 0.6) / 0.4;
        const shimEnv = lp * lp * bEnv;
        s[i] += sin(880, t) * shimEnv * 0.1;
        s[i] += sin(880.7, t) * shimEnv * 0.06;
        s[i] += sin(1319, t) * shimEnv * 0.04;
      }

      // FM texture throughout: adds organic movement
      const fmIdx = 1.5 * (1 - bp);
      s[i] += fm(110, 55, fmIdx, t) * bEnv * 0.06;
    }

    // ── Phase B: Cinematic pad (3s-8.5s) ──────────────────────────
    if (t >= buildEnd - 0.5) { // Start crossfading 0.5s before build ends
      const padStart = buildEnd - 0.5;
      const padDur = dur - padStart;
      const pt = (t - padStart) / padDur; // 0→1 over pad phase

      // Volume swell: -12dB → -6dB (0.25 → 0.5) then gentle fade
      const padVol = pt < 0.4
        ? 0.25 + 0.25 * (pt / 0.4) // swell up
        : pt < 0.7
          ? 0.50 // sustain
          : 0.50 * (1 - (pt - 0.7) / 0.3); // fade out

      const padEnv = adsr(t - padStart, 1.0, 0.3, 0.8, 1.5, padDur);

      // A major chord: A3(220) + C#4(277) + E4(330)
      s[i] += sin(220, t)   * padEnv * padVol * 0.20;
      s[i] += sin(277.2, t) * padEnv * padVol * 0.15; // C#4
      s[i] += sin(330, t)   * padEnv * padVol * 0.12; // E4

      // Octave shimmer: A4(440) + E5(659), subtle
      s[i] += sin(440, t)   * padEnv * padVol * 0.08;
      s[i] += sin(659.3, t) * padEnv * padVol * 0.05;

      // Detuned warmth (slow beating)
      s[i] += sin(220.5, t) * padEnv * padVol * 0.06;
      s[i] += sin(330.4, t) * padEnv * padVol * 0.04;

      // Very gentle noise bed for texture
      s[i] += noise() * padEnv * padVol * 0.015;
    }
  }

  reverb(s, 80, -10);
  normalize(s, 0.45);
  return trim(s);
}

// ─── Sheet Open ──────────────────────────────────────────────────────────────
/**
 * sheet-open.wav — Satisfying whoosh for bottom sheet open.
 * Air sweep with subtle tone landing on E5. 100ms.
 */
function genSheetOpen() {
  const dur = 0.1;
  const s = buf(dur);

  let noiseSeed = 54321;
  const noise = () => {
    noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0;
    return (noiseSeed / 0x80000000) - 1;
  };

  for (let i = 0; i < s.length; i++) {
    const t = i / SR;
    const p = t / dur;

    // Filtered whoosh: noise with descending resonance
    const nEnv = adsr(t, 0.002, 0.03, 0.3, 0.04, dur);
    s[i] += noise() * nEnv * 0.15;

    // Tonal landing: E5 (659Hz) fades in
    if (p > 0.3) {
      const lp = (p - 0.3) / 0.7;
      s[i] += sin(659, t) * lp * xdecay(t - dur * 0.3, 25) * 0.35;
    }
  }
  reverb(s, 15, -24);
  normalize(s, 0.22);
  return trim(s);
}

// ─── Fallback synth for Kenney-replaceable sounds (if file missing) ───────────

/** block-select fallback: clean E5 bell tap */
function genBlockSelect() {
  const s = buf(0.08);
  for (let i = 0; i < s.length; i++) {
    const t = i / SR;
    const env = xdecay(t, 40);
    s[i] = sin(659, t) * env * 0.6 + sin(1318, t) * env * 0.15;
  }
  normalize(s, 0.22);
  return trim(s);
}

/** block-deselect fallback: softer A4 release */
function genBlockDeselect() {
  const s = buf(0.07);
  for (let i = 0; i < s.length; i++) {
    const t = i / SR;
    const env = xdecay(t, 55);
    s[i] = sin(440, t) * env * 0.6;
  }
  normalize(s, 0.18);
  return trim(s);
}

/** button-tap fallback: tiny A5 crystal click */
function genButtonTap() {
  const s = buf(0.05);
  for (let i = 0; i < s.length; i++) {
    const t = i / SR;
    const env = xdecay(t, 65);
    s[i] = (sin(880, t) * 0.5 + sin(1760, t) * 0.15) * env;
  }
  normalize(s, 0.18);
  return trim(s);
}

// ─── Generate all ────────────────────────────────────────────────────────────

console.log("Generating The Monolith sound effects (A Dorian crystal identity)...\n");
fs.mkdirSync(OUT_DIR, { recursive: true });

// Always regenerate synthesized sounds
writeWav("layer-scroll.wav",     genLayerScroll());
writeWav("panel-open.wav",       genPanelOpen());
writeWav("charge-tap.wav",       genChargeTap());
writeWav("customize.wav",        genCustomize());
writeWav("error.wav",            genError());
writeWav("block-claim.wav",      genBlockClaim());
writeWav("streak-milestone.wav", genStreakMilestone());
writeWav("level-up.wav",         genLevelUp());
writeWav("tower-rise.wav",      genTowerRise());
writeWav("sheet-open.wav",      genSheetOpen());

// Kenney-replaceable — synth fallback if file doesn't already exist
const kenney = [
  { file: "block-select.wav",   gen: genBlockSelect },
  { file: "block-deselect.wav", gen: genBlockDeselect },
  { file: "button-tap.wav",     gen: genButtonTap },
];
for (const { file, gen } of kenney) {
  const fp = path.join(OUT_DIR, file);
  if (fs.existsSync(fp)) {
    const kB = (fs.statSync(fp).size / 1024).toFixed(1);
    console.log(`  ⏭ ${file} (Kenney/existing, ${kB} KB)`);
  } else {
    writeWav(file, gen());
  }
}

// Preserve claim-celebration
const cel = path.join(OUT_DIR, "claim-celebration.wav");
if (fs.existsSync(cel)) {
  console.log(`  ✓ claim-celebration.wav (preserved)`);
} else {
  console.log(`  ⚠ claim-celebration.wav missing — run: node generate-claim-sound.js`);
}

console.log("\nDone.");
