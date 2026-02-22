import * as THREE from "three";
import { DEFAULT_TOWER_CONFIG, getTowerHeight, SPIRE_START_LAYER } from "@monolith/common";

/**
 * Video-adapted block shader — ported from apps/mobile/components/tower/BlockShader.ts.
 * Identical GLSL, but uTime is set externally via frame/fps (no useFrame).
 */

const vertexShader = /* glsl */ `
  precision highp float;

  // Per-instance attributes
  attribute float aEnergy;
  attribute vec3 aOwnerColor;
  attribute float aLayerNorm;
  attribute float aStyle;
  attribute float aTextureId;
  attribute float aFade;
  attribute float aHighlight;
  attribute float aImageIndex;

  // Passed to fragment
  varying float vEnergy;
  varying vec3 vOwnerColor;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vDist;
  varying float vInstanceOffset;
  varying float vLayerNorm;
  varying float vWorldY;
  varying vec3 vWorldPos;
  varying float vStyle;
  varying float vTextureId;
  varying float vFade;
  varying float vHighlight;
  varying float vImageIndex;
  varying vec3 vWorldNormal;
  varying vec2 vFaceUV;
  varying vec3 vLocalPos;
  varying vec3 vBlockCenter;

  void main() {
    vec3 localPos = position * (1.0 + aHighlight * 0.08);
    vec4 worldPos = instanceMatrix * vec4(localPos, 1.0);

    // Pop-out: push highlighted block radially away from tower center
    vec3 radialDir = vec3(worldPos.x, 0.0, worldPos.z);
    float radialLen = length(radialDir);
    if (radialLen > 0.01) {
      radialDir /= radialLen;
    } else {
      radialDir = vec3(0.0, 0.0, 1.0);
    }
    worldPos.xyz += radialDir * aHighlight * 0.6;
    worldPos.y += aHighlight * 0.12;

    vec4 mvPosition = modelViewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;

    vEnergy = aEnergy;
    vOwnerColor = aOwnerColor;
    vLayerNorm = aLayerNorm;
    vWorldY = worldPos.y;
    vWorldPos = worldPos.xyz;
    vStyle = aStyle;
    vTextureId = aTextureId;
    vFade = aFade;
    vHighlight = aHighlight;
    vImageIndex = aImageIndex;
    vLocalPos = position;
    vBlockCenter = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);

    mat3 instRot = mat3(instanceMatrix);
    vNormal = normalize(normalMatrix * instRot * normal);
    vWorldNormal = normalize(instRot * normal);

    vec3 aN = abs(normal);
    if (aN.x > aN.y && aN.x > aN.z) {
      vFaceUV = vec2(position.z * sign(normal.x), position.y) * 1.25 + 0.5;
    } else if (aN.z > aN.y) {
      vFaceUV = vec2(position.x * sign(normal.z), position.y) * 1.25 + 0.5;
    } else {
      vFaceUV = position.xz * 1.25 + 0.5;
    }

    vViewDir = normalize(-mvPosition.xyz);
    vDist = length(mvPosition.xyz);
    vInstanceOffset = worldPos.x * 0.3 + worldPos.y * 0.7 + worldPos.z * 0.5;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uSpireThreshold;
  uniform float uTowerHeight;
  uniform sampler2D uImageAtlas;
  uniform float uAtlasCols;
  uniform float uAtlasRows;
  uniform vec3 uCameraPos;

  varying float vEnergy;
  varying vec3 vOwnerColor;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vDist;
  varying float vInstanceOffset;
  varying float vLayerNorm;
  varying float vWorldY;
  varying vec3 vWorldPos;
  varying float vStyle;
  varying float vTextureId;
  varying float vFade;
  varying float vHighlight;
  varying float vImageIndex;
  varying vec3 vWorldNormal;
  varying vec2 vFaceUV;
  varying vec3 vLocalPos;
  varying vec3 vBlockCenter;

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

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  vec3 energyGlowColor(float e) {
    vec3 dead     = vec3(0.06, 0.06, 0.09);
    vec3 dying    = vec3(0.50, 0.14, 0.08);
    vec3 fading   = vec3(0.72, 0.38, 0.20);
    vec3 thriving = vec3(1.05, 0.72, 0.22);
    vec3 blazing  = vec3(1.5, 1.25, 0.65);

    vec3 col = dead;
    col = mix(col, dying,    smoothstep(0.0,  0.05, e));
    col = mix(col, fading,   smoothstep(0.05, 0.2,  e));
    col = mix(col, thriving, smoothstep(0.2,  0.5,  e));
    col = mix(col, blazing,  smoothstep(0.5,  0.8,  e));
    return col;
  }

  float getTexturePattern(float texId, vec3 wp) {
    int tid = int(texId + 0.5);

    if (tid == 1) {
      vec2 bUV = wp.xz * 3.0;
      float row = floor(bUV.y);
      bUV.x += mod(row, 2.0) * 0.5;
      vec2 brick = fract(bUV);
      float mortar = step(0.06, brick.x) * step(0.06, brick.y);
      return mix(0.6, 1.0, mortar);
    }

    if (tid == 2) {
      vec2 cUV = wp.xz * 4.0;
      float lineX = smoothstep(0.45, 0.48, abs(fract(cUV.x) - 0.5));
      float lineY = smoothstep(0.45, 0.48, abs(fract(cUV.y * 0.7) - 0.5));
      float traces = max(lineX, lineY);
      float dots = smoothstep(0.15, 0.1, length(fract(cUV) - 0.5));
      return mix(0.85, 1.0, max(traces, dots * 0.5));
    }

    if (tid == 3) {
      vec2 sUV = wp.xz * 5.0;
      sUV.x += mod(floor(sUV.y), 2.0) * 0.5;
      vec2 cell = fract(sUV) - 0.5;
      float d = length(cell);
      return smoothstep(0.45, 0.3, d) * 0.3 + 0.7;
    }

    if (tid == 4) {
      float n = noise2D(wp.xz * 2.5) * 0.5
              + noise2D(wp.xz * 5.0 + 100.0) * 0.3
              + noise2D(wp.xz * 10.0 + 200.0) * 0.2;
      return smoothstep(0.3, 0.7, n) * 0.4 + 0.6;
    }

    if (tid == 5) {
      float n = noise2D(wp.xz * 3.0) * 2.0;
      n += noise2D(wp.xz * 6.0) * 1.0;
      n += noise2D(wp.xz * 12.0) * 0.5;
      float veins = abs(sin(wp.x * 4.0 + n));
      return mix(0.7, 1.0, veins);
    }

    if (tid == 6) {
      vec2 cfUV = wp.xz * 8.0;
      float cx = sin(cfUV.x * 3.14159) * 0.5 + 0.5;
      float cy = sin(cfUV.y * 3.14159) * 0.5 + 0.5;
      float weave = cx * cy + (1.0 - cx) * (1.0 - cy);
      return mix(0.75, 1.0, weave);
    }

    return 1.0;
  }

  void main() {
    float energy = clamp(vEnergy, 0.0, 1.0);
    int style = int(vStyle + 0.5);
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    float NdotV = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, 4.0);

    // BASE COLOR
    vec3 baseColor = vOwnerColor;
    float isOwned = step(0.01, energy);
    vec3 neutralColor = vec3(0.25, 0.20, 0.15);
    baseColor = mix(neutralColor, baseColor, isOwned);

    int texId = int(vTextureId + 0.5);
    if (energy > 0.01 && texId > 0) {
      float texPattern = getTexturePattern(vTextureId, vWorldPos);
      baseColor *= texPattern;
    }

    if (energy > 0.01 && texId == 0) {
      float blockVar = fract(vInstanceOffset * 0.37) * 0.10;
      baseColor *= 0.95 + blockVar;
    }

    // INTERIOR MAPPING
    if (vImageIndex > 0.5) {
      float isVerticalFace = step(abs(vWorldNormal.y), 0.5);
      if (isVerticalFace > 0.5) {
        vec2 faceUV = clamp(vFaceUV, 0.0, 1.0);
        vec3 viewRay = normalize(vWorldPos - uCameraPos);
        vec3 faceN = normalize(vWorldNormal);
        vec3 faceTanX = normalize(cross(vec3(0.0, 1.0, 0.0), faceN));
        vec3 faceTanY = vec3(0.0, 1.0, 0.0);
        float rayN = dot(viewRay, faceN);
        float rayU = dot(viewRay, faceTanX);
        float rayV = dot(viewRay, faceTanY);
        float roomDepth = 0.55;
        float interiorU = faceUV.x;
        float interiorV = faceUV.y;
        if (rayN > 0.001) {
          float t = roomDepth / rayN;
          interiorU = faceUV.x + rayU * t;
          interiorV = faceUV.y + rayV * t;
        }
        interiorU = clamp(interiorU, 0.03, 0.97);
        interiorV = clamp(interiorV, 0.03, 0.97);

        float slot = vImageIndex - 1.0;
        float atlasCol = mod(slot, uAtlasCols);
        float atlasRow = floor(slot / uAtlasCols);
        vec2 atlasUV = vec2(
          (interiorU + atlasCol) / uAtlasCols,
          (interiorV + atlasRow) / uAtlasRows
        );

        vec4 imgColor = texture2D(uImageAtlas, atlasUV);

        float frameW = 0.08;
        float frameMask = smoothstep(0.0, frameW, faceUV.x)
                        * smoothstep(0.0, frameW, 1.0 - faceUV.x)
                        * smoothstep(0.0, frameW, faceUV.y)
                        * smoothstep(0.0, frameW, 1.0 - faceUV.y);

        float depthFade = 1.0 - length(vec2(interiorU - 0.5, interiorV - 0.5)) * 0.35;
        depthFade = clamp(depthFade, 0.4, 1.0);

        vec2 vigUV = faceUV * 2.0 - 1.0;
        float vignette = clamp(1.0 - dot(vigUV, vigUV) * 0.2, 0.0, 1.0);
        float scanline = 0.96 + 0.04 * sin(faceUV.y * 100.0 + uTime * 1.5);

        float edgeDist = min(min(faceUV.x, 1.0 - faceUV.x), min(faceUV.y, 1.0 - faceUV.y));
        float edgeGlow = smoothstep(0.12, 0.0, edgeDist) * energy * 0.6;
        float chromaStr = max((1.0 - edgeDist * 8.0) * 0.005, 0.0);
        vec2 chromaOff = vec2(chromaStr, 0.0);
        float rCh = texture2D(uImageAtlas, atlasUV + chromaOff).r;
        float bCh = texture2D(uImageAtlas, atlasUV - chromaOff).b;
        vec3 chromaImg = vec3(rCh, imgColor.g, bCh);

        vec3 imgFinal = chromaImg * depthFade * scanline * vignette;
        float imgBrightness = max(0.35, 0.35 + energy * 0.95);
        imgFinal *= imgBrightness;
        vec3 imgGlow = imgFinal * energy * 0.2;

        float blendStrength = max(imgColor.a, 0.4) * 0.92 * frameMask;
        baseColor = mix(baseColor, imgFinal, blendStrength);
        baseColor += imgGlow * frameMask;
        baseColor += vOwnerColor * edgeGlow;
      }
    }

    // STYLE MODIFIERS
    if (style == 1 && energy > 0.01) {
      float hue = fract(
        dot(vWorldPos, vec3(0.3, 0.5, 0.7)) * 0.15
        + uTime * 0.15
        + NdotV * 0.3
      );
      vec3 holoColor = hsv2rgb(vec3(hue, 0.6, 1.0));
      float holoMix = 0.4 + fresnel * 0.4;
      baseColor = mix(baseColor, holoColor, holoMix);
      baseColor += holoColor * fresnel * 0.6;
    }

    if (style == 2 && energy > 0.01) {
      float luma = dot(baseColor, vec3(0.299, 0.587, 0.114));
      baseColor = mix(vec3(luma), baseColor, 1.8);
      baseColor = max(baseColor, vec3(0.0));
      baseColor += vOwnerColor * fresnel * 2.0;
      baseColor *= 1.3;
    }

    if (style == 4 && energy > 0.01) {
      baseColor = mix(baseColor, vec3(1.0), 0.25);
      baseColor += vec3(0.8, 0.9, 1.0) * fresnel * 1.5;
      float distort = noise2D(vWorldPos.xz * 3.0 + uTime * 0.2) * 0.1;
      baseColor += vec3(distort);
    }

    if (style == 5 && energy > 0.01) {
      vec2 fireUV = vec2(vWorldPos.x * 3.0, vWorldPos.y * 2.0 - uTime * 1.5);
      float flame = noise2D(fireUV) * 0.5
                  + noise2D(fireUV * 2.0 + 50.0) * 0.3
                  + noise2D(fireUV * 4.0 + 100.0) * 0.2;
      vec3 fireColor;
      if (flame < 0.3) {
        fireColor = mix(vec3(0.15, 0.02, 0.0), vec3(0.8, 0.2, 0.0), flame / 0.3);
      } else if (flame < 0.6) {
        fireColor = mix(vec3(0.8, 0.2, 0.0), vec3(1.0, 0.7, 0.1), (flame - 0.3) / 0.3);
      } else {
        fireColor = mix(vec3(1.0, 0.7, 0.1), vec3(1.3, 1.1, 0.8), (flame - 0.6) / 0.4);
      }
      baseColor = mix(baseColor, fireColor, 0.7);
    }

    if (style == 6 && energy > 0.01) {
      baseColor = mix(baseColor, vec3(0.6, 0.8, 1.0), 0.45);
      vec3 iceLight = normalize(vec3(0.5, 0.8, 0.3));
      float facet = pow(max(dot(N, iceLight), 0.0), 16.0);
      baseColor += vec3(0.5, 0.7, 1.0) * facet * 0.6;
      float frost = noise2D(vWorldPos.xz * 8.0) * noise2D(vWorldPos.xy * 6.0);
      baseColor += vec3(0.3, 0.4, 0.5) * frost * 0.3;
      baseColor += vec3(0.4, 0.6, 1.0) * fresnel * 0.8;
    }

    // FACE SHADING
    vec3 lightDir = normalize(vec3(0.25, 0.8, -0.5));
    float NdotL = dot(N, lightDir);
    float topFace = max(0.0, N.y);
    float bottomFace = max(0.0, -N.y);
    float sideFace = 1.0 - abs(N.y);

    float faceBrightness = 0.72 + 0.30 * NdotL;
    faceBrightness += topFace * 0.25;
    faceBrightness -= bottomFace * 0.15;

    vec3 toCenter = normalize(vec3(0.0, vWorldPos.y, 0.0) - vWorldPos);
    float ao = 1.0 - max(dot(N, toCenter), 0.0) * 0.4;
    faceBrightness *= ao;

    vec3 edgePos = fract(vWorldPos * 1.1);
    float edgeDist = min(min(edgePos.x, 1.0 - edgePos.x), min(edgePos.z, 1.0 - edgePos.z));
    float contactShadow = smoothstep(0.0, 0.12, edgeDist);
    faceBrightness *= mix(0.7, 1.0, contactShadow);

    if (style == 3) {
      faceBrightness = 0.65 + 0.15 * NdotL;
    }

    float sss = pow(max(dot(-N, lightDir), 0.0), 2.0) * energy * 0.2;
    baseColor += vec3(0.15, 0.08, 0.03) * sss;
    baseColor += vec3(0.06, 0.04, 0.02) * max(0.0, -N.y) * energy;
    baseColor += vec3(0.04, 0.02, 0.01) * sideFace * energy;

    // ENERGY OVERLAY
    vec3 glowColor = energyGlowColor(energy);

    vec3 specColor = vec3(0.0);
    if (style != 3) {
      vec3 H = normalize(lightDir + V);
      float NdotH = max(dot(N, H), 0.0);
      float exponent = mix(8.0, 32.0, energy);
      float spec = pow(NdotH, exponent) * 0.15 * step(0.1, energy);
      spec *= (0.3 + energy * 0.7);
      specColor = vec3(1.0, 0.92, 0.7) * spec;
    }

    vec3 rimContrib = vec3(0.0);
    if (style != 3) {
      vec3 rimTint = mix(vec3(0.5, 0.7, 1.0), glowColor, 0.5 + energy * 0.5);
      float rimStrength = fresnel * (0.35 + energy * 1.0);
      rimContrib = rimTint * 2.2 * rimStrength;
    }

    float innerGlow = 0.0;
    if (energy > 0.05) {
      float coreFactor = NdotV * NdotV;
      innerGlow = coreFactor * energy * 0.15;
    }

    float pulseSpeed = 1.0 + energy * 3.0;
    float pulse = 0.5 + 0.5 * sin(uTime * pulseSpeed + vInstanceOffset);
    float pulseIntensity = 0.1 + energy * 0.5;

    float scanY = mod(uTime * 0.8, uTowerHeight + 8.0) - 4.0;
    float scanLine = smoothstep(2.0, 0.0, abs(vWorldY - scanY)) * 0.25;

    float spireBoost = smoothstep(uSpireThreshold - 0.05, uSpireThreshold + 0.15, vLayerNorm);
    float spireGlow = spireBoost * (0.4 + 0.5 * sin(uTime * 1.5 + vInstanceOffset * 2.0));

    float radiate = smoothstep(0.6, 1.0, energy) * (0.3 + 0.2 * sin(uTime * 2.0 + vInstanceOffset));

    vec3 baseTint = vec3(0.04, 0.03, 0.05);
    vec3 topTint = vec3(0.4, 0.28, 0.12);
    vec3 heightTint = mix(baseTint, topTint, vLayerNorm) * 0.15;

    // COMBINE
    vec3 color = baseColor * faceBrightness;
    color += heightTint;
    color *= (0.8 + pulse * pulseIntensity * 0.4);
    color += rimContrib;
    color += specColor;
    color += glowColor * scanLine * energy;
    color += glowColor * spireGlow * 0.5;
    color += glowColor * radiate;
    color += glowColor * innerGlow;

    // DEAD BLOCKS
    float deadMask = smoothstep(0.0, 0.06, energy);

    vec3 lp = abs(vLocalPos);
    float halfExt = 0.4;
    float edgeW = 0.035;

    float eX = smoothstep(halfExt - edgeW, halfExt, lp.x);
    float eY = smoothstep(halfExt - edgeW, halfExt, lp.y);
    float eZ = smoothstep(halfExt - edgeW, halfExt, lp.z);
    float wireframe = max(eX * eY, max(eY * eZ, eX * eZ));

    float faceEdgeW = 0.06;
    float fX = smoothstep(halfExt - faceEdgeW, halfExt, lp.x);
    float fY = smoothstep(halfExt - faceEdgeW, halfExt, lp.y);
    float fZ = smoothstep(halfExt - faceEdgeW, halfExt, lp.z);
    float faceOutline = max(fX, max(fY, fZ)) * 0.3;

    float edgeGlowDead = max(wireframe, faceOutline);

    vec3 glassBase = vec3(0.16, 0.12, 0.09);
    glassBase += vec3(0.04, 0.03, 0.02) * max(0.0, N.y);
    glassBase += vec3(0.03, 0.02, 0.01) * max(0.0, dot(N, normalize(vec3(0.4, 0.6, -0.3))));

    float dormantWarmth = 0.06 + 0.04 * vLayerNorm;
    glassBase += vec3(0.18, 0.10, 0.04) * dormantWarmth;

    float dormantPulse = 0.9 + 0.1 * sin(uTime * 0.4 + vInstanceOffset * 1.5);
    glassBase *= dormantPulse;

    vec3 edgeColorLow = vec3(0.55, 0.28, 0.10);
    vec3 edgeColorHigh = vec3(0.75, 0.55, 0.18);
    vec3 edgeColor = mix(edgeColorLow, edgeColorHigh, vLayerNorm);

    vec3 deadColor = glassBase + edgeColor * edgeGlowDead;

    float rimPulse = 0.85 + 0.15 * sin(uTime * 0.6 + vInstanceOffset * 2.0);
    deadColor += vec3(0.18, 0.10, 0.04) * fresnel * 0.7 * rimPulse;

    color = mix(deadColor, color, deadMask);

    // INSPECT MODE
    float hasImg = step(0.5, vImageIndex);
    float dimFloor = mix(0.30, 0.45, hasImg);
    color *= mix(dimFloor, 1.0, vFade);

    if (vHighlight > 0.01) {
      float hlHasImage = step(0.5, vImageIndex);
      float hlRim = pow(1.0 - NdotV, 2.0);
      vec3 rimColor = mix(vOwnerColor, vec3(1.0, 0.92, 0.7), 0.3);

      if (hlHasImage > 0.5) {
        color += rimColor * hlRim * vHighlight * 1.8;
        color *= 1.0 + vHighlight * 0.2;
        color += vOwnerColor * vHighlight * 0.15;
      } else {
        vec3 emissive = mix(vOwnerColor, vec3(1.0, 0.9, 0.6), 0.3);
        color += emissive * vHighlight * 0.7;
        color *= 1.0 + vHighlight * 0.4;
        color += rimColor * hlRim * vHighlight * 1.2;
      }
    }

    // FOG
    float fogFactor = exp(-uFogDensity * uFogDensity * vDist * vDist);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    color = mix(uFogColor, color, fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createBlockMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uFogColor: { value: new THREE.Color(0x2a1828) },
      uFogDensity: { value: 0.0 },
      uSpireThreshold: { value: SPIRE_START_LAYER / DEFAULT_TOWER_CONFIG.layerCount },
      uTowerHeight: { value: getTowerHeight(DEFAULT_TOWER_CONFIG.layerCount) },
      uImageAtlas: { value: null },
      uAtlasCols: { value: 3.0 },
      uAtlasRows: { value: 2.0 },
      uCameraPos: { value: new THREE.Vector3() },
    },
    fog: false,
    toneMapped: false,
  });
}

// ─── Glow Pass Material ──────────────────────────────────

const glowVertexShader = /* glsl */ `
  precision highp float;

  attribute float aEnergy;
  attribute vec3 aOwnerColor;
  attribute float aFade;
  attribute float aHighlight;

  varying float vEnergy;
  varying vec3 vOwnerColor;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vFade;
  varying float vHighlight;

  void main() {
    mat3 normalMat = mat3(instanceMatrix);
    vec3 worldNormal = normalize(normalMat * normal);
    vec3 localPos = (position + normal * 0.04) * (1.0 + aHighlight * 0.08);
    vec4 worldPos = instanceMatrix * vec4(localPos, 1.0);

    vec3 radialDir = vec3(worldPos.x, 0.0, worldPos.z);
    float radialLen = length(radialDir);
    if (radialLen > 0.01) {
      radialDir /= radialLen;
    } else {
      radialDir = vec3(0.0, 0.0, 1.0);
    }
    worldPos.xyz += radialDir * aHighlight * 0.6;
    worldPos.y += aHighlight * 0.12;

    vec4 mvPosition = modelViewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;

    vEnergy = aEnergy;
    vOwnerColor = aOwnerColor;
    vFade = aFade;
    vHighlight = aHighlight;
    vNormal = normalize(normalMatrix * worldNormal);
    vViewDir = normalize(-mvPosition.xyz);
  }
`;

const glowFragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;

  varying float vEnergy;
  varying vec3 vOwnerColor;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vFade;
  varying float vHighlight;

  void main() {
    float energy = clamp(vEnergy, 0.0, 1.0);

    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    float NdotV = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, 2.5);

    float glowStrength = energy * energy * energy * energy;

    float isDead = step(energy, 0.01);
    float dormantGlow = isDead * 0.08;

    if (glowStrength < 0.2 && dormantGlow < 0.01) discard;

    vec3 warmGold = vec3(1.0, 0.8, 0.3);
    vec3 dormantAmber = vec3(0.7, 0.4, 0.12);
    vec3 glowColor = mix(vOwnerColor, warmGold, 0.4) * 1.5;
    glowColor = mix(glowColor, dormantAmber, isDead);

    float pulse = 0.85 + 0.15 * sin(uTime * 2.0 + vOwnerColor.r * 10.0);
    float dormantPulse = 0.9 + 0.1 * sin(uTime * 0.5 + vOwnerColor.g * 8.0);
    pulse = mix(pulse, dormantPulse, isDead);

    float alpha = fresnel * max(glowStrength, dormantGlow) * pulse * 0.35;

    alpha *= mix(0.15, 1.0, vFade);
    if (vHighlight > 0.01) {
      float hlGlow = max(glowStrength, 0.4);
      alpha += vHighlight * hlGlow * 0.8;
      glowColor *= 1.0 + vHighlight * 0.8;
    }

    gl_FragColor = vec4(glowColor * max(glowStrength, dormantGlow), alpha);
  }
`;

export function createGlowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: glowVertexShader,
    fragmentShader: glowFragmentShader,
    uniforms: {
      uTime: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
}
