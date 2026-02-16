#!/usr/bin/env node
/**
 * WAV sound effect generator for The Monolith.
 * Pure Node.js — zero dependencies. Generates 6 .wav files via PCM synthesis.
 *
 * Usage: node scripts/generate-sounds.js
 * Output: apps/mobile/assets/sfx/*.wav
 */

const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;
const OUT_DIR = path.join(__dirname, "..", "apps", "mobile", "assets", "sfx");

function writeWav(filename, samples) {
  const numSamples = samples.length;
  const byteRate = SAMPLE_RATE * 2; // 16-bit mono
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
  }

  const filepath = path.join(OUT_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  console.log(`  ✓ ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

function sine(freq, t) {
  return Math.sin(2 * Math.PI * freq * t);
}

function square(freq, t) {
  return sine(freq, t) > 0 ? 1 : -1;
}

function envelope(t, attack, decay, total) {
  if (t < attack) return t / attack;
  const remaining = total - attack;
  return Math.max(0, 1 - (t - attack) / remaining);
}

// 1. block-claim.wav — Rising sweep + shimmer (523→784Hz, 0.4s)
function genBlockClaim() {
  const dur = 0.4;
  const n = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 523 + (784 - 523) * (t / dur);
    const env = envelope(t, 0.02, 0.3, dur);
    // Main sweep + octave shimmer
    samples[i] = (sine(freq, t) * 0.6 + sine(freq * 2, t) * 0.25 + sine(freq * 3, t) * 0.1) * env * 0.7;
  }
  return samples;
}

// 2. charge-tap.wav — Electric zap (1200Hz burst, 0.15s)
function genChargeTap() {
  const dur = 0.15;
  const n = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 1200 * (1 - t / dur * 0.3); // slight pitch drop
    const env = Math.exp(-t * 25);
    samples[i] = (sine(freq, t) * 0.5 + square(freq * 0.5, t) * 0.15) * env * 0.8;
  }
  return samples;
}

// 3. block-select.wav — Glass click (880Hz, 0.1s)
function genBlockSelect() {
  const dur = 0.1;
  const n = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 40);
    samples[i] = (sine(880, t) * 0.6 + sine(1760, t) * 0.3) * env * 0.6;
  }
  return samples;
}

// 4. block-deselect.wav — Soft release (660Hz, 0.08s)
function genBlockDeselect() {
  const dur = 0.08;
  const n = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 50);
    samples[i] = sine(660, t) * env * 0.4;
  }
  return samples;
}

// 5. streak-milestone.wav — C-E-G chime (3 tones, 0.6s)
function genStreakMilestone() {
  const dur = 0.6;
  const n = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float32Array(n);
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  const noteLen = 0.18;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let val = 0;
    for (let ni = 0; ni < notes.length; ni++) {
      const noteStart = ni * noteLen;
      const nt = t - noteStart;
      if (nt >= 0) {
        const env = Math.exp(-nt * 6);
        val += sine(notes[ni], t) * env * 0.4;
        val += sine(notes[ni] * 2, t) * env * 0.15; // overtone
      }
    }
    samples[i] = val * 0.7;
  }
  return samples;
}

// 6. error.wav — Low buzz (200Hz square, 0.2s)
function genError() {
  const dur = 0.2;
  const n = Math.floor(SAMPLE_RATE * dur);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = envelope(t, 0.01, 0.15, dur);
    samples[i] = square(200, t) * env * 0.35;
  }
  return samples;
}

// ─── Generate all ────────────────────────────────────────
console.log("Generating sound effects...\n");

fs.mkdirSync(OUT_DIR, { recursive: true });

writeWav("block-claim.wav", genBlockClaim());
writeWav("charge-tap.wav", genChargeTap());
writeWav("block-select.wav", genBlockSelect());
writeWav("block-deselect.wav", genBlockDeselect());
writeWav("streak-milestone.wav", genStreakMilestone());
writeWav("error.wav", genError());

console.log("\nDone! 6 sound effects generated.");
