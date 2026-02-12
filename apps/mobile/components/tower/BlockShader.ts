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

  // Passed to fragment
  varying float vEnergy;
  varying vec3 vOwnerColor;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vDist;
  varying float vInstanceOffset;

  void main() {
    // Apply instance transform
    vec4 worldPos = instanceMatrix * vec4(position, 1.0);
    vec4 mvPosition = modelViewMatrix * worldPos;

    gl_Position = projectionMatrix * mvPosition;

    // Pass to fragment
    vEnergy = aEnergy;
    vOwnerColor = aOwnerColor;

    // View-space normal for fresnel (transform normal by instance rotation)
    mat3 normalMat = mat3(instanceMatrix);
    vNormal = normalize(normalMatrix * normalMat * normal);

    // View direction for fresnel
    vViewDir = normalize(-mvPosition.xyz);

    // Distance from camera for fog
    vDist = length(mvPosition.xyz);

    // Unique offset per instance for pulse variation
    // Use world position as a seed
    vInstanceOffset = worldPos.x * 0.3 + worldPos.y * 0.7 + worldPos.z * 0.5;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3 uFogColor;
  uniform float uFogDensity;

  varying float vEnergy;
  varying vec3 vOwnerColor;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vDist;
  varying float vInstanceOffset;

  // Energy → color ramp (branchless via smoothstep/mix)
  vec3 energyColor(float e) {
    // Dead → dying → fading → thriving → blazing
    vec3 dead    = vec3(0.1, 0.1, 0.18);
    vec3 dying   = vec3(1.0, 0.0, 0.4);
    vec3 fading  = vec3(0.4, 0.0, 1.0);
    vec3 thriving = vec3(0.0, 0.4, 1.0);
    vec3 blazing = vec3(0.0, 1.0, 1.0);

    vec3 col = dead;
    col = mix(col, dying,    smoothstep(0.0,  0.05, e));
    col = mix(col, fading,   smoothstep(0.05, 0.2,  e));
    col = mix(col, thriving, smoothstep(0.2,  0.5,  e));
    col = mix(col, blazing,  smoothstep(0.5,  0.8,  e));

    return col;
  }

  void main() {
    float energy = clamp(vEnergy, 0.0, 1.0);

    // Base color: 70% energy ramp + 30% owner color
    vec3 eCol = energyColor(energy);
    vec3 baseColor = mix(vOwnerColor, eCol, 0.7);

    // Fresnel rim glow — neon edge highlight
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 3.0);
    vec3 rimColor = eCol * 1.5;
    float rimStrength = fresnel * energy * 0.8;

    // Pulse: sin wave modulating emissive, faster for higher energy
    float pulseSpeed = 1.0 + energy * 3.0;
    float pulse = 0.5 + 0.5 * sin(uTime * pulseSpeed + vInstanceOffset);
    float pulseIntensity = 0.3 + energy * 0.7;

    // Combine: base + rim + pulse glow
    vec3 color = baseColor * (0.6 + pulse * pulseIntensity * 0.4);
    color += rimColor * rimStrength;

    // Dead blocks: minimal glow
    float deadMask = smoothstep(0.0, 0.05, energy);
    color = mix(vec3(0.08, 0.08, 0.12), color, deadMask);

    // Manual fog: exponential squared
    float fogFactor = exp(-uFogDensity * uFogDensity * vDist * vDist);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    color = mix(uFogColor, color, fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Creates the custom ShaderMaterial for tower blocks.
 * Supports instanced rendering with per-block energy and owner color.
 */
export function createBlockMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uFogColor: { value: new THREE.Color(0x0a0a0f) },
      uFogDensity: { value: 0.012 },
    },
    fog: false, // We handle fog manually in the shader
    toneMapped: false,
  });
}
