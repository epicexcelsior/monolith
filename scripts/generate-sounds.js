#!/usr/bin/env node
/**
 * WAV sound effect generator for The Monolith.
 * Pure Node.js — zero dependencies. Generates hero sounds via layered PCM synthesis.
 *
 * Skips block-select.wav, block-deselect.wav, button-tap.wav if they already exist
 * (those come from Kenney CC0 pack). Skips claim-celebration.wav (from generate-claim-sound.js).
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
  console.log(`  ✓ ${filename} (${(buf.length / 1024).toFixed(1)} KB)`);
}

// ─── Helpers ─────────────────────────────────────────────

const sin = (f, t) => Math.sin(2 * Math.PI * f * t);

/** ADSR envelope */
function adsr(t, a, d, s, r, total) {
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < total - r) return s;
  return s * (1 - (t - (total - r)) / r);
}

/** Simple exponential decay */
function expDecay(t, rate) {
  return Math.exp(-t * rate);
}

/** Add simulated reverb: copy signal delayed by delayMs at ampDb below */
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

// ─── Sound Generators ────────────────────────────────────

/** charge-tap.wav — Energy pulse (0.3s) */
function genChargeTap() {
  const dur = 0.3;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let val = 0;

    // Phase 1 (0-0.05s): Bright transient sweep 1200→800Hz
    if (t < 0.05) {
      const freq = 1200 - (1200 - 800) * (t / 0.05);
      const env = expDecay(t, 40);
      val += sin(freq, t) * env * 0.7;
      val += sin(freq * 2, t) * env * 0.2;  // 2nd partial
    }

    // Phase 2 (0.05-0.3s): Warm resolution C5 (523Hz) + overtones
    if (t >= 0.05) {
      const lt = t - 0.05;
      const env = adsr(lt, 0.01, 0.08, 0.4, 0.1, dur - 0.05);
      val += sin(523, t) * env * 0.5;
      val += sin(1047, t) * env * 0.25;   // octave -6dB
      val += sin(1570, t) * env * 0.12;   // 3rd partial -12dB
      // Slight detune for warmth
      val += sin(524, t) * env * 0.15;
    }

    // Sub-bass thump at 100Hz, 10ms
    if (t < 0.01) {
      val += sin(100, t) * (1 - t / 0.01) * 0.35;
    }

    s[i] = val;
  }

  addReverb(s, 50, -15);
  normalize(s, 0.7);
  return s;
}

/** block-claim.wav — Triumphant rising sweep (0.5s) */
function genBlockClaim() {
  const dur = 0.5;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let val = 0;

    // Ascending sweep phase (0-0.35s)
    if (t < 0.35) {
      const p = t / 0.35;
      const env = adsr(t, 0.01, 0.05, 0.8, 0.05, 0.35);

      // Root: A4(440)→A5(880)
      const f1 = 440 + (880 - 440) * p;
      val += sin(f1, t) * env * 0.5;
      val += sin(f1 * 2, t) * env * 0.15;  // octave

      // Major 3rd: C#5(554)→C#6(1108)
      const f2 = 554 + (1108 - 554) * p;
      val += sin(f2, t) * env * 0.25;

      // Perfect 5th: E5(659)→E6(1318)
      const f3 = 659 + (1318 - 659) * p;
      val += sin(f3, t) * env * 0.17;
    }

    // Final ring (0.35-0.5s): A major triad with shimmer
    if (t >= 0.35) {
      const lt = t - 0.35;
      const env = expDecay(lt, 5);

      val += sin(880, t) * env * 0.35;
      val += sin(881, t) * env * 0.15;  // ±1Hz detune shimmer
      val += sin(1108, t) * env * 0.2;
      val += sin(1318, t) * env * 0.15;
      val += sin(1760, t) * env * 0.08; // 2nd octave sparkle
    }

    s[i] = val;
  }

  addReverb(s, 60, -12);
  normalize(s, 0.7);
  return s;
}

/** streak-milestone.wav — Ascending celebration chime (0.8s) */
function genStreakMilestone() {
  const dur = 0.8;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);

  // 4-note arpeggio: C5→E5→G5→C6
  const notes = [523, 659, 784, 1047];
  const noteLen = 0.15;
  const overlap = 0.05;
  const step = noteLen - overlap;

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let val = 0;

    for (let ni = 0; ni < notes.length; ni++) {
      const noteStart = ni * step;
      const nt = t - noteStart;
      if (nt < 0) continue;

      const isLast = ni === notes.length - 1;
      const noteDur = isLast ? dur - noteStart : 0.35;
      if (nt > noteDur) continue;

      const env = isLast
        ? adsr(nt, 0.005, 0.05, 0.6, 0.15, noteDur)
        : expDecay(nt, 5);

      const f = notes[ni];
      val += sin(f, t) * env * 0.35;
      val += sin(f * 2, t) * env * 0.15;       // octave -6dB
      val += sin(f * 3, t) * env * 0.06;       // 3rd partial -12dB

      // Shimmer on last note
      if (isLast) {
        val += sin(f + 1, t) * env * 0.12;
        val += sin(f - 1, t) * env * 0.12;
      }
    }

    s[i] = val;
  }

  addReverb(s, 50, -12);
  normalize(s, 0.7);
  return s;
}

/** error.wav — Gentle "nope" (0.3s) */
function genError() {
  const dur = 0.3;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let val = 0;

    // Note 1: E4 (330Hz) for 0.12s
    if (t < 0.15) {
      const env = adsr(t, 0.005, 0.03, 0.6, 0.04, 0.15);
      val += sin(330, t) * env * 0.5;
      val += sin(330 * 3, t) * env * 0.06;  // mild 3rd harmonic
    }

    // Note 2: C4 (262Hz) from 0.09s → 0.3s (overlap at 0.09-0.15)
    if (t >= 0.09) {
      const lt = t - 0.09;
      const noteDur = dur - 0.09;
      const env = adsr(lt, 0.005, 0.04, 0.5, 0.06, noteDur);
      val += sin(262, t) * env * 0.5;
      val += sin(262 * 3, t) * env * 0.06;
    }

    s[i] = val;
  }

  // 40% quieter than positive sounds
  addReverb(s, 40, -15);
  normalize(s, 0.42);
  return s;
}

/** level-up.wav — Epic ascending fanfare (1.2s) */
function genLevelUp() {
  const dur = 1.2;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);

  // 6-note arpeggio: C4→E4→G4→C5→E5→G5
  const notes = [262, 330, 392, 523, 659, 784];
  const noteLen = 0.1;

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let val = 0;

    // Sub-bass C2 (65Hz) drone
    const subEnv = adsr(t, 0.05, 0.2, 0.3, 0.3, dur);
    val += sin(65, t) * subEnv * 0.06;

    for (let ni = 0; ni < notes.length; ni++) {
      const noteStart = ni * noteLen;
      const nt = t - noteStart;
      if (nt < 0) continue;

      const remaining = dur - noteStart;
      const env = adsr(nt, 0.008, 0.08, 0.5, 0.2, remaining);
      const f = notes[ni];

      // Alternate left/right emphasis (simulated pan via volume)
      const panL = ni % 2 === 0 ? 1.0 : 0.7;
      const gain = 0.25 * panL;

      val += sin(f, t) * env * gain;
      val += sin(f * 2, t) * env * gain * 0.4;    // octave -6dB
      val += sin(f * 1.5, t) * env * gain * 0.2;  // 5th -9dB
    }

    // Final chord shimmer (0.6s-1.2s): C major chord sustained
    if (t >= 0.6) {
      const lt = t - 0.6;
      const env = adsr(lt, 0.02, 0.1, 0.5, 0.2, 0.6);
      // Add ±1Hz detune for shimmer
      val += sin(524, t) * env * 0.08;
      val += sin(522, t) * env * 0.08;
      val += sin(660, t) * env * 0.06;
      val += sin(785, t) * env * 0.05;
    }

    s[i] = val;
  }

  addReverb(s, 80, -12);
  normalize(s, 0.7);
  return s;
}

/** customize.wav — Satisfying stamp (0.2s) */
function genCustomize() {
  const dur = 0.2;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let val = 0;

    // Transient: 800→600Hz fast 20ms sweep
    if (t < 0.02) {
      const freq = 800 - (800 - 600) * (t / 0.02);
      val += sin(freq, t) * (1 - t / 0.02) * 0.6;
    }

    // Body: 400Hz warm tone, 0.15s decay
    {
      const env = adsr(t, 0.005, 0.04, 0.4, 0.05, dur);
      val += sin(400, t) * env * 0.45;
      val += sin(1200, t) * env * expDecay(t, 20) * 0.17;  // overtone, faster decay
    }

    // Sub thump: 120Hz, 8ms
    if (t < 0.008) {
      val += sin(120, t) * (1 - t / 0.008) * 0.35;
    }

    s[i] = val;
  }

  normalize(s, 0.7);
  return s;
}

/** Fallback UI tap sounds — only generated if Kenney files don't exist */
function genBlockSelect() {
  const dur = 0.1;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = expDecay(t, 40);
    s[i] = (sin(880, t) * 0.6 + sin(1760, t) * 0.3) * env;
  }
  normalize(s, 0.6);
  return s;
}

function genBlockDeselect() {
  const dur = 0.08;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = expDecay(t, 50);
    s[i] = sin(660, t) * env * 0.4;
  }
  normalize(s, 0.4);
  return s;
}

function genButtonTap() {
  const dur = 0.08;
  const n = Math.floor(SR * dur);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = expDecay(t, 45);
    s[i] = (sin(700, t) * 0.5 + sin(1400, t) * 0.2) * env;
  }
  normalize(s, 0.5);
  return s;
}

// ─── Generate all ────────────────────────────────────────

console.log("Generating sound effects...\n");
fs.mkdirSync(OUT_DIR, { recursive: true });

// Hero sounds — always regenerate
writeWav("charge-tap.wav", genChargeTap());
writeWav("block-claim.wav", genBlockClaim());
writeWav("streak-milestone.wav", genStreakMilestone());
writeWav("error.wav", genError());
writeWav("level-up.wav", genLevelUp());
writeWav("customize.wav", genCustomize());

// UI taps — only generate if Kenney files don't exist
const uiSounds = [
  { file: "block-select.wav", gen: genBlockSelect },
  { file: "block-deselect.wav", gen: genBlockDeselect },
  { file: "button-tap.wav", gen: genButtonTap },
];

for (const { file, gen } of uiSounds) {
  const fullPath = path.join(OUT_DIR, file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ⏭ ${file} (already exists, skipping)`);
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
