/**
 * generate-claim-sound.js
 *
 * ARC: Low bass charge builds (0 → 2.5s) → EXPLOSION → warm ethereal synth pad fades out
 *
 *   0.00–2.50s  Sub-bass charge sweep (22→65Hz) — dark, inevitable buildup
 *               + harmonic ladder for phone speaker presence
 *               + living-hum beat pair (two detuned 5th harmonics, 0.5Hz beat)
 *               + tension crackle in last 0.6s
 *   2.50s       EXPLOSION:
 *               — Deep 808 slam (100→22Hz pitch drop)   ← the BOOM
 *               — Broadband crack (< 20ms)              ← the POP
 *               — Upward noise sweep (0.10s)            ← the WHOOSH
 *   2.55–5.5s   Warm ethereal synth pad (A major chord: 220/277/330Hz)
 *               — Soft attack, long sustain, slow decay — Duolingo-style
 *               — Stereo width from L/R detune pairs (±1Hz beat → lush shimmer)
 *               — Upper octave doublings (440/554/660Hz) for brightness
 *               — Deep grounding hum (A1=55Hz) keeps it from going thin
 *
 * DESIGN PHILOSOPHY:
 *   No sharp-attack chimes (harsh), no high-frequency tinkle (piercing).
 *   The explosion provides all the "snap". Afterward: warmth, beauty, resolve.
 *   A major (A/C#/E) = bright, uplifting, achievement. Held long = earned.
 */

const fs   = require("fs");
const path = require("path");

const SR   = 44100;
const DUR  = 5.5;
const N    = Math.floor(SR * DUR);

const L = new Float32Array(N);
const R = new Float32Array(N);

const IMPACT = 2.50;

// ─── Phase-accumulating oscillator (correct for pitch sweeps) ─────────────
function osc(bufL, bufR, t0, t1, freqFn, ampL, ampR, envFn) {
  const s0  = Math.floor(t0 * SR);
  const s1  = Math.min(Math.floor(t1 * SR), N);
  let ph    = 0;
  for (let i = s0; i < s1; i++) {
    const lt  = (i - s0) / SR;
    const env = Math.max(0, envFn(lt, t1 - t0));
    bufL[i] += ampL * env * Math.sin(2 * Math.PI * ph);
    bufR[i] += ampR * env * Math.sin(2 * Math.PI * ph);
    ph += freqFn(lt) / SR;
    if (ph > 1) ph -= 1;
  }
}
const oscC = (bL, bR, t0, t1, f, aL, aR, e) => osc(bL, bR, t0, t1, () => f, aL, aR, e);

// ─── Stereo noise (decorrelated L/R) ─────────────────────────────────────
function noise(bufL, bufR, t0, t1, ampL, ampR, envFn, seed = 0) {
  const s0 = Math.floor(t0 * SR);
  const s1 = Math.min(Math.floor(t1 * SR), N);
  let sl = seed | 0, sr = (seed ^ 0xDEAD) | 0;
  const rl = () => { sl = Math.imul(sl, 1664525) + 1013904223 | 0; return (sl >>> 0) / 0x100000000 * 2 - 1; };
  const rr = () => { sr = Math.imul(sr, 1664525) + 1013904223 | 0; return (sr >>> 0) / 0x100000000 * 2 - 1; };
  for (let i = s0; i < s1; i++) {
    const lt  = (i - s0) / SR;
    const env = Math.max(0, envFn(lt, t1 - t0));
    bufL[i] += ampL * env * rl();
    bufR[i] += ampR * env * rr();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION A: CHARGE BUILDUP (0 → 2.5s)
// Long, dark, deep — energy gathering over 2.5 seconds
// ══════════════════════════════════════════════════════════════════════════

// Sub-bass sweep: 22Hz → 65Hz with ease-in³ — starts almost silent, ends loud
osc(L, R, 0, IMPACT,
  (lt) => 22 + (lt / IMPACT) * 43,
  0.38, 0.38,
  (lt, dur) => { const t = lt / dur; return t * t * t; },
);
// 2nd harmonic (44→130Hz) — phone speaker presence
osc(L, R, 0, IMPACT,
  (lt) => (22 + (lt / IMPACT) * 43) * 2,
  0.24, 0.24,
  (lt, dur) => (lt / dur) ** 2.5,
);
// 3rd harmonic (66→195Hz) — warmth + growl
osc(L, R, 0, IMPACT,
  (lt) => (22 + (lt / IMPACT) * 43) * 3,
  0.12, 0.12,
  (lt, dur) => (lt / dur) ** 2,
);
// 4th harmonic — subtle body
osc(L, R, 0, IMPACT,
  (lt) => (22 + (lt / IMPACT) * 43) * 4,
  0.06, 0.06,
  (lt, dur) => (lt / dur) ** 1.5,
);

// Living-hum beat pair: two detuned 5th harmonics beat at 0.5Hz
// Creates organic "breathing" in the buildup rather than static drone
osc(L, R, 0.4, IMPACT,
  (lt) => (22 + (lt / (IMPACT - 0.4)) * 43) * 5,
  0.04, 0.04,
  (lt, dur) => (lt / dur) ** 1.5,
);
osc(L, R, 0.4, IMPACT,
  (lt) => (22 + (lt / (IMPACT - 0.4)) * 43) * 5 + 0.5,
  0.04, 0.04,
  (lt, dur) => (lt / dur) ** 1.5,
);

// Dark background hum
noise(L, R, 0, IMPACT, 0.025, 0.025,
  (lt, dur) => (lt / dur) ** 2 * 0.4,
  333,
);
// Electrical tension crackle — last 0.6s
noise(L, R, IMPACT - 0.6, IMPACT, 0.08, 0.08,
  (lt, dur) => (lt / dur) ** 2.0,
  222,
);

// ══════════════════════════════════════════════════════════════════════════
// SECTION B: EXPLOSION (at 2.5s)
// ══════════════════════════════════════════════════════════════════════════

// Deep 808 SLAM — 100Hz → 22Hz pitch drop (the BOOM)
osc(L, R, IMPACT, IMPACT + 0.80,
  (lt) => 100 * Math.exp(-lt * 6.0) + 22,
  1.00, 1.00,
  (lt) => {
    if (lt < 0.002) return lt / 0.002;
    return Math.exp(-(lt - 0.002) * 3.5);
  },
);
// Chest thump (low-mid punch)
osc(L, R, IMPACT, IMPACT + 0.45,
  (lt) => 180 * Math.exp(-lt * 4) + 80,
  0.35, 0.35,
  (lt) => { if (lt < 0.001) return lt/0.001; return Math.exp(-(lt-0.001) * 8); },
);
// Broadband CRACK (the POP — < 20ms)
noise(L, R, IMPACT, IMPACT + 0.018, 0.65, 0.65,
  (lt) => Math.exp(-lt * 200),
  456,
);
// Upward WHOOSH
noise(L, R, IMPACT, IMPACT + 0.10, 0.20, 0.20,
  (lt, dur) => {
    const t = lt / dur;
    return t < 0.6 ? t / 0.6 : Math.exp(-(t - 0.6) * 12);
  },
  789,
);

// ══════════════════════════════════════════════════════════════════════════
// SECTION C: ETHEREAL SYNTH PAD (2.5s → 5.5s)
// Duolingo-style warm resolution — A major chord, soft attack, long decay
// No sharp tinkle. No high-frequency shimmer. Just warmth and beauty.
// ══════════════════════════════════════════════════════════════════════════

// ─── A major chord: A3=220Hz, C#4=277Hz, E4=330Hz ─────────────────────
// Envelope: 0.18s soft attack → peak → slow exponential decay
// Stereo width: L/R detuned ±0.8Hz so they beat gently — creates shimmer

// Root: A3 (220Hz) — the foundation
oscC(L, R, IMPACT + 0.05, 5.50, 220.8, 0.28, 0.00,
  (lt, dur) => {
    if (lt < 0.18) return lt / 0.18;
    return Math.exp(-(lt - 0.18) * 0.55);
  },
);
oscC(L, R, IMPACT + 0.05, 5.50, 219.2, 0.00, 0.28,
  (lt, dur) => {
    if (lt < 0.18) return lt / 0.18;
    return Math.exp(-(lt - 0.18) * 0.55);
  },
);

// Third: C#4 (277Hz) — gives it major brightness
oscC(L, R, IMPACT + 0.08, 5.40, 277.8, 0.20, 0.00,
  (lt) => {
    if (lt < 0.20) return lt / 0.20;
    return Math.exp(-(lt - 0.20) * 0.60);
  },
);
oscC(L, R, IMPACT + 0.08, 5.40, 276.2, 0.00, 0.20,
  (lt) => {
    if (lt < 0.20) return lt / 0.20;
    return Math.exp(-(lt - 0.20) * 0.60);
  },
);

// Fifth: E4 (330Hz) — completes the triad, airy
oscC(L, R, IMPACT + 0.12, 5.30, 330.7, 0.15, 0.00,
  (lt) => {
    if (lt < 0.22) return lt / 0.22;
    return Math.exp(-(lt - 0.22) * 0.65);
  },
);
oscC(L, R, IMPACT + 0.12, 5.30, 329.3, 0.00, 0.15,
  (lt) => {
    if (lt < 0.22) return lt / 0.22;
    return Math.exp(-(lt - 0.22) * 0.65);
  },
);

// ─── Upper octave doublings (A4/C#5/E5) — add brightness without harshness ──
// These are an octave up but SOFT (lower amplitude), pure harmonics
// Soft attack is key — no sharp transient here

// A4 upper (440Hz) — warm brightness
oscC(L, R, IMPACT + 0.10, 4.80, 441, 0.10, 0.00,
  (lt) => {
    if (lt < 0.25) return lt / 0.25;
    return Math.exp(-(lt - 0.25) * 0.80);
  },
);
oscC(L, R, IMPACT + 0.10, 4.80, 439, 0.00, 0.10,
  (lt) => {
    if (lt < 0.25) return lt / 0.25;
    return Math.exp(-(lt - 0.25) * 0.80);
  },
);

// C#5 upper (554Hz) — shimmery without being shrill
oscC(L, R, IMPACT + 0.15, 4.50, 554.5, 0.07, 0.00,
  (lt) => {
    if (lt < 0.28) return lt / 0.28;
    return Math.exp(-(lt - 0.28) * 0.90);
  },
);
oscC(L, R, IMPACT + 0.15, 4.50, 553.5, 0.00, 0.07,
  (lt) => {
    if (lt < 0.28) return lt / 0.28;
    return Math.exp(-(lt - 0.28) * 0.90);
  },
);

// E5 upper (659Hz) — airy top note (MAX freq — nothing above this)
oscC(L, R, IMPACT + 0.20, 4.20, 659.5, 0.05, 0.00,
  (lt) => {
    if (lt < 0.30) return lt / 0.30;
    return Math.exp(-(lt - 0.30) * 1.00);
  },
);
oscC(L, R, IMPACT + 0.20, 4.20, 658.5, 0.00, 0.05,
  (lt) => {
    if (lt < 0.30) return lt / 0.30;
    return Math.exp(-(lt - 0.30) * 1.00);
  },
);

// ─── Deep grounding hum (A1=55Hz) — prevents thinness, grounds the pad ──
oscC(L, R, IMPACT + 0.05, 5.50, 55, 0.18, 0.18,
  (lt) => {
    if (lt < 0.15) return lt / 0.15;
    return Math.exp(-(lt - 0.15) * 0.28);
  },
);
oscC(L, R, IMPACT + 0.05, 4.80, 110, 0.10, 0.10,
  (lt) => Math.exp(-lt * 0.40),
);

// ══════════════════════════════════════════════════════════════════════════
// MASTER: soft-knee limiter + fade-in/out
// ══════════════════════════════════════════════════════════════════════════

const KNEE = 0.62;
const GAIN = 0.76;
const sc = (x) => {
  const a = Math.abs(x) * GAIN;
  if (a <= KNEE) return Math.sign(x) * a;
  return Math.sign(x) * (KNEE + (1 - KNEE) * Math.tanh((a - KNEE) / (1 - KNEE)));
};

const FI = Math.floor(0.005 * SR);
const FO = N - Math.floor(1.00 * SR);  // 1s fade-out

for (let i = 0; i < N; i++) {
  let lv = sc(L[i]);
  let rv = sc(R[i]);
  if (i < FI)  { const f = i / FI;             lv *= f;   rv *= f; }
  if (i >= FO) { const f = 1 - (i-FO)/(N-FO); lv *= f*f; rv *= f*f; }
  L[i] = lv;
  R[i] = rv;
}

// ══════════════════════════════════════════════════════════════════════════
// WAV encode — 44100Hz stereo 16-bit PCM
// ══════════════════════════════════════════════════════════════════════════

const dataSize = N * 4;
const wav = Buffer.alloc(44 + dataSize);
wav.write("RIFF", 0); wav.writeUInt32LE(36 + dataSize, 4); wav.write("WAVE", 8);
wav.write("fmt ", 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22); wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28);
wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34);
wav.write("data", 36); wav.writeUInt32LE(dataSize, 40);
let off = 44;
for (let i = 0; i < N; i++) {
  wav.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), off); off += 2;
  wav.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))), off); off += 2;
}

const out = path.resolve(__dirname, "apps/mobile/assets/sfx/claim-celebration.wav");
fs.writeFileSync(out, wav);
console.log(`✅  ${out}`);
console.log(`    ${DUR}s | ${(wav.length/1024).toFixed(0)}KB`);
console.log(`    Arc: 0-2.5s deep bass buildup → 2.5s BOOM+POP+WHOOSH → warm A-major synth pad (220/277/330Hz) + 55Hz ground`);
console.log(`    Max freq: 659Hz (E5) — no tinkling, no shimmer, just warmth`);
