import React, { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import {
  MONOLITH_HALF_W,
  MONOLITH_HALF_D,
  DEFAULT_TOWER_CONFIG,
  getTowerHeight,
} from "@monolith/common";

const PARTICLE_COUNT = 120;
const PARTICLE_SIZE = 0.3;
const TOWER_HEIGHT = getTowerHeight(DEFAULT_TOWER_CONFIG.layerCount);
const MARGIN = 4;
const DRIFT_SPEED = 0.3;

const particleVertexShader = /* glsl */ `
  precision highp float;

  uniform float uTime;

  attribute float aSeed;

  varying float vAlpha;
  varying float vHeight;

  void main() {
    vec4 worldPos = instanceMatrix * vec4(position, 1.0);

    float t = uTime * ${DRIFT_SPEED.toFixed(1)} + aSeed * 100.0;
    float yOffset = mod(t, ${(TOWER_HEIGHT + 12).toFixed(1)});
    worldPos.y += yOffset - 4.0;
    worldPos.x += sin(t * 0.5 + aSeed * 40.0) * 1.2;
    worldPos.z += cos(t * 0.4 + aSeed * 25.0) * 1.0;

    vec4 mvPosition = modelViewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;

    float normalizedY = (worldPos.y + 4.0) / ${(TOWER_HEIGHT + 12).toFixed(1)};
    vHeight = normalizedY;

    vAlpha = smoothstep(0.0, 0.1, normalizedY) * smoothstep(1.0, 0.85, normalizedY);
    vAlpha *= 0.55 + 0.40 * sin(uTime * 1.5 + aSeed * 15.0);
  }
`;

const particleFragmentShader = /* glsl */ `
  precision highp float;

  varying float vAlpha;
  varying float vHeight;

  void main() {
    vec3 baseColor = vec3(0.8, 0.35, 0.08);
    vec3 topColor = vec3(1.2, 0.95, 0.35);
    vec3 color = mix(baseColor, topColor, vHeight);

    gl_FragColor = vec4(color, vAlpha);
  }
`;

interface VideoParticlesProps {
  frame: number;
  fps: number;
}

/**
 * Particles adapted for Remotion — uTime driven by frame / fps
 * instead of delta accumulation.
 */
export const VideoParticles: React.FC<VideoParticlesProps> = ({ frame, fps }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
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
  }, []);

  // Position particles deterministically
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const tempObj = new THREE.Object3D();
    const seeds = new Float32Array(PARTICLE_COUNT);

    const spawnW = MONOLITH_HALF_W + MARGIN;
    const spawnD = MONOLITH_HALF_D + MARGIN;

    // Deterministic seeding
    let seed = 12345;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const face = Math.floor(rand() * 4);
      let x: number, z: number;

      switch (face) {
        case 0:
          x = (rand() - 0.5) * 2 * spawnW;
          z = spawnD + rand() * 3;
          break;
        case 1:
          x = (rand() - 0.5) * 2 * spawnW;
          z = -(spawnD + rand() * 3);
          break;
        case 2:
          x = spawnW + rand() * 3;
          z = (rand() - 0.5) * 2 * spawnD;
          break;
        default:
          x = -(spawnW + rand() * 3);
          z = (rand() - 0.5) * 2 * spawnD;
          break;
      }

      const y = rand() * TOWER_HEIGHT - 2;

      tempObj.position.set(x, y, z);
      tempObj.scale.setScalar(PARTICLE_SIZE);
      tempObj.updateMatrix();
      mesh.setMatrixAt(i, tempObj.matrix);

      seeds[i] = rand();
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.geometry.setAttribute(
      "aSeed",
      new THREE.InstancedBufferAttribute(seeds, 1),
    );
  }, []);

  // Drive uTime from frame (deterministic for Remotion rendering)
  material.uniforms.uTime.value = frame / fps;

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
};
