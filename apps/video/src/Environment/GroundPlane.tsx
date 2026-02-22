import React, { useMemo } from "react";
import * as THREE from "three";

/**
 * GroundPlane — Polished stone ground with concentric rings + warm light pool.
 * Ported from TowerScene.tsx GroundPlane component.
 */
export const GroundPlane: React.FC = () => {
  const FOUNDATION_BOTTOM = -5.9;

  const groundMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;

        float hash21(vec2 p) {
          p = fract(p * vec2(233.34, 851.73));
          p += dot(p, p + 23.45);
          return fract(p.x * p.y);
        }

        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          float ang = atan(center.y, center.x);

          vec2 noiseUV = vUv * 8.0;
          float noise = hash21(floor(noiseUV)) * 0.08;
          vec3 stoneColor = vec3(0.14, 0.11, 0.08) + noise;

          float ringFreq = dist * 35.0;
          float ring = smoothstep(0.40, 0.50, abs(fract(ringFreq) - 0.5));
          stoneColor = mix(stoneColor, vec3(0.10, 0.08, 0.06), ring * 0.5);

          float spokes = 24.0;
          float spoke = smoothstep(0.47, 0.50, abs(fract(ang * spokes / 6.2832) - 0.5));
          stoneColor = mix(stoneColor, vec3(0.10, 0.08, 0.06), spoke * 0.3 * step(dist, 0.25));

          float warmth = smoothstep(0.30, 0.0, dist);
          stoneColor += vec3(0.45, 0.28, 0.10) * warmth * warmth;

          float midWarmth = smoothstep(0.40, 0.08, dist);
          stoneColor += vec3(0.18, 0.10, 0.04) * midWarmth;

          stoneColor += vec3(0.04, 0.03, 0.02) * smoothstep(0.45, 0.25, dist);

          float foundationRing = smoothstep(0.02, 0.0, abs(dist - 0.10));
          stoneColor += vec3(0.40, 0.25, 0.08) * foundationRing * 0.6;

          float edgeFade = smoothstep(0.50, 0.38, dist);

          gl_FragColor = vec4(stoneColor, edgeFade);
        }
      `,
      transparent: true,
      depthWrite: true,
    });
  }, []);

  const lightPoolMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;

        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);

          vec3 warmColor = vec3(0.50, 0.30, 0.10);
          float alpha = smoothstep(0.25, 0.0, dist) * 0.35;

          gl_FragColor = vec4(warmColor, alpha);
        }
      `,
    });
  }, []);

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, FOUNDATION_BOTTOM - 0.05, 0]}
        material={groundMaterial}
      >
        <circleGeometry args={[100, 64]} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, FOUNDATION_BOTTOM, 0]}
        material={lightPoolMaterial}
      >
        <circleGeometry args={[60, 48]} />
      </mesh>
    </group>
  );
};
