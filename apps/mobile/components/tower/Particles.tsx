import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber/native";
import * as THREE from "three";
import { BASE_RADIUS, LAYER_HEIGHT } from "@monolith/common";

const PARTICLE_COUNT = 150;
const PARTICLE_SIZE = 0.15;
const TOWER_HEIGHT = 10 * LAYER_HEIGHT; // 10 layers
const SPAWN_RADIUS = BASE_RADIUS + 5;
const DRIFT_SPEED = 0.4;

const particleVertexShader = /* glsl */ `
  precision highp float;

  uniform float uTime;

  // Per-instance seed for variation
  attribute float aSeed;

  varying float vAlpha;

  void main() {
    // Apply instance transform (position from JS)
    vec4 worldPos = instanceMatrix * vec4(position, 1.0);

    // Animate: slow upward drift + sine-wave sway
    float t = uTime * ${DRIFT_SPEED.toFixed(1)} + aSeed * 100.0;
    float yOffset = mod(t, ${(TOWER_HEIGHT + 10).toFixed(1)});
    worldPos.y += yOffset - 5.0; // Start below tower base
    worldPos.x += sin(t * 0.7 + aSeed * 50.0) * 1.5;
    worldPos.z += cos(t * 0.5 + aSeed * 30.0) * 1.5;

    vec4 mvPosition = modelViewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;

    // Fade based on height (fade in at bottom, fade out at top)
    float normalizedY = (worldPos.y + 5.0) / ${(TOWER_HEIGHT + 10).toFixed(1)};
    vAlpha = smoothstep(0.0, 0.1, normalizedY) * smoothstep(1.0, 0.8, normalizedY);
    vAlpha *= 0.4 + 0.3 * sin(uTime * 2.0 + aSeed * 20.0);
  }
`;

const particleFragmentShader = /* glsl */ `
  precision highp float;

  varying float vAlpha;

  void main() {
    vec3 color = vec3(0.0, 0.8, 1.0); // Cyan-ish
    gl_FragColor = vec4(color, vAlpha);
  }
`;

/**
 * Particles — ~150 floating particles around the tower.
 * Uses a second InstancedMesh with additive blending.
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

  // Position particles in a cylinder
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const tempObj = new THREE.Object3D();
    const seeds = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = (Math.random() * 0.6 + 0.4) * SPAWN_RADIUS;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
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

  useFrame((_state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
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
