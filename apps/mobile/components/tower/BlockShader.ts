import * as THREE from "three";
import { DEFAULT_TOWER_CONFIG, getTowerHeight, SPIRE_START_LAYER } from "@monolith/common";

/**
 * Energy → color stops for the shader color ramp.
 * Maps normalized energy (0-1) to RGB colors.
 * These define the ENERGY OVERLAY — brightness/glow intensity, not base color.
 * Exported for testing.
 */
export const ENERGY_COLOR_STOPS = {
  blazing: { threshold: 0.8, color: [1.0, 0.92, 0.55] as const },  // brilliant white-gold
  thriving: { threshold: 0.5, color: [0.95, 0.65, 0.18] as const }, // warm amber-gold
  fading: { threshold: 0.2, color: [0.65, 0.35, 0.22] as const },   // copper with warmth
  dying: { threshold: 0.05, color: [0.45, 0.12, 0.08] as const },   // warm ember red
  dead: { threshold: 0.0, color: [0.06, 0.06, 0.08] as const },     // cool dark stone
} as const;

/**
 * Block styles (matched to BLOCK_STYLES in BlockInspector):
 * 0=Default, 1=Holographic, 2=Neon, 3=Matte, 4=Glass, 5=Fire, 6=Ice
 * 7=Lava, 8=Aurora, 9=Crystal, 10=Nature
 *
 * Block textures (procedural patterns):
 * 0=None, 1=Bricks, 2=Circuits, 3=Scales, 4=Camo, 5=Marble, 6=Carbon
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
  varying vec3 vLocalPos;       // raw local-space position (for interior mapping)
  varying vec3 vBlockCenter;    // world-space block center

  void main() {
    // Apply instance transform with optional highlight scale-up
    vec3 localPos = position * (1.0 + aHighlight * 0.08);
    vec4 worldPos = instanceMatrix * vec4(localPos, 1.0);

    // Pop-out: push highlighted block radially away from tower center (Y-axis)
    // This works correctly for all faces including corners
    vec3 radialDir = vec3(worldPos.x, 0.0, worldPos.z);
    float radialLen = length(radialDir);
    if (radialLen > 0.01) {
      radialDir /= radialLen;
    } else {
      radialDir = vec3(0.0, 0.0, 1.0); // fallback for center blocks
    }
    worldPos.xyz += radialDir * aHighlight * 0.6;
    worldPos.y += aHighlight * 0.12; // subtle upward float

    vec4 mvPosition = modelViewMatrix * worldPos;

    gl_Position = projectionMatrix * mvPosition;

    // Pass to fragment
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
    vLocalPos = position; // raw local-space vertex position
    // Block center from instance matrix translation column
    vBlockCenter = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);

    // Instance rotation matrix (3x3)
    mat3 instRot = mat3(instanceMatrix);

    // View-space normal for fresnel
    vNormal = normalize(normalMatrix * instRot * normal);

    // World-space normal for face detection (not view-space!)
    vWorldNormal = normalize(instRot * normal);

    // Face UV: computed per-face from local position + local normal.
    // Each face of the box uses the correct tangent axes for UV mapping.
    // BLOCK_SIZE=0.8, so *1.25 maps [-0.4,0.4] to [0,1]
    vec3 aN = abs(normal);
    if (aN.x > aN.y && aN.x > aN.z) {
      // X-facing local face: use local Z,Y
      vFaceUV = vec2(position.z * sign(normal.x), position.y) * 1.25 + 0.5;
    } else if (aN.z > aN.y) {
      // Z-facing local face: use local X,Y
      vFaceUV = vec2(position.x * sign(normal.z), position.y) * 1.25 + 0.5;
    } else {
      // Y-facing (top/bottom): use X,Z — filtered out by face detection anyway
      vFaceUV = position.xz * 1.25 + 0.5;
    }

    // View direction for fresnel
    vViewDir = normalize(-mvPosition.xyz);

    // Distance from camera for fog
    vDist = length(mvPosition.xyz);

    // Unique offset per instance for pulse variation
    vInstanceOffset = worldPos.x * 0.3 + worldPos.y * 0.7 + worldPos.z * 0.5;
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;  // mediump sufficient for color math — ~2x faster on mobile GPU

  uniform float uTime;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uSpireThreshold;
  uniform float uTowerHeight;
  uniform sampler2D uImageAtlas;
  uniform float uAtlasCols;
  uniform float uAtlasRows;
  uniform vec3 uCameraPos;

  // Claim celebration uniforms
  uniform vec3 uClaimWaveOrigin;
  uniform float uClaimWaveTime;
  uniform float uClaimWaveIntensity;
  uniform vec3 uClaimLightPos;
  uniform float uClaimLightIntensity;

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

  // ─── Utility: hash/noise for textures ──────────────────
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

  // ─── HSV helpers for holographic ───────────────────────
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  // ─── Energy glow color (for overlays) ──────────────────
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

  // ─── Texture patterns (procedural) ─────────────────────
  // Returns a 0-1 pattern value to modulate the base color
  float getTexturePattern(float texId, vec3 wp) {
    int tid = int(texId + 0.5);

    if (tid == 1) {
      // Bricks — offset grid pattern
      vec2 bUV = wp.xz * 3.0;
      float row = floor(bUV.y);
      bUV.x += mod(row, 2.0) * 0.5; // offset every other row
      vec2 brick = fract(bUV);
      float mortar = step(0.06, brick.x) * step(0.06, brick.y);
      return mix(0.6, 1.0, mortar);
    }

    if (tid == 2) {
      // Circuits — PCB trace lines
      vec2 cUV = wp.xz * 4.0;
      float lineX = smoothstep(0.45, 0.48, abs(fract(cUV.x) - 0.5));
      float lineY = smoothstep(0.45, 0.48, abs(fract(cUV.y * 0.7) - 0.5));
      float traces = max(lineX, lineY);
      float dots = smoothstep(0.15, 0.1, length(fract(cUV) - 0.5));
      return mix(0.85, 1.0, max(traces, dots * 0.5));
    }

    if (tid == 3) {
      // Scales — hexagonal pattern
      vec2 sUV = wp.xz * 5.0;
      sUV.x += mod(floor(sUV.y), 2.0) * 0.5;
      vec2 cell = fract(sUV) - 0.5;
      float d = length(cell);
      return smoothstep(0.45, 0.3, d) * 0.3 + 0.7;
    }

    if (tid == 4) {
      // Camo — organic blobs from noise
      float n = noise2D(wp.xz * 2.5) * 0.5
              + noise2D(wp.xz * 5.0 + 100.0) * 0.3
              + noise2D(wp.xz * 10.0 + 200.0) * 0.2;
      return smoothstep(0.3, 0.7, n) * 0.4 + 0.6;
    }

    if (tid == 5) {
      // Marble — turbulent veins
      float n = noise2D(wp.xz * 3.0) * 2.0;
      n += noise2D(wp.xz * 6.0) * 1.0;
      n += noise2D(wp.xz * 12.0) * 0.5;
      float veins = abs(sin(wp.x * 4.0 + n));
      return mix(0.7, 1.0, veins);
    }

    if (tid == 6) {
      // Carbon fiber — woven grid
      vec2 cfUV = wp.xz * 8.0;
      float cx = sin(cfUV.x * 3.14159) * 0.5 + 0.5;
      float cy = sin(cfUV.y * 3.14159) * 0.5 + 0.5;
      float weave = cx * cy + (1.0 - cx) * (1.0 - cy);
      return mix(0.75, 1.0, weave);
    }

    return 1.0; // tid == 0 or unrecognized: no pattern
  }

  void main() {
    float energy = clamp(vEnergy, 0.0, 1.0);
    int style = int(vStyle + 0.5);
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    float NdotV = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, 4.0);

    // ═══════════════════════════════════════════════════════
    // LAYER 1: BASE COLOR (from customization, NOT energy)
    // ═══════════════════════════════════════════════════════

    // Owner color is the player's chosen color. Unowned blocks get a neutral default.
    vec3 baseColor = vOwnerColor;

    // If block is dead/unowned, use neutral dark stone as base
    float isOwned = step(0.01, energy);
    vec3 neutralColor = vec3(0.25, 0.20, 0.15);
    baseColor = mix(neutralColor, baseColor, isOwned);

    // Apply texture pattern (skip for dead blocks and no-texture)
    int texId = int(vTextureId + 0.5);
    if (energy > 0.01 && texId > 0) {
      float texPattern = getTexturePattern(vTextureId, vWorldPos);
      baseColor *= texPattern;
    }

    // Per-block color variation (uses instance offset, NOT per-pixel hash)
    if (energy > 0.01 && texId == 0) {
      float blockVar = fract(vInstanceOffset * 0.37) * 0.10;
      baseColor *= 0.95 + blockVar;
    }

    // ═══════════════════════════════════════════════════════
    // LAYER 1.5: INTERIOR MAPPING — "window into the block"
    // ═══════════════════════════════════════════════════════
    // ALL vertical faces become windows (not just outward face).
    // Each face has proper UVs computed from local position.
    // Interior mapping: ray from camera through fragment → virtual back wall.
    if (vImageIndex > 0.5) {
      // Skip top/bottom faces (Y-dominant normals)
      float isVerticalFace = step(abs(vWorldNormal.y), 0.5);

      if (isVerticalFace > 0.5) {
        // Face UV already computed correctly per-face in the vertex shader
        vec2 faceUV = clamp(vFaceUV, 0.0, 1.0);

        // ── Interior mapping ray-box intersection ──
        vec3 viewRay = normalize(vWorldPos - uCameraPos);

        // Face-local coordinate frame from world normal
        vec3 faceN = normalize(vWorldNormal);
        vec3 faceTanX = normalize(cross(vec3(0.0, 1.0, 0.0), faceN));
        vec3 faceTanY = vec3(0.0, 1.0, 0.0);

        // Project view ray into face-local axes
        float rayN = dot(viewRay, faceN);   // depth into block
        float rayU = dot(viewRay, faceTanX); // horizontal shift
        float rayV = dot(viewRay, faceTanY); // vertical shift

        // Room depth: how far "inside" the back wall sits
        float roomDepth = 0.55;

        // Find where ray intersects back wall
        float interiorU = faceUV.x;
        float interiorV = faceUV.y;
        if (rayN > 0.001) {
          float t = roomDepth / rayN;
          interiorU = faceUV.x + rayU * t;
          interiorV = faceUV.y + rayV * t;
        }
        interiorU = clamp(interiorU, 0.03, 0.97);
        interiorV = clamp(interiorV, 0.03, 0.97);

        // Atlas UV: dynamic grid (cols x rows), slots 1-based
        float slot = vImageIndex - 1.0;
        float atlasCol = mod(slot, uAtlasCols);
        float atlasRow = floor(slot / uAtlasCols);
        vec2 atlasUV = vec2(
          (interiorU + atlasCol) / uAtlasCols,
          (interiorV + atlasRow) / uAtlasRows
        );

        vec4 imgColor = texture2D(uImageAtlas, atlasUV);

        // ── Window frame ──
        float frameW = 0.08;
        float frameMask = smoothstep(0.0, frameW, faceUV.x)
                        * smoothstep(0.0, frameW, 1.0 - faceUV.x)
                        * smoothstep(0.0, frameW, faceUV.y)
                        * smoothstep(0.0, frameW, 1.0 - faceUV.y);

        // Depth darkening (room corners dimmer)
        float depthFade = 1.0 - length(vec2(interiorU - 0.5, interiorV - 0.5)) * 0.35;
        depthFade = clamp(depthFade, 0.4, 1.0);

        // Vignette + scanlines
        vec2 vigUV = faceUV * 2.0 - 1.0;
        float vignette = clamp(1.0 - dot(vigUV, vigUV) * 0.2, 0.0, 1.0);
        float scanline = 0.96 + 0.04 * sin(faceUV.y * 100.0 + uTime * 1.5);

        // Edge glow + chromatic aberration
        float edgeDist = min(min(faceUV.x, 1.0 - faceUV.x), min(faceUV.y, 1.0 - faceUV.y));
        float edgeGlow = smoothstep(0.12, 0.0, edgeDist) * energy * 0.6;
        float chromaStr = max((1.0 - edgeDist * 8.0) * 0.005, 0.0);
        vec2 chromaOff = vec2(chromaStr, 0.0);
        float rCh = texture2D(uImageAtlas, atlasUV + chromaOff).r;
        float bCh = texture2D(uImageAtlas, atlasUV - chromaOff).b;
        vec3 chromaImg = vec3(rCh, imgColor.g, bCh);

        // Compose with depth + effects
        vec3 imgFinal = chromaImg * depthFade * scanline * vignette;
        float imgBrightness = max(0.35, 0.35 + energy * 0.95); // dim at 0 energy, bright when charged
        imgFinal *= imgBrightness;
        vec3 imgGlow = imgFinal * energy * 0.2;

        // Blend: image dominates inside window frame
        float blendStrength = max(imgColor.a, 0.4) * 0.92 * frameMask;
        baseColor = mix(baseColor, imgFinal, blendStrength);
        baseColor += imgGlow * frameMask;
        baseColor += vOwnerColor * edgeGlow;
      }
    }

    // ═══════════════════════════════════════════════════════
    // LAYER 2: STYLE MODIFIER (purely cosmetic, per block)
    // ═══════════════════════════════════════════════════════

    // --- Style 1: Holographic (rainbow shift) ---
    if (style == 1 && energy > 0.01) {
      float hue = fract(
        dot(vWorldPos, vec3(0.3, 0.5, 0.7)) * 0.15
        + uTime * 0.15
        + NdotV * 0.3
      );
      vec3 holoColor = hsv2rgb(vec3(hue, 0.6, 1.0));
      // Blend holo rainbow with the owner color
      float holoMix = 0.4 + fresnel * 0.4;
      baseColor = mix(baseColor, holoColor, holoMix);
      // Iridescent sheen on edges
      baseColor += holoColor * fresnel * 0.6;
    }

    // --- Style 2: Neon (saturated glow, bloom edges) ---
    if (style == 2 && energy > 0.01) {
      // Boost saturation of owner color
      float luma = dot(baseColor, vec3(0.299, 0.587, 0.114));
      baseColor = mix(vec3(luma), baseColor, 1.8); // over-saturate
      baseColor = max(baseColor, vec3(0.0));
      // Strong edge glow in owner color
      baseColor += vOwnerColor * fresnel * 2.0;
      // Emissive boost
      baseColor *= 1.3;
    }

    // --- Style 3: Matte (no specular, flat diffuse) ---
    // Handled below by zeroing fresnel/specular

    // --- Style 4: Glass (high fresnel, translucent look) ---
    if (style == 4 && energy > 0.01) {
      // Lighten the base for a glass-like appearance
      baseColor = mix(baseColor, vec3(1.0), 0.25);
      // Strong reflective rim
      baseColor += vec3(0.8, 0.9, 1.0) * fresnel * 1.5;
      // Subtle distortion via world position
      float distort = noise2D(vWorldPos.xz * 3.0 + uTime * 0.2) * 0.1;
      baseColor += vec3(distort);
    }

    // --- Style 5: Fire (animated flame) ---
    if (style == 5 && energy > 0.01) {
      vec2 fireUV = vec2(vWorldPos.x * 3.0, vWorldPos.y * 2.0 - uTime * 1.5);
      float flame = noise2D(fireUV) * 0.5
                  + noise2D(fireUV * 2.0 + 50.0) * 0.3
                  + noise2D(fireUV * 4.0 + 100.0) * 0.2;
      // Fire gradient: dark red → orange → yellow → white
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

    // --- Style 6: Ice (cool crystal) ---
    if (style == 6 && energy > 0.01) {
      // Cool blue-white tint
      baseColor = mix(baseColor, vec3(0.6, 0.8, 1.0), 0.45);
      // Crystalline facets — sharp normal-based lighting
      vec3 iceLight = normalize(vec3(0.5, 0.8, 0.3));
      float facet = pow(max(dot(N, iceLight), 0.0), 16.0);
      baseColor += vec3(0.5, 0.7, 1.0) * facet * 0.6;
      // Frost noise
      float frost = noise2D(vWorldPos.xz * 8.0) * noise2D(vWorldPos.xy * 6.0);
      baseColor += vec3(0.3, 0.4, 0.5) * frost * 0.3;
      // Ice rim glow
      baseColor += vec3(0.4, 0.6, 1.0) * fresnel * 0.8;
    }

    // --- Style 7: Lava (flowing magma with glowing cracks) ---
    if (style == 7 && energy > 0.01) {
      vec2 lavaUV = vWorldPos.xz * 2.5 + uTime * 0.15;
      float flow = noise2D(lavaUV) * 0.5
                  + noise2D(lavaUV * 2.0 + vec2(uTime * 0.1, 0.0)) * 0.3
                  + noise2D(lavaUV * 4.0 + 50.0) * 0.2;
      // Cracks: sharp threshold on noise
      float cracks = smoothstep(0.35, 0.5, flow);
      // Lava gradient: dark rock → orange → bright yellow
      vec3 rockColor = vec3(0.12, 0.06, 0.03);
      vec3 magmaColor = mix(vec3(0.9, 0.3, 0.0), vec3(1.2, 0.8, 0.1), flow);
      vec3 lavaColor = mix(rockColor, magmaColor, cracks);
      // Pulsing glow in cracks
      float lavaPulse = 0.8 + 0.2 * sin(uTime * 2.0 + vInstanceOffset);
      lavaColor *= lavaPulse;
      baseColor = mix(baseColor, lavaColor, 0.75);
      // Emissive rim
      baseColor += vec3(0.8, 0.2, 0.0) * fresnel * 0.5;
    }

    // --- Style 8: Aurora (northern lights shimmer) ---
    if (style == 8 && energy > 0.01) {
      float auroraT = uTime * 0.3 + vWorldPos.y * 0.8;
      // Multi-frequency color waves
      float wave1 = sin(vWorldPos.y * 3.0 + uTime * 0.5 + vWorldPos.x * 2.0) * 0.5 + 0.5;
      float wave2 = sin(vWorldPos.y * 5.0 - uTime * 0.3 + vWorldPos.z * 1.5) * 0.5 + 0.5;
      float wave3 = sin(vWorldPos.y * 2.0 + uTime * 0.7) * 0.5 + 0.5;
      // HSV-based color: hue shifts through green→teal→purple
      float hue = fract(0.35 + wave1 * 0.3 + wave2 * 0.15 + uTime * 0.02);
      vec3 auroraColor = hsv2rgb(vec3(hue, 0.7 + wave3 * 0.2, 0.9 + wave1 * 0.3));
      // Curtain pattern: stronger in vertical bands
      float curtain = smoothstep(0.2, 0.8, wave1 * wave2);
      baseColor = mix(baseColor, auroraColor, curtain * 0.7);
      // Soft edge glow
      baseColor += auroraColor * fresnel * 0.4;
    }

    // --- Style 9: Crystal (sparkling facets) ---
    if (style == 9 && energy > 0.01) {
      // Voronoi-like cells for faceted look
      vec2 crystalUV = vWorldPos.xz * 4.0;
      vec2 cellId = floor(crystalUV);
      vec2 cellUV = fract(crystalUV) - 0.5;
      // Distance to nearest cell center
      float minDist = 1.0;
      for (int j = -1; j <= 1; j++) {
        for (int k = -1; k <= 1; k++) {
          vec2 neighbor = vec2(float(j), float(k));
          vec2 nc = cellId + neighbor;
          // Generate pseudo-random 2D point from two hash calls
          float hx = hash21(nc);
          float hy = hash21(nc + vec2(127.0, 311.0));
          vec2 point = vec2(hx, hy) * 0.8 - 0.4;
          float d = length(cellUV - neighbor - point);
          minDist = min(minDist, d);
        }
      }
      // Facet edges
      float facetEdge = smoothstep(0.05, 0.12, minDist);
      // Specular pings — sharp sparkles that move with time
      float sparkle = pow(max(0.0, 1.0 - minDist * 3.0), 8.0);
      float sparkleTime = sin(uTime * 4.0 + hash21(cellId) * 20.0) * 0.5 + 0.5;
      sparkle *= sparkleTime;
      // Crystal base: translucent with prismatic hints
      vec3 crystalBase = mix(baseColor, vec3(0.8, 0.9, 1.0), 0.3);
      crystalBase *= facetEdge;
      crystalBase += vec3(1.0, 0.95, 0.8) * sparkle * 1.5;
      // Prismatic edge color
      float prismHue = fract(hash21(cellId) + uTime * 0.05);
      crystalBase += hsv2rgb(vec3(prismHue, 0.5, 0.4)) * (1.0 - facetEdge) * 0.5;
      baseColor = mix(baseColor, crystalBase, 0.7);
      // Strong specular rim
      baseColor += vec3(0.6, 0.7, 1.0) * fresnel * 1.0;
    }

    // --- Style 10: Nature (mossy solarpunk growth) ---
    if (style == 10 && energy > 0.01) {
      // Green noise tendrils growing over the block
      float moss1 = noise2D(vWorldPos.xz * 3.0 + uTime * 0.05);
      float moss2 = noise2D(vWorldPos.xy * 4.0 - uTime * 0.03);
      float mossPattern = moss1 * 0.6 + moss2 * 0.4;
      // Growth from bottom up
      float growthMask = smoothstep(-0.4, 0.2, vLocalPos.y + mossPattern * 0.3);
      // Green palette: deep forest → bright spring → golden tips
      vec3 deepGreen = vec3(0.05, 0.18, 0.06);
      vec3 brightGreen = vec3(0.15, 0.45, 0.12);
      vec3 goldTip = vec3(0.5, 0.45, 0.1);
      vec3 mossColor = mix(deepGreen, brightGreen, mossPattern);
      mossColor = mix(mossColor, goldTip, smoothstep(0.7, 0.95, mossPattern));
      // Subtle life pulse
      float lifePulse = 0.9 + 0.1 * sin(uTime * 0.8 + vInstanceOffset * 2.0);
      mossColor *= lifePulse;
      baseColor = mix(baseColor, mossColor, growthMask * 0.7);
      // Bioluminescent rim
      baseColor += vec3(0.1, 0.3, 0.05) * fresnel * 0.6;
    }

    // ═══════════════════════════════════════════════════════
    // LAYER 3: FACE SHADING (3D form, always applies)
    // ═══════════════════════════════════════════════════════

    vec3 lightDir = normalize(vec3(0.25, 0.8, -0.5));
    float NdotL = dot(N, lightDir);
    float topFace = max(0.0, N.y);
    float bottomFace = max(0.0, -N.y);
    float sideFace = 1.0 - abs(N.y);

    float faceBrightness = 0.72 + 0.30 * NdotL;
    faceBrightness += topFace * 0.25;
    faceBrightness -= bottomFace * 0.15;

    // ─── Fake AO: darken faces pointing toward tower center ──
    vec3 toCenter = normalize(vec3(0.0, vWorldPos.y, 0.0) - vWorldPos);
    float ao = 1.0 - max(dot(N, toCenter), 0.0) * 0.4;
    faceBrightness *= ao;

    // ─── Contact shadow: darken block edges where they meet grid ──
    vec3 edgePos = fract(vWorldPos * 1.1);
    float edgeDist = min(min(edgePos.x, 1.0 - edgePos.x), min(edgePos.z, 1.0 - edgePos.z));
    float contactShadow = smoothstep(0.0, 0.12, edgeDist);
    faceBrightness *= mix(0.7, 1.0, contactShadow);

    // Matte style: flatten the lighting
    if (style == 3) {
      faceBrightness = 0.65 + 0.15 * NdotL;
    }

    // ─── SSS approximation: light wrapping for high-energy blocks ──
    float sss = pow(max(dot(-N, lightDir), 0.0), 2.0) * energy * 0.2;
    baseColor += vec3(0.15, 0.08, 0.03) * sss;

    // ─── Uplight bounce: warm light on undersides ──
    baseColor += vec3(0.06, 0.04, 0.02) * max(0.0, -N.y) * energy;

    // Warm ambient on sides for living blocks
    baseColor += vec3(0.04, 0.02, 0.01) * sideFace * energy;

    // ═══════════════════════════════════════════════════════
    // LAYER 4: ENERGY OVERLAY (system-driven, additive)
    // ═══════════════════════════════════════════════════════
    // Energy affects glow intensity, not base color

    vec3 glowColor = energyGlowColor(energy);

    // Specular — Blinn-Phong (skip for matte)
    vec3 specColor = vec3(0.0);
    if (style != 3) {
      vec3 H = normalize(lightDir + V);
      float NdotH = max(dot(N, H), 0.0);
      float exponent = mix(8.0, 32.0, energy);
      float spec = pow(NdotH, exponent) * 0.15 * step(0.1, energy);
      spec *= (0.3 + energy * 0.7);
      specColor = vec3(1.0, 0.92, 0.7) * spec;
    }

    // Fresnel rim glow (energy-scaled, skip for matte)
    vec3 rimContrib = vec3(0.0);
    if (style != 3) {
      vec3 rimTint = mix(vec3(0.5, 0.7, 1.0), glowColor, 0.5 + energy * 0.5);
      float rimStrength = fresnel * (0.35 + energy * 1.0);
      rimContrib = rimTint * 2.2 * rimStrength;
    }

    // Edge highlights removed — fwidth() too expensive on mobile

    // Inner glow (core emission for owned blocks)
    float innerGlow = 0.0;
    if (energy > 0.05) {
      float coreFactor = NdotV * NdotV;
      innerGlow = coreFactor * energy * 0.15;
    }

    // Pulse animation (energy-driven)
    float pulseSpeed = 1.0 + energy * 3.0;
    float pulse = 0.5 + 0.5 * sin(uTime * pulseSpeed + vInstanceOffset);
    float pulseIntensity = 0.1 + energy * 0.5;

    // Vertical scanline
    float scanY = mod(uTime * 0.8, uTowerHeight + 8.0) - 4.0;
    float scanLine = smoothstep(2.0, 0.0, abs(vWorldY - scanY)) * 0.25;

    // Spire glow boost
    float spireBoost = smoothstep(uSpireThreshold - 0.05, uSpireThreshold + 0.15, vLayerNorm);
    float spireGlow = spireBoost * (0.4 + 0.5 * sin(uTime * 1.5 + vInstanceOffset * 2.0));

    // Emissive radiate (high-energy only)
    float radiate = smoothstep(0.6, 1.0, energy) * (0.3 + 0.2 * sin(uTime * 2.0 + vInstanceOffset));

    // Height tint
    vec3 baseTint = vec3(0.04, 0.03, 0.05);
    vec3 topTint = vec3(0.4, 0.28, 0.12);
    vec3 heightTint = mix(baseTint, topTint, vLayerNorm) * 0.15;

    // ═══════════════════════════════════════════════════════
    // COMBINE: Base × Shading + Energy Overlays
    // ═══════════════════════════════════════════════════════

    vec3 color = baseColor * faceBrightness;
    color += heightTint;

    // Energy-driven overlays (additive)
    color *= (0.8 + pulse * pulseIntensity * 0.4);
    color += rimContrib;
    color += specColor;
    color += glowColor * scanLine * energy;
    color += glowColor * spireGlow * 0.5;
    color += glowColor * radiate;
    color += glowColor * innerGlow;

    // ─── Dead blocks: dark glass with glowing amber edges ──
    float deadMask = smoothstep(0.0, 0.06, energy);

    // ── Edge detection from local box position ──
    // vLocalPos is raw box-space coords: ranges ~[-0.4, 0.4]
    vec3 lp = abs(vLocalPos);
    float halfExt = 0.4;    // half-extent of block geometry
    float edgeW = 0.035;    // edge line width

    // Each axis: 1.0 when near the face boundary, 0.0 in the interior
    float eX = smoothstep(halfExt - edgeW, halfExt, lp.x);
    float eY = smoothstep(halfExt - edgeW, halfExt, lp.y);
    float eZ = smoothstep(halfExt - edgeW, halfExt, lp.z);

    // Wireframe = where 2+ axes are at the boundary (the 12 cube edges)
    float wireframe = max(eX * eY, max(eY * eZ, eX * eZ));

    // Also add single-axis face borders (softer, wider) for the face outlines
    float faceEdgeW = 0.06;
    float fX = smoothstep(halfExt - faceEdgeW, halfExt, lp.x);
    float fY = smoothstep(halfExt - faceEdgeW, halfExt, lp.y);
    float fZ = smoothstep(halfExt - faceEdgeW, halfExt, lp.z);
    float faceOutline = max(fX, max(fY, fZ)) * 0.3; // subtle face borders

    float edgeGlow = max(wireframe, faceOutline);

    // ── Dark glass interior with subtle inner warmth ──
    vec3 glassBase = vec3(0.16, 0.12, 0.09);
    // Face shading so it reads as 3D
    glassBase += vec3(0.04, 0.03, 0.02) * max(0.0, N.y);
    glassBase += vec3(0.03, 0.02, 0.01) * max(0.0, dot(N, normalize(vec3(0.4, 0.6, -0.3))));

    // Subtle height-based ambient warmth — unclaimed blocks glow faintly near the base
    float dormantWarmth = 0.06 + 0.04 * vLayerNorm;
    glassBase += vec3(0.18, 0.10, 0.04) * dormantWarmth;

    // Gentle breathing pulse — the tower is alive even where unclaimed
    float dormantPulse = 0.9 + 0.1 * sin(uTime * 0.4 + vInstanceOffset * 1.5);
    glassBase *= dormantPulse;

    // ── Amber edge color — height-graded ──
    vec3 edgeColorLow = vec3(0.55, 0.28, 0.10);   // warm amber
    vec3 edgeColorHigh = vec3(0.75, 0.55, 0.18);   // pale gold
    vec3 edgeColor = mix(edgeColorLow, edgeColorHigh, vLayerNorm);

    // Compose: dark glass + glowing edges
    vec3 deadColor = glassBase + edgeColor * edgeGlow;

    // Fresnel rim — amber glow at viewing angle edges
    float rimPulse = 0.85 + 0.15 * sin(uTime * 0.6 + vInstanceOffset * 2.0);
    deadColor += vec3(0.18, 0.10, 0.04) * fresnel * 0.7 * rimPulse;

    color = mix(deadColor, color, deadMask);

    // ═══════════════════════════════════════════════════════
    // LAYER 4.5: CLAIM CELEBRATION (shockwave + fake light)
    // ═══════════════════════════════════════════════════════
    // Guarded by intensity checks — zero cost when inactive
    if (uClaimWaveIntensity > 0.001) {
      float waveDist = distance(vWorldPos, uClaimWaveOrigin);
      // Two-speed expansion: fast burst then spreading ripple
      float waveRadius = uClaimWaveTime * 14.0;
      float ringDist = abs(waveDist - waveRadius);

      // ── Primary shockwave ring — wide gold-white flash ────────────────
      float ring = smoothstep(3.5, 0.0, ringDist) * uClaimWaveIntensity;
      // Narrow bright core of the ring
      float ringCore = smoothstep(1.2, 0.0, ringDist) * uClaimWaveIntensity;
      // Hot-white core fades to gold-orange edges
      vec3 waveColor = mix(vec3(1.0, 0.70, 0.15), vec3(2.0, 1.8, 1.2), ringCore);
      color += waveColor * ring * 2.0;

      // ── Secondary ripple (travels behind, fades out) ──────────────────
      float rippleRadius = uClaimWaveTime * 10.0;
      float rippleDist = abs(waveDist - rippleRadius);
      float ripple = smoothstep(4.0, 0.0, rippleDist) * uClaimWaveIntensity * 0.45;
      color += vec3(0.6, 0.3, 1.0) * ripple; // violet secondary ripple

      // ── Nearby blocks: strong proximity flash at moment of impact ────
      // Creates the "tower pulses" effect on blocks adjacent to claim
      float proximityFlash = smoothstep(5.0, 0.0, waveDist) * uClaimWaveIntensity;
      color += vec3(1.4, 1.1, 0.5) * proximityFlash * 0.9;

      // ── Claimed block: stays lit up after wave passes ──────────────
      float originGlow = smoothstep(2.0, 0.0, waveDist) * uClaimWaveIntensity * 0.5;
      color += vec3(1.5, 1.3, 0.8) * originGlow;
    }
    if (uClaimLightIntensity > 0.001) {
      float lightDist = distance(vWorldPos, uClaimLightPos);
      // Wide soft attenuation — illuminates the whole surrounding tower
      float atten = 1.0 / (1.0 + lightDist * lightDist * 0.015);
      // Warm gold point light, brighter than before
      color += vec3(1.1, 0.90, 0.45) * atten * uClaimLightIntensity;
      // Strong orange bloom on immediately adjacent blocks
      float nearGlow = smoothstep(5.0, 0.0, lightDist) * uClaimLightIntensity;
      color += vec3(1.0, 0.5, 0.15) * nearGlow * 0.7;
    }

    // ═══════════════════════════════════════════════════════
    // LAYER 5: INSPECT MODE (dim + highlight)
    // ═══════════════════════════════════════════════════════

    // Dim non-focused blocks — aggressive darken for night scene contrast
    float hasImg = step(0.5, vImageIndex);
    float dimFloor = mix(0.30, 0.45, hasImg); // dark scene needs stronger dim
    color *= mix(dimFloor, 1.0, vFade);

    // Highlight selected block — punchy for dark scene
    if (vHighlight > 0.01) {
      float hlHasImage = step(0.5, vImageIndex);
      float hlRim = pow(1.0 - NdotV, 2.0); // wider rim (was 2.5)
      vec3 rimColor = mix(vOwnerColor, vec3(1.0, 0.92, 0.7), 0.3);

      if (hlHasImage > 0.5) {
        // IMAGE BLOCKS: bright rim glow + moderate face lift
        color += rimColor * hlRim * vHighlight * 1.8;
        color *= 1.0 + vHighlight * 0.2;
        // Warm edge emission so the block pops from the darkness
        color += vOwnerColor * vHighlight * 0.15;
      } else {
        // NON-IMAGE BLOCKS: strong emissive highlight
        vec3 emissive = mix(vOwnerColor, vec3(1.0, 0.9, 0.6), 0.3);
        color += emissive * vHighlight * 0.7;
        color *= 1.0 + vHighlight * 0.4;
        color += rimColor * hlRim * vHighlight * 1.2;
      }
    }

    // ─── Fog ─────────────────────────────────────────────
    float fogFactor = exp(-uFogDensity * uFogDensity * vDist * vDist);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    color = mix(uFogColor, color, fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Creates the custom ShaderMaterial for tower blocks.
 * Supports instanced rendering with per-block energy, owner color,
 * layer height, style, and texture.
 *
 * ARCHITECTURE — Energy ≠ Customization:
 * - Energy (system): controls pulse, rim glow, scanline, radiate intensity
 * - Customization (player): controls base color (ownerColor), style, texture
 *
 * Visual features:
 * - 7 material styles: Default, Holographic, Neon, Matte, Glass, Fire, Ice
 * - 7 procedural textures: None, Bricks, Circuits, Scales, Camo, Marble, Carbon
 * - HDR output for Blazing blocks
 * - Face-shading differentiation (top/side/bottom)
 * - Dead blocks with cool-tinted cracks
 */
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
      // Claim celebration
      uClaimWaveOrigin: { value: new THREE.Vector3() },
      uClaimWaveTime: { value: -1 },
      uClaimWaveIntensity: { value: 0 },
      uClaimLightPos: { value: new THREE.Vector3() },
      uClaimLightIntensity: { value: 0 },
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
    // Inflate geometry along normals for halo effect
    mat3 normalMat = mat3(instanceMatrix);
    vec3 worldNormal = normalize(normalMat * normal);
    vec3 localPos = (position + normal * 0.04) * (1.0 + aHighlight * 0.08);
    vec4 worldPos = instanceMatrix * vec4(localPos, 1.0);

    // Pop-out: match main shader — radially away from tower center
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
  precision mediump float;  // mediump sufficient for glow color math

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

    // Owned blocks: steep energy falloff for bright glow
    float glowStrength = energy * energy * energy * energy;

    // Unclaimed blocks: very subtle ambient halo
    float isDead = step(energy, 0.01);
    float dormantGlow = isDead * 0.08;

    // Discard truly invisible fragments
    if (glowStrength < 0.2 && dormantGlow < 0.01) discard;

    // Glow color: blend owner color with warm gold for owned,
    // warm amber for unclaimed
    vec3 warmGold = vec3(1.0, 0.8, 0.3);
    vec3 dormantAmber = vec3(0.7, 0.4, 0.12);
    vec3 glowColor = mix(vOwnerColor, warmGold, 0.4) * 1.5;
    glowColor = mix(glowColor, dormantAmber, isDead);

    // Subtle pulse
    float pulse = 0.85 + 0.15 * sin(uTime * 2.0 + vOwnerColor.r * 10.0);
    // Slower, gentler pulse for dormant blocks
    float dormantPulse = 0.9 + 0.1 * sin(uTime * 0.5 + vOwnerColor.g * 8.0);
    pulse = mix(pulse, dormantPulse, isDead);

    float alpha = fresnel * max(glowStrength, dormantGlow) * pulse * 0.35;

    // Inspect mode: fade glow on non-selected, boost on selected
    alpha *= mix(0.15, 1.0, vFade); // stronger fade in night scene
    if (vHighlight > 0.01) {
      // Force glow visible on highlighted block even at moderate energy
      float hlGlow = max(glowStrength, 0.4);
      alpha += vHighlight * hlGlow * 0.8;
      glowColor *= 1.0 + vHighlight * 0.8;
    }

    gl_FragColor = vec4(glowColor * max(glowStrength, dormantGlow), alpha);
  }
`;

/**
 * Creates the additive glow material for the fake bloom pass.
 * Renders inflated block geometry with fresnel-based alpha.
 * Only high-energy blocks produce visible glow (cubic falloff).
 */
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
