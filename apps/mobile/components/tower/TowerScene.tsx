import React, { useRef, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { View, StyleSheet, PanResponder, type GestureResponderEvent } from "react-native";
import * as THREE from "three";
import TowerGrid from "./TowerGrid";
import Particles from "./Particles";
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
    scene.fog = new THREE.FogExp2(0x080604, 0.004);
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
        // Deselect → smoothly return lookAt to tower center axis
        // Keep current Y height for continuity, but center X/Z
        cs.targetLookAt.set(0, cs.lookAt.y, 0);
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

    // Normalize azimuth to [-PI, PI] to prevent float precision drift
    while (cs.azimuth > Math.PI) cs.azimuth -= Math.PI * 2;
    while (cs.azimuth < -Math.PI) cs.azimuth += Math.PI * 2;
    while (cs.targetAzimuth > Math.PI) cs.targetAzimuth -= Math.PI * 2;
    while (cs.targetAzimuth < -Math.PI) cs.targetAzimuth += Math.PI * 2;

    // ─── Spherical → Cartesian ──────────────────
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

function GroundGrid() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial
          color="#080604"
          transparent
          opacity={0.9}
          roughness={0.95}
          metalness={0.1}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <circleGeometry args={[15, 32]} />
        <meshBasicMaterial color="#1a1208" transparent opacity={0.6} />
      </mesh>
    </group>
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
 * Enhanced procedural sky sphere — dramatic golden Solarpunk atmosphere.
 * Uses GLSL shader for rich gradient with subtle stars, achieving the same
 * warm majestic feeling as an equirectangular texture but native to React Native.
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
        varying vec3 vWorldPosition;
        uniform float uTime;

        // Simple hash for procedural stars
        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        void main() {
          vec3 dir = normalize(vWorldPosition);
          float t = dir.y * 0.5 + 0.5; // 0 = bottom, 1 = top

          // Rich color stops for dramatic golden sky
          vec3 deepBottom   = vec3(0.02, 0.015, 0.01);  // nearly black warm
          vec3 lowerDark    = vec3(0.08, 0.05, 0.025);   // deep brown
          vec3 horizonDeep  = vec3(0.25, 0.15, 0.06);    // rich amber-brown
          vec3 horizonGlow  = vec3(0.55, 0.35, 0.12);    // intense golden glow
          vec3 horizonPeak  = vec3(0.70, 0.48, 0.18);    // brilliant golden
          vec3 midAscend    = vec3(0.45, 0.30, 0.12);    // warm copper
          vec3 upperSky     = vec3(0.20, 0.13, 0.06);    // dark warm copper
          vec3 topZenith    = vec3(0.06, 0.04, 0.025);   // dark warm zenith

          // Smooth multi-stop gradient
          vec3 color;
          if (t < 0.10) {
            color = mix(deepBottom, lowerDark, t / 0.10);
          } else if (t < 0.25) {
            color = mix(lowerDark, horizonDeep, (t - 0.10) / 0.15);
          } else if (t < 0.40) {
            color = mix(horizonDeep, horizonGlow, (t - 0.25) / 0.15);
          } else if (t < 0.50) {
            color = mix(horizonGlow, horizonPeak, (t - 0.40) / 0.10);
          } else if (t < 0.62) {
            color = mix(horizonPeak, midAscend, (t - 0.50) / 0.12);
          } else if (t < 0.78) {
            color = mix(midAscend, upperSky, (t - 0.62) / 0.16);
          } else {
            color = mix(upperSky, topZenith, (t - 0.78) / 0.22);
          }

          // Subtle stars in upper sky (above horizon)
          if (t > 0.55) {
            vec3 starPos = normalize(vWorldPosition) * 100.0;
            float starVal = hash(floor(starPos));
            // Only sparse, bright stars
            if (starVal > 0.998) {
              float twinkle = 0.5 + 0.5 * sin(uTime * 3.0 + starVal * 100.0);
              float starBrightness = (starVal - 0.998) * 500.0 * twinkle;
              color += vec3(0.9, 0.7, 0.4) * starBrightness * (t - 0.55);
            }
          }

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
  }, []);

  // Animate stars
  useFrame((_, delta) => {
    if (skyMaterial.uniforms.uTime) {
      skyMaterial.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh material={skyMaterial}>
      <sphereGeometry args={[180, 32, 32]} />
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

        {/* ─── Lighting (warm Solarpunk palette) ───── */}
        <ambientLight intensity={0.3} color="#FFE8C0" />
        <directionalLight position={[12, 30, 8]} intensity={0.9} color="#FFF0D0" />
        <directionalLight position={[-15, 15, -5]} intensity={0.3} color="#D4A050" />
        <pointLight
          position={[0, TOWER_CENTER_Y, -20]}
          intensity={0.5}
          color="#FFB347"
          distance={60}
          decay={2}
        />
        <pointLight
          position={[0, TOWER_HEIGHT - 2, 0]}
          intensity={1.0}
          color="#FFD700"
          distance={15}
          decay={1.5}
        />

        {/* ─── Scene Content ────────────────────────── */}
        <GoldenSkybox />
        <BackgroundPlane />
        <TowerGrid />
        <Particles />
        <GroundGrid />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080604",
  },
});
