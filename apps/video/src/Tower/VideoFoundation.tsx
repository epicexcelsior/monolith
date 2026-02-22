import React, { useMemo } from "react";
import * as THREE from "three";
import { MONOLITH_HALF_W } from "@monolith/common";

/**
 * Foundation — Concentric circular stepped pedestal beneath the tower.
 * Adapted from mobile Foundation.tsx for web R3F (no native imports).
 */

const TIERS = [
  { scale: 1.5, height: 1.0 },
  { scale: 2.4, height: 1.4 },
  { scale: 3.5, height: 1.8 },
  { scale: 4.8, height: 1.2 },
] as const;

const TOTAL_HEIGHT = TIERS.reduce((sum, t) => sum + t.height, 0);
const CYLINDER_SEGMENTS = 48;

const foundationVertexShader = /* glsl */ `
  precision highp float;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vHeightNorm;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    gl_Position = projectionMatrix * mvPosition;

    vWorldPos = worldPos.xyz;
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    vHeightNorm = clamp((0.0 - worldPos.y) / ${TOTAL_HEIGHT.toFixed(1)}, 0.0, 1.0);
  }
`;

const foundationFragmentShader = /* glsl */ `
  precision highp float;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vHeightNorm;

  float hash21(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
  }

  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    float NdotV = max(dot(N, V), 0.0);

    float radialDist = length(vWorldPos.xz);
    float ang = atan(vWorldPos.z, vWorldPos.x);

    vec2 rockUV = vWorldPos.xz * 0.18 + vWorldPos.y * 0.10;
    float rockNoise = noise2D(rockUV * 2.5) * 0.5
                    + noise2D(rockUV * 6.0) * 0.3
                    + noise2D(rockUV * 12.0) * 0.2;

    float ringFreq = 1.2;
    float rings = smoothstep(0.42, 0.50, abs(fract(radialDist * ringFreq) - 0.5));

    float angSegments = 16.0;
    float angJoint = smoothstep(0.46, 0.50, abs(fract(ang * angSegments / 6.2832) - 0.5));

    float courseY = smoothstep(0.44, 0.50, abs(fract(vWorldPos.y * 0.9) - 0.5));

    float joints = max(max(rings, angJoint * 0.6), courseY) * 0.45;

    vec3 stoneDark  = vec3(0.40, 0.32, 0.24);
    vec3 stoneMid   = vec3(0.58, 0.48, 0.36);
    vec3 stoneLight = vec3(0.72, 0.60, 0.44);
    vec3 jointColor = vec3(0.22, 0.16, 0.10);

    vec3 rockColor = mix(stoneDark, stoneMid, rockNoise);
    rockColor = mix(rockColor, stoneLight, smoothstep(0.5, 0.85, rockNoise) * 0.5);
    rockColor = mix(rockColor, jointColor, joints);

    float topFace = max(0.0, N.y);
    float proximity = 1.0 - vHeightNorm;

    vec3 towerWarm = vec3(0.85, 0.55, 0.20);
    rockColor += towerWarm * topFace * proximity * 1.5;

    float sideFace = 1.0 - abs(N.y);
    rockColor += vec3(0.50, 0.30, 0.12) * sideFace * proximity * 0.8;

    rockColor += vec3(0.45, 0.30, 0.12) * topFace * (0.4 + proximity * 0.7);

    float lipY0 = smoothstep(0.12, 0.0, abs(vWorldPos.y + 0.5));
    float lipY1 = smoothstep(0.12, 0.0, abs(vWorldPos.y + 1.5));
    float lipY2 = smoothstep(0.12, 0.0, abs(vWorldPos.y + 2.9));
    float lipY3 = smoothstep(0.12, 0.0, abs(vWorldPos.y + 4.7));
    float lipGlow = max(max(lipY0, lipY1), max(lipY2, lipY3));
    vec3 lipColor = vec3(0.80, 0.52, 0.16);
    rockColor += lipColor * lipGlow * 0.8 * (1.0 - abs(N.y) * 0.4);

    float ringHighlight = rings * topFace * 0.3;
    rockColor += vec3(0.30, 0.20, 0.08) * ringHighlight * proximity;

    vec3 lightDir = normalize(vec3(0.1, 1.0, 0.05));
    float NdotL = max(dot(N, lightDir), 0.0);
    float faceBrightness = 0.40 + 0.60 * NdotL;

    float depthDarken = mix(1.0, 0.70, smoothstep(0.3, 1.0, vHeightNorm));

    float fresnel = pow(1.0 - NdotV, 3.0);
    vec3 rimColor = vec3(0.30, 0.18, 0.06) * fresnel * proximity;

    vec3 color = rockColor * faceBrightness * depthDarken;
    color += rimColor;

    vec3 groundBounce = vec3(0.20, 0.12, 0.05) * max(0.0, -N.y) * 0.4;
    color += groundBounce;
    color += vec3(0.10, 0.07, 0.04) * (0.5 + 0.5 * NdotV);

    color = max(color, vec3(0.18, 0.14, 0.10));

    gl_FragColor = vec4(color, 1.0);
  }
`;

export const VideoFoundation: React.FC = () => {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: foundationVertexShader,
      fragmentShader: foundationFragmentShader,
      fog: false,
      toneMapped: false,
    });
  }, []);

  const tiers = useMemo(() => {
    const baseRadius = MONOLITH_HALF_W;
    const result: Array<{ geo: THREE.CylinderGeometry; y: number }> = [];

    let yTop = -0.5;
    for (const tier of TIERS) {
      const r = baseRadius * tier.scale;
      const h = tier.height;
      const geo = new THREE.CylinderGeometry(r, r, h, CYLINDER_SEGMENTS);
      const y = yTop - h / 2;
      result.push({ geo, y });
      yTop -= h;
    }

    return result;
  }, []);

  return (
    <group>
      {tiers.map((tier, i) => (
        <mesh
          key={i}
          geometry={tier.geo}
          material={material}
          position={[0, tier.y, 0]}
        />
      ))}
    </group>
  );
};
