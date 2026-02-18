import * as THREE from "three";
import { DEFAULT_TOWER_CONFIG, getTowerHeight, SPIRE_START_LAYER } from "@monolith/common";

/**
 * Energy → color stops for the shader color ramp.
 * Maps normalized energy (0-1) to RGB colors.
 * These define the ENERGY OVERLAY — brightness/glow intensity, not base color.
 * Exported for testing.
 */
export const ENERGY_COLOR_STOPS = {
  blazing: { threshold: 0.8, color: [1.0, 0.92, 0.55] as const },  // brilliant white-gold
  thriving: { threshold: 0.5, color: [0.95, 0.65, 0.18] as const }, // warm amber-gold
  fading: { threshold: 0.2, color: [0.65, 0.35, 0.22] as const },   // copper with warmth
  dying: { threshold: 0.05, color: [0.45, 0.12, 0.08] as const },   // warm ember red
  dead: { threshold: 0.0, color: [0.06, 0.06, 0.08] as const },     // cool dark stone
} as const;

/**
 * Block styles (matched to BLOCK_STYLES in BlockInspector):
 * 0=Default, 1=Holographic, 2=Neon, 3=Matte, 4=Glass, 5=Fire, 6=Ice
 *
 * Block textures (procedural patterns):
 * 0=None, 1=Bricks, 2=Circuits, 3=Scales, 4=Camo, 5=Marble, 6=Carbon
 */

const vertexShader = /* glsl */ `
  precision highp float;

  // Per-instance attributes
  attribute float aEnergy;
  attribute vec3 aOwnerColor;
  attribute float aLayerNorm;
  attribute float aStyle;
  attribute float aTextureId;
  attribute float aFade;
  attribute float aHighlight;

  // Passed to fragment
  varying float vEnergy;
  varying vec3 vOwnerColor;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vDist;
  varying float vInstanceOffset;
  varying float vLayerNorm;
  varying float vWorldY;
  varying vec3 vWorldPos;
  varying float vStyle;
  varying float vTextureId;
  varying float vFade;
  varying float vHighlight;

  void main() {
    // Apply instance transform with optional highlight scale-up
    vec3 localPos = position * (1.0 + aHighlight * 0.08);
    vec4 worldPos = instanceMatrix * vec4(localPos, 1.0);

    // Pop-out: push highlighted block radially outward from tower axis
    vec3 blockCenter = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
    float centerDist = length(blockCenter);
    if (centerDist > 0.1) {
      worldPos.xyz += (blockCenter / centerDist) * aHighlight * 0.5;
    }
    worldPos.y += aHighlight * 0.15; // subtle upward float

    vec4 mvPosition = modelViewMatrix * worldPos;

    gl_Position = projectionMatrix * mvPosition;

    // Pass to fragment
    vEnergy = aEnergy;
    vOwnerColor = aOwnerColor;
    vLayerNorm = aLayerNorm;
    vWorldY = worldPos.y;
    vWorldPos = worldPos.xyz;
    vStyle = aStyle;
    vTextureId = aTextureId;
    vFade = aFade;
    vHighlight = aHighlight;

    // View-space normal for fresnel (transform normal by instance rotation)
    mat3 normalMat = mat3(instanceMatrix);
    vNormal = normalize(normalMatrix * normalMat * normal);

    // View direction for fresnel
    vViewDir = normalize(-mvPosition.xyz);

    // Distance from camera for fog
    vDist = length(mvPosition.xyz);

    // Unique offset per instance for pulse variation
    vInstanceOffset = worldPos.x * 0.3 + worldPos.y * 0.7 + worldPos.z * 0.5;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uSpireThreshold;
  uniform float uTowerHeight;

  varying float vEnergy;
  varying vec3 vOwnerColor;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vDist;
  varying float vInstanceOffset;
  varying float vLayerNorm;
  varying float vWorldY;
  varying vec3 vWorldPos;
  varying float vStyle;
  varying float vTextureId;
  varying float vFade;
  varying float vHighlight;

  // ─── Utility: hash/noise for textures ──────────────────
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

  // ─── HSV helpers for holographic ───────────────────────
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  // ─── Energy glow color (for overlays) ──────────────────
  vec3 energyGlowColor(float e) {
    vec3 dead     = vec3(0.06, 0.06, 0.09);
    vec3 dying    = vec3(0.50, 0.14, 0.08);
    vec3 fading   = vec3(0.72, 0.38, 0.20);
    vec3 thriving = vec3(1.05, 0.72, 0.22);
    vec3 blazing  = vec3(1.5, 1.25, 0.65);

    vec3 col = dead;
    col = mix(col, dying,    smoothstep(0.0,  0.05, e));
    col = mix(col, fading,   smoothstep(0.05, 0.2,  e));
    col = mix(col, thriving, smoothstep(0.2,  0.5,  e));
    col = mix(col, blazing,  smoothstep(0.5,  0.8,  e));
    return col;
  }

  // ─── Texture patterns (procedural) ─────────────────────
  // Returns a 0-1 pattern value to modulate the base color
  float getTexturePattern(float texId, vec3 wp) {
    int tid = int(texId + 0.5);

    if (tid == 1) {
      // Bricks — offset grid pattern
      vec2 bUV = wp.xz * 3.0;
      float row = floor(bUV.y);
      bUV.x += mod(row, 2.0) * 0.5; // offset every other row
      vec2 brick = fract(bUV);
      float mortar = step(0.06, brick.x) * step(0.06, brick.y);
      return mix(0.6, 1.0, mortar);
    }

    if (tid == 2) {
      // Circuits — PCB trace lines
      vec2 cUV = wp.xz * 4.0;
      float lineX = smoothstep(0.45, 0.48, abs(fract(cUV.x) - 0.5));
      float lineY = smoothstep(0.45, 0.48, abs(fract(cUV.y * 0.7) - 0.5));
      float traces = max(lineX, lineY);
      float dots = smoothstep(0.15, 0.1, length(fract(cUV) - 0.5));
      return mix(0.85, 1.0, max(traces, dots * 0.5));
    }

    if (tid == 3) {
      // Scales — hexagonal pattern
      vec2 sUV = wp.xz * 5.0;
      sUV.x += mod(floor(sUV.y), 2.0) * 0.5;
      vec2 cell = fract(sUV) - 0.5;
      float d = length(cell);
      return smoothstep(0.45, 0.3, d) * 0.3 + 0.7;
    }

    if (tid == 4) {
      // Camo — organic blobs from noise
      float n = noise2D(wp.xz * 2.5) * 0.5
              + noise2D(wp.xz * 5.0 + 100.0) * 0.3
              + noise2D(wp.xz * 10.0 + 200.0) * 0.2;
      return smoothstep(0.3, 0.7, n) * 0.4 + 0.6;
    }

    if (tid == 5) {
      // Marble — turbulent veins
      float n = noise2D(wp.xz * 3.0) * 2.0;
      n += noise2D(wp.xz * 6.0) * 1.0;
      n += noise2D(wp.xz * 12.0) * 0.5;
      float veins = abs(sin(wp.x * 4.0 + n));
      return mix(0.7, 1.0, veins);
    }

    if (tid == 6) {
      // Carbon fiber — woven grid
      vec2 cfUV = wp.xz * 8.0;
      float cx = sin(cfUV.x * 3.14159) * 0.5 + 0.5;
      float cy = sin(cfUV.y * 3.14159) * 0.5 + 0.5;
      float weave = cx * cy + (1.0 - cx) * (1.0 - cy);
      return mix(0.75, 1.0, weave);
    }

    return 1.0; // tid == 0 or unrecognized: no pattern
  }

  void main() {
    float energy = clamp(vEnergy, 0.0, 1.0);
    int style = int(vStyle + 0.5);
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    float NdotV = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, 4.0);

    // ═══════════════════════════════════════════════════════
    // LAYER 1: BASE COLOR (from customization, NOT energy)
    // ═══════════════════════════════════════════════════════

    // Owner color is the player's chosen color. Unowned blocks get a neutral default.
    vec3 baseColor = vOwnerColor;

    // If block is dead/unowned, use neutral dark stone as base
    float isOwned = step(0.01, energy);
    vec3 neutralColor = vec3(0.10, 0.07, 0.05);
    baseColor = mix(neutralColor, baseColor, isOwned);

    // Apply texture pattern (skip for dead blocks and no-texture)
    int texId = int(vTextureId + 0.5);
    if (energy > 0.01 && texId > 0) {
      float texPattern = getTexturePattern(vTextureId, vWorldPos);
      baseColor *= texPattern;
    }

    // Smooth flowing noise for owned blocks with no custom texture
    // Uses triplanar blending so noise flows consistently on all faces
    if (energy > 0.01 && texId == 0) {
      vec3 blend = abs(N);
      blend = pow(blend, vec3(4.0)); // sharpen blend to reduce overlap
      blend /= (blend.x + blend.y + blend.z); // normalize

      float t = uTime * 0.03;
      float nXZ = noise2D(vWorldPos.xz * 1.5 + t);
      float nXY = noise2D(vWorldPos.xy * 1.5 + t + vec2(53.0, 17.0));
      float nYZ = noise2D(vWorldPos.yz * 1.5 + t + vec2(91.0, 37.0));
      float flowNoise = nXZ * blend.y + nXY * blend.z + nYZ * blend.x;

      // Subtle: just enough to break flatness, not enough to distract
      float noiseStrength = 0.06 + energy * 0.10;
      baseColor *= 1.0 + (flowNoise - 0.5) * noiseStrength;
    }

    // ═══════════════════════════════════════════════════════
    // LAYER 2: STYLE MODIFIER (purely cosmetic, per block)
    // ═══════════════════════════════════════════════════════

    // --- Style 1: Holographic (rainbow shift) ---
    if (style == 1 && energy > 0.01) {
      float hue = fract(
        dot(vWorldPos, vec3(0.3, 0.5, 0.7)) * 0.15
        + uTime * 0.15
        + NdotV * 0.3
      );
      vec3 holoColor = hsv2rgb(vec3(hue, 0.6, 1.0));
      // Blend holo rainbow with the owner color
      float holoMix = 0.4 + fresnel * 0.4;
      baseColor = mix(baseColor, holoColor, holoMix);
      // Iridescent sheen on edges
      baseColor += holoColor * fresnel * 0.6;
    }

    // --- Style 2: Neon (saturated glow, bloom edges) ---
    if (style == 2 && energy > 0.01) {
      // Boost saturation of owner color
      float luma = dot(baseColor, vec3(0.299, 0.587, 0.114));
      baseColor = mix(vec3(luma), baseColor, 1.8); // over-saturate
      baseColor = max(baseColor, vec3(0.0));
      // Strong edge glow in owner color
      baseColor += vOwnerColor * fresnel * 2.0;
      // Emissive boost
      baseColor *= 1.3;
    }

    // --- Style 3: Matte (no specular, flat diffuse) ---
    // Handled below by zeroing fresnel/specular

    // --- Style 4: Glass (high fresnel, translucent look) ---
    if (style == 4 && energy > 0.01) {
      // Lighten the base for a glass-like appearance
      baseColor = mix(baseColor, vec3(1.0), 0.25);
      // Strong reflective rim
      baseColor += vec3(0.8, 0.9, 1.0) * fresnel * 1.5;
      // Subtle distortion via world position
      float distort = noise2D(vWorldPos.xz * 3.0 + uTime * 0.2) * 0.1;
      baseColor += vec3(distort);
    }

    // --- Style 5: Fire (animated flame) ---
    if (style == 5 && energy > 0.01) {
      vec2 fireUV = vec2(vWorldPos.x * 3.0, vWorldPos.y * 2.0 - uTime * 1.5);
      float flame = noise2D(fireUV) * 0.5
                  + noise2D(fireUV * 2.0 + 50.0) * 0.3
                  + noise2D(fireUV * 4.0 + 100.0) * 0.2;
      // Fire gradient: dark red → orange → yellow → white
      vec3 fireColor;
      if (flame < 0.3) {
        fireColor = mix(vec3(0.15, 0.02, 0.0), vec3(0.8, 0.2, 0.0), flame / 0.3);
      } else if (flame < 0.6) {
        fireColor = mix(vec3(0.8, 0.2, 0.0), vec3(1.0, 0.7, 0.1), (flame - 0.3) / 0.3);
      } else {
        fireColor = mix(vec3(1.0, 0.7, 0.1), vec3(1.3, 1.1, 0.8), (flame - 0.6) / 0.4);
      }
      baseColor = mix(baseColor, fireColor, 0.7);
    }

    // --- Style 6: Ice (cool crystal) ---
    if (style == 6 && energy > 0.01) {
      // Cool blue-white tint
      baseColor = mix(baseColor, vec3(0.6, 0.8, 1.0), 0.45);
      // Crystalline facets — sharp normal-based lighting
      vec3 iceLight = normalize(vec3(0.5, 0.8, 0.3));
      float facet = pow(max(dot(N, iceLight), 0.0), 16.0);
      baseColor += vec3(0.5, 0.7, 1.0) * facet * 0.6;
      // Frost noise
      float frost = noise2D(vWorldPos.xz * 8.0) * noise2D(vWorldPos.xy * 6.0);
      baseColor += vec3(0.3, 0.4, 0.5) * frost * 0.3;
      // Ice rim glow
      baseColor += vec3(0.4, 0.6, 1.0) * fresnel * 0.8;
    }

    // ═══════════════════════════════════════════════════════
    // LAYER 3: FACE SHADING (3D form, always applies)
    // ═══════════════════════════════════════════════════════

    vec3 lightDir = normalize(vec3(0.25, 0.8, -0.5));
    float NdotL = dot(N, lightDir);
    float topFace = max(0.0, N.y);
    float bottomFace = max(0.0, -N.y);
    float sideFace = 1.0 - abs(N.y);

    float faceBrightness = 0.55 + 0.35 * NdotL;
    faceBrightness += topFace * 0.25;
    faceBrightness -= bottomFace * 0.15;

    // ─── Fake AO: darken faces pointing toward tower center ──
    vec3 toCenter = normalize(vec3(0.0, vWorldPos.y, 0.0) - vWorldPos);
    float ao = 1.0 - max(dot(N, toCenter), 0.0) * 0.4;
    faceBrightness *= ao;

    // ─── Contact shadow: darken block edges where they meet grid ──
    vec3 edgePos = fract(vWorldPos * 1.1);
    float edgeDist = min(min(edgePos.x, 1.0 - edgePos.x), min(edgePos.z, 1.0 - edgePos.z));
    float contactShadow = smoothstep(0.0, 0.12, edgeDist);
    faceBrightness *= mix(0.7, 1.0, contactShadow);

    // Matte style: flatten the lighting
    if (style == 3) {
      faceBrightness = 0.65 + 0.15 * NdotL;
    }

    // ─── SSS approximation: light wrapping for high-energy blocks ──
    float sss = pow(max(dot(-N, lightDir), 0.0), 2.0) * energy * 0.2;
    baseColor += vec3(0.15, 0.08, 0.03) * sss;

    // ─── Uplight bounce: warm light on undersides ──
    baseColor += vec3(0.06, 0.04, 0.02) * max(0.0, -N.y) * energy;

    // Warm ambient on sides for living blocks
    baseColor += vec3(0.04, 0.02, 0.01) * sideFace * energy;

    // ═══════════════════════════════════════════════════════
    // LAYER 4: ENERGY OVERLAY (system-driven, additive)
    // ═══════════════════════════════════════════════════════
    // Energy affects glow intensity, not base color

    vec3 glowColor = energyGlowColor(energy);

    // Specular — GGX-like distribution (skip for matte)
    vec3 specColor = vec3(0.0);
    if (style != 3) {
      vec3 H = normalize(lightDir + V);
      float NdotH = max(dot(N, H), 0.0);
      // Roughness varies with energy: smooth when charged, rough when dim
      float roughness = mix(0.7, 0.2, energy);
      float alpha2 = roughness * roughness;
      alpha2 *= alpha2;
      float denom = NdotH * NdotH * (alpha2 - 1.0) + 1.0;
      float ggx = alpha2 / (3.14159 * denom * denom + 0.0001);
      float spec = ggx * 0.12 * step(0.1, energy);
      spec *= (0.3 + energy * 0.7);
      specColor = vec3(1.0, 0.92, 0.7) * spec;
    }

    // Fresnel rim glow (energy-scaled, skip for matte)
    vec3 rimContrib = vec3(0.0);
    if (style != 3) {
      vec3 rimTint = mix(vec3(0.5, 0.7, 1.0), glowColor, 0.5 + energy * 0.5);
      float rimStrength = fresnel * (0.35 + energy * 1.0);
      rimContrib = rimTint * 2.2 * rimStrength;
    }

    // Edge highlights (normal curvature)
    float edgeHighlight = 0.0;
    if (energy > 0.1 && style != 3) {
      float normalVariance = length(fwidth(N));
      edgeHighlight = smoothstep(0.3, 0.8, normalVariance) * 0.4 * energy;
    }

    // Inner glow (core emission for owned blocks)
    float innerGlow = 0.0;
    if (energy > 0.05) {
      float coreFactor = NdotV * NdotV;
      innerGlow = coreFactor * energy * 0.15;
    }

    // Pulse animation (energy-driven)
    float pulseSpeed = 1.0 + energy * 3.0;
    float pulse = 0.5 + 0.5 * sin(uTime * pulseSpeed + vInstanceOffset);
    float pulseIntensity = 0.1 + energy * 0.5;

    // Vertical scanline
    float scanY = mod(uTime * 0.8, uTowerHeight + 8.0) - 4.0;
    float scanLine = smoothstep(2.0, 0.0, abs(vWorldY - scanY)) * 0.25;

    // Spire glow boost
    float spireBoost = smoothstep(uSpireThreshold - 0.05, uSpireThreshold + 0.15, vLayerNorm);
    float spireGlow = spireBoost * (0.4 + 0.5 * sin(uTime * 1.5 + vInstanceOffset * 2.0));

    // Emissive radiate (high-energy only)
    float radiate = smoothstep(0.6, 1.0, energy) * (0.3 + 0.2 * sin(uTime * 2.0 + vInstanceOffset));

    // Height tint
    vec3 baseTint = vec3(0.04, 0.03, 0.05);
    vec3 topTint = vec3(0.4, 0.28, 0.12);
    vec3 heightTint = mix(baseTint, topTint, vLayerNorm) * 0.15;

    // ═══════════════════════════════════════════════════════
    // COMBINE: Base × Shading + Energy Overlays
    // ═══════════════════════════════════════════════════════

    vec3 color = baseColor * faceBrightness;
    color += heightTint;

    // Energy-driven overlays (additive)
    color *= (0.8 + pulse * pulseIntensity * 0.4);
    color += rimContrib;
    color += specColor;
    color += glowColor * scanLine * energy;
    color += glowColor * spireGlow * 0.5;
    color += glowColor * radiate;
    color += glowColor * innerGlow;
    color += vec3(1.0, 0.9, 0.7) * edgeHighlight;

    // ─── Dead blocks: warm obsidian with flowing amber veins ──
    float deadMask = smoothstep(0.0, 0.06, energy);

    // Warm obsidian base
    vec3 obsidianBase = vec3(0.08, 0.06, 0.05);

    // Flowing marble veins using turbulent noise
    float t = uTime * 0.04; // very slow flow
    vec2 veinUV = vWorldPos.xz * 1.8 + vec2(t, t * 0.7);
    float turb = noise2D(veinUV) * 2.0
               + noise2D(veinUV * 2.3 + vec2(13.7, 41.2)) * 1.0
               + noise2D(veinUV * 5.1 + vec2(73.1, 19.8)) * 0.5;
    float veins = pow(1.0 - abs(sin(vWorldPos.x * 3.0 + vWorldPos.z * 2.0 + turb)), 4.0);

    // Height gradient: deep ember at bottom, pale gold at top
    vec3 veinColorLow = vec3(0.35, 0.12, 0.04);  // deep ember
    vec3 veinColorHigh = vec3(0.55, 0.38, 0.10);  // pale gold
    vec3 veinColor = mix(veinColorLow, veinColorHigh, vLayerNorm);

    vec3 deadColor = obsidianBase + veinColor * veins * 0.35;

    // Subtle warm fresnel glow
    deadColor += vec3(0.12, 0.06, 0.02) * fresnel * 0.5;

    color = mix(deadColor, color, deadMask);

    // ═══════════════════════════════════════════════════════
    // LAYER 5: INSPECT MODE (dim + highlight)
    // ═══════════════════════════════════════════════════════

    // Dim non-focused blocks — subtle darken, selected block gets emissive boost
    color *= mix(0.55, 1.0, vFade);

    // Highlight selected block (emissive boost + bright rim)
    if (vHighlight > 0.01) {
      vec3 emissive = mix(vOwnerColor, vec3(1.0, 0.9, 0.6), 0.35);
      color += emissive * vHighlight * 0.35;
      color *= 1.0 + vHighlight * 0.25;
      float hlRim = pow(1.0 - NdotV, 2.5);
      color += vec3(1.0, 0.92, 0.7) * hlRim * vHighlight * 0.6;
    }

    // ─── Fog ─────────────────────────────────────────────
    float fogFactor = exp(-uFogDensity * uFogDensity * vDist * vDist);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    color = mix(uFogColor, color, fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Creates the custom ShaderMaterial for tower blocks.
 * Supports instanced rendering with per-block energy, owner color,
 * layer height, style, and texture.
 *
 * ARCHITECTURE — Energy ≠ Customization:
 * - Energy (system): controls pulse, rim glow, scanline, radiate intensity
 * - Customization (player): controls base color (ownerColor), style, texture
 *
 * Visual features:
 * - 7 material styles: Default, Holographic, Neon, Matte, Glass, Fire, Ice
 * - 7 procedural textures: None, Bricks, Circuits, Scales, Camo, Marble, Carbon
 * - HDR output for Blazing blocks
 * - Face-shading differentiation (top/side/bottom)
 * - Dead blocks with cool-tinted cracks
 */
export function createBlockMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uFogColor: { value: new THREE.Color(0x1a1008) },
      uFogDensity: { value: 0.004 },
      uSpireThreshold: { value: SPIRE_START_LAYER / DEFAULT_TOWER_CONFIG.layerCount },
      uTowerHeight: { value: getTowerHeight(DEFAULT_TOWER_CONFIG.layerCount) },
    },
    fog: false,
    toneMapped: false,
  });
}

// ─── Glow Pass Material ──────────────────────────────────

const glowVertexShader = /* glsl */ `
  precision highp float;

  attribute float aEnergy;
  attribute vec3 aOwnerColor;
  attribute float aFade;
  attribute float aHighlight;

  varying float vEnergy;
  varying vec3 vOwnerColor;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vFade;
  varying float vHighlight;

  void main() {
    // Inflate geometry along normals for halo effect
    mat3 normalMat = mat3(instanceMatrix);
    vec3 worldNormal = normalize(normalMat * normal);
    vec3 localPos = (position + normal * 0.04) * (1.0 + aHighlight * 0.08);
    vec4 worldPos = instanceMatrix * vec4(localPos, 1.0);

    // Pop-out: match main shader
    vec3 blockCenter = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
    float centerDist = length(blockCenter);
    if (centerDist > 0.1) {
      worldPos.xyz += (blockCenter / centerDist) * aHighlight * 0.5;
    }
    worldPos.y += aHighlight * 0.15;

    vec4 mvPosition = modelViewMatrix * worldPos;

    gl_Position = projectionMatrix * mvPosition;

    vEnergy = aEnergy;
    vOwnerColor = aOwnerColor;
    vFade = aFade;
    vHighlight = aHighlight;
    vNormal = normalize(normalMatrix * worldNormal);
    vViewDir = normalize(-mvPosition.xyz);
  }
`;

const glowFragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;

  varying float vEnergy;
  varying vec3 vOwnerColor;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vFade;
  varying float vHighlight;

  void main() {
    float energy = clamp(vEnergy, 0.0, 1.0);

    // Steep energy falloff — only very high-energy blocks glow
    float glowStrength = energy * energy * energy * energy;

    // Discard low-energy fragments (GPU skips most blocks)
    if (glowStrength < 0.2) discard;

    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    float NdotV = max(dot(N, V), 0.0);

    // Fresnel: stronger glow at edges, transparent at center
    float fresnel = pow(1.0 - NdotV, 2.5);

    // Glow color: blend owner color with warm gold
    vec3 warmGold = vec3(1.0, 0.8, 0.3);
    vec3 glowColor = mix(vOwnerColor, warmGold, 0.4) * 1.5;

    // Subtle pulse
    float pulse = 0.85 + 0.15 * sin(uTime * 2.0 + vOwnerColor.r * 10.0);

    float alpha = fresnel * glowStrength * pulse * 0.35;

    // Inspect mode: fade glow on non-selected, boost on selected
    alpha *= mix(0.3, 1.0, vFade);
    if (vHighlight > 0.01) {
      alpha += vHighlight * glowStrength * 0.5;
      glowColor *= 1.0 + vHighlight * 0.5;
    }

    gl_FragColor = vec4(glowColor * glowStrength, alpha);
  }
`;

/**
 * Creates the additive glow material for the fake bloom pass.
 * Renders inflated block geometry with fresnel-based alpha.
 * Only high-energy blocks produce visible glow (cubic falloff).
 */
export function createGlowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: glowVertexShader,
    fragmentShader: glowFragmentShader,
    uniforms: {
      uTime: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
}
