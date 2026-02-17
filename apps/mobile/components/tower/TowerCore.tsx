import React, { useMemo } from "react";
import { useFrame } from "@react-three/fiber/native";
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
 *
 * Renders BackSide only with additive blending so the core is never
 * visible from outside and never darkens anything — you only see a
 * warm amber glow through the mortar gaps between blocks, giving the
 * tower a "keeper of the flame" feeling.
 *
 * Performance: 2 meshes, ~64 triangles, 2 draw calls, zero overdraw cost.
 */

const BODY_HEIGHT = SPIRE_START_LAYER * LAYER_HEIGHT;
// Inset enough that it sits behind the block surface
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
    // Flip normal for BackSide rendering
    vec3 N = normalize(-vNormal);
    vec3 V = normalize(vViewDir);

    // Height gradient: embers at base -> warm amber -> pale gold at top
    vec3 emberColor = vec3(0.6, 0.15, 0.02);
    vec3 amberColor = vec3(0.8, 0.45, 0.08);
    vec3 goldColor  = vec3(0.95, 0.8, 0.3);

    float h = clamp(vWorldPos.y / uBodyHeight, 0.0, 1.0);
    vec3 glowColor = mix(emberColor, amberColor, smoothstep(0.0, 0.5, h));
    glowColor = mix(glowColor, goldColor, smoothstep(0.5, 1.0, h));

    // Edge softening: fade near edges of box faces
    float edgeFade = pow(1.0 - abs(dot(N, V)), 1.5);

    // Breathing pulse: subtle energy feeling
    float pulse = 0.85 + 0.15 * sin(uTime * 0.8);

    // Final: warm glow, brighter at center, fading at edges
    float alpha = edgeFade * pulse * 0.35;
    gl_FragColor = vec4(glowColor * 0.4, alpha);
  }
`;

export default function TowerCore() {
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

  const spireGeometry = useMemo(() => {
    const bottomRadius = Math.min(BODY_WIDTH, BODY_DEPTH) * 0.5;
    const topRadius = 0.15;
    return new THREE.CylinderGeometry(topRadius, bottomRadius, SPIRE_HEIGHT, 8, 1);
  }, []);

  useFrame((_state, delta) => {
    bodyMaterial.uniforms.uTime.value += delta;
  });

  return (
    <group>
      {/* Body: box filling tower interior, BackSide only */}
      <mesh
        position={[0, BODY_HEIGHT / 2, 0]}
        material={bodyMaterial}
      >
        <boxGeometry args={[BODY_WIDTH, BODY_HEIGHT, BODY_DEPTH]} />
      </mesh>

      {/* Spire: cone from spire start to top, BackSide only */}
      <mesh
        position={[0, BODY_HEIGHT + SPIRE_HEIGHT / 2, 0]}
        geometry={spireGeometry}
        material={bodyMaterial}
      />
    </group>
  );
}
