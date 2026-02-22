import React, { useMemo } from "react";
import * as THREE from "three";
import {
  MONOLITH_HALF_W,
  MONOLITH_HALF_D,
  BLOCK_SIZE,
  LAYER_HEIGHT,
  SPIRE_START_LAYER,
  DEFAULT_TOWER_CONFIG,
} from "@monolith/common";

/**
 * TowerCore — Warm interior glow visible through gaps between blocks.
 * Ported from apps/mobile/components/tower/TowerCore.tsx.
 * Time driven by frame/fps instead of useFrame delta accumulation.
 */

const BODY_HEIGHT = SPIRE_START_LAYER * LAYER_HEIGHT;
const BODY_WIDTH = MONOLITH_HALF_W * 2 - BLOCK_SIZE * 0.6;
const BODY_DEPTH = MONOLITH_HALF_D * 2 - BLOCK_SIZE * 0.6;

const SPIRE_LAYERS = DEFAULT_TOWER_CONFIG.layerCount - SPIRE_START_LAYER;
const SPIRE_HEIGHT = SPIRE_LAYERS * LAYER_HEIGHT;

const coreVertexShader = /* glsl */ `
  precision highp float;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    gl_Position = projectionMatrix * mvPosition;

    vWorldPos = worldPos.xyz;
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
  }
`;

const coreFragmentShader = /* glsl */ `
  precision highp float;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  uniform float uBodyHeight;
  uniform float uTime;

  void main() {
    vec3 N = normalize(-vNormal);
    vec3 V = normalize(vViewDir);

    vec3 emberColor = vec3(0.6, 0.15, 0.02);
    vec3 amberColor = vec3(0.8, 0.45, 0.08);
    vec3 goldColor  = vec3(0.95, 0.8, 0.3);

    float h = clamp(vWorldPos.y / uBodyHeight, 0.0, 1.0);
    vec3 glowColor = mix(emberColor, amberColor, smoothstep(0.0, 0.5, h));
    glowColor = mix(glowColor, goldColor, smoothstep(0.5, 1.0, h));

    float edgeFade = pow(1.0 - abs(dot(N, V)), 1.5);

    float pulse = 0.85 + 0.15 * sin(uTime * 0.8);

    float alpha = edgeFade * pulse * 0.35;
    gl_FragColor = vec4(glowColor * 0.4, alpha);
  }
`;

interface TowerCoreProps {
  frame: number;
  fps: number;
}

export const TowerCore: React.FC<TowerCoreProps> = ({ frame, fps }) => {
  const bodyMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: coreVertexShader,
      fragmentShader: coreFragmentShader,
      uniforms: {
        uBodyHeight: { value: BODY_HEIGHT },
        uTime: { value: 0 },
      },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      toneMapped: false,
    });
  }, []);

  // Deterministic time
  bodyMaterial.uniforms.uTime.value = frame / fps;

  return (
    <group>
      {/* Only render the body box — spire cone removed to avoid top-of-tower artifacts */}
      <mesh
        position={[0, BODY_HEIGHT / 2, 0]}
        material={bodyMaterial}
      >
        <boxGeometry args={[BODY_WIDTH, BODY_HEIGHT, BODY_DEPTH]} />
      </mesh>
    </group>
  );
};
