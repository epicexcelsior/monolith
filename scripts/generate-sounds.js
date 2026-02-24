#!/usr/bin/env node
/**
 * WAV sound effect generator for The Monolith.
 * Pure Node.js — zero dependencies. Generates hero sounds via layered PCM synthesis.
 *
 * Volume hierarchy (mobile game best practice):
 *   UI taps (select, deselect, button):  ~0.25 peak — barely there, just tactile
 *   Feedback (charge, customize, error):  ~0.40 peak — noticeable, not intrusive
 *   Celebrations (claim, streak, level):  ~0.55 peak — rewarding
 *   claim-celebration.wav:                ~0.76 peak — the big moment (untouched)
 *
 * Timing rules:
 *   - Zero leading silence (instant attack)
 *   - UI taps < 100ms, feedback < 200ms, celebrations < 1s
 *   - Trim trailing silence below -40dB
 *
 * Skips block-select, block-deselect, button-tap, error, customize if they
 * already exist (those come from Kenney CC0 pack).
 * Never overwrites claim-celebration.wav (from generate-claim-sound.js).
 *
 * Usage: node scripts/generate-sounds.js
 * Output: apps/mobile/assets/sfx/*.wav
 */

const fs = require("fs");
const path = require("path");

const SR = 44100;
const OUT_DIR = path.join(__dirname, "..", "apps", "mobile", "assets", "sfx");

// ─── WAV Writer ──────────────────────────────────────────

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
  buf.writeUInt32LE(SR * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32);      // block align
  buf.writeUInt16LE(16, 34);     // 16-bit

  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }

  fs.writeFileSync(path.join(OUT_DIR, filename), buf);
  console.log(`  ✓ ${filename} (${(buf.length / 1024).toFixed(1)} KB, ${(n / SR * 1000).toFixed(0)}ms)`);
}

// ─── Helpers ─────────────────────────────────────────────

const sin = (f, t) => Math.sin(2 * Math.PI * f * t);

/** ADSR envelope — instant attack matters most for mobile */
function adsr(t, a, d, s, r, total) {
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < total - r) return s;
  const releaseT = (t - (total - r)) / r;
  return s * Math.max(0, 1 - releaseT);
}

function expDecay(t, rate) {
  return Math.exp(-t * rate);
}

/** Simulated early reflection reverb */
function addReverb(samples, delayMs, ampDb) {
  const delaySamples = Math.floor((delayMs / 1000) * SR);
  const amp = Math.pow(10, ampDb / 20);
  for (let i = delaySamples; i < samples.length; i++) {
    samples[i] += samples[i - delaySamples] * amp;
  }
}

/** Normalize peaks to target amplitude */
function normalize(samples, target) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  if (peak === 0) return;
  const scale = target / peak;
  for (let i = 0; i < samples.length; i++) {
    samples[i] *= scale;
  }
}

/** Trim trailing silence below threshold */
function trimSilence(samples, thresholdDb) {
  const threshold = Math.pow(10, thresholdDb / 20);
  let lastLoud = samples.length - 1;
  while (lastLoud > 0 && Math.abs(samples[lastLoud]) < threshold) {
    lastLoud--;
  }
  // Keep 10ms of padding after last audible sample
  const end = Math.min(samples.length, lastLoud + Math.floor(SR * 0.01));
  return samples.slice(0, end);
}

// ─── Sound Generators ────────────────────────────────────

/**
 * charge-tap.wav — Snappy energy zap (0.18s)
 * Instant bright transient → fast warm resolve. No delay.
 * Peak: 0.40 (feedback tier)
 */
function genChargeTap() {
  const dur = 0.18;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let val = 0;

    // Instant bright transient: 1100→700Hz sweep in 25ms
    if (t < 0.025) {
      const freq = 1100 - (1100 - 700) * (t / 0.025);
      const env = expDecay(t, 60);
      val += sin(freq, t) * env * 0.6;
      val += sin(freq * 2, t) * env * 0.15;
    }

    // Warm resolve: C5 (523Hz), fast decay
    const resolveEnv = expDecay(t, 18) * (t > 0.01 ? 1 : t / 0.01);
    val += sin(523, t) * resolveEnv * 0.35;
    val += sin(1047, t) * resolveEnv * 0.12;  // octave color

    // Micro-thump: 80Hz, 5ms (phone speaker won't play but adds body on headphones)
    if (t < 0.005) {
      val += sin(80, t) * (1 - t / 0.005) * 0.2;
    }

    s[i] = val;
  }

  addReverb(s, 30, -18);
  normalize(s, 0.40);
  return trimSilence(s, -40);
}

/**
 * block-claim.wav — Triumphant rising sweep (0.4s)
 * Fast ascending A major triad → bright ring. Rewarding but short.
 * Peak: 0.55 (celebration tier)
 */
function genBlockClaim() {
  const dur = 0.4;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let val = 0;

    // Ascending sweep (0-0.25s)
    if (t < 0.25) {
      const p = t / 0.25;
      const env = adsr(t, 0.003, 0.04, 0.75, 0.04, 0.25);

      // Root: A4(440)→A5(880) — ease-out curve for snappier feel
      const f1 = 440 + (880 - 440) * (1 - Math.pow(1 - p, 2));
      val += sin(f1, t) * env * 0.4;

      // Major 3rd: C#5→C#6
      const f2 = 554 + (1108 - 554) * (1 - Math.pow(1 - p, 2));
      val += sin(f2, t) * env * 0.2;

      // Perfect 5th: E5→E6
      const f3 = 659 + (1318 - 659) * (1 - Math.pow(1 - p, 2));
      val += sin(f3, t) * env * 0.13;
    }

    // Ring (0.2-0.4s): A major triad with shimmer, overlaps sweep slightly
    if (t >= 0.2) {
      const lt = t - 0.2;
      const env = expDecay(lt, 7);
      val += sin(880, t) * env * 0.3;
      val += sin(881, t) * env * 0.1;   // shimmer
      val += sin(1108, t) * env * 0.15;
      val += sin(1318, t) * env * 0.1;
    }

    s[i] = val;
  }

  addReverb(s, 40, -15);
  normalize(s, 0.55);
  return trimSilence(s, -40);
}

/**
 * streak-milestone.wav — Ascending chime arpeggio (0.6s)
 * 4-note C major arpeggio, each note snaps in fast.
 * Peak: 0.55 (celebration tier)
 */
function genStreakMilestone() {
  const dur = 0.6;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);

  const notes = [523, 659, 784, 1047]; // C5→E5→G5→C6
  const step = 0.09; // 90ms between note onsets — snappy

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let val = 0;

    for (let ni = 0; ni < notes.length; ni++) {
      const noteStart = ni * step;
      const nt = t - noteStart;
      if (nt < 0) continue;

      const isLast = ni === notes.length - 1;
      const env = isLast
        ? adsr(nt, 0.003, 0.04, 0.5, 0.15, dur - noteStart)
        : expDecay(nt, 8);

      const f = notes[ni];
      val += sin(f, t) * env * 0.3;
      val += sin(f * 2, t) * env * 0.1;

      // Shimmer on last note only
      if (isLast) {
        val += sin(f + 1, t) * env * 0.08;
        val += sin(f - 1, t) * env * 0.08;
      }
    }

    s[i] = val;
  }

  addReverb(s, 35, -15);
  normalize(s, 0.55);
  return trimSilence(s, -40);
}

/**
 * level-up.wav — Epic ascending fanfare (0.9s)
 * 6-note C major arpeggio across 2 octaves → sustained chord.
 * The biggest non-claim sound. Skip sub-bass (inaudible on phone speakers).
 * Peak: 0.55 (celebration tier)
 */
function genLevelUp() {
  const dur = 0.9;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);

  const notes = [262, 330, 392, 523, 659, 784]; // C4→E4→G4→C5→E5→G5
  const step = 0.07; // 70ms between onsets — rapid fire

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let val = 0;

    for (let ni = 0; ni < notes.length; ni++) {
      const noteStart = ni * step;
      const nt = t - noteStart;
      if (nt < 0) continue;

      const remaining = dur - noteStart;
      const env = adsr(nt, 0.005, 0.06, 0.45, 0.2, remaining);
      const f = notes[ni];
      const gain = 0.2;

      val += sin(f, t) * env * gain;
      val += sin(f * 2, t) * env * gain * 0.35;    // octave
      val += sin(f * 1.5, t) * env * gain * 0.15;  // 5th
    }

    // Sustained chord shimmer (after arpeggio finishes at ~0.42s)
    if (t >= 0.42) {
      const lt = t - 0.42;
      const env = adsr(lt, 0.015, 0.08, 0.4, 0.2, dur - 0.42);
      val += sin(524, t) * env * 0.06;
      val += sin(522, t) * env * 0.06;
      val += sin(660, t) * env * 0.05;
      val += sin(785, t) * env * 0.04;
    }

    s[i] = val;
  }

  addReverb(s, 50, -15);
  normalize(s, 0.55);
  return trimSilence(s, -40);
}

// ─── Fallback synth sounds (only if Kenney files don't exist) ────

/** error — gentle descending 2-note (0.25s). Peak: 0.30 */
function genError() {
  const dur = 0.25;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let val = 0;
    if (t < 0.12) {
      const env = adsr(t, 0.003, 0.02, 0.5, 0.03, 0.12);
      val += sin(330, t) * env * 0.4;
    }
    if (t >= 0.07) {
      const lt = t - 0.07;
      const env = adsr(lt, 0.003, 0.03, 0.4, 0.05, dur - 0.07);
      val += sin(262, t) * env * 0.4;
    }
    s[i] = val;
  }
  normalize(s, 0.30);
  return trimSilence(s, -40);
}

/** customize — quick pluck (0.12s). Peak: 0.40 */
function genCustomize() {
  const dur = 0.12;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let val = 0;
    const env = expDecay(t, 30);
    val += sin(600, t) * env * 0.5;
    val += sin(1200, t) * env * 0.15;
    if (t < 0.008) val += sin(100, t) * (1 - t / 0.008) * 0.2;
    s[i] = val;
  }
  normalize(s, 0.40);
  return trimSilence(s, -40);
}

/** block-select — crisp glass tap (0.08s). Peak: 0.25 */
function genBlockSelect() {
  const dur = 0.08;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = expDecay(t, 45);
    s[i] = (sin(880, t) * 0.5 + sin(1760, t) * 0.2) * env;
  }
  normalize(s, 0.25);
  return s;
}

/** block-deselect — soft release (0.06s). Peak: 0.25 */
function genBlockDeselect() {
  const dur = 0.06;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = expDecay(t, 55);
    s[i] = sin(660, t) * env * 0.4;
  }
  normalize(s, 0.25);
  return s;
}

/** button-tap — light click (0.06s). Peak: 0.25 */
function genButtonTap() {
  const dur = 0.06;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = expDecay(t, 50);
    s[i] = (sin(700, t) * 0.4 + sin(1400, t) * 0.15) * env;
  }
  normalize(s, 0.25);
  return s;
}

// ─── Generate all ────────────────────────────────────────

console.log("Generating sound effects...\n");
fs.mkdirSync(OUT_DIR, { recursive: true });

// Hero synth sounds — always regenerate
writeWav("charge-tap.wav", genChargeTap());
writeWav("block-claim.wav", genBlockClaim());
writeWav("streak-milestone.wav", genStreakMilestone());
writeWav("level-up.wav", genLevelUp());

// Kenney-replaceable sounds — only generate if Kenney files don't exist
const kenneySounds = [
  { file: "block-select.wav", gen: genBlockSelect },
  { file: "block-deselect.wav", gen: genBlockDeselect },
  { file: "button-tap.wav", gen: genButtonTap },
  { file: "error.wav", gen: genError },
  { file: "customize.wav", gen: genCustomize },
];

for (const { file, gen } of kenneySounds) {
  const fullPath = path.join(OUT_DIR, file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ⏭ ${file} (Kenney/existing, skipping)`);
  } else {
    writeWav(file, gen());
  }
}

// Verify claim-celebration.wav exists
const celebPath = path.join(OUT_DIR, "claim-celebration.wav");
if (fs.existsSync(celebPath)) {
  console.log(`  ✓ claim-celebration.wav (preserved)`);
} else {
  console.log(`  ⚠ claim-celebration.wav missing — run: node generate-claim-sound.js`);
}

console.log("\nDone! Sound effects generated.");
