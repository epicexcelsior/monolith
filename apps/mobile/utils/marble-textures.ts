/**
 * Marble Textures — loads pre-encoded RGBA marble textures into THREE.DataTexture.
 *
 * Follows the image-atlas.ts pattern: base64 → Uint8Array → DataTexture.
 * Returns cached textures with RepeatWrapping for triplanar UV mapping.
 */
import * as THREE from "three";
import {
  MARBLE_TEX_SIZE,
  MARBLE_BASECOLOR_BASE64,
  MARBLE_NORMAL_BASE64,
} from "./marble-texture-data";

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function makeDataTexture(b64: string): THREE.DataTexture {
  const data = base64ToUint8Array(b64);
  const tex = new THREE.DataTexture(
    data as unknown as Uint8Array<ArrayBuffer>,
    MARBLE_TEX_SIZE,
    MARBLE_TEX_SIZE,
    THREE.RGBAFormat,
  );
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

let cached: { baseColor: THREE.DataTexture; normal: THREE.DataTexture } | null = null;

export function getMarbleTextures() {
  if (cached) return cached;
  if (__DEV__) console.log("[MarbleTextures] Decoding marble textures...");
  cached = {
    baseColor: makeDataTexture(MARBLE_BASECOLOR_BASE64),
    normal: makeDataTexture(MARBLE_NORMAL_BASE64),
  };
  if (__DEV__) console.log("[MarbleTextures] Done");
  return cached;
}
