import React, { useRef, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { View, StyleSheet, PanResponder, type GestureResponderEvent } from "react-native";
import * as THREE from "three";
import TowerGrid from "./TowerGrid";
import Particles from "./Particles";
import Foundation from "./Foundation";
import { useTowerStore } from "@/stores/tower-store";
import { LAYER_HEIGHT, DEFAULT_TOWER_CONFIG } from "@monolith/common";
import {
  hapticBlockSelect,
  hapticBlockDeselect,
  hapticZoomSnap,
  hapticReset,
  hapticLayerCross,
} from "@/utils/haptics";

// ─── Constants ────────────────────────────────────────────

const TOWER_CENTER_Y = (DEFAULT_TOWER_CONFIG.layerCount * LAYER_HEIGHT) / 2;
const TOWER_HEIGHT = DEFAULT_TOWER_CONFIG.layerCount * LAYER_HEIGHT;

// ─── Camera tuning ────────────────────────────────────────

/** Auto-rotate when idle — speed scales with zoom (slower when close) */
const IDLE_TIMEOUT = 4; // seconds before auto-rotate starts
const AUTO_ROTATE_SPEED = 0.0005;

/** Lerp rates — dual system for interactive vs programmatic motion */
const ORBIT_LERP = 0.18; // fast — snappy interactive orbit response
const ZOOM_LERP = 0.22; // faster — zoom should feel immediate and direct
const TRANSITION_LERP = 0.045; // slow — smooth fly-to / reset easing

/** Orbit sensitivity (radians per pixel of finger drag) */
const ORBIT_SENSITIVITY = 0.006;

/** Momentum: velocity-based inertia after finger lifts (orbit only) */
const MOMENTUM_FRICTION = 0.93; // per-frame decay (higher = longer coast)
const MOMENTUM_MIN_VEL = 0.00008; // stop threshold

/** Zoom range */
const ZOOM_MIN = 6;
const ZOOM_MAX = 55;

/** Zoom tier centers (for tier detection only — no magnetic snapping) */
const ZOOM_OVERVIEW = 40;
const ZOOM_NEIGHBORHOOD = 18;
const ZOOM_BLOCK = 8;



/** Elevation clamp (radians) */
const ELEVATION_MIN = 0.15;
const ELEVATION_MAX = 1.3;

/** Fixed camera state for overview / reset */
const OVERVIEW_ELEVATION = 0.65;
const OVERVIEW_AZIMUTH = Math.PI / 5;

/** Drag threshold — finger must move this far to count as drag, not tap */
const DRAG_THRESHOLD = 14;

/** Double-tap window (ms) */
const DOUBLE_TAP_WINDOW = 350;

/** Pinch cooldown — ignore single-finger orbit for this long after pinch ends */
const PINCH_COOLDOWN_MS = 100;

/** Transition completion threshold */
const TRANSITION_THRESHOLD = 0.5;

// ─── Types ────────────────────────────────────────────────

type ZoomTier = "overview" | "neighborhood" | "block";

function getZoomTier(zoom: number): ZoomTier {
  if (zoom >= 29) return "overview";
  if (zoom >= 13) return "neighborhood";
  return "block";
}

function getLayerFromY(y: number): number {
  return Math.round(
    Math.max(0, Math.min(y / LAYER_HEIGHT, DEFAULT_TOWER_CONFIG.layerCount - 1)),
  );
}



// ─── Camera State ─────────────────────────────────────────

interface CameraState {
  // Current (interpolated) values
  azimuth: number;
  elevation: number;
  zoom: number;
  lookAt: THREE.Vector3;

  // Target values (what we're lerping toward)
  targetAzimuth: number;
  targetElevation: number;
  targetZoom: number;
  targetLookAt: THREE.Vector3;

  // Momentum (orbit only — zoom is direct, no momentum)
  velocityAzimuth: number;
  velocityElevation: number;

  // State flags
  isTouching: boolean;
  isTransitioning: boolean; // true during fly-to-block / reset
}

// ─── SceneSetup ───────────────────────────────────────────

function SceneSetup() {
  const { scene } = useThree();
  useMemo(() => {
    scene.fog = new THREE.FogExp2(0x1a1008, 0.005);
  }, [scene]);
  return null;
}

// ─── CameraRig ────────────────────────────────────────────

/**
 * CameraRig — Per-frame camera update.
 *
 * - Dual lerp: fast for orbit, faster for zoom, slow for transitions
 * - Orbit momentum with friction decay
 * - Zoom is direct: sticks exactly where you leave it (no momentum, no magnetics)
 * - Auto-rotate when idle (scales with zoom level)
 */
function CameraRig({
  cameraState,
  lastTouchTime,
}: {
  cameraState: React.MutableRefObject<CameraState>;
  lastTouchTime: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  const selectedBlockId = useTowerStore((s) => s.selectedBlockId);
  const getDemoBlockById = useTowerStore((s) => s.getDemoBlockById);
  const setFocusedLayer = useTowerStore((s) => s.setFocusedLayer);
  const setZoomTier = useTowerStore((s) => s.setZoomTier);
  const prevSelectedRef = useRef<string | null>(null);
  const prevTierRef = useRef<ZoomTier>("overview");

  useFrame(() => {
    const cs = cameraState.current;
    const now = performance.now() / 1000;
    const idleTime = now - lastTouchTime.current;

    // ─── Fly to selected block ──────────────────
    if (selectedBlockId !== prevSelectedRef.current) {
      prevSelectedRef.current = selectedBlockId;

      if (selectedBlockId) {
        const block = getDemoBlockById(selectedBlockId);
        if (block) {
          cs.targetAzimuth = Math.atan2(block.position.x, block.position.z);
          cs.targetElevation = 0.55;
          cs.targetZoom = ZOOM_BLOCK;
          cs.targetLookAt.set(
            block.position.x,
            block.position.y,
            block.position.z,
          );
          cs.velocityAzimuth = 0;
          cs.velocityElevation = 0;
          cs.isTransitioning = true;
          hapticBlockSelect();
        }
      } else {
        // Deselect → smoothly return to full cinematic overview
        cs.targetZoom = ZOOM_OVERVIEW;
        cs.targetElevation = OVERVIEW_ELEVATION;
        cs.targetLookAt.set(0, TOWER_CENTER_Y, 0);
        cs.velocityAzimuth = 0;
        cs.velocityElevation = 0;
        cs.isTransitioning = true;
        hapticBlockDeselect();
      }
    }

    // ─── Check if transition is complete ────────
    if (cs.isTransitioning) {
      const zoomDelta = Math.abs(cs.zoom - cs.targetZoom);
      const lookDelta = cs.lookAt.distanceTo(cs.targetLookAt);
      if (zoomDelta < TRANSITION_THRESHOLD && lookDelta < TRANSITION_THRESHOLD) {
        cs.isTransitioning = false;
      }
    }

    // ─── Pick lerp rate ─────────────────────────
    const orbitLerp = cs.isTransitioning ? TRANSITION_LERP : ORBIT_LERP;
    const zoomLerp = cs.isTransitioning ? TRANSITION_LERP : ZOOM_LERP;

    // ─── Orbit momentum coasting (when finger lifted) ─
    if (!cs.isTouching && !cs.isTransitioning) {
      if (
        Math.abs(cs.velocityAzimuth) > MOMENTUM_MIN_VEL ||
        Math.abs(cs.velocityElevation) > MOMENTUM_MIN_VEL
      ) {
        cs.targetAzimuth += cs.velocityAzimuth;
        cs.targetElevation += cs.velocityElevation;
        cs.velocityAzimuth *= MOMENTUM_FRICTION;
        cs.velocityElevation *= MOMENTUM_FRICTION;

        cs.targetElevation = Math.max(
          ELEVATION_MIN,
          Math.min(ELEVATION_MAX, cs.targetElevation),
        );
      }
      // Zoom: no momentum, no magnetics — sticks where you left it
    }

    // ─── Auto-rotate when idle ──────────────
    const currentTier = getZoomTier(cs.zoom);
    if (idleTime > IDLE_TIMEOUT && !selectedBlockId && !cs.isTransitioning) {
      // Rotate slower when zoomed in
      const zoomFactor = cs.zoom / ZOOM_OVERVIEW;
      cs.targetAzimuth += AUTO_ROTATE_SPEED * zoomFactor;

      // Smoothly drift lookAt back toward tower center Y-axis
      // This ensures auto-rotate always orbits around the tower,
      // not around the last-selected block's position
      cs.targetLookAt.x += (0 - cs.targetLookAt.x) * 0.02;
      cs.targetLookAt.z += (0 - cs.targetLookAt.z) * 0.02;
      // Gently return Y to tower center too
      cs.targetLookAt.y += (TOWER_CENTER_Y - cs.targetLookAt.y) * 0.01;
    }

    // ─── Spring-damped interpolation ────────────
    cs.azimuth += (cs.targetAzimuth - cs.azimuth) * orbitLerp;
    cs.elevation += (cs.targetElevation - cs.elevation) * orbitLerp;
    cs.zoom += (cs.targetZoom - cs.zoom) * zoomLerp;
    cs.lookAt.lerp(cs.targetLookAt, orbitLerp);

    // Clamp
    cs.elevation = Math.max(ELEVATION_MIN, Math.min(ELEVATION_MAX, cs.elevation));
    cs.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cs.zoom));

    // ─── Spherical → Cartesian ──────────────────
    // NOTE: azimuth is NOT normalized — it grows unboundedly to prevent
    // jumps when wrapping past ±PI. Float64 handles this for years.
    // Only the local theta for trig is taken modulo 2PI.
    const r = cs.zoom;
    const theta = cs.azimuth;
    const phi = cs.elevation;

    camera.position.set(
      cs.lookAt.x + r * Math.sin(phi) * Math.sin(theta),
      cs.lookAt.y + r * Math.cos(phi),
      cs.lookAt.z + r * Math.sin(phi) * Math.cos(theta),
    );
    camera.lookAt(cs.lookAt);

    // ─── Push state for UI overlays ─────────────
    if (currentTier !== prevTierRef.current) {
      setZoomTier(currentTier);
      prevTierRef.current = currentTier;
    }
    setFocusedLayer(getLayerFromY(cs.lookAt.y));
  });

  return null;
}

// ─── GroundGrid ───────────────────────────────────────────

/**
 * GroundPlane — Styled rectangular liquid ground beneath the tower.
 * Dark and dimmed, with subtle animated caustic/liquid ripple effects.
 * Matches tower footprint but wider (2.5×), doesn't distract from the tower.
 */
function GroundPlane() {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const groundMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        uniform float uTime;

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
          vec2 center = vUv - 0.5;

          // Rectangular fade — stronger on the short edges, softer on long
          float fadeX = smoothstep(0.5, 0.3, abs(center.x));
          float fadeY = smoothstep(0.5, 0.3, abs(center.y));
          float rectFade = fadeX * fadeY;

          // Liquid caustic ripples (2 slow-moving octaves)
          vec2 uv1 = vWorldPos.xz * 0.12 + uTime * 0.03;
          vec2 uv2 = vWorldPos.xz * 0.2 - uTime * 0.02;
          float caustic1 = noise2D(uv1) * noise2D(uv1 * 1.5 + 50.0);
          float caustic2 = noise2D(uv2 + 100.0) * noise2D(uv2 * 1.3 + 150.0);
          float caustic = (caustic1 + caustic2) * 0.5;

          // Gentle ripple rings emanating from center
          float dist = length(center) * 8.0;
          float ripple = sin(dist - uTime * 0.5) * 0.5 + 0.5;
          ripple *= smoothstep(0.5, 0.15, length(center));
          ripple *= 0.12;

          // Base color: very dark warm, subtle golden tint near center
          vec3 darkBase = vec3(0.04, 0.03, 0.02);
          vec3 warmCenter = vec3(0.10, 0.07, 0.03);
          vec3 color = mix(warmCenter, darkBase, smoothstep(0.0, 0.4, length(center)));

          // Add caustic light with golden tint
          vec3 causticColor = vec3(0.20, 0.14, 0.05);
          color += causticColor * caustic * 0.4;
          color += vec3(0.12, 0.08, 0.03) * ripple;

          // Overall dimness
          float alpha = rectFade * 0.7;

          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
  }, []);

  // Animate liquid
  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.5, 0]}
      ref={(mesh) => {
        if (mesh) matRef.current = mesh.material as THREE.ShaderMaterial;
      }}
      material={groundMaterial}
    >
      <planeGeometry args={[40, 40]} />
    </mesh>
  );
}

// ─── Pinch distance helper ────────────────────────────────

function getPinchDistance(evt: GestureResponderEvent): number | null {
  const touches = evt.nativeEvent.touches;
  if (!touches || touches.length < 2) return null;
  const dx = touches[1].pageX - touches[0].pageX;
  const dy = touches[1].pageY - touches[0].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── BackgroundPlane (tap-to-deselect) ────────────────────

/**
 * Invisible sphere that catches taps on empty space.
 * TowerGrid's onClick uses event.stopPropagation(), so block taps
 * never reach this mesh. Only taps on empty space arrive here → deselect.
 */
function BackgroundPlane() {
  const selectBlock = useTowerStore((s) => s.selectBlock);
  const selectedBlockId = useTowerStore((s) => s.selectedBlockId);

  const handleClick = useCallback(() => {
    if (selectedBlockId) {
      selectBlock(null);
    }
  }, [selectedBlockId, selectBlock]);

  return (
    <mesh onClick={handleClick} visible={false}>
      <sphereGeometry args={[200, 8, 8]} />
      <meshBasicMaterial side={THREE.BackSide} />
    </mesh>
  );
}

/**
 * Golden Hour Skybox — Stunning procedural sky with atmospheric effects.
 *
 * Features:
 * - Sun disk with warm corona bloom at horizon
 * - Atmospheric scattering gradient (golden hour palette)
 * - Procedural cloud wisps lit from below by golden light
 * - Radial god rays from sun position
 * - Twinkling warm starfield in upper hemisphere
 *
 * Performance: Single draw call, all computation in fragment shader.
 * No textures needed — runs perfectly in React Native.
 */
function GoldenSkybox() {
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

        // ─── Noise functions for clouds ───────────────
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

        float fbm(vec2 p) {
          float val = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 3; i++) {
            val += amp * noise2D(p);
            p *= 2.1;
            amp *= 0.5;
          }
          return val;
        }

        // ─── Star hash ───────────────────────────────
        float hash3D(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        void main() {
          vec3 dir = normalize(vWorldPosition);

          // ─── Smooth latitude mapping ───────────────
          // Use atan2 for Y vs XZ-plane to avoid acos pole singularity
          float elevation = atan(dir.y, length(dir.xz));
          // Map: +PI/2 (zenith) → 0, 0 (horizon) → 0.5, -PI/2 (nadir) → 1
          float lat = 0.5 - elevation / 3.14159265;
          float aboveHorizon = smoothstep(0.52, 0.48, lat);
          float azimuth = atan(dir.x, dir.z);

          // ─── Sun position (low on horizon for dramatic golden hour) ──
          vec3 sunDir = normalize(vec3(0.3, 0.06, -1.0));
          float sunAngle = max(dot(dir, sunDir), 0.0);

          // ─── Sky gradient — richer golden sunset ───
          vec3 zenithColor    = vec3(0.05, 0.035, 0.025);     // deep dark (more contrast)
          vec3 upperSky       = vec3(0.15, 0.09, 0.04);       // dark warm
          vec3 midSky         = vec3(0.50, 0.28, 0.10);       // deep copper
          vec3 horizonPeak    = vec3(1.2, 0.78, 0.30);        // intense warm gold (HDR)
          vec3 horizonGlow    = vec3(1.0, 0.60, 0.20);        // rich golden glow
          vec3 horizonBand    = vec3(0.65, 0.35, 0.10);       // deep amber band
          vec3 horizonWarm    = vec3(0.30, 0.15, 0.05);       // rich dark amber
          vec3 belowHorizon   = vec3(0.10, 0.06, 0.03);       // warm dark below
          vec3 nadirColor     = vec3(0.03, 0.02, 0.012);      // deepest bottom

          // Smooth multi-stop gradient with wider, more dramatic horizon band
          vec3 skyColor;
          if (lat < 0.06) {
            skyColor = mix(zenithColor, upperSky, lat / 0.06);
          } else if (lat < 0.18) {
            skyColor = mix(upperSky, midSky, (lat - 0.06) / 0.12);
          } else if (lat < 0.32) {
            skyColor = mix(midSky, horizonPeak, (lat - 0.18) / 0.14);
          } else if (lat < 0.42) {
            // Near horizon — brightest, widest glow
            skyColor = mix(horizonPeak, horizonGlow, (lat - 0.32) / 0.10);
          } else if (lat < 0.50) {
            skyColor = mix(horizonGlow, horizonBand, (lat - 0.42) / 0.08);
          } else if (lat < 0.58) {
            // Below horizon — amber falloff
            skyColor = mix(horizonBand, horizonWarm, (lat - 0.50) / 0.08);
          } else if (lat < 0.72) {
            skyColor = mix(horizonWarm, belowHorizon, (lat - 0.58) / 0.14);
          } else {
            skyColor = mix(belowHorizon, nadirColor, (lat - 0.72) / 0.28);
          }

          // ─── Sun disk + corona (richer) ────────────
          float sunDisk = pow(sunAngle, 500.0) * 3.5;
          vec3 sunColor = vec3(1.0, 0.92, 0.55);

          float corona = pow(sunAngle, 6.0) * 0.9;
          vec3 coronaColor = vec3(1.0, 0.6, 0.18);

          float atmoGlow = pow(sunAngle, 2.0) * 0.45;
          vec3 atmoColor = vec3(0.95, 0.5, 0.12);

          // ─── God rays (2 octaves, above horizon) ───
          float rayAngle = atan(dir.x - sunDir.x, dir.z - sunDir.z);
          float rays = 0.0;
          for (float i = 1.0; i <= 2.0; i += 1.0) {
            float freq = 6.0 * i;
            float ray = pow(max(sin(rayAngle * freq + uTime * 0.05 * i), 0.0), 12.0);
            ray *= pow(sunAngle, 3.0) * (0.18 / i);
            rays += ray;
          }
          vec3 rayColor = vec3(1.0, 0.7, 0.25) * rays * aboveHorizon;

          // ─── Procedural clouds (richer, more visible) ──
          vec2 cloudUV = vec2(azimuth * 1.5, lat * 6.0);
          cloudUV += uTime * 0.008;

          float cloudNoise = fbm(cloudUV * 1.5);
          float cloudMask = smoothstep(0.08, 0.22, lat) * smoothstep(0.52, 0.28, lat);
          float clouds = smoothstep(0.30, 0.65, cloudNoise) * cloudMask * 0.8;

          // Cloud color: golden-lit from below
          vec3 cloudLitColor = mix(
            vec3(0.55, 0.30, 0.10),
            vec3(1.0, 0.72, 0.28),
            pow(sunAngle, 1.5) * 0.5 + 0.5
          );

          // ─── Stars (upper sky only) ────────────────
          vec3 starContrib = vec3(0.0);
          if (lat < 0.25) {
            vec3 starPos = dir * 80.0;
            float starVal = hash3D(floor(starPos));
            if (starVal > 0.997) {
              float twinkle = 0.5 + 0.5 * sin(uTime * 2.5 + starVal * 80.0);
              float brightness = (starVal - 0.997) * 333.0 * twinkle;
              float starFade = smoothstep(0.25, 0.10, lat);
              starContrib = vec3(1.0, 0.88, 0.55) * brightness * starFade;
            }
          }

          // ─── Combine everything ────────────────────
          vec3 color = skyColor;

          // Sun + corona + atmospheric glow
          float sunVis = smoothstep(0.58, 0.46, lat);
          color += sunColor * sunDisk * sunVis;
          color += coronaColor * corona * sunVis;
          color += atmoColor * atmoGlow * sunVis;

          // God rays
          color += rayColor;

          // Blend clouds
          color = mix(color, cloudLitColor, clouds);

          // Stars
          color += starContrib * (1.0 - clouds);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
  }, []);

  // Animate
  useFrame((_, delta) => {
    if (skyMaterial.uniforms.uTime) {
      skyMaterial.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh material={skyMaterial}>
      <sphereGeometry args={[800, 64, 48]} />
    </mesh>
  );
}

// ─── TowerScene ───────────────────────────────────────────

/**
 * TowerScene — Main R3F Canvas with gesture-driven camera.
 *
 * GESTURE ARCHITECTURE:
 * - PanResponder only captures on MOVE (not start) → taps pass to R3F Canvas
 * - Zoom is direct — sticks exactly where you leave it, no drift
 * - Dual lerp: fast for orbit, faster for zoom, smooth eased for fly-to/reset
 * - Orbit momentum with friction for tactile spin
 * - Double-tap to reset (via delayed timer, doesn't block block taps)
 * - Tap empty space to deselect selected block
 */
export default function TowerScene() {
  const cameraState = useRef<CameraState>({
    azimuth: OVERVIEW_AZIMUTH,
    elevation: OVERVIEW_ELEVATION,
    zoom: ZOOM_OVERVIEW,
    targetAzimuth: OVERVIEW_AZIMUTH,
    targetElevation: OVERVIEW_ELEVATION,
    targetZoom: ZOOM_OVERVIEW,
    lookAt: new THREE.Vector3(0, TOWER_CENTER_Y, 0),
    targetLookAt: new THREE.Vector3(0, TOWER_CENTER_Y, 0),
    velocityAzimuth: 0,
    velocityElevation: 0,
    isTouching: false,
    isTransitioning: false,
  });

  const lastTouchTime = useRef(performance.now() / 1000);

  // Touch tracking
  const prevTouch = useRef({ x: 0, y: 0 });
  const prevLayerRef = useRef(getLayerFromY(TOWER_CENTER_Y));
  const prevZoomTierRef = useRef<ZoomTier>("overview");

  // Pinch state
  const isPinching = useRef(false);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(ZOOM_OVERVIEW);
  const pinchCooldownTime = useRef(0);

  // Drag tracking (to distinguish taps from drags)
  const isDragging = useRef(false);

  // Double-tap state (timer-based so it doesn't block block taps)
  const lastTapTime = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectBlock = useTowerStore((s) => s.selectBlock);
  const setGestureActive = useTowerStore((s) => s.setGestureActive);

  // Reset camera to overview
  const resetCamera = useCallback(() => {
    const cs = cameraState.current;
    cs.targetAzimuth = OVERVIEW_AZIMUTH;
    cs.targetElevation = OVERVIEW_ELEVATION;
    cs.targetZoom = ZOOM_OVERVIEW;
    cs.targetLookAt.set(0, TOWER_CENTER_Y, 0);
    cs.velocityAzimuth = 0;
    cs.velocityElevation = 0;
    cs.isTransitioning = true;
    selectBlock(null);
    hapticReset();
  }, [selectBlock]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Don't capture taps — let them through to R3F for block raycasting
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => {
          // Capture only when finger has moved enough to be a drag
          // OR when there are 2+ fingers (pinch)
          return (
            Math.abs(gesture.dx) > DRAG_THRESHOLD ||
            Math.abs(gesture.dy) > DRAG_THRESHOLD ||
            (gesture.numberActiveTouches >= 2)
          );
        },

        onPanResponderGrant: (evt) => {
          const { pageX, pageY } = evt.nativeEvent;
          prevTouch.current = { x: pageX, y: pageY };
          cameraState.current.isTouching = true;
          cameraState.current.isTransitioning = false;
          isDragging.current = true;
          setGestureActive(true);
          // Kill orbit momentum on new touch
          cameraState.current.velocityAzimuth = 0;
          cameraState.current.velocityElevation = 0;
          lastTouchTime.current = performance.now() / 1000;
        },

        onPanResponderMove: (evt) => {
          lastTouchTime.current = performance.now() / 1000;

          // ─── Pinch zoom ─────────────────────────
          const pinchDist = getPinchDistance(evt);
          if (pinchDist !== null) {
            if (!isPinching.current) {
              isPinching.current = true;
              pinchStartDist.current = pinchDist;
              pinchStartZoom.current = cameraState.current.zoom;
              return;
            }
            const scale = pinchDist / pinchStartDist.current;
            const raw = pinchStartZoom.current / scale;
            cameraState.current.targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, raw));
            // No velocity tracking — zoom sticks exactly where you leave it

            // Haptic on tier crossing during pinch
            const newTier = getZoomTier(cameraState.current.targetZoom);
            if (newTier !== prevZoomTierRef.current) {
              hapticZoomSnap();
              prevZoomTierRef.current = newTier;
            }
            return;
          }

          // ─── Single finger orbit ────────────────
          if (isPinching.current) return;
          // Ignore leftover finger after pinch release (prevents ghost orbit)
          if (performance.now() - pinchCooldownTime.current < PINCH_COOLDOWN_MS) return;

          const { pageX, pageY } = evt.nativeEvent;
          const cs = cameraState.current;

          const dx = pageX - prevTouch.current.x;
          const dy = pageY - prevTouch.current.y;
          prevTouch.current = { x: pageX, y: pageY };

          const vAz = -dx * ORBIT_SENSITIVITY;
          const vEl = -dy * ORBIT_SENSITIVITY;

          cs.targetAzimuth += vAz;
          cs.targetElevation += vEl;
          cs.velocityAzimuth = vAz;
          cs.velocityElevation = vEl;

          cs.targetElevation = Math.max(
            ELEVATION_MIN,
            Math.min(ELEVATION_MAX, cs.targetElevation),
          );

          // Layer crossing haptic
          const currentLayer = getLayerFromY(cs.targetLookAt.y);
          if (currentLayer !== prevLayerRef.current) {
            hapticLayerCross();
            prevLayerRef.current = currentLayer;
          }
        },

        onPanResponderRelease: () => {
          cameraState.current.isTouching = false;
          // NOTE: isDragging stays true until next handleTouchStart.
          // This prevents onTouchEnd from triggering double-tap after drag/pinch.
          // Safety timeout: clear gesture active after a brief delay
          // to prevent stuck state if release event is missed
          setTimeout(() => setGestureActive(false), 50);

          if (isPinching.current) {
            isPinching.current = false;
            pinchCooldownTime.current = performance.now();
            // Zoom sticks — no snap, no momentum, no magnetics.
          }
          // Momentum continues via CameraRig useFrame
        },
      }),
    [selectBlock, resetCamera],
  );

  // ─── Touch handlers (double-tap + tap-to-deselect) ──────
  // Uses onTouchEnd with drag guard so drags never trigger double-tap.
  // onTouchStart only records time; actual logic runs at touch end.
  const handleTouchStart = useCallback(() => {
    // Mark that we haven't dragged yet for this touch
    isDragging.current = false;
  }, []);

  const handleTouchEnd = useCallback(() => {
    // Skip if this touch was a drag (PanResponder handled it)
    if (isDragging.current) return;

    const now = Date.now();

    if (now - lastTapTime.current < DOUBLE_TAP_WINDOW) {
      // Double-tap detected — reset camera
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      lastTapTime.current = 0;
      resetCamera();
    } else {
      lastTapTime.current = now;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
      }, DOUBLE_TAP_WINDOW);
    }
  }, [resetCamera]);

  return (
    <View
      style={styles.container}
      {...panResponder.panHandlers}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Canvas
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
        }}
        camera={{ position: [0, TOWER_CENTER_Y, ZOOM_OVERVIEW], fov: 50 }}
      >
        <SceneSetup />
        <CameraRig
          cameraState={cameraState}
          lastTouchTime={lastTouchTime}
        />

        {/* ─── Lighting (warm golden radiance, optimized) ── */}
        <ambientLight intensity={0.45} color="#FFE8C0" />
        {/* Hemisphere: golden sky + warm earth fill — replaces multiple fill lights */}
        <hemisphereLight args={['#FFD080', '#3D2010', 0.5]} />
        {/* Main key light */}
        <directionalLight position={[12, 30, 8]} intensity={1.4} color="#FFF0D0" />
        {/* Warm fill from side */}
        <directionalLight position={[-15, 15, -5]} intensity={0.5} color="#D4A050" />
        {/* Spire crown glow */}
        <pointLight
          position={[0, TOWER_HEIGHT - 2, 0]}
          intensity={2.0}
          color="#FFD700"
          distance={18}
          decay={1.5}
        />

        {/* ─── Scene Content ────────────────────────── */}
        <GoldenSkybox />
        <BackgroundPlane />
        <TowerGrid />
        <Particles />
        <Foundation />
        <GroundPlane />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0804",
  },
});
