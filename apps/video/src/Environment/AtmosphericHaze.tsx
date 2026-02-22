import React, { useMemo } from "react";
import * as THREE from "three";

/**
 * AtmosphericHaze — Warm volumetric-like glow around tower base.
 * Ported from TowerScene.tsx.
 */
export const AtmosphericHaze: React.FC = () => {
  const hazeMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
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

        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);

          vec3 hazeColor = vec3(0.35, 0.22, 0.08);
          float alpha = smoothstep(0.45, 0.0, dist) * 0.20;

          gl_FragColor = vec4(hazeColor, alpha);
        }
      `,
    });
  }, []);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -3.5, 0]}
      material={hazeMaterial}
    >
      <planeGeometry args={[160, 160]} />
    </mesh>
  );
};
