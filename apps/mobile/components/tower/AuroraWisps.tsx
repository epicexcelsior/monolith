import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber/native";
import * as THREE from "three";
import { DEFAULT_TOWER_CONFIG, getTowerHeight } from "@monolith/common";

/**
 * AuroraWisps — Ephemeral squiggly light streams that appear,
 * travel horizontally with a wavy tail, and dissolve.
 *
 * Each wisp is a wide plane with a head-to-tail gradient painted
 * in the fragment shader. The vertex shader bends the plane into
 * a squiggly S-curve using sin() offsets per vertex, creating
 * the "little stream of light" / tadpole look.
 *
 * PERFORMANCE:
 * - InstancedMesh: 1 draw call for all wisps
 * - Zero JS per frame except uTime bump
 * - PlaneGeometry with 8 width segments for bendable squiggle
 * - Additive blending + discard → no transparency sort
 */

const WISP_COUNT = 35;
const TOWER_HEIGHT = getTowerHeight(DEFAULT_TOWER_CONFIG.layerCount);

const wispVertexShader = /* glsl */ `
  precision highp float;

  uniform float uTime;

  attribute float aSeed;
  attribute float aRadius;

  varying float vAlpha;
  varying vec2 vUv;
  varying float vDistFactor;

  void main() {
    vUv = uv;

    float seed = aSeed;

    // ─── Lifecycle: appear → travel → dissolve ─────
    float cycleLen = 10.0 + seed * 10.0;  // 10-20s per wisp
    float phase = mod(uTime + seed * cycleLen, cycleLen) / cycleLen;

    // Quick fade in, long travel, gentle fade out
    float fadeIn  = smoothstep(0.0, 0.08, phase);
    float fadeOut = smoothstep(1.0, 0.75, phase);
    float life = fadeIn * fadeOut;

    // ─── Spawn position from instance matrix ───────
    vec4 origin = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);

    // Travel direction: horizontal tangent to tower
    vec3 radialDir = normalize(vec3(origin.x, 0.0, origin.z));
    vec3 tangentDir = vec3(-radialDir.z, 0.0, radialDir.x);

    // How far along its journey (0 at spawn, grows over lifecycle)
    float travelDist = phase * (4.0 + seed * 4.0);

    // Center of wisp moves along tangent
    vec3 center = origin.xyz + tangentDir * travelDist;

    // ─── Squiggle the shape itself ─────────────────
    // position.x goes -0.5..+0.5 across the width (8 segments)
    // Offset each vertex perpendicular to travel, creating S-curve
    float along = position.x + 0.5; // 0..1 head to tail
    float squiggleT = uTime * 1.5 + seed * 30.0 + along * 6.0;
    float squiggleY = sin(squiggleT) * 0.35;
    float squiggleR = cos(squiggleT * 0.7 + 1.5) * 0.2;

    // Build world position: center + travel offset + squiggle
    vec3 worldPos = center
      + tangentDir * position.x * 3.0          // stretch along travel direction
      + vec3(0.0, position.y * 0.5, 0.0)       // thin height
      + vec3(0.0, squiggleY, 0.0)              // vertical squiggle
      + radialDir * squiggleR;                  // radial squiggle

    vec4 mvPosition = viewMatrix * vec4(worldPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Alpha: lifecycle × base intensity
    vAlpha = life * (0.10 + 0.08 * sin(seed * 50.0));

    // Color distance factor
    vDistFactor = smoothstep(12.0, 28.0, aRadius);
  }
`;

const wispFragmentShader = /* glsl */ `
  precision mediump float;
  uniform highp float uTime;

  varying float vAlpha;
  varying vec2 vUv;
  varying float vDistFactor;

  void main() {
    // Head-to-tail gradient: bright head (left), fading tail (right)
    float along = vUv.x;  // 0 = one end, 1 = other end
    float headTail = smoothstep(0.0, 0.3, along) * smoothstep(1.0, 0.4, along);

    // Thin vertical falloff — wisp is a narrow stream
    float centerY = abs(vUv.y - 0.5) * 2.0;
    float thinness = smoothstep(1.0, 0.2, centerY);

    float alpha = headTail * thinness * vAlpha;

    if (alpha < 0.002) discard;

    // Color: warm gold near tower → cool teal further out
    vec3 warmColor = vec3(1.0, 0.85, 0.4);
    vec3 coolColor = vec3(0.3, 0.7, 0.9);
    vec3 color = mix(warmColor, coolColor, vDistFactor);

    // Slightly brighter at the head
    color *= 1.0 + (1.0 - along) * 0.3;

    gl_FragColor = vec4(color, alpha);
  }
`;

export default function AuroraWisps() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: wispVertexShader,
      fragmentShader: wispFragmentShader,
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

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const tempObj = new THREE.Object3D();
    const seeds = new Float32Array(WISP_COUNT);
    const radii = new Float32Array(WISP_COUNT);

    for (let i = 0; i < WISP_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const radius = 10 + Math.random() * 25; // 10..35
      const y = -2 + Math.random() * (TOWER_HEIGHT + 6);

      tempObj.position.set(
        Math.cos(theta) * radius,
        y,
        Math.sin(theta) * radius,
      );
      tempObj.scale.setScalar(1);
      tempObj.updateMatrix();
      mesh.setMatrixAt(i, tempObj.matrix);

      seeds[i] = Math.random();
      radii[i] = radius;
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.geometry.setAttribute(
      "aSeed",
      new THREE.InstancedBufferAttribute(seeds, 1),
    );
    mesh.geometry.setAttribute(
      "aRadius",
      new THREE.InstancedBufferAttribute(radii, 1),
    );
  }, []);

  useFrame((_state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += Math.min(delta, 0.1);
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, WISP_COUNT]}
      frustumCulled={false}
      material={material}
    >
      {/* 8 width segments so squiggle bends the mesh visibly */}
      <planeGeometry args={[1, 1, 8, 1]} />
    </instancedMesh>
  );
}
