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
const ORBIT_LERP = 0.14; // fast — snappy interactive response
const TRANSITION_LERP = 0.045; // slow — smooth fly-to / reset easing

/** Orbit sensitivity (radians per pixel of finger drag) */
const ORBIT_SENSITIVITY = 0.005;

/** Momentum: velocity-based inertia after finger lifts */
const MOMENTUM_FRICTION = 0.94; // per-frame decay (higher = longer coast)
const MOMENTUM_MIN_VEL = 0.00008; // stop threshold

/** Zoom range */
const ZOOM_MIN = 6;
const ZOOM_MAX = 55;

/** Zoom tier centers (for tier detection + soft magnetics) */
const ZOOM_OVERVIEW = 40;
const ZOOM_NEIGHBORHOOD = 18;
const ZOOM_BLOCK = 8;

/** Soft magnetic zone — pull gently if within this many units of a tier */
const MAGNETIC_ZONE = 2.5;
const MAGNETIC_STRENGTH = 0.03; // per-frame pull factor

/** Elevation clamp (radians) */
const ELEVATION_MIN = 0.15;
const ELEVATION_MAX = 1.3;

/** Fixed camera state for overview / reset */
const OVERVIEW_ELEVATION = 0.65;
const OVERVIEW_AZIMUTH = Math.PI / 5;

/** Drag threshold — finger must move this far to count as drag, not tap */
const DRAG_THRESHOLD = 8;

/** Double-tap window (ms) */
const DOUBLE_TAP_WINDOW = 350;

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

/**
 * Soft magnetic snap — gently pulls zoom toward nearest tier center
 * if within the magnetic zone. Returns adjusted zoom per frame.
 */
function applySoftMagnetic(zoom: number): number {
  const tiers = [ZOOM_BLOCK, ZOOM_NEIGHBORHOOD, ZOOM_OVERVIEW];
  for (const tier of tiers) {
    const dist = Math.abs(zoom - tier);
    if (dist < MAGNETIC_ZONE && dist > 0.1) {
      // Gentle pull toward tier center
      return zoom + (tier - zoom) * MAGNETIC_STRENGTH;
    }
  }
  return zoom;
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

  // State flags
  isTouching: boolean;
  isTransitioning: boolean; // true during fly-to-block / reset
}

// ─── SceneSetup ───────────────────────────────────────────

function SceneSetup() {
  const { scene } = useThree();
  useMemo(() => {
    scene.fog = new THREE.FogExp2(0x060610, 0.006);
  }, [scene]);
  return null;
}

// ─── CameraRig ────────────────────────────────────────────

/**
 * CameraRig — Per-frame camera update.
 *
 * - Dual lerp: fast for orbit, smooth for transitions
 * - Momentum coasting with friction decay
 * - Soft magnetic zoom near tier centers
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
        // Deselect → smooth return to overview
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
    const lerp = cs.isTransitioning ? TRANSITION_LERP : ORBIT_LERP;

    // ─── Momentum coasting (when finger lifted) ─
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

      // Apply soft magnetic pull on zoom
      cs.targetZoom = applySoftMagnetic(cs.targetZoom);
    }

    // ─── Auto-rotate when idle ──────────────────
    const currentTier = getZoomTier(cs.zoom);
    if (idleTime > IDLE_TIMEOUT && !selectedBlockId && !cs.isTransitioning) {
      // Rotate slower when zoomed in
      const zoomFactor = cs.zoom / ZOOM_OVERVIEW;
      cs.targetAzimuth += AUTO_ROTATE_SPEED * zoomFactor;
    }

    // ─── Spring-damped interpolation ────────────
    cs.azimuth += (cs.targetAzimuth - cs.azimuth) * lerp;
    cs.elevation += (cs.targetElevation - cs.elevation) * lerp;
    cs.zoom += (cs.targetZoom - cs.zoom) * lerp;
    cs.lookAt.lerp(cs.targetLookAt, lerp);

    // Clamp
    cs.elevation = Math.max(ELEVATION_MIN, Math.min(ELEVATION_MAX, cs.elevation));
    cs.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cs.zoom));

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
          color="#060610"
          transparent
          opacity={0.9}
          roughness={0.95}
          metalness={0.1}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <circleGeometry args={[15, 32]} />
        <meshBasicMaterial color="#0a1530" transparent opacity={0.6} />
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

// ─── TowerScene ───────────────────────────────────────────

/**
 * TowerScene — Main R3F Canvas with gesture-driven camera.
 *
 * GESTURE ARCHITECTURE:
 * - PanResponder only captures on MOVE (not start) → taps pass to R3F Canvas
 * - Free zoom with soft magnetic pull near tier centers
 * - Dual lerp: fast for orbit, smooth eased for fly-to/reset
 * - Momentum with friction for tactile spin
 * - Double-tap to reset (via delayed timer, doesn't block block taps)
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

  // Double-tap state (timer-based so it doesn't block block taps)
  const lastTapTime = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectBlock = useTowerStore((s) => s.selectBlock);

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
          // Kill momentum on new touch
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

          if (isPinching.current) {
            isPinching.current = false;
            // No hard snap — zoom stays where you left it.
            // Soft magnetics will gently pull if near a tier center.
          }
          // Momentum continues via CameraRig useFrame
        },
      }),
    [selectBlock, resetCamera],
  );

  // ─── Double-tap handler (timer-based) ───────────────────
  // Uses a delayed timer so single taps aren't blocked.
  // Single taps pass through to R3F Canvas for block onClick.
  const handleTouchStart = useCallback(() => {
    const now = Date.now();

    if (now - lastTapTime.current < DOUBLE_TAP_WINDOW) {
      // Double-tap detected
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      lastTapTime.current = 0;
      resetCamera();
    } else {
      lastTapTime.current = now;
      // Clear any pending timer
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

        {/* ─── Lighting ─────────────────────────────── */}
        <ambientLight intensity={0.25} color="#4444cc" />
        <directionalLight position={[12, 30, 8]} intensity={0.8} color="#ddeeff" />
        <directionalLight position={[-15, 15, -5]} intensity={0.35} color="#4466ff" />
        <pointLight
          position={[0, TOWER_CENTER_Y, -20]}
          intensity={0.6}
          color="#00ccff"
          distance={60}
          decay={2}
        />
        <pointLight
          position={[0, TOWER_HEIGHT - 2, 0]}
          intensity={1.2}
          color="#00ffff"
          distance={15}
          decay={1.5}
        />

        {/* ─── Scene Content ────────────────────────── */}
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
    backgroundColor: "#060610",
  },
});
