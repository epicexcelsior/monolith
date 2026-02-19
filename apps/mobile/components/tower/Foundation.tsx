import React, { useMemo } from "react";
import * as THREE from "three";
import {
  MONOLITH_HALF_W,
  MONOLITH_HALF_D,
} from "@monolith/common";

/**
 * Foundation — Rocky bedrock base beneath the tower.
 *
 * A wide, tapered column that extends deep below the tower,
 * fading into fog/darkness. Gives the tower a sense of being
 * anchored to something ancient and massive.
 *
 * PERFORMANCE:
 * - Single mesh, ~200 triangles
 * - 1 draw call
 * - Procedural shader (no textures)
 * - depthWrite true for correct occlusion
 */

// Foundation dimensions — shallow visible platform
const FOUNDATION_TOP_SCALE = 2.2;   // wide pedestal beyond tower footprint
const FOUNDATION_DEPTH = 4;         // shallow — fully visible
const FOUNDATION_SEGMENTS = 12;     // radial segments
const FOUNDATION_TAPER = 0.9;       // subtle taper

const foundationVertexShader = /* glsl */ `
  precision highp float;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vDepth;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    gl_Position = projectionMatrix * mvPosition;

    vWorldPos = worldPos.xyz;
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    // Normalized depth: 0 at top, 1 at bottom
    vDepth = clamp(-position.y / ${FOUNDATION_DEPTH.toFixed(1)}, 0.0, 1.0);
  }
`;

const foundationFragmentShader = /* glsl */ `
  precision highp float;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vDepth;

  // Simple hash for procedural rock texture
  float hash21(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
  }

  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    float NdotV = max(dot(N, V), 0.0);

    // ─── Rock texture (procedural stone) ─────────────
    vec2 rockUV = vWorldPos.xz * 0.3 + vWorldPos.y * 0.1;
    float rockNoise = noise2D(rockUV * 2.0) * 0.5
                    + noise2D(rockUV * 5.0) * 0.3
                    + noise2D(rockUV * 12.0) * 0.2;

    // Crack veins
    vec3 wp = vWorldPos * 1.8;
    float crackX = smoothstep(0.42, 0.5, abs(fract(wp.x) - 0.5));
    float crackY = smoothstep(0.42, 0.5, abs(fract(wp.y * 0.5) - 0.5));
    float crackZ = smoothstep(0.42, 0.5, abs(fract(wp.z) - 0.5));
    float cracks = max(crackX, max(crackY, crackZ)) * 0.6;

    // ─── Base rock colors ────────────────────────────
    vec3 rockDark  = vec3(0.30, 0.24, 0.18);   // visible stone
    vec3 rockMid   = vec3(0.42, 0.34, 0.24);   // mid weathered stone
    vec3 rockLight = vec3(0.50, 0.40, 0.28);   // lighter patches
    vec3 crackColor = vec3(0.18, 0.14, 0.10);  // dark cracks

    // Mix rock variations
    vec3 rockColor = mix(rockDark, rockMid, rockNoise);
    rockColor = mix(rockColor, rockLight, smoothstep(0.6, 0.9, rockNoise) * 0.5);
    rockColor = mix(rockColor, crackColor, cracks);

    // ─── Golden top glow ─────────────────────────────
    // Strong warm light from the tower above
    float topGlow = smoothstep(0.5, 0.0, vDepth);
    rockColor += vec3(0.30, 0.20, 0.08) * topGlow;

    // ─── Face shading ────────────────────────────────
    vec3 lightDir = normalize(vec3(0.4, 0.8, 0.3));
    float NdotL = dot(N, lightDir);
    float faceBrightness = 0.5 + 0.4 * NdotL;
    faceBrightness += max(0.0, N.y) * 0.2;

    // ─── Subtle rim light ────────────────────────────
    float fresnel = pow(1.0 - NdotV, 3.0);
    vec3 rimColor = vec3(0.18, 0.12, 0.06) * fresnel;

    // ─── Combine ─────────────────────────────────────
    vec3 color = rockColor * faceBrightness;
    color += rimColor;

    // Emissive floor — foundation is always visible, never blends with void
    float minBrightness = 0.14;
    color = max(color, vec3(minBrightness, minBrightness * 0.8, minBrightness * 0.5));

    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function Foundation() {
  // Create a tapered cylinder geometry
  const geometry = useMemo(() => {
    const topRadiusX = MONOLITH_HALF_W * FOUNDATION_TOP_SCALE;
    const topRadiusZ = MONOLITH_HALF_D * FOUNDATION_TOP_SCALE;
    const botRadiusX = topRadiusX * FOUNDATION_TAPER;
    const botRadiusZ = topRadiusZ * FOUNDATION_TAPER;

    // Build a tapered rectangular prism manually for proper oval shape
    const geo = new THREE.CylinderGeometry(
      // Use average of X and Z for the cylinder, then scale
      (topRadiusX + topRadiusZ) / 2,
      (botRadiusX + botRadiusZ) / 2,
      FOUNDATION_DEPTH,
      FOUNDATION_SEGMENTS,
      2, // height segments
      false, // closed — top face visible and reflects light
    );

    // Scale X and Z to make it oval matching the rectangular tower footprint
    const xScale = topRadiusX / ((topRadiusX + topRadiusZ) / 2);
    const zScale = topRadiusZ / ((topRadiusX + topRadiusZ) / 2);
    geo.scale(xScale, 1, zScale);

    return geo;
  }, []);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: foundationVertexShader,
      fragmentShader: foundationFragmentShader,
      fog: false,
      toneMapped: false,
    });
  }, []);

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, -FOUNDATION_DEPTH / 2 - 0.5, 0]}
    />
  );
}
