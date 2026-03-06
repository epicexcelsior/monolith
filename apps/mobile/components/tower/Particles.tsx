import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber/native";
import * as THREE from "three";
import {
  MONOLITH_HALF_W,
  MONOLITH_HALF_D,
  DEFAULT_TOWER_CONFIG,
  getTowerHeight,
} from "@monolith/common";

const PARTICLE_COUNT = 80;
const PARTICLE_SIZE = 0.45;
const TOWER_HEIGHT = getTowerHeight(DEFAULT_TOWER_CONFIG.layerCount);
const MARGIN = 4; // extra space around the monolith
const DRIFT_SPEED = 0.3;

const particleVertexShader = /* glsl */ `
  precision highp float;

  uniform float uTime;

  attribute float aSeed;

  varying float vAlpha;
  varying float vHeight;

  void main() {
    vec4 worldPos = instanceMatrix * vec4(position, 1.0);

    // Animate: slow upward drift + gentle sway
    float t = uTime * ${DRIFT_SPEED.toFixed(1)} + aSeed * 100.0;
    float yOffset = mod(t, ${(TOWER_HEIGHT + 12).toFixed(1)});
    worldPos.y += yOffset - 4.0;
    worldPos.x += sin(t * 0.5 + aSeed * 40.0) * 1.2;
    worldPos.z += cos(t * 0.4 + aSeed * 25.0) * 1.0;

    vec4 mvPosition = modelViewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;

    // Height-normalized for color shift
    float normalizedY = (worldPos.y + 4.0) / ${(TOWER_HEIGHT + 12).toFixed(1)};
    vHeight = normalizedY;

    // Fade at edges
    vAlpha = smoothstep(0.0, 0.1, normalizedY) * smoothstep(1.0, 0.85, normalizedY);
    vAlpha *= 0.55 + 0.40 * sin(uTime * 1.5 + aSeed * 15.0);
  }
`;

const particleFragmentShader = /* glsl */ `
  precision mediump float;

  varying float vAlpha;
  varying float vHeight;

  void main() {
    // Color shifts from deep ember at base to bright gold near spire
    vec3 baseColor = vec3(0.9, 0.50, 0.15);
    vec3 topColor = vec3(1.3, 1.0, 0.45);
    vec3 color = mix(baseColor, topColor, vHeight);

    gl_FragColor = vec4(color, vAlpha);
  }
`;

/**
 * Particles — ~120 floating particles around the monolith.
 *
 * PERFORMANCE:
 * - InstancedMesh: 1 draw call for all particles
 * - Additive blending, depth write off (no sorting needed)
 * - Particle positions are STATIC; animation is fully in the vertex shader
 *   (zero JS work per frame except bumping uTime)
 * - Spawn area matches monolith rectangular footprint + margin
 */
export default function Particles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      uniforms: {
        uTime: { value: 0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    materialRef.current = mat;
    return mat;
  }, []);

  // Position particles in a rectangular volume around the monolith
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const tempObj = new THREE.Object3D();
    const seeds = new Float32Array(PARTICLE_COUNT);

    const spawnW = MONOLITH_HALF_W + MARGIN;
    const spawnD = MONOLITH_HALF_D + MARGIN;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Spawn on the perimeter of the rectangular footprint (+ some depth)
      const face = Math.floor(Math.random() * 4);
      let x: number, z: number;

      switch (face) {
        case 0: // Front
          x = (Math.random() - 0.5) * 2 * spawnW;
          z = spawnD + Math.random() * 3;
          break;
        case 1: // Back
          x = (Math.random() - 0.5) * 2 * spawnW;
          z = -(spawnD + Math.random() * 3);
          break;
        case 2: // Right
          x = spawnW + Math.random() * 3;
          z = (Math.random() - 0.5) * 2 * spawnD;
          break;
        default: // Left
          x = -(spawnW + Math.random() * 3);
          z = (Math.random() - 0.5) * 2 * spawnD;
          break;
      }

      const y = Math.random() * TOWER_HEIGHT - 2;

      tempObj.position.set(x, y, z);
      tempObj.scale.setScalar(PARTICLE_SIZE);
      tempObj.updateMatrix();
      mesh.setMatrixAt(i, tempObj.matrix);

      seeds[i] = Math.random();
    }

    mesh.instanceMatrix.needsUpdate = true;

    mesh.geometry.setAttribute(
      "aSeed",
      new THREE.InstancedBufferAttribute(seeds, 1),
    );
  }, []);

  // Only update uTime — zero matrix updates per frame
  // Cap delta to prevent visual jumps after frame stalls (e.g. store updates)
  useFrame((_state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += Math.min(delta, 0.1);
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, PARTICLE_COUNT]}
      frustumCulled={false}
      material={material}
    >
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}
