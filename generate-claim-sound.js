/**
 * generate-claim-sound.js
 *
 * ARC: Long low-bass hum builds (0 → 2.5s) → angelic explosion → celestial shimmer
 *
 *   0.00–2.50s  Sub-bass charge sweep (22→65Hz) — deep capacitor building
 *               + harmonic ladder (44/88/176Hz) for phone speaker presence
 *               + slow harmonic beat pattern for "living hum" feel
 *               + electrical tension noise building in last 0.6s
 *   2.50s       EXPLOSION:
 *               — Deep slam (100→22Hz pitch drop)   ← the BOOM
 *               — Broadband crack (< 20ms)           ← the POP
 *               — Upward noise sweep (0.10s)         ← the WHOOSH
 *   2.55–5.5s   Angelic sparkle shimmer (300–5000Hz, wide stereo)
 *   2.65s       Chime 1: A4 = 440Hz  (warm reward tone)
 *   2.90s       Chime 2: E5 = 659Hz  (ascending fifth — ethereal escalation)
 *   3.15s       Chime 3: B4 = 494Hz  (settling resolution — major seventh feel)
 *   2.55–5.5s   Deep resonance hum (A1=55Hz stays to ground the brightness)
 *               + celestial mid-pad (220Hz soft swell for angelic texture)
 *
 * Why this works:
 *   The 2.5s buildup creates real anticipation — slow, dark, inevitable.
 *   Three chimes (440/659/494Hz) give an angelic ascending-then-resolving arc.
 *   The deep hum prevents it feeling "thin" or Duolingo-cute.
 *   220Hz mid-pad adds that lush "heaven opening" texture.
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
  const dur = t1 - t0;
  let ph    = 0;
  for (let i = s0; i < s1; i++) {
    const lt  = (i - s0) / SR;
    const env = Math.max(0, envFn(lt, dur));
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
// Long, dark, deep — energy gathering over a full 2.5 seconds
// ══════════════════════════════════════════════════════════════════════════

// Sub-bass sweep: 22Hz → 65Hz (ease-in³ amplitude — slow start, strong finish)
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
// 4th harmonic — subtle warmth
osc(L, R, 0, IMPACT,
  (lt) => (22 + (lt / IMPACT) * 43) * 4,
  0.06, 0.06,
  (lt, dur) => (lt / dur) ** 1.5,
);

// Slow harmonic beat (creates "living hum" — two detuned 5th-harmonic tones)
// Beating at ~0.5Hz gives gentle pulsing life to the charge
osc(L, R, 0.3, IMPACT,
  (lt) => (22 + (lt / (IMPACT - 0.3)) * 43) * 5,
  0.04, 0.04,
  (lt, dur) => (lt / dur) ** 1.5,
);
osc(L, R, 0.3, IMPACT,
  (lt) => (22 + (lt / (IMPACT - 0.3)) * 43) * 5 + 0.5,  // 0.5Hz beat
  0.04, 0.04,
  (lt, dur) => (lt / dur) ** 1.5,
);

// Background ambiance: very quiet dark hum noise throughout buildup
noise(L, R, 0, IMPACT, 0.03, 0.03,
  (lt, dur) => (lt / dur) ** 2 * 0.4,
  333,
);

// Electrical tension crackle — builds in last 0.6s before impact
noise(L, R, IMPACT - 0.6, IMPACT, 0.08, 0.08,
  (lt, dur) => (lt / dur) ** 1.8,
  222,
);
// High tension whine — very quiet shimmer in last 0.4s
noise(L, R, IMPACT - 0.4, IMPACT, 0.03, 0.03,
  (lt, dur) => (lt / dur) ** 3,
  999,
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
// Low-mid body punch (adds chest thump)
osc(L, R, IMPACT, IMPACT + 0.45,
  (lt) => 180 * Math.exp(-lt * 4) + 80,
  0.35, 0.35,
  (lt) => { if (lt < 0.001) return lt/0.001; return Math.exp(-(lt-0.001) * 8); },
);

// Broadband CRACK at impact (the POP — < 20ms)
noise(L, R, IMPACT, IMPACT + 0.018, 0.65, 0.65,
  (lt) => Math.exp(-lt * 200),
  456,
);

// Upward noise sweep — WHOOSH punctuating the explosion
noise(L, R, IMPACT, IMPACT + 0.10, 0.20, 0.20,
  (lt, dur) => {
    const t = lt / dur;
    return t < 0.6 ? t / 0.6 : Math.exp(-(t - 0.6) * 12);
  },
  789,
);

// ══════════════════════════════════════════════════════════════════════════
// SECTION C: ANGELIC CELEBRATION (2.5s → 5.5s)
// Celestial shimmer + three angelic chimes + lush grounding pads
// ══════════════════════════════════════════════════════════════════════════

// Angelic sparkle shimmer: 55 stereo tones in 300–5000Hz range
// Dense at first, gradually settling — wide stereo field
{
  let seed = 777;
  const rng = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 0x100000000; };

  for (let s = 0; s < 55; s++) {
    const t0   = IMPACT + 0.04 + rng() * 2.0;    // spread over 2s after impact
    const dur  = 0.05 + rng() * 0.35;
    const freq = 300 + rng() * 4700;              // 300–5000Hz
    const pan  = (rng() * 2 - 1) * 0.85;         // very wide stereo spread
    const dec  = Math.exp(-(t0 - IMPACT) * 0.7); // earlier = louder (gradual fade)
    const amp  = (0.04 + rng() * 0.10) * dec;
    const lA   = amp * (1 - Math.max(0, pan));
    const rA   = amp * (1 + Math.min(0, pan));

    oscC(L, R, t0, t0 + dur, freq, lA, rA,
      (lt) => { if (lt < 0.005) return lt/0.005; return Math.exp(-(lt-0.005) * 14); },
    );
  }
}

// ─── THREE ANGELIC CHIMES — ascending then resolving ─────────────────────
// Chime 1: A4 = 440Hz — warm, bright first arrival
oscC(L, R, IMPACT + 0.15, 4.80, 440, 0.26, 0.26,
  (lt) => { if (lt < 0.007) return lt/0.007; return Math.exp(-(lt-0.007) * 0.9); },
);
// Bell inharmonic partials (makes it sound like a real resonant bell)
oscC(L, R, IMPACT + 0.15, 3.50, 440 * 2.756, 0.07, 0.07,
  (lt) => Math.exp(-lt * 1.8),
);
oscC(L, R, IMPACT + 0.15, 4.00, 880, 0.08, 0.08,
  (lt) => Math.exp(-lt * 1.4),
);

// Chime 2: E5 = 659Hz — ascending fifth (ethereal, celestial escalation)
oscC(L, R, IMPACT + 0.40, 5.20, 659, 0.20, 0.20,
  (lt) => { if (lt < 0.007) return lt/0.007; return Math.exp(-(lt-0.007) * 0.75); },
);
oscC(L, R, IMPACT + 0.40, 4.00, 659 * 2.756, 0.05, 0.05,
  (lt) => Math.exp(-lt * 1.8),
);
oscC(L, R, IMPACT + 0.40, 4.50, 1318, 0.06, 0.06,
  (lt) => Math.exp(-lt * 1.2),
);

// Chime 3: B4 = 494Hz — resolving seventh (settling, "earned" feeling)
oscC(L, R, IMPACT + 0.65, 5.50, 494, 0.16, 0.16,
  (lt) => { if (lt < 0.007) return lt/0.007; return Math.exp(-(lt-0.007) * 0.6); },
);
oscC(L, R, IMPACT + 0.65, 4.50, 494 * 2.756, 0.04, 0.04,
  (lt) => Math.exp(-lt * 1.8),
);

// ─── GROUNDING PADS — the celestial "heaven opening" layer ───────────────
// Deep resonance hum (A1=55Hz) — anchor that stops everything going thin
oscC(L, R, IMPACT + 0.05, 5.50, 55, 0.18, 0.18,
  (lt) => { if (lt < 0.15) return lt/0.15; return Math.exp(-(lt-0.15) * 0.30); },
);
oscC(L, R, IMPACT + 0.05, 4.50, 110, 0.10, 0.10,
  (lt) => Math.exp(-lt * 0.45),
);
oscC(L, R, IMPACT + 0.05, 4.00, 220, 0.06, 0.06,
  (lt) => Math.exp(-lt * 0.60),
);

// Celestial mid-pad (A3=220Hz soft swell, slight detune L/R for width)
// This is the "heaven opening" texture — warm, lush, angelic
oscC(L, R, IMPACT + 0.10, 5.50, 221, 0.07, 0.00,  // L: 221Hz
  (lt) => {
    if (lt < 0.25) return lt / 0.25;
    return Math.exp(-(lt - 0.25) * 0.35);
  },
);
oscC(L, R, IMPACT + 0.10, 5.50, 219, 0.00, 0.07,  // R: 219Hz (2Hz beat → shimmer)
  (lt) => {
    if (lt < 0.25) return lt / 0.25;
    return Math.exp(-(lt - 0.25) * 0.35);
  },
);
// Upper angelic pad (A4=440Hz detuned pair for chorus effect)
oscC(L, R, IMPACT + 0.20, 5.00, 441.5, 0.04, 0.00,
  (lt) => { if (lt < 0.30) return lt/0.30; return Math.exp(-(lt-0.30) * 0.50); },
);
oscC(L, R, IMPACT + 0.20, 5.00, 438.5, 0.00, 0.04,
  (lt) => { if (lt < 0.30) return lt/0.30; return Math.exp(-(lt-0.30) * 0.50); },
);

// ══════════════════════════════════════════════════════════════════════════
// MASTER: soft-knee limiter + fade-in/out
// ══════════════════════════════════════════════════════════════════════════

const KNEE = 0.62;
const GAIN = 0.78;
const sc = (x) => {
  const a = Math.abs(x) * GAIN;
  if (a <= KNEE) return Math.sign(x) * a;
  return Math.sign(x) * (KNEE + (1 - KNEE) * Math.tanh((a - KNEE) / (1 - KNEE)));
};

// Fade in (5ms) and fade out (0.8s)
const FI = Math.floor(0.005 * SR);
const FO = N - Math.floor(0.80 * SR);

for (let i = 0; i < N; i++) {
  let lv = sc(L[i]);
  let rv = sc(R[i]);
  if (i < FI)  { const f = i / FI;               lv *= f; rv *= f; }
  if (i >= FO) { const f = 1 - (i-FO)/(N-FO);   lv *= f*f; rv *= f*f; }
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
console.log(`    Arc: 0-2.5s deep bass charge buildup → 2.5s BOOM+POP+WHOOSH → angelic shimmer + A/E/B chimes + celestial pads`);
