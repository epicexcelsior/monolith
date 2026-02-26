import React, { useRef, useMemo, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { View, StyleSheet, PanResponder, type GestureResponderEvent } from "react-native";
import * as THREE from "three";
import TowerGrid from "./TowerGrid";
import Particles from "./Particles";
import { ClaimVFX } from "./ClaimVFX";
import { useTowerReveal } from "@/hooks/useTowerReveal";

/**
 * ConditionalClaimVFX — Mounts the particle celebration only while active.
 *
 * PERF: ClaimVFX allocates 730 GPU instances across 7 InstancedMesh draw calls.
 * Transparent blended objects have no early-Z rejection on mobile — they burn
 * fill-rate every frame even when invisible. Mounting only during celebrations
 * (cinematicMode = true, ~5.5s) keeps the idle scene at budget (80 particles).
 *
 * Timing safety: celebrationRef is set BEFORE setCinematicMode(true) fires in
 * useClaimCelebration, so the ref is already populated when this mounts.
 */
function ConditionalClaimVFX() {
  const cinematicMode = useTowerStore((s) => s.cinematicMode);
  return cinematicMode ? <ClaimVFX /> : null;
}
import Foundation from "./Foundation";
import { useTowerStore } from "@/stores/tower-store";
import { LAYER_HEIGHT, DEFAULT_TOWER_CONFIG, getTowerHeight, getLayerY } from "@monolith/common";
import { CAMERA_CONFIG, getZoomMode } from "@/constants/CameraConfig";
import {
  hapticBlockSelect,
  hapticBlockDeselect,
  hapticZoomSnap,
  hapticReset,
  hapticLayerCross,
} from "@/utils/haptics";
import { playBlockSelect, playBlockDeselect } from "@/utils/audio";
import { CLAIM_SHAKE, CLAIM_PHASES, CLAIM_CAMERA, CLAIM_IMPACT_OFFSET_SECS } from "@/constants/ClaimEffectConfig";

// ─── Constants ────────────────────────────────────────────

const TOWER_HEIGHT = getTowerHeight(DEFAULT_TOWER_CONFIG.layerCount);
const TOWER_CENTER_Y = TOWER_HEIGHT / 2;
const OVERVIEW_LOOKAT_Y = TOWER_HEIGHT * CAMERA_CONFIG.overview.lookAtY;
// ≈ 12.2 instead of 13.6 — shifts viewport down ~5 units so foundation is visible

// ─── Camera Configuration (see CameraConfig.ts for all tunable parameters) ───
// All camera parameters are now centralized in CAMERA_CONFIG for easy iteration
const IDLE_TIMEOUT = CAMERA_CONFIG.idle.timeoutSeconds;
const AUTO_ROTATE_SPEED = CAMERA_CONFIG.idle.rotateSpeed;

const ORBIT_LERP = CAMERA_CONFIG.lerp.orbit;
const ZOOM_LERP = CAMERA_CONFIG.lerp.zoom;
const TRANSITION_LERP = CAMERA_CONFIG.lerp.transition;

const ORBIT_SENSITIVITY = CAMERA_CONFIG.gesture.orbitSensitivity;

const MOMENTUM_FRICTION = CAMERA_CONFIG.physics.momentumFriction;
const MOMENTUM_MIN_VEL = CAMERA_CONFIG.physics.momentumMinVelocity;

const ZOOM_MIN = CAMERA_CONFIG.zoom.min;
const ZOOM_MAX = CAMERA_CONFIG.zoom.max;

const ZOOM_OVERVIEW = CAMERA_CONFIG.zoom.overview;
const ZOOM_NEIGHBORHOOD = CAMERA_CONFIG.zoom.neighborhood;
const ZOOM_BLOCK = CAMERA_CONFIG.zoom.block;

const PAN_Y_SENSITIVITY = CAMERA_CONFIG.gesture.panYSensitivity;
const LOOKAT_Y_MIN = CAMERA_CONFIG.overview.yFloor;
const LOOKAT_Y_MAX = TOWER_HEIGHT; // Computed from tower height
const LOOKAT_Y_OVERSCROLL = CAMERA_CONFIG.physics.lookAtYOverscroll;
const ELASTIC_SPRING = CAMERA_CONFIG.physics.elasticSpring;

const ELEVATION_MIN = CAMERA_CONFIG.elevation.min;
const ELEVATION_MAX = CAMERA_CONFIG.elevation.max;

const CAMERA_NEAR = CAMERA_CONFIG.frustum.near;
const CAMERA_FAR = CAMERA_CONFIG.frustum.far;

const OVERVIEW_ELEVATION = CAMERA_CONFIG.elevation.overview;
const BLOCK_ELEVATION = CAMERA_CONFIG.elevation.block;
const OVERVIEW_AZIMUTH = CAMERA_CONFIG.overview.azimuth;

const DRAG_THRESHOLD = CAMERA_CONFIG.gesture.dragThreshold;
const DOUBLE_TAP_WINDOW = CAMERA_CONFIG.gesture.doubleTapWindowMs;
const PINCH_COOLDOWN_MS = CAMERA_CONFIG.gesture.pinchCooldownMs;

const TRANSITION_THRESHOLD = CAMERA_CONFIG.transition.completionThreshold;

// ─── Types ────────────────────────────────────────────────

type ZoomTier = "overview" | "neighborhood" | "block";

function getZoomTier(zoom: number): ZoomTier {
  return getZoomMode(zoom);
}

function getLayerFromY(y: number): number {
  // Binary search through layer Y positions for accurate mapping
  const totalLayers = DEFAULT_TOWER_CONFIG.layerCount;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < totalLayers; i++) {
    const layerY = getLayerY(i, totalLayers);
    const dist = Math.abs(y - layerY);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/**
 * Normalizes a target azimuth to be within ±PI of the current azimuth.
 * Prevents the camera from spinning multiple revolutions on reset/fly-to.
 */
function nearestAzimuth(current: number, target: number): number {
  const TWO_PI = Math.PI * 2;
  let diff = target - current;
  diff = diff - Math.round(diff / TWO_PI) * TWO_PI;
  return current + diff;
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

  // Momentum
  velocityAzimuth: number;
  velocityElevation: number;
  velocityLookAtY: number;

  // State flags
  isTouching: boolean;
  isTransitioning: boolean; // true during fly-to-block / reset
}

// ─── SceneSetup ───────────────────────────────────────────

function SceneSetup() {
  const { scene } = useThree();
  useMemo(() => {
    scene.fog = null; // No fog — night darkness + lighting falloff provide depth cues
  }, [scene]);
  return null;
}

// ─── CameraRig ────────────────────────────────────────────

/**
 * CameraRig — Per-frame camera update.
 *
 * - Dual lerp: fast for orbit, faster for zoom, slow for transitions
 * - Orbit momentum with friction decay
 * - lookAt.y momentum for vertical pan coasting
 * - Elastic overscroll bounce-back on lookAt.y bounds
 * - Dynamic near plane based on zoom distance
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
  const claimCelebrationRef = useTowerStore((s) => s.claimCelebrationRef);
  const prevSelectedRef = useRef<string | null>(null);
  const prevTierRef = useRef<ZoomTier>("overview");
  const prevLayerRef = useRef<number>(-1);
  const prevNearRef = useRef<number>(0);
  const shakeRef = useRef<{ startTime: number; active: boolean; magnitude: number; duration: number; decay: number }>({
    startTime: 0, active: false, magnitude: 0, duration: 0, decay: 0,
  });
  const shakeTriggeredForRef = useRef<number>(0);
  // Camera orbit during celebration
  const celebCameraRef = useRef<{
    orbiting: boolean;
    zoomedOut: boolean;  // zoom-out phase (before impact)
    zoomedIn: boolean;   // zoom-in phase (after shockwave)
    preZoom: number;     // user's zoom level before celebration
    triggeredForStartTime: number;
    glowUpTriggered: boolean;
  }>({ orbiting: false, zoomedOut: false, zoomedIn: false, preZoom: 0, triggeredForStartTime: -1, glowUpTriggered: false });

  useFrame(() => {
    const cs = cameraState.current;
    const now = performance.now() / 1000;
    const idleTime = now - lastTouchTime.current;

    // ─── Fly to selected block ──────────────────
    // NOTE: Depends on DemoBlock.position being pre-computed at store boundaries
    // (not {0,0,0}). In local mode, seed-tower.ts computes positions. In multiplayer mode,
    // serverBlockToDemo() uses a position cache computed from @monolith/common layout functions.
    // Do NOT omit positions or set them to origin — this breaks camera navigation!
    if (selectedBlockId !== prevSelectedRef.current) {
      prevSelectedRef.current = selectedBlockId;

      if (selectedBlockId) {
        const block = getDemoBlockById(selectedBlockId);
        if (block) {
          // Compute pop-out offset (radial from tower Y-axis)
          const POP_DIST = CAMERA_CONFIG.inspect.popDistance;
          const bx = block.position.x;
          const bz = block.position.z;
          const len = Math.sqrt(bx * bx + bz * bz);
          let popX = 0, popY = 0, popZ = 0;
          if (len < 0.01) {
            popY = POP_DIST; // pinnacle pops up
          } else {
            popX = (bx / len) * POP_DIST;
            popZ = (bz / len) * POP_DIST;
          }

          const targetX = bx + popX;
          const targetZ = bz + popZ;
          cs.targetAzimuth = nearestAzimuth(cs.azimuth, Math.atan2(targetX, targetZ));
          cs.targetElevation = BLOCK_ELEVATION;
          cs.targetZoom = ZOOM_BLOCK;
          cs.targetLookAt.set(
            targetX,
            block.position.y + popY,
            targetZ,
          );
          cs.velocityAzimuth = 0;
          cs.velocityElevation = 0;
          cs.velocityLookAtY = 0;
          cs.isTransitioning = true;
          hapticBlockSelect();
          playBlockSelect();
        }
      } else {
        // Deselect → smoothly return to full cinematic overview
        cs.targetZoom = ZOOM_OVERVIEW;
        cs.targetElevation = OVERVIEW_ELEVATION;
        cs.targetLookAt.set(0, OVERVIEW_LOOKAT_Y, 0);
        cs.velocityAzimuth = 0;
        cs.velocityElevation = 0;
        cs.velocityLookAtY = 0;
        cs.isTransitioning = true;
        hapticBlockDeselect();
        playBlockDeselect();
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

      // lookAt.y momentum (vertical pan coasting)
      if (Math.abs(cs.velocityLookAtY) > MOMENTUM_MIN_VEL) {
        cs.targetLookAt.y += cs.velocityLookAtY;
        cs.velocityLookAtY *= MOMENTUM_FRICTION;
      }
    }

    // ─── Elastic overscroll bounce-back ──────────
    if (!cs.isTouching) {
      if (cs.targetLookAt.y < LOOKAT_Y_MIN) {
        cs.targetLookAt.y += (LOOKAT_Y_MIN - cs.targetLookAt.y) * ELASTIC_SPRING;
        cs.velocityLookAtY = 0;
      } else if (cs.targetLookAt.y > LOOKAT_Y_MAX) {
        cs.targetLookAt.y += (LOOKAT_Y_MAX - cs.targetLookAt.y) * ELASTIC_SPRING;
        cs.velocityLookAtY = 0;
      }
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
      cs.targetLookAt.y += (OVERVIEW_LOOKAT_Y - cs.targetLookAt.y) * 0.01;
    }

    // ─── Spring-damped interpolation ────────────
    cs.azimuth += (cs.targetAzimuth - cs.azimuth) * orbitLerp;
    cs.elevation += (cs.targetElevation - cs.elevation) * orbitLerp;
    cs.zoom += (cs.targetZoom - cs.zoom) * zoomLerp;
    cs.lookAt.lerp(cs.targetLookAt, orbitLerp);

    // Clamp
    cs.elevation = Math.max(ELEVATION_MIN, Math.min(ELEVATION_MAX, cs.elevation));
    cs.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cs.zoom));

    // Clamp lookAt.y — prevent looking far outside the tower
    cs.lookAt.y = Math.max(
      LOOKAT_Y_MIN - LOOKAT_Y_OVERSCROLL,
      Math.min(LOOKAT_Y_MAX + LOOKAT_Y_OVERSCROLL, cs.lookAt.y),
    );

    // ─── Spherical → Cartesian ──────────────────
    // NOTE: azimuth is NOT normalized — it grows unboundedly to prevent
    // jumps when wrapping past ±PI. Float64 handles this for years.
    // Only the local theta for trig is taken modulo 2PI.
    const r = cs.zoom;
    const theta = cs.azimuth;
    const phi = cs.elevation;

    let camY = cs.lookAt.y + r * Math.cos(phi);
    // Prevent camera from going below ground
    if (camY < 0.5) camY = 0.5;

    camera.position.set(
      cs.lookAt.x + r * Math.sin(phi) * Math.sin(theta),
      camY,
      cs.lookAt.z + r * Math.sin(phi) * Math.cos(theta),
    );
    camera.lookAt(cs.lookAt);

    // ─── Claim celebration: buildup → shake → orbit → zoom-back → glow-up ──
    if (claimCelebrationRef?.current) {
      const cel = claimCelebrationRef.current;
      if (cel.active) {
        const elapsed = now - cel.startTime;
        const cc = celebCameraRef.current;

        // ── BUILDUP PHASE (0 → impact): escalate shake magnitude 0.1→0.4 ──
        if (elapsed < CLAIM_IMPACT_OFFSET_SECS && elapsed > 0) {
          const buildupT = elapsed / CLAIM_IMPACT_OFFSET_SECS;
          const buildupMag = 0.1 + buildupT * 0.3; // 0.1 → 0.4
          // Continuous low-frequency rumble (overwrite each frame)
          shakeRef.current = {
            startTime: now - 0.01, // keep it "just started" to prevent decay
            active: true,
            magnitude: buildupMag,
            duration: 0.1, // short — refreshed every frame
            decay: 0, // no decay during buildup
          };
        }

        // ── AT IMPACT: main shake + zoom OUT + orbit all fire together ──
        if (elapsed >= CLAIM_IMPACT_OFFSET_SECS && shakeTriggeredForRef.current !== cel.startTime) {
          cc.triggeredForStartTime = cel.startTime;
          cc.preZoom = cs.zoom;
          cc.zoomedOut = true;
          cc.zoomedIn = false;
          cc.orbiting = true;
          cc.glowUpTriggered = false;
          // Pull back to show full tower + expanding shockwave ring
          cs.targetZoom = Math.min(ZOOM_MAX, cs.zoom * CLAIM_CAMERA.zoomOutFactor);
          cs.isTransitioning = true;
          // Main impact shake
          shakeRef.current = {
            startTime: now,
            active: true,
            magnitude: CLAIM_SHAKE.magnitude,
            duration: CLAIM_SHAKE.duration,
            decay: CLAIM_SHAKE.decay,
          };
          shakeTriggeredForRef.current = cel.startTime;
        }

        // ── Slow orbit during celebration (stop at ZOOM_RETURN_DELAY) ──
        if (cc.orbiting && elapsed > CLAIM_IMPACT_OFFSET_SECS && elapsed < CLAIM_CAMERA.zoomReturnDelay) {
          cs.targetAzimuth += CLAIM_CAMERA.orbitSpeed;
        }

        // ── Phase 3: Zoom IN after shockwave peaks ────────────────
        const zoomInAt = CLAIM_IMPACT_OFFSET_SECS + CLAIM_CAMERA.zoomInDelay;
        if (elapsed >= zoomInAt && cc.zoomedOut && !cc.zoomedIn) {
          cc.zoomedOut = false;
          cc.zoomedIn = true;
          cs.targetZoom = Math.max(ZOOM_MIN, cc.preZoom * CLAIM_CAMERA.zoomInFactor);
          cs.isTransitioning = true;
        }

        // ── Stop orbit + restore zoom at ZOOM_RETURN_DELAY ──────
        if (elapsed >= CLAIM_CAMERA.zoomReturnDelay) {
          cc.orbiting = false;
          if (cc.zoomedIn) {
            cc.zoomedIn = false;
            cs.targetZoom = cc.preZoom;
            cs.isTransitioning = true;
          }
        }

        // ── Trigger glow-up after zoom-back is mostly complete ──
        const glowUpAt = CLAIM_CAMERA.zoomReturnDelay + 1.0;
        if (elapsed >= glowUpAt && !cc.glowUpTriggered) {
          cc.glowUpTriggered = true;
          if (cel.blockId) {
            useTowerStore.getState().setGlowUpBlockId(cel.blockId);
          }
        }
      }
    }

    // Apply shake offset — multi-axis decaying oscillation
    if (shakeRef.current.active) {
      const shakeElapsed = now - shakeRef.current.startTime;
      const { magnitude, duration, decay } = shakeRef.current;
      if (shakeElapsed < duration) {
        const d = Math.exp(-decay * shakeElapsed);
        const mag = magnitude * d;
        const freq = CLAIM_SHAKE.frequency;
        const t = shakeElapsed * freq * 6.2832;
        // 3-axis shake with different frequencies for organic feel
        camera.position.x += Math.sin(t) * mag;
        camera.position.y += Math.cos(t * 1.3) * mag * 0.8;
        camera.position.z += Math.sin(t * 0.7 + 2.0) * mag * 0.5;
      } else {
        shakeRef.current.active = false;
      }
    }

    // Dynamic near plane: tighter when zoomed in for close detail,
    // relaxed when zoomed out to avoid z-fighting
    const newNear = Math.max(CAMERA_NEAR, cs.zoom * CAMERA_CONFIG.nearPlaneScale);
    if (Math.abs(newNear - prevNearRef.current) > 0.01) {
      camera.near = newNear;
      camera.far = CAMERA_FAR;
      camera.updateProjectionMatrix();
      prevNearRef.current = newNear;
    }

    // ─── Push state for UI overlays ─────────────
    if (currentTier !== prevTierRef.current) {
      setZoomTier(currentTier);
      prevTierRef.current = currentTier;
    }
    const currentLayer = getLayerFromY(cs.lookAt.y);
    if (currentLayer !== prevLayerRef.current) {
      setFocusedLayer(currentLayer);
      prevLayerRef.current = currentLayer;
    }
  });

  return null;
}

// ─── GroundGrid ───────────────────────────────────────────

/**
 * GroundPlane — Polished stone ground with concentric rings.
 * Creates a visible surface the foundation sits on, plus a warm light pool.
 * Positioned at foundation bottom so the tower doesn't float.
 */
/**
 * TowerRevealController — Hosts the useTowerReveal hook inside Canvas context.
 * Drives reveal progress and camera sweep. Disables during later use.
 */
function TowerRevealController({
  cameraState,
  lastTouchTime,
}: {
  cameraState: React.MutableRefObject<CameraState>;
  lastTouchTime: React.MutableRefObject<number>;
}) {
  useTowerReveal(cameraState, lastTouchTime);
  return null;
}

function GroundPlane() {
  // Foundation: 4 tiers (1.0 + 1.4 + 1.8 + 1.2 = 5.4) starting at y=-0.5
  const FOUNDATION_BOTTOM = -5.9;

  // Solid ground with carved concentric rings — matches circular foundation
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

          // ─── Base stone color with subtle noise ──
          vec2 noiseUV = vUv * 8.0;
          float noise = hash21(floor(noiseUV)) * 0.08;
          vec3 stoneColor = vec3(0.14, 0.11, 0.08) + noise;

          // ─── Concentric ring grooves (carved stone circles) ──
          float ringFreq = dist * 35.0; // ring density
          float ring = smoothstep(0.40, 0.50, abs(fract(ringFreq) - 0.5));
          stoneColor = mix(stoneColor, vec3(0.10, 0.08, 0.06), ring * 0.5);

          // ─── Radial spoke lines (pie-slice divisions) ──
          float spokes = 24.0;
          float spoke = smoothstep(0.47, 0.50, abs(fract(ang * spokes / 6.2832) - 0.5));
          stoneColor = mix(stoneColor, vec3(0.10, 0.08, 0.06), spoke * 0.3 * step(dist, 0.25));

          // ─── Warm tower light pool — bright center ──
          float warmth = smoothstep(0.30, 0.0, dist);
          stoneColor += vec3(0.45, 0.28, 0.10) * warmth * warmth;

          // Mid-range warm glow
          float midWarmth = smoothstep(0.40, 0.08, dist);
          stoneColor += vec3(0.18, 0.10, 0.04) * midWarmth;

          // ─── Outer ambient — visible but dark (not void) ──
          stoneColor += vec3(0.04, 0.03, 0.02) * smoothstep(0.45, 0.25, dist);

          // ─── Ring highlight near foundation base ──
          // Bright concentric ring right where foundation meets ground
          float foundationRing = smoothstep(0.02, 0.0, abs(dist - 0.10));
          stoneColor += vec3(0.40, 0.25, 0.08) * foundationRing * 0.6;

          // ─── Circular fade — far edges go transparent ──
          float edgeFade = smoothstep(0.50, 0.38, dist);

          gl_FragColor = vec4(stoneColor, edgeFade);
        }
      `,
      transparent: true,
      depthWrite: true,
    });
  }, []);

  // Warm additive light pool overlay
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
          float alpha = smoothstep(0.25, 0.0, dist) * 0.45;

          gl_FragColor = vec4(warmColor, alpha);
        }
      `,
    });
  }, []);

  return (
    <group>
      {/* Solid stone ground — concentric ring pattern */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, FOUNDATION_BOTTOM - 0.05, 0]}
        material={groundMaterial}
      >
        <circleGeometry args={[100, 64]} />
      </mesh>
      {/* Additive warm light pool on top */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, FOUNDATION_BOTTOM, 0]}
        material={lightPoolMaterial}
      >
        <circleGeometry args={[60, 48]} />
      </mesh>
    </group>
  );
}

/**
 * AtmosphericHaze — Warm volumetric-like glow around tower base.
 * Additive-blended plane that creates atmospheric depth.
 * 1 extra draw call, trivial shader.
 */
function AtmosphericHaze() {
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
          float alpha = smoothstep(0.45, 0.0, dist) * 0.28;

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
}

// ─── Pinch helpers ────────────────────────────────────────

function getPinchDistance(evt: GestureResponderEvent): number | null {
  const touches = evt.nativeEvent.touches;
  if (!touches || touches.length < 2) return null;
  const dx = touches[1].pageX - touches[0].pageX;
  const dy = touches[1].pageY - touches[0].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Returns the vertical midpoint of two fingers (for two-finger pan) */
function getPinchMidpointY(evt: GestureResponderEvent): number | null {
  const touches = evt.nativeEvent.touches;
  if (!touches || touches.length < 2) return null;
  return (touches[0].pageY + touches[1].pageY) / 2;
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
 * Night Monument Skybox — Dark sky where the tower is the light source.
 *
 * Features:
 * - Dark night sky with visible stars across the full upper hemisphere
 * - Warm ambient horizon glow (tower light scattering in atmosphere)
 * - Below horizon: warm amber wash (tower lighting the ground/air)
 * - No sun disk — the tower IS the light
 *
 * Performance: Single draw call, simple gradient + star hash.
 */
function NightSkybox() {
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
          // lat: 0 = zenith, 0.5 = horizon, 1.0 = nadir
          float lat = 0.5 - elevation / 3.14159265;
          float azimuth = atan(dir.x, dir.z);

          // ─── Night sky gradient (Solana-inspired: deep purple → teal horizon) ──
          // nadirColor matches canvas bg (#120e18) for seamless bottom edge
          vec3 zenithColor   = vec3(0.06, 0.04, 0.18);    // deep indigo
          vec3 upperSky      = vec3(0.10, 0.06, 0.22);    // purple-blue
          vec3 midSky        = vec3(0.14, 0.08, 0.25);    // clear purple
          vec3 lowerMidSky   = vec3(0.10, 0.12, 0.24);    // purple-teal transition
          vec3 horizonGlow   = vec3(0.06, 0.18, 0.20);    // muted teal-green
          vec3 belowHorizon  = vec3(0.10, 0.10, 0.14);    // dark purple-grey
          vec3 nadirColor    = vec3(0.07, 0.055, 0.094);   // matches canvas #120e18

          // Smooth gradient — wide overlapping bands, no hard edges
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
            // Wide smooth horizon-to-below transition
            skyColor = mix(horizonGlow, belowHorizon, (lat - 0.48) / 0.14);
          } else {
            // Gradual fade all the way to nadir — no hard cutoff
            skyColor = mix(belowHorizon, nadirColor, smoothstep(0.62, 0.95, lat));
          }

          // ─── Nebula wisps + aurora (sin-based, no noise) ────────
          // Bold flowing energy wisps — must be clearly visible on mobile
          // wispFade: STRONGEST at horizon (where camera actually sees sky),
          // fades toward zenith. Camera viewport top is ~lat 0.48.
          if (lat < 0.55) {
            float wispFade = smoothstep(0.55, 0.30, lat);

            // Wisp 1: broad purple-magenta band
            float w1 = sin(azimuth * 2.0 + lat * 8.0 + uTime * 0.08) *
                        sin(azimuth * 3.0 - lat * 5.0 - uTime * 0.05);
            w1 = smoothstep(0.2, 0.7, w1 * 0.5 + 0.5);
            vec3 wispColor1 = vec3(0.45, 0.18, 0.70); // bold purple
            skyColor += wispColor1 * w1 * wispFade * 0.9;

            // Wisp 2: teal-cyan wisps
            // NOTE: all azimuth multipliers MUST be integers to avoid seam
            // at atan2 wrap point (azimuth jumps +π → -π)
            float w2 = sin(azimuth * 5.0 + lat * 12.0 - uTime * 0.06) *
                        sin(azimuth * 2.0 + lat * 4.0 + uTime * 0.04);
            w2 = smoothstep(0.4, 0.85, w2 * 0.5 + 0.5);
            vec3 wispColor2 = vec3(0.12, 0.40, 0.55); // vivid teal
            skyColor += wispColor2 * w2 * wispFade * 0.8;

            // Wisp 3: teal-green energy near horizon (Solana accent)
            float w3 = sin(azimuth * 4.0 - lat * 6.0 + uTime * 0.03);
            w3 = smoothstep(0.5, 0.9, w3 * 0.5 + 0.5);
            float horizonWisp = smoothstep(0.05, 0.35, lat) * smoothstep(0.55, 0.35, lat);
            vec3 wispColor3 = vec3(0.08, 0.40, 0.30); // teal-green
            skyColor += wispColor3 * w3 * horizonWisp * 0.7;

            // Wisp 4: emerald aurora — northern lights accent
            float w4 = sin(azimuth * 4.0 + lat * 10.0 + uTime * 0.07) *
                        sin(azimuth * 2.0 - lat * 7.0 - uTime * 0.04);
            w4 = smoothstep(0.3, 0.8, w4 * 0.5 + 0.5);
            vec3 wispColor4 = vec3(0.10, 0.50, 0.22); // bold emerald
            skyColor += wispColor4 * w4 * wispFade * 0.65;

            // Wisp 5: horizon aurora band — teal-green for visible camera range
            float horizBand = smoothstep(0.55, 0.45, lat) * smoothstep(0.30, 0.40, lat);
            float w5 = sin(azimuth * 2.0 + lat * 15.0 + uTime * 0.06) *
                        sin(azimuth * 3.0 - lat * 8.0 - uTime * 0.03);
            w5 = smoothstep(0.2, 0.65, w5 * 0.5 + 0.5);
            vec3 wispColor5 = vec3(0.06, 0.35, 0.28); // Solana teal
            skyColor += wispColor5 * w5 * horizBand * 0.8;
          }

          // ─── Stars (visible across most of upper hemisphere) ──
          vec3 starContrib = vec3(0.0);
          if (lat < 0.48) {
            // Two densities of stars for depth
            vec3 starPos1 = dir * 100.0;
            float sv1 = hash3D(floor(starPos1));
            if (sv1 > 0.994) {
              float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + sv1 * 100.0);
              float brightness = (sv1 - 0.994) * 166.0 * twinkle * 1.5;
              float fade = smoothstep(0.48, 0.15, lat);
              vec3 starColor = mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.9, 0.7), sv1 * 3.0);
              starContrib = starColor * brightness * fade;
            }
            // Dimmer background stars
            vec3 starPos2 = dir * 200.0;
            float sv2 = hash3D(floor(starPos2));
            if (sv2 > 0.993) {
              float brightness = (sv2 - 0.993) * 60.0;
              float fade = smoothstep(0.48, 0.10, lat);
              starContrib += vec3(0.7, 0.75, 0.9) * brightness * fade;
            }
          }

          vec3 color = skyColor + starContrib;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
  }, []);

  useFrame((_, delta) => {
    if (skyMaterial.uniforms.uTime) {
      skyMaterial.uniforms.uTime.value += Math.min(delta, 0.1);
    }
  });

  return (
    <mesh material={skyMaterial}>
      <sphereGeometry args={[800, 16, 8]} />
    </mesh>
  );
}

// ─── TowerScene ───────────────────────────────────────────

/**
 * TowerScene — Main R3F Canvas with gesture-driven camera.
 *
 * GESTURE ARCHITECTURE:
 * - Single finger: always orbits (azimuth + elevation)
 * - Two fingers: pinch zoom + vertical pan (midpoint Y movement)
 * - LayerIndicator scrubber: tap/drag for precise floor navigation
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
    lookAt: new THREE.Vector3(0, OVERVIEW_LOOKAT_Y, 0),
    targetLookAt: new THREE.Vector3(0, OVERVIEW_LOOKAT_Y, 0),
    velocityAzimuth: 0,
    velocityElevation: 0,
    velocityLookAtY: 0,
    isTouching: false,
    isTransitioning: false,
  });

  const lastTouchTime = useRef(performance.now() / 1000);

  // Touch tracking
  const prevTouch = useRef({ x: 0, y: 0 });
  const prevLayerRef = useRef(getLayerFromY(TOWER_CENTER_Y));
  const prevZoomTierRef = useRef<ZoomTier>("overview");
  // Tracks when a block was just selected (to suppress double-tap reset)
  const blockJustSelected = useRef(false);

  // Pinch state
  const isPinching = useRef(false);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef<number>(ZOOM_OVERVIEW);
  const prevPinchMidpointY = useRef(0);
  const pinchCooldownTime = useRef(0);

  // Drag tracking (to distinguish taps from drags)
  const isDragging = useRef(false);

  // Double-tap state (timer-based so it doesn't block block taps)
  const lastTapTime = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectBlock = useTowerStore((s) => s.selectBlock);
  const setGestureActive = useTowerStore((s) => s.setGestureActive);
  const setCameraStateRef = useTowerStore((s) => s.setCameraStateRef);

  // Register cameraState ref with store so LayerIndicator can access it
  useEffect(() => {
    setCameraStateRef(cameraState);
  }, [setCameraStateRef]);

  // Reset camera to overview
  const resetCamera = useCallback(() => {
    const cs = cameraState.current;
    // Keep current rotation — only reset zoom, elevation, and lookAt
    cs.targetElevation = OVERVIEW_ELEVATION;
    cs.targetZoom = ZOOM_OVERVIEW;
    cs.targetLookAt.set(0, OVERVIEW_LOOKAT_Y, 0);
    cs.velocityAzimuth = 0;
    cs.velocityElevation = 0;
    cs.velocityLookAtY = 0;
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
          // Block gestures during tower reveal animation
          if (!useTowerStore.getState().revealComplete) return false;
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
          // Kill momentum on new touch
          cameraState.current.velocityAzimuth = 0;
          cameraState.current.velocityElevation = 0;
          cameraState.current.velocityLookAtY = 0;
          lastTouchTime.current = performance.now() / 1000;
        },

        onPanResponderMove: (evt) => {
          lastTouchTime.current = performance.now() / 1000;

          // ─── Two-finger: pinch zoom + vertical pan ─
          const pinchDist = getPinchDistance(evt);
          const pinchMidY = getPinchMidpointY(evt);
          if (pinchDist !== null && pinchMidY !== null) {
            if (!isPinching.current) {
              isPinching.current = true;
              pinchStartDist.current = pinchDist;
              pinchStartZoom.current = cameraState.current.zoom;
              prevPinchMidpointY.current = pinchMidY;
              return;
            }

            // Zoom from pinch spread
            const scale = pinchDist / pinchStartDist.current;
            const raw = pinchStartZoom.current / scale;
            cameraState.current.targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, raw));

            // Vertical pan from midpoint movement (two-finger drag)
            const cs = cameraState.current;
            const midDy = pinchMidY - prevPinchMidpointY.current;
            prevPinchMidpointY.current = pinchMidY;
            const vY = midDy * PAN_Y_SENSITIVITY;
            cs.targetLookAt.y += vY;
            cs.velocityLookAtY = vY;

            // Hard clamp with overscroll allowance
            const hardMin = LOOKAT_Y_MIN - LOOKAT_Y_OVERSCROLL;
            const hardMax = LOOKAT_Y_MAX + LOOKAT_Y_OVERSCROLL;
            cs.targetLookAt.y = Math.max(hardMin, Math.min(hardMax, cs.targetLookAt.y));

            // Haptic on tier crossing during pinch
            const newTier = getZoomTier(cs.targetZoom);
            if (newTier !== prevZoomTierRef.current) {
              hapticZoomSnap();
              prevZoomTierRef.current = newTier;
            }
            return;
          }

          // ─── Single finger orbit (always azimuth + elevation) ─
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
          // Clear gesture active immediately — handleTouchStart also clears
          // this as a safety net on the next touch
          setGestureActive(false);

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
  // Track block selection to suppress double-tap reset when tapping blocks
  const selectedBlockId = useTowerStore((s) => s.selectedBlockId);
  useEffect(() => {
    if (selectedBlockId) {
      blockJustSelected.current = true;
      // Clear after a frame so subsequent empty-space double-taps still work
      const timer = setTimeout(() => { blockJustSelected.current = false; }, 400);
      return () => clearTimeout(timer);
    }
  }, [selectedBlockId]);

  const handleTouchStart = useCallback(() => {
    // Mark that we haven't dragged yet for this touch
    isDragging.current = false;
    // Clear stale gesture state — prevents isGestureActive from getting stuck
    // if a previous PanResponder release was missed
    setGestureActive(false);
  }, [setGestureActive]);

  const handleTouchEnd = useCallback(() => {
    // Skip if this touch was a drag (PanResponder handled it)
    if (isDragging.current) return;
    // Skip double-tap reset if a block was just selected by R3F click —
    // prevents two quick block taps from triggering camera reset
    if (blockJustSelected.current) return;

    const now = Date.now();

    if (now - lastTapTime.current < DOUBLE_TAP_WINDOW) {
      // Double-tap detected on empty space — reset camera
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
        camera={{ position: [0, OVERVIEW_LOOKAT_Y, ZOOM_OVERVIEW], fov: 50, near: CAMERA_NEAR, far: CAMERA_FAR }}
      >
        <SceneSetup />
        <TowerRevealController
          cameraState={cameraState}
          lastTouchTime={lastTouchTime}
        />
        <CameraRig
          cameraState={cameraState}
          lastTouchTime={lastTouchTime}
        />

        {/* ─── Lighting (urban night — tower floods its surroundings) ── */}
        {/* Ambient: warm tint, enough to see foundation + ground clearly */}
        <ambientLight intensity={0.30} color="#D4C4A0" />
        {/* Hemisphere: cool sky above + warm tower bounce below */}
        <hemisphereLight args={['#3a2850', '#8A5820', 0.5]} />
        {/* Subtle cool key light — night fill, reads as moonlight */}
        <directionalLight position={[12, 40, 8]} intensity={0.45} color="#C0C8E0" />
        {/* Tower base uplight — strong warm glow flooding the foundation */}
        <pointLight
          position={[0, 1, 0]}
          intensity={5.0}
          color="#FFB040"
          distance={50}
          decay={1.2}
        />
        {/* Spire crown glow — the tower's beacon */}
        <pointLight
          position={[0, TOWER_HEIGHT - 2, 0]}
          intensity={6.0}
          color="#FFD700"
          distance={40}
          decay={1.0}
        />
        {/* Mid-tower warm fill — represents aggregate block energy */}
        <pointLight
          position={[0, TOWER_HEIGHT * 0.5, 0]}
          intensity={3.5}
          color="#FFA030"
          distance={35}
          decay={1.2}
        />
        {/* Foundation down-light — ensures the pedestal steps are visible */}
        <pointLight
          position={[0, 4, 0]}
          intensity={4.0}
          color="#FFCC60"
          distance={30}
          decay={1.4}
        />

        {/* ─── Scene Content ────────────────────────── */}
        <NightSkybox />
        <BackgroundPlane />
        <TowerGrid />
        <Particles />
        <ConditionalClaimVFX />
        <Foundation />
        <GroundPlane />
        <AtmosphericHaze />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#120e18", // matches sky nadirColor for seamless edge
  },
});
