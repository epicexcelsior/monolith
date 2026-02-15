import * as THREE from "three";

/**
 * Energy → color stops for the shader color ramp.
 * Maps normalized energy (0-1) to RGB colors.
 * Solarpunk palette: warm gold/amber/copper — HDR-ready.
 * Exported for testing.
 */
export const ENERGY_COLOR_STOPS = {
  blazing: { threshold: 0.8, color: [1.0, 0.85, 0.2] as const }, // brilliant gold
  thriving: { threshold: 0.5, color: [0.9, 0.6, 0.15] as const }, // warm amber
  fading: { threshold: 0.2, color: [0.7, 0.35, 0.1] as const }, // dim copper
  dying: { threshold: 0.05, color: [0.4, 0.15, 0.05] as const }, // faint ember
  dead: { threshold: 0.0, color: [0.08, 0.06, 0.04] as const }, // dark stone
} as const;

const vertexShader = /* glsl */ `
  precision highp float;

  // Per-instance attributes
  attribute float aEnergy;
  attribute vec3 aOwnerColor;
  attribute float aLayerNorm;

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

  void main() {
    // Apply instance transform
    vec4 worldPos = instanceMatrix * vec4(position, 1.0);
    vec4 mvPosition = modelViewMatrix * worldPos;

    gl_Position = projectionMatrix * mvPosition;

    // Pass to fragment
    vEnergy = aEnergy;
    vOwnerColor = aOwnerColor;
    vLayerNorm = aLayerNorm;
    vWorldY = worldPos.y;
    vWorldPos = worldPos.xyz;

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

  // Energy → color ramp: warm solarpunk palette (gold/amber/copper)
  // Returns HDR-range values for blazing blocks (>1.0)
  vec3 energyColor(float e) {
    vec3 dead     = vec3(0.10, 0.07, 0.04);   // dark stone (warmer)
    vec3 dying    = vec3(0.50, 0.22, 0.08);    // faint ember
    vec3 fading   = vec3(0.85, 0.45, 0.14);    // dim copper
    vec3 thriving = vec3(1.05, 0.75, 0.22);    // warm amber
    vec3 blazing  = vec3(1.5, 1.15, 0.4);      // HDR brilliant gold (>1.0!)

    vec3 col = dead;
    col = mix(col, dying,    smoothstep(0.0,  0.05, e));
    col = mix(col, fading,   smoothstep(0.05, 0.2,  e));
    col = mix(col, thriving, smoothstep(0.2,  0.5,  e));
    col = mix(col, blazing,  smoothstep(0.5,  0.8,  e));

    return col;
  }

  void main() {
    float energy = clamp(vEnergy, 0.0, 1.0);

    // Base color: blend energy ramp with owner color
    vec3 eCol = energyColor(energy);
    vec3 baseColor = mix(vOwnerColor * 0.55, eCol, 0.7);

    // ─── Directional face shading ────────────────────
    // Simulates proper 3D form: top bright, sides mid, bottom dark
    vec3 N = normalize(vNormal);
    vec3 lightDir = normalize(vec3(0.4, 0.8, 0.3));
    float NdotL = dot(N, lightDir);
    float faceBrightness = 0.65 + 0.35 * NdotL;
    faceBrightness += max(0.0, N.y) * 0.15; // top-face boost

    // ─── Height-based tint ───────────────────────────
    vec3 baseTint = vec3(0.06, 0.04, 0.02);
    vec3 topTint = vec3(0.4, 0.28, 0.12);
    baseColor += mix(baseTint, topTint, vLayerNorm) * 0.3;

    // ─── Shared view direction ───────────────────────
    vec3 V = normalize(vViewDir);
    float NdotV = max(dot(N, V), 0.0);

    // ─── Specular highlight (cheap Blinn-Phong) ──────
    // Skip for dead/low-energy blocks via multiplier
    vec3 H = normalize(lightDir + V);
    float specular = pow(max(dot(N, H), 0.0), 16.0) * 0.4 * step(0.1, energy);
    specular *= (0.3 + energy * 0.7);
    vec3 specColor = vec3(1.0, 0.9, 0.6) * specular;

    // ─── Fresnel rim glow ────────────────────────────
    float fresnel = pow(1.0 - NdotV, 3.0);
    vec3 rimTint = mix(vec3(1.0, 0.8, 0.3), eCol, 0.4);
    float rimStrength = fresnel * (0.4 + energy * 0.9);

    // ─── Ambient occlusion from edges ────────────────
    float edgeAO = 1.0 - fresnel * 0.15;

    // ─── Pulse animation ─────────────────────────────
    float pulseSpeed = 1.0 + energy * 3.0;
    float pulse = 0.5 + 0.5 * sin(uTime * pulseSpeed + vInstanceOffset);
    float pulseIntensity = 0.12 + energy * 0.6;

    // ─── Vertical scanline ───────────────────────────
    float scanY = mod(uTime * 0.8, uTowerHeight + 8.0) - 4.0;
    float scanLine = smoothstep(2.0, 0.0, abs(vWorldY - scanY)) * 0.3;

    // ─── Spire glow boost ────────────────────────────
    float spireBoost = smoothstep(uSpireThreshold - 0.05, uSpireThreshold + 0.15, vLayerNorm);
    float spireGlow = spireBoost * (0.4 + 0.5 * sin(uTime * 1.5 + vInstanceOffset * 2.0));

    // ─── Emissive glow (high-energy only) ────────────
    float radiate = smoothstep(0.6, 1.0, energy) * (0.35 + 0.25 * sin(uTime * 2.0 + vInstanceOffset));
    vec3 radiateColor = vec3(1.3, 0.9, 0.3) * radiate;

    // ─── Combine ─────────────────────────────────────
    vec3 color = baseColor * faceBrightness * edgeAO;
    color *= (0.75 + pulse * pulseIntensity * 0.5);
    color += rimTint * 2.5 * rimStrength;
    color += specColor;
    color += vec3(1.0, 0.85, 0.35) * scanLine * energy;
    color += eCol * spireGlow * 0.7;
    color += radiateColor;

    // ─── Dead blocks: cheap grid crack pattern ───────
    // Single fract-based grid — much cheaper than hexPattern × 3
    float deadMask = smoothstep(0.0, 0.06, energy);
    vec3 wp = vWorldPos * 2.5;
    float crackX = smoothstep(0.44, 0.5, abs(fract(wp.x) - 0.5));
    float crackY = smoothstep(0.44, 0.5, abs(fract(wp.y) - 0.5));
    float crackZ = smoothstep(0.44, 0.5, abs(fract(wp.z) - 0.5));
    float cracks = max(crackX, max(crackY, crackZ));

    vec3 deadBase = vec3(0.07, 0.055, 0.04);
    vec3 deadCrack = vec3(0.18, 0.10, 0.04);
    vec3 deadColor = mix(deadBase, deadCrack, cracks * 0.7);
    deadColor += vec3(0.06, 0.04, 0.02) * fresnel;

    color = mix(deadColor, color, deadMask);

    // ─── Fog ─────────────────────────────────────────
    float fogFactor = exp(-uFogDensity * uFogDensity * vDist * vDist);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    color = mix(uFogColor, color, fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Creates the custom ShaderMaterial for tower blocks.
 * Supports instanced rendering with per-block energy, owner color,
 * and layer-normalized height for gradient + spire effects.
 *
 * Visual features:
 * - HDR-range output for Blazing blocks (fake bloom without post-processing)
 * - Intense golden fresnel rim glow
 * - Emissive radiate effect for high-energy blocks
 * - Visible dead blocks with structural crack lines
 * - Warm solarpunk palette (gold/amber/copper)
 */
export function createBlockMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uFogColor: { value: new THREE.Color(0x1a1008) }, // warm dark fog (brighter)
      uFogDensity: { value: 0.004 }, // half density — show more tower
      uSpireThreshold: { value: 14 / 18 }, // SPIRE_START_LAYER / layerCount
      uTowerHeight: { value: 18 * 1.3 }, // layerCount * LAYER_HEIGHT
    },
    fog: false,
    toneMapped: false,
  });
}
