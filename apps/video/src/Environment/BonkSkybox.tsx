import React, { useMemo } from "react";
import * as THREE from "three";

interface BonkSkyboxProps {
  frame: number;
  fps: number;
}

/**
 * BONK-themed night sky — warm oranges, golds, and ambers instead of cool purples.
 * Same procedural stars/wisps structure as NightSkybox but shifted to BONK palette.
 */
export const BonkSkybox: React.FC<BonkSkyboxProps> = ({ frame, fps }) => {
  const skyMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vWorldPosition;
        uniform float uTime;

        float hash3D(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        void main() {
          vec3 dir = normalize(vWorldPosition);

          float elevation = atan(dir.y, length(dir.xz));
          float lat = 0.5 - elevation / 3.14159265;
          float azimuth = atan(dir.x, dir.z);

          // BONK warm palette — oranges, ambers, deep reds
          vec3 zenithColor   = vec3(0.12, 0.04, 0.02);
          vec3 upperSky      = vec3(0.18, 0.06, 0.02);
          vec3 midSky        = vec3(0.22, 0.08, 0.03);
          vec3 lowerMidSky   = vec3(0.20, 0.10, 0.04);
          vec3 horizonGlow   = vec3(0.35, 0.15, 0.04);
          vec3 belowHorizon  = vec3(0.14, 0.08, 0.03);
          vec3 nadirColor    = vec3(0.08, 0.04, 0.02);

          vec3 skyColor;
          if (lat < 0.12) {
            skyColor = mix(zenithColor, upperSky, lat / 0.12);
          } else if (lat < 0.30) {
            skyColor = mix(upperSky, midSky, (lat - 0.12) / 0.18);
          } else if (lat < 0.38) {
            skyColor = mix(midSky, lowerMidSky, (lat - 0.30) / 0.08);
          } else if (lat < 0.48) {
            skyColor = mix(lowerMidSky, horizonGlow, (lat - 0.38) / 0.10);
          } else if (lat < 0.62) {
            skyColor = mix(horizonGlow, belowHorizon, (lat - 0.48) / 0.14);
          } else {
            skyColor = mix(belowHorizon, nadirColor, smoothstep(0.62, 0.95, lat));
          }

          // Warm wisps — fire/ember clouds instead of nebula
          if (lat < 0.55) {
            float wispFade = smoothstep(0.55, 0.30, lat);

            float w1 = sin(azimuth * 2.0 + lat * 8.0 + uTime * 0.08) *
                        sin(azimuth * 3.0 - lat * 5.0 - uTime * 0.05);
            w1 = smoothstep(0.2, 0.7, w1 * 0.5 + 0.5);
            vec3 wispColor1 = vec3(0.70, 0.30, 0.05);
            skyColor += wispColor1 * w1 * wispFade * 0.9;

            float w2 = sin(azimuth * 5.0 + lat * 12.0 - uTime * 0.06) *
                        sin(azimuth * 2.0 + lat * 4.0 + uTime * 0.04);
            w2 = smoothstep(0.4, 0.85, w2 * 0.5 + 0.5);
            vec3 wispColor2 = vec3(0.55, 0.20, 0.02);
            skyColor += wispColor2 * w2 * wispFade * 0.8;

            float w3 = sin(azimuth * 4.0 - lat * 6.0 + uTime * 0.03);
            w3 = smoothstep(0.5, 0.9, w3 * 0.5 + 0.5);
            float horizonWisp = smoothstep(0.05, 0.35, lat) * smoothstep(0.55, 0.35, lat);
            vec3 wispColor3 = vec3(0.80, 0.45, 0.08);
            skyColor += wispColor3 * w3 * horizonWisp * 0.7;

            float w4 = sin(azimuth * 4.0 + lat * 10.0 + uTime * 0.07) *
                        sin(azimuth * 2.0 - lat * 7.0 - uTime * 0.04);
            w4 = smoothstep(0.3, 0.8, w4 * 0.5 + 0.5);
            vec3 wispColor4 = vec3(0.90, 0.55, 0.10);
            skyColor += wispColor4 * w4 * wispFade * 0.65;

            float horizBand = smoothstep(0.55, 0.45, lat) * smoothstep(0.30, 0.40, lat);
            float w5 = sin(azimuth * 2.0 + lat * 15.0 + uTime * 0.06) *
                        sin(azimuth * 3.0 - lat * 8.0 - uTime * 0.03);
            w5 = smoothstep(0.2, 0.65, w5 * 0.5 + 0.5);
            vec3 wispColor5 = vec3(0.60, 0.25, 0.04);
            skyColor += wispColor5 * w5 * horizBand * 0.8;
          }

          // Stars — warm-tinted
          vec3 starContrib = vec3(0.0);
          if (lat < 0.48) {
            vec3 starPos1 = dir * 100.0;
            float sv1 = hash3D(floor(starPos1));
            if (sv1 > 0.994) {
              float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + sv1 * 100.0);
              float brightness = (sv1 - 0.994) * 166.0 * twinkle * 1.5;
              float fade = smoothstep(0.48, 0.15, lat);
              vec3 starColor = mix(vec3(1.0, 0.85, 0.6), vec3(1.0, 0.7, 0.4), sv1 * 3.0);
              starContrib = starColor * brightness * fade;
            }
            vec3 starPos2 = dir * 200.0;
            float sv2 = hash3D(floor(starPos2));
            if (sv2 > 0.993) {
              float brightness = (sv2 - 0.993) * 60.0;
              float fade = smoothstep(0.48, 0.10, lat);
              starContrib += vec3(0.9, 0.7, 0.5) * brightness * fade;
            }
          }

          vec3 color = skyColor + starContrib;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
  }, []);

  skyMaterial.uniforms.uTime.value = frame / fps;

  return (
    <mesh material={skyMaterial}>
      <sphereGeometry args={[800, 32, 32]} />
    </mesh>
  );
};
