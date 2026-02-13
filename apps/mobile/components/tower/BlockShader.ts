import * as THREE from "three";

/**
 * Energy → color stops for the shader color ramp.
 * Maps normalized energy (0-1) to RGB colors.
 * Exported for testing.
 */
export const ENERGY_COLOR_STOPS = {
  blazing: { threshold: 0.8, color: [0.0, 1.0, 1.0] as const }, // cyan
  thriving: { threshold: 0.5, color: [0.0, 0.4, 1.0] as const }, // blue
  fading: { threshold: 0.2, color: [0.4, 0.0, 1.0] as const }, // purple
  dying: { threshold: 0.05, color: [1.0, 0.0, 0.4] as const }, // red
  dead: { threshold: 0.0, color: [0.1, 0.1, 0.18] as const }, // dark
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

  // Energy → color ramp (branchless via smoothstep/mix)
  vec3 energyColor(float e) {
    vec3 dead    = vec3(0.08, 0.06, 0.14);
    vec3 dying   = vec3(0.7, 0.0, 0.3);
    vec3 fading  = vec3(0.3, 0.0, 0.8);
    vec3 thriving = vec3(0.0, 0.35, 0.9);
    vec3 blazing = vec3(0.0, 0.9, 1.0);

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
    vec3 baseColor = mix(vOwnerColor * 0.6, eCol, 0.65);

    // ─── Height-based tint ───────────────────────────
    // Subtle gradient: dark indigo at base → brighter cyan/white at top
    vec3 baseTint = vec3(0.04, 0.02, 0.1);
    vec3 topTint = vec3(0.1, 0.2, 0.45);
    vec3 heightTint = mix(baseTint, topTint, vLayerNorm);
    baseColor += heightTint * 0.3;

    // ─── Fresnel rim glow ────────────────────────────
    // Strong glass-panel edge glow
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 2.5);
    vec3 rimColor = mix(eCol, vec3(0.3, 0.6, 1.0), 0.3) * 1.8;
    float rimStrength = fresnel * (0.4 + energy * 0.6);

    // ─── Pulse animation ─────────────────────────────
    float pulseSpeed = 1.0 + energy * 2.5;
    float pulse = 0.5 + 0.5 * sin(uTime * pulseSpeed + vInstanceOffset);
    float pulseIntensity = 0.2 + energy * 0.6;

    // ─── Vertical scanline ───────────────────────────
    // Faint sweeping light line moving up the building
    float scanY = mod(uTime * 0.8, uTowerHeight + 8.0) - 4.0;
    float scanDist = abs(vWorldY - scanY);
    float scanLine = smoothstep(2.0, 0.0, scanDist) * 0.15;

    // ─── Spire glow boost ────────────────────────────
    float spireBoost = smoothstep(uSpireThreshold - 0.05, uSpireThreshold + 0.15, vLayerNorm);
    float spireGlow = spireBoost * (0.3 + 0.4 * sin(uTime * 1.5 + vInstanceOffset * 2.0));

    // ─── Combine ─────────────────────────────────────
    vec3 color = baseColor * (0.55 + pulse * pulseIntensity * 0.45);
    color += rimColor * rimStrength;
    color += vec3(0.2, 0.5, 1.0) * scanLine * energy;
    color += eCol * spireGlow * 0.6;

    // Dead blocks: nearly black with faint structure lines
    float deadMask = smoothstep(0.0, 0.06, energy);
    vec3 deadColor = vec3(0.05, 0.04, 0.08) + vec3(0.03) * fresnel;
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
 */
export function createBlockMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uFogColor: { value: new THREE.Color(0x060610) },
      uFogDensity: { value: 0.008 },
      uSpireThreshold: { value: 14 / 18 }, // SPIRE_START_LAYER / layerCount
      uTowerHeight: { value: 18 * 1.3 }, // layerCount * LAYER_HEIGHT
    },
    fog: false,
    toneMapped: false,
  });
}
