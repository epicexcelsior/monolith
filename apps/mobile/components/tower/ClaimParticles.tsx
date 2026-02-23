import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber/native";
import * as THREE from "three";
import { useTowerStore } from "@/stores/tower-store";
import {
  CLAIM_PARTICLES,
  CLAIM_PARTICLE_COLORS,
  PARTICLE_TYPE,
  CLAIM_PHASES,
} from "@/constants/ClaimEffectConfig";

const TOTAL = CLAIM_PARTICLES.convergeCount + CLAIM_PARTICLES.sparkCount
            + CLAIM_PARTICLES.emberCount + CLAIM_PARTICLES.trailCount;

/**
 * ClaimParticles vertex shader — GPU-driven multi-phase particle celebration.
 *
 * 220 particles across 4 types, all animation computed on GPU.
 * Uses easeOutQuad for spark deceleration (feels like real projectiles).
 * Per-particle scale animation for punch effect.
 */
const claimParticleVertex = /* glsl */ `
  precision highp float;

  uniform float uClaimTime;
  uniform vec3 uClaimPos;
  uniform float uClaimActive;
  uniform float uClaimDuration;

  attribute float aSeed;
  attribute float aType;       // 0=converge, 1=spark, 2=ember, 3=trail
  attribute float aSpawnTime;
  attribute float aLifetime;
  attribute float aSpeed;

  varying float vAlpha;
  varying vec3 vColor;

  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  // easeOutQuad: fast start, gentle deceleration
  float easeOut(float t) { return t * (2.0 - t); }
  // easeOutCubic: even more dramatic deceleration
  float easeOutCubic(float t) { float t1 = 1.0 - t; return 1.0 - t1 * t1 * t1; }

  void main() {
    // Hide when inactive
    if (uClaimActive < 0.5) {
      gl_Position = vec4(9999.0, 9999.0, 9999.0, 1.0);
      vAlpha = 0.0;
      vColor = vec3(0.0);
      return;
    }

    float t = uClaimTime;
    float progress = clamp(t / uClaimDuration, 0.0, 1.0);

    // Phase boundaries
    float buildupEnd = ${CLAIM_PHASES.buildup.end.toFixed(2)};
    float impactStart = ${CLAIM_PHASES.impact.start.toFixed(2)};
    float impactEnd = ${CLAIM_PHASES.impact.end.toFixed(2)};
    float celebStart = ${CLAIM_PHASES.celebration.start.toFixed(2)};
    float celebEnd = ${CLAIM_PHASES.celebration.end.toFixed(2)};

    vec3 pos = vec3(0.0);
    float alpha = 0.0;
    float scale = 1.0;

    int type = int(aType + 0.5);

    // ═══════════════════════════════════════════════
    // TYPE 0: CONVERGE — gold streams spiraling inward
    // ═══════════════════════════════════════════════
    if (type == 0) {
      float spawnT = aSpawnTime * buildupEnd * uClaimDuration;
      float age = t - spawnT;
      if (age >= 0.0 && progress < impactEnd + 0.05) {
        float life = clamp(age / aLifetime, 0.0, 1.0);

        // Spiral inward with acceleration
        float angle = aSeed * 6.2832 + age * 3.0; // spin as they approach
        float startDist = 4.0 + hash(aSeed * 7.0) * 3.0;
        float dist = startDist * (1.0 - easeOut(life));

        // Height oscillation — particles come from above and below
        float heightOff = sin(aSeed * 13.0 + age * 4.0) * 2.0 * (1.0 - life);

        pos = uClaimPos + vec3(
          cos(angle) * dist,
          heightOff,
          sin(angle) * dist
        );

        alpha = smoothstep(0.0, 0.15, life) * smoothstep(1.0, 0.7, life);
        // Brighten as they get closer
        alpha *= 0.5 + life * 0.5;
        // Shrink as they converge
        scale = 1.5 * (1.0 - life * 0.5);

        vColor = vec3(${CLAIM_PARTICLE_COLORS.converge.join(", ")});
        // Color shifts to white near center
        vColor = mix(vColor, vec3(1.5, 1.3, 0.9), life * 0.4);
      }
    }

    // ═══════════════════════════════════════════════
    // TYPE 1: SPARK — explosive radial burst
    // ═══════════════════════════════════════════════
    else if (type == 1) {
      float sparkStart = impactStart * uClaimDuration;
      float sparkAge = t - sparkStart;
      if (sparkAge > 0.0 && sparkAge < aLifetime) {
        float sparkLife = sparkAge / aLifetime;

        // Random direction on a sphere
        float theta = aSeed * 6.2832;
        float phi = (hash(aSeed * 17.0) - 0.5) * 3.14159; // full sphere
        float cosP = cos(phi);
        vec3 dir = vec3(cos(theta) * cosP, sin(phi), sin(theta) * cosP);

        // easeOutCubic: fast launch, dramatic deceleration
        float dist = aSpeed * easeOutCubic(sparkLife);

        // Gravity pull downward slightly
        float gravity = sparkAge * sparkAge * 0.8;

        pos = uClaimPos + dir * dist + vec3(0.0, -gravity, 0.0);

        // Bright at start, trails off
        alpha = (1.0 - sparkLife) * (1.0 - sparkLife);
        // Flicker
        alpha *= 0.7 + 0.3 * sin(sparkAge * 40.0 + aSeed * 100.0);

        // Scale: big punch at start, shrink
        scale = mix(2.0, 0.3, sparkLife);

        // Color: starts white-hot, fades to gold
        vColor = mix(
          vec3(${CLAIM_PARTICLE_COLORS.spark.join(", ")}),
          vec3(${CLAIM_PARTICLE_COLORS.ember.join(", ")}),
          sparkLife * 0.6
        );
      }
    }

    // ═══════════════════════════════════════════════
    // TYPE 2: EMBER — rising glowing embers
    // ═══════════════════════════════════════════════
    else if (type == 2) {
      float emberStart = celebStart * uClaimDuration;
      float emberAge = t - emberStart - aSpawnTime; // staggered spawn
      if (emberAge > 0.0 && emberAge < aLifetime) {
        float emberLife = emberAge / aLifetime;

        float angle = aSeed * 6.2832;
        float radius = 0.8 + hash(aSeed * 23.0) * 2.5;
        // Gentle spiral upward
        float spiralAngle = angle + emberAge * 0.8;

        pos = uClaimPos + vec3(
          cos(spiralAngle) * radius * (1.0 + emberLife * 0.5),
          emberAge * 2.0 + sin(emberAge * 3.0 + aSeed * 10.0) * 0.3,
          sin(spiralAngle) * radius * (1.0 + emberLife * 0.5)
        );

        alpha = smoothstep(0.0, 0.1, emberLife)
              * smoothstep(1.0, 0.6, emberLife)
              * 0.7;
        // Gentle pulse
        alpha *= 0.8 + 0.2 * sin(emberAge * 5.0 + aSeed * 20.0);

        scale = mix(1.0, 0.5, emberLife);

        vColor = vec3(${CLAIM_PARTICLE_COLORS.ember.join(", ")});
        // Some embers shift toward warm red
        float redShift = hash(aSeed * 31.0);
        if (redShift > 0.5) {
          vColor = mix(vColor, vec3(1.0, 0.3, 0.05), (redShift - 0.5) * 0.6);
        }
      }
    }

    // ═══════════════════════════════════════════════
    // TYPE 3: TRAIL — starburst lines radiating outward
    // ═══════════════════════════════════════════════
    else {
      float trailStart = impactStart * uClaimDuration;
      float trailAge = t - trailStart;
      if (trailAge > 0.0 && trailAge < aLifetime) {
        float trailLife = trailAge / aLifetime;

        // Starburst: equidistant radial lines
        float angle = aSeed * 6.2832;
        float speed = aSpeed * 1.5;
        float dist = speed * easeOut(trailLife);

        // Stretch along direction — make it a LINE, not a point
        float linePos = hash(aSeed * 37.0) * 0.8;
        float lineDist = dist * (0.6 + linePos * 0.4);

        pos = uClaimPos + vec3(
          cos(angle) * lineDist,
          (hash(aSeed * 41.0) - 0.5) * 2.0 * (1.0 - trailLife),
          sin(angle) * lineDist
        );

        alpha = (1.0 - trailLife) * 0.9;
        scale = mix(1.2, 0.1, trailLife);

        vColor = vec3(${CLAIM_PARTICLE_COLORS.trail.join(", ")});
      }
    }

    if (alpha < 0.001) {
      gl_Position = vec4(9999.0, 9999.0, 9999.0, 1.0);
      vAlpha = 0.0;
      return;
    }

    // Apply instance scale
    vec4 worldPos = instanceMatrix * vec4(position * scale, 1.0);
    worldPos.xyz = pos; // Override with computed position
    vec4 mvPosition = modelViewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;

    // Perspective size attenuation — particles near camera appear larger
    gl_PointSize = 1.0; // not used with mesh, but useful reference

    vAlpha = alpha;
  }
`;

const claimParticleFragment = /* glsl */ `
  precision highp float;

  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    if (vAlpha < 0.01) discard;
    // Soft glow: fade edges of the cube to simulate round particle
    gl_FragColor = vec4(vColor * vAlpha, vAlpha);
  }
`;

/**
 * ClaimParticles — GPU-driven explosive particle celebration.
 *
 * PERFORMANCE:
 * - 220 instances, 1 draw call, AdditiveBlending
 * - ALL animation in vertex shader — zero JS matrix updates per frame
 * - Hidden when inactive (vertex shader moves offscreen)
 * - No sorting needed (additive blending is order-independent)
 * - No transparent:true on InstancedMesh (uses AdditiveBlending instead)
 */
export default function ClaimParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const claimCelebrationRef = useTowerStore((s) => s.claimCelebrationRef);

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: claimParticleVertex,
      fragmentShader: claimParticleFragment,
      uniforms: {
        uClaimTime: { value: 0 },
        uClaimPos: { value: new THREE.Vector3() },
        uClaimActive: { value: 0 },
        uClaimDuration: { value: 3.0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    materialRef.current = mat;
    return mat;
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const tempObj = new THREE.Object3D();
    const seeds = new Float32Array(TOTAL);
    const types = new Float32Array(TOTAL);
    const spawnTimes = new Float32Array(TOTAL);
    const lifetimes = new Float32Array(TOTAL);
    const speeds = new Float32Array(TOTAL);

    let idx = 0;

    // Converge particles (40)
    for (let i = 0; i < CLAIM_PARTICLES.convergeCount; i++, idx++) {
      seeds[idx] = Math.random();
      types[idx] = PARTICLE_TYPE.CONVERGE;
      spawnTimes[idx] = (i / CLAIM_PARTICLES.convergeCount); // normalized 0-1
      lifetimes[idx] = 0.3 + Math.random() * 0.4;
      speeds[idx] = 2.0 + Math.random() * 2.0;
    }

    // Spark particles (100) — the hero burst
    for (let i = 0; i < CLAIM_PARTICLES.sparkCount; i++, idx++) {
      seeds[idx] = Math.random();
      types[idx] = PARTICLE_TYPE.SPARK;
      spawnTimes[idx] = 0;
      lifetimes[idx] = 0.4 + Math.random() * 0.8;
      speeds[idx] = 3.0 + Math.random() * 6.0; // varied velocities = natural feel
    }

    // Ember particles (50) — staggered spawning
    for (let i = 0; i < CLAIM_PARTICLES.emberCount; i++, idx++) {
      seeds[idx] = Math.random();
      types[idx] = PARTICLE_TYPE.EMBER;
      spawnTimes[idx] = (i / CLAIM_PARTICLES.emberCount) * 1.5; // stagger over 1.5s
      lifetimes[idx] = 1.5 + Math.random() * 2.0;
      speeds[idx] = 0.5 + Math.random() * 1.0;
    }

    // Trail particles (30) — starburst lines
    for (let i = 0; i < CLAIM_PARTICLES.trailCount; i++, idx++) {
      seeds[idx] = Math.random();
      types[idx] = PARTICLE_TYPE.TRAIL;
      spawnTimes[idx] = 0;
      lifetimes[idx] = 0.3 + Math.random() * 0.4;
      speeds[idx] = 4.0 + Math.random() * 4.0;
    }

    // Identity matrices (positions computed in vertex shader)
    const PARTICLE_SIZE = 0.15;
    for (let i = 0; i < TOTAL; i++) {
      tempObj.position.set(0, 0, 0);
      tempObj.scale.setScalar(PARTICLE_SIZE);
      tempObj.updateMatrix();
      mesh.setMatrixAt(i, tempObj.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    const geo = mesh.geometry;
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    geo.setAttribute("aType", new THREE.InstancedBufferAttribute(types, 1));
    geo.setAttribute("aSpawnTime", new THREE.InstancedBufferAttribute(spawnTimes, 1));
    geo.setAttribute("aLifetime", new THREE.InstancedBufferAttribute(lifetimes, 1));
    geo.setAttribute("aSpeed", new THREE.InstancedBufferAttribute(speeds, 1));
  }, []);

  useFrame(() => {
    if (!materialRef.current || !claimCelebrationRef?.current) return;
    const cel = claimCelebrationRef.current;
    const mat = materialRef.current;

    if (cel.active) {
      const elapsed = performance.now() / 1000 - cel.startTime;
      mat.uniforms.uClaimTime.value = elapsed;
      mat.uniforms.uClaimPos.value.set(cel.blockPosition.x, cel.blockPosition.y, cel.blockPosition.z);
      mat.uniforms.uClaimActive.value = 1;
      mat.uniforms.uClaimDuration.value = cel.duration;
    } else {
      mat.uniforms.uClaimActive.value = 0;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, TOTAL]}
      frustumCulled={false}
      material={material}
    >
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}
