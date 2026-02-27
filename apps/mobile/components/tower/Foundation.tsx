import React, { useMemo } from "react";
import * as THREE from "three";
import { MONOLITH_HALF_W } from "@monolith/common";
import { getMarbleTextures } from "@/utils/marble-textures";

/**
 * Foundation — Classical marble pedestal descending into an abyss.
 *
 * 3 visible tiers (cornice → main → base course) + deep abyss column.
 * Real marble textures with normal mapping. Decorative molding lines,
 * specular edge bevels, and classical architectural detailing.
 *
 * PERFORMANCE:
 * - 4 meshes sharing 1 material = 4 draw calls
 * - CylinderGeometry with 48 radial segments
 * - 2 texture samples (baseColor + normal) per fragment
 * - depthWrite true for correct occlusion
 */

// ─── Tier definitions ────────────────────────────────────
const TIERS = [
  { scale: 1.6, height: 0.6 },   // Cornice — decorative lip
  { scale: 2.8, height: 1.2 },   // Main platform — broad slab
  { scale: 3.8, height: 0.8 },   // Base course — widest visible step
  { scale: 3.8, height: 37.0 },  // Abyss column — matches base course width
] as const;

const CYLINDER_SEGMENTS = 48;

// Y positions of each tier's top edge (for molding placement)
// Tiers stack downward from y = -0.5
const CORNICE_TOP = -0.5;
const CORNICE_BOT = CORNICE_TOP - 0.6;
const MAIN_TOP = CORNICE_BOT;
const MAIN_BOT = MAIN_TOP - 1.2;
const BASE_TOP = MAIN_BOT;
const BASE_BOT = BASE_TOP - 0.8;

const foundationVertexShader = /* glsl */ `
  precision highp float;

  varying vec3 vWorldPos;
  varying vec3 vLocalPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    gl_Position = projectionMatrix * mvPosition;

    vWorldPos = worldPos.xyz;
    vLocalPos = position;
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
  }
`;

const foundationFragmentShader = /* glsl */ `
  precision mediump float;

  uniform sampler2D uBaseColor;
  uniform sampler2D uNormal;

  varying vec3 vWorldPos;
  varying vec3 vLocalPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  // Tier edge Y positions
  const float CORNICE_TOP = ${CORNICE_TOP.toFixed(1)};
  const float CORNICE_BOT = ${CORNICE_BOT.toFixed(1)};
  const float MAIN_TOP    = ${MAIN_TOP.toFixed(1)};
  const float MAIN_BOT    = ${MAIN_BOT.toFixed(1)};
  const float BASE_TOP    = ${BASE_TOP.toFixed(1)};
  const float BASE_BOT    = ${BASE_BOT.toFixed(1)};

  // Sharp molding line — thin bright/dark band at a Y position
  float moldingLine(float y, float center, float width) {
    return smoothstep(width, 0.0, abs(y - center));
  }

  void main() {
    float y = vWorldPos.y;
    vec3 rawN = normalize(vNormal);
    float isSide = 1.0 - abs(rawN.y);  // 1 on sides, 0 on top/bottom
    float isTop = max(rawN.y, 0.0);    // 1 on top faces

    // ─── Per-pixel triplanar UV mapping ────────────
    // Planar projection on all faces — no cylindrical wrapping,
    // no atan seam, no radial lines on tops. Large scale so
    // marble veins are clearly visible even from overview camera.
    float texScale = 0.08;
    vec2 uvXZ = vWorldPos.xz * texScale;       // top/bottom faces
    vec2 uvXY = vWorldPos.xy * texScale;       // front/back sides
    vec2 uvYZ = vWorldPos.yz * texScale;       // left/right sides

    // Blend weights from normal direction (triplanar)
    vec3 blendW = abs(rawN);
    blendW = blendW / (blendW.x + blendW.y + blendW.z + 0.001);

    vec2 marbleUV = uvYZ * blendW.x + uvXZ * blendW.y + uvXY * blendW.z;

    // Per-pixel tangent frame for normal mapping (triplanar-aligned)
    // Choose tangent based on dominant axis to match UV projection
    vec3 T;
    if (blendW.y > blendW.x && blendW.y > blendW.z) {
      T = vec3(1.0, 0.0, 0.0); // top/bottom: tangent along X
    } else if (blendW.x > blendW.z) {
      T = vec3(0.0, 0.0, 1.0); // left/right: tangent along Z
    } else {
      T = vec3(1.0, 0.0, 0.0); // front/back: tangent along X
    }
    vec3 tangent = normalize(T - rawN * dot(rawN, T));
    vec3 bitangent = cross(rawN, tangent);

    // ─── Marble texture ────────────────────────────
    vec3 marbleColor = texture2D(uBaseColor, marbleUV).rgb;
    vec3 normalMap = texture2D(uNormal, marbleUV).rgb * 2.0 - 1.0;

    // Brighten and cool-shift the white marble
    marbleColor = pow(marbleColor, vec3(0.82));
    marbleColor *= vec3(1.06, 1.04, 1.10);

    // Perturb normal with tangent-space normal map
    vec3 N = normalize(
      rawN + normalMap.x * tangent * 0.5 + normalMap.y * bitangent * 0.5
    );
    vec3 V = normalize(vViewDir);
    float NdotV = max(dot(N, V), 0.0);

    // ─── Lighting ──────────────────────────────────
    vec3 warmLightDir = normalize(vec3(0.1, 1.0, 0.05));
    float NdotL_warm = max(dot(N, warmLightDir), 0.0);
    vec3 warmLight = vec3(1.0, 0.88, 0.65) * NdotL_warm * 0.85;

    vec3 coolLightDir = normalize(vec3(-0.5, 0.3, 0.8));
    float NdotL_cool = max(dot(N, coolLightDir), 0.0);
    vec3 coolLight = vec3(0.4, 0.45, 0.6) * NdotL_cool * 0.30;

    // Specular — polished marble
    vec3 halfVec = normalize(warmLightDir + V);
    float spec = pow(max(dot(N, halfVec), 0.0), 28.0);
    vec3 specular = vec3(1.0, 0.95, 0.88) * spec * 0.30;

    // Rim light
    float fresnel = pow(1.0 - NdotV, 3.0);
    vec3 rimLight = vec3(0.22, 0.18, 0.35) * fresnel * 0.45;

    vec3 ambient = vec3(0.24, 0.22, 0.27);

    vec3 color = marbleColor * (ambient + warmLight + coolLight) + specular + rimLight;

    // ─── Classical Molding Details (side faces) ────
    // These create the decorative horizontal bands that make
    // Greek/Roman pedestals look majestic

    // === CORNICE: ornate top edge ===
    // Double fillet at cornice top (bright highlight line)
    float topFillet = moldingLine(y, CORNICE_TOP + 0.02, 0.03);
    color += vec3(0.40, 0.35, 0.25) * topFillet * isSide * 0.6;

    // Cavetto (concave groove) below cornice top
    float cavetto = moldingLine(y, CORNICE_TOP - 0.08, 0.06);
    color *= 1.0 - cavetto * isSide * 0.18;

    // Astragal bead at cornice bottom
    float astragal = moldingLine(y, CORNICE_BOT + 0.04, 0.025);
    color += vec3(0.35, 0.30, 0.22) * astragal * isSide * 0.5;

    // === MAIN PLATFORM: clean with subtle relief ===
    // Fascia line — thin bright line near top
    float fascia = moldingLine(y, MAIN_TOP - 0.06, 0.02);
    color += vec3(0.30, 0.27, 0.22) * fascia * isSide * 0.4;

    // Scotia (concave dark groove) at center
    float scotia = moldingLine(y, (MAIN_TOP + MAIN_BOT) * 0.5, 0.04);
    color *= 1.0 - scotia * isSide * 0.12;

    // Torus (convex bright roll) near bottom
    float torus = moldingLine(y, MAIN_BOT + 0.08, 0.03);
    color += vec3(0.28, 0.25, 0.20) * torus * isSide * 0.45;

    // === BASE COURSE: wide with bold edges ===
    // Bright lip at base top
    float baseLip = moldingLine(y, BASE_TOP + 0.02, 0.025);
    color += vec3(0.32, 0.28, 0.20) * baseLip * isSide * 0.5;

    // Plinth groove near bottom
    float plinth = moldingLine(y, BASE_BOT + 0.06, 0.035);
    color *= 1.0 - plinth * isSide * 0.15;

    // ─── Step edge highlights (top face glow) ──────
    // Each tier's top face gets a bright warm edge where it overhangs
    float edgeCornice = smoothstep(0.15, 0.0, abs(y - CORNICE_TOP)) * isTop;
    float edgeMain    = smoothstep(0.15, 0.0, abs(y - MAIN_TOP)) * isTop;
    float edgeBase    = smoothstep(0.15, 0.0, abs(y - BASE_TOP)) * isTop;
    float edgeGlow = max(max(edgeCornice, edgeMain), edgeBase);
    color += vec3(0.45, 0.38, 0.25) * edgeGlow * 0.35;

    // ─── Specular catch on step overhangs (side face near top of each tier)
    float overhangCornice = smoothstep(0.2, 0.0, y - CORNICE_TOP) * smoothstep(-0.2, 0.0, y - CORNICE_TOP);
    float overhangMain    = smoothstep(0.2, 0.0, y - MAIN_TOP) * smoothstep(-0.2, 0.0, y - MAIN_TOP);
    float overhangBase    = smoothstep(0.2, 0.0, y - BASE_TOP) * smoothstep(-0.2, 0.0, y - BASE_TOP);
    float overhang = max(max(overhangCornice, overhangMain), overhangBase);
    color += vec3(0.25, 0.22, 0.18) * overhang * isSide * spec * 2.0;

    // ─── Abyss fog ─────────────────────────────────
    float fogFactor = smoothstep(-3.0, -20.0, y);
    vec3 abyssColor = vec3(0.02, 0.015, 0.03);
    color = mix(color, abyssColor, fogFactor);

    // Minimum brightness for visible tiers
    float upperTier = smoothstep(-4.0, -0.5, y);
    color = max(color, vec3(0.12, 0.11, 0.14) * upperTier);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function Foundation() {
  const marbleTex = useMemo(() => getMarbleTextures(), []);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: foundationVertexShader,
      fragmentShader: foundationFragmentShader,
      uniforms: {
        uBaseColor: { value: marbleTex.baseColor },
        uNormal: { value: marbleTex.normal },
      },
      fog: false,
      toneMapped: false,
    });
  }, [marbleTex]);

  const tiers = useMemo(() => {
    const baseRadius = MONOLITH_HALF_W;
    const result: Array<{ geo: THREE.CylinderGeometry; y: number }> = [];

    let yTop = -0.5; // Start just below tower base
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
}
