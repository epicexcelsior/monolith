import * as THREE from "three";

/**
 * Generates a 512x512 procedural image atlas with a 3x2 grid of mysterious patterns.
 * Each cell uses dark noise, scan lines, sigils, and void aesthetics.
 */

const ATLAS_SIZE = 512;
const COLS = 3;
const ROWS = 2;
const CELL_W = Math.floor(ATLAS_SIZE / COLS);
const CELL_H = Math.floor(ATLAS_SIZE / ROWS);

/** Simple deterministic hash for procedural patterns */
function hash(x: number, y: number): number {
  let h = ((x * 1619 + y * 31337) ^ 0xdeadbeef) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h >>> 0) / 0xffffffff;
}

/** Smooth noise at a given scale */
function smoothNoise(x: number, y: number, scale: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (d - a + a - b - c + b) * ux * uy;
}

type RGB = [number, number, number];

function writePixel(data: Uint8Array, x: number, y: number, r: number, g: number, b: number) {
  const idx = (y * ATLAS_SIZE + x) * 4;
  data[idx]     = Math.max(0, Math.min(255, Math.round(r)));
  data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
  data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
  data[idx + 3] = 255;
}

/** Pattern 0: Dark void — deep black with barely-visible depth noise */
function patternVoid(lx: number, ly: number): RGB {
  const n = smoothNoise(lx, ly, 60) * 0.4 + smoothNoise(lx, ly, 20) * 0.15;
  const v = n * 18;
  return [v, v * 0.9, v * 0.8];
}

/** Pattern 1: Scan lines — horizontal dark stripes bleeding amber */
function patternScanLines(lx: number, ly: number): RGB {
  const line = Math.sin(ly * 0.35) * 0.5 + 0.5;
  const flicker = smoothNoise(lx, ly, 80) * 0.3;
  const amber = (line * 0.6 + flicker) * 0.7;
  const base = smoothNoise(lx, ly, 25) * 8;
  return [base + amber * 55, base + amber * 30, base + amber * 5];
}

/** Pattern 2: Circuit grid — dark traces on darker board */
function patternCircuit(lx: number, ly: number): RGB {
  const gridX = Math.abs(Math.sin(lx * 0.28)) > 0.97 ? 1 : 0;
  const gridY = Math.abs(Math.sin(ly * 0.28)) > 0.97 ? 1 : 0;
  const node = (Math.abs(Math.sin(lx * 0.14)) > 0.96 && Math.abs(Math.sin(ly * 0.14)) > 0.96) ? 1 : 0;
  const trace = Math.max(gridX, gridY) * 0.6 + node * 0.4;
  const noise = smoothNoise(lx, ly, 40) * 5;
  const g = trace * 45 + noise;
  const r = trace * 20 + noise;
  return [r, g, noise * 0.5];
}

/** Pattern 3: Rune / sigil — circular glowing symbol on dark */
function patternRune(lx: number, ly: number): RGB {
  const cx = lx - CELL_W / 2;
  const cy = ly - CELL_H / 2;
  const dist = Math.sqrt(cx * cx + cy * cy);
  const angle = Math.atan2(cy, cx);
  const r1 = CELL_W * 0.35;
  const r2 = CELL_W * 0.20;
  const r3 = CELL_W * 0.08;
  const ring1 = Math.max(0, 1 - Math.abs(dist - r1) / 3);
  const ring2 = Math.max(0, 1 - Math.abs(dist - r2) / 2.5);
  const ring3 = Math.max(0, 1 - Math.abs(dist - r3) / 2);
  const spokes = Math.max(0, Math.abs(Math.sin(angle * 6)) - 0.92) / 0.08;
  const innerSpokes = dist < r2 ? Math.max(0, Math.abs(Math.sin(angle * 3)) - 0.88) / 0.12 : 0;
  const glyph = Math.max(ring1, ring2, ring3, spokes * (dist < r1 ? 1 : 0), innerSpokes);
  const noise = smoothNoise(lx, ly, 30) * 3;
  const amber = glyph * 80;
  return [noise + amber * 1.0, noise * 0.8 + amber * 0.5, noise * 0.6 + amber * 0.1];
}

/** Pattern 4: Corrupted data — glitch noise, scattered bright pixels on void */
function patternCorrupted(lx: number, ly: number): RGB {
  const blockSize = 8;
  const bx = Math.floor(lx / blockSize);
  const by = Math.floor(ly / blockSize);
  const blockHash = hash(bx * 7 + 3, by * 13 + 5);
  // Most blocks are dark, a few are bright
  if (blockHash > 0.96) {
    const v = 120 + hash(lx, ly) * 100;
    return [v * 0.9, v * 0.7, v * 0.4];
  }
  if (blockHash > 0.92) {
    const v = 20 + hash(lx * 3, ly * 3) * 30;
    return [v * 0.4, v * 0.8, v * 0.5];
  }
  const noise = smoothNoise(lx, ly, 15) * 6;
  return [noise, noise * 0.8, noise * 0.6];
}

/** Pattern 5: Deep nebula — layered noise with faint teal-purple glow */
function patternNebula(lx: number, ly: number): RGB {
  const n1 = smoothNoise(lx, ly, 80);
  const n2 = smoothNoise(lx + 100, ly + 50, 40);
  const n3 = smoothNoise(lx + 200, ly + 150, 20);
  const nebula = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
  const r = Math.pow(Math.max(0, nebula - 0.3) / 0.7, 2) * 60;
  const g = Math.pow(Math.max(0, nebula - 0.4) / 0.6, 2) * 30;
  const b = Math.pow(nebula, 1.5) * 45;
  return [r, g, b];
}

const PATTERNS = [
  patternVoid,
  patternScanLines,
  patternCircuit,
  patternRune,
  patternCorrupted,
  patternNebula,
];

export function generateAtlasTexture(): THREE.DataTexture {
  const data = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const patternFn = PATTERNS[row * COLS + col];
      const startX = col * CELL_W;
      const startY = row * CELL_H;

      for (let py = 0; py < CELL_H; py++) {
        for (let px = 0; px < CELL_W; px++) {
          const [r, g, b] = patternFn(px, py);
          writePixel(data, startX + px, startY + py, r, g, b);
        }
      }
    }
  }

  const texture = new THREE.DataTexture(data, ATLAS_SIZE, ATLAS_SIZE, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  return texture;
}
