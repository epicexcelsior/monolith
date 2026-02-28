/**
 * Image Atlas — loads pre-encoded RGBA atlas into a THREE.DataTexture.
 *
 * This approach is 100% reliable in React Native because it bypasses
 * DOM Image / TextureLoader entirely. Raw RGBA bytes → DataTexture.
 *
 * If the real atlas fails to decode (large base64), falls back to a
 * procedural 4-color test atlas so the shader pipeline is never broken.
 */
import * as THREE from "three";
import { ATLAS_WIDTH, ATLAS_HEIGHT, ATLAS_COLS, ATLAS_ROWS, ATLAS_DATA_BASE64 } from "./image-atlas-data";

// base64 → Uint8Array (handles large strings via chunked decode)
function base64ToUint8Array(b64: string): Uint8Array {
  try {
    const binaryString = atob(b64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error("[ImageAtlas] atob failed, trying manual decode:", e);
    return manualBase64Decode(b64);
  }
}

// Manual base64 decoder as fallback (no atob dependency)
function manualBase64Decode(b64: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  // Strip whitespace and padding
  const clean = b64.replace(/[\s=]/g, "");
  const outLen = (clean.length * 3) >> 2;
  const out = new Uint8Array(outLen);

  let j = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)];
    const d = lookup[clean.charCodeAt(i + 3)];
    out[j++] = (a << 2) | (b >> 4);
    if (j < outLen) out[j++] = ((b & 0xf) << 4) | (c >> 2);
    if (j < outLen) out[j++] = ((c & 0x3) << 6) | d;
  }
  return out;
}

/**
 * Generate a small procedural test atlas (4 bright colors in 2x2 grid).
 * Used as fallback if the real atlas fails to load.
 */
function createTestAtlas(): { data: Uint8Array; width: number; height: number } {
  const size = 64; // 64x64, 2x2 grid of 32x32 each
  const data = new Uint8Array(size * size * 4);
  // Colors: slot 1=blue (Solana), slot 2=gold (Doge), slot 3=purple (QN), slot 4=green (Toly)
  const colors = [
    [100, 80, 255, 255],  // slot 1: blue-purple
    [255, 200, 50, 255],  // slot 2: gold
    [150, 50, 255, 255],  // slot 3: purple
    [50, 200, 100, 255],  // slot 4: green
  ];
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const col = x < half ? 0 : 1;
      const row = y < half ? 0 : 1;
      const slot = row * 2 + col;
      const idx = (y * size + x) * 4;
      data[idx] = colors[slot][0];
      data[idx + 1] = colors[slot][1];
      data[idx + 2] = colors[slot][2];
      data[idx + 3] = colors[slot][3];
    }
  }
  return { data, width: size, height: size };
}

let cachedTexture: THREE.DataTexture | null = null;

/**
 * Creates (or returns cached) the image atlas DataTexture.
 * Call from within a R3F component (inside <Canvas>).
 */
export function getImageAtlasTexture(): THREE.DataTexture {
  if (cachedTexture) return cachedTexture;

  let texData: Uint8Array;
  let texW: number;
  let texH: number;

  try {
    const expectedBytes = ATLAS_WIDTH * ATLAS_HEIGHT * 4;
    if (__DEV__) console.log(`[ImageAtlas] Decoding atlas: ${ATLAS_WIDTH}x${ATLAS_HEIGHT}, base64 length=${ATLAS_DATA_BASE64.length}`);

    texData = base64ToUint8Array(ATLAS_DATA_BASE64);
    texW = ATLAS_WIDTH;
    texH = ATLAS_HEIGHT;

    if (texData.length !== expectedBytes) {
      console.warn(`[ImageAtlas] Size mismatch: got ${texData.length}, expected ${expectedBytes}. Using fallback.`);
      const fb = createTestAtlas();
      texData = fb.data;
      texW = fb.width;
      texH = fb.height;
    } else {
      if (__DEV__) console.log(`[ImageAtlas] Decoded ${texData.length} bytes OK`);
    }
  } catch (e) {
    console.warn("[ImageAtlas] Decode failed, using fallback test atlas:", e);
    const fb = createTestAtlas();
    texData = fb.data;
    texW = fb.width;
    texH = fb.height;
  }

  const texture = new THREE.DataTexture(
    texData as unknown as Uint8Array<ArrayBuffer>,
    texW,
    texH,
    THREE.RGBAFormat,
  );
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  cachedTexture = texture;
  if (__DEV__) console.log(`[ImageAtlas] Texture created: ${texW}x${texH}`);
  return texture;
}

/** Re-export atlas grid dimensions for shader UV math */
export { ATLAS_COLS, ATLAS_ROWS };

/** Demo image names mapped to atlas slot indices (1-based) */
export const DEMO_IMAGES: Record<string, number> = {
  solana: 1,
  dogecoin: 2,
  quicknode: 3,
  toly: 4,
  mike: 5,
};
