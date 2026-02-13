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

/** Auto-rotate only at overview zoom when idle */
const IDLE_TIMEOUT = 4;
const AUTO_ROTATE_SPEED = 0.0006;

/** Camera lerp — higher = snappier response */
const CAMERA_LERP = 0.12;

/** Orbit sensitivity (radians per pixel of finger drag) */
const ORBIT_SENSITIVITY = 0.006;

/** Momentum friction — lower = longer coast, 1 = instant stop */
const MOMENTUM_FRICTION = 0.92;
/** Minimum velocity to keep coasting (radians/frame) */
const MOMENTUM_MIN_VEL = 0.0001;

/** Zoom tier distances */
const ZOOM_OVERVIEW = 40;
const ZOOM_NEIGHBORHOOD = 18;
const ZOOM_BLOCK = 8;

/** Zoom tier snap boundaries */
const SNAP_HIGH = (ZOOM_OVERVIEW + ZOOM_NEIGHBORHOOD) / 2;
const SNAP_LOW = (ZOOM_NEIGHBORHOOD + ZOOM_BLOCK) / 2;

/** Elevation clamp (radians) */
const ELEVATION_MIN = 0.15;
const ELEVATION_MAX = 1.3;

/** Fixed elevation for overview (radians) */
const OVERVIEW_ELEVATION = 0.65;

/** Minimum finger movement (px) to count as a drag, not a tap */
const DRAG_THRESHOLD = 6;

type ZoomTier = "overview" | "neighborhood" | "block";

function getZoomTier(zoom: number): ZoomTier {
  if (zoom >= SNAP_HIGH) return "overview";
  if (zoom >= SNAP_LOW) return "neighborhood";
  return "block";
}

function snapToTier(zoom: number): number {
  const tier = getZoomTier(zoom);
  if (tier === "overview") return ZOOM_OVERVIEW;
  if (tier === "neighborhood") return ZOOM_NEIGHBORHOOD;
  return ZOOM_BLOCK;
}

function getLayerFromY(y: number): number {
  return Math.round(
    Math.max(0, Math.min(y / LAYER_HEIGHT, DEFAULT_TOWER_CONFIG.layerCount - 1)),
  );
}

// ─── Camera State ─────────────────────────────────────────

interface CameraState {
  azimuth: number;
  elevation: number;
  zoom: number;
  targetAzimuth: number;
  targetElevation: number;
  targetZoom: number;
  lookAt: THREE.Vector3;
  targetLookAt: THREE.Vector3;
  // Momentum velocities (radians per frame)
  velocityAzimuth: number;
  velocityElevation: number;
  isTouching: boolean;
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
 * CameraRig — Reads camera state ref every frame and applies
 * spring-damped lerp + momentum-based coasting after releasing.
 *
 * PERFORMANCE: Zero allocations per frame. Only math + one lookAt call.
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
          // Kill momentum so the fly-to feels sharp
          cs.velocityAzimuth = 0;
          cs.velocityElevation = 0;
          hapticBlockSelect();
        }
      } else {
        // Deselect → return to overview with fixed elevation
        cs.targetZoom = ZOOM_OVERVIEW;
        cs.targetElevation = OVERVIEW_ELEVATION;
        cs.targetLookAt.set(0, TOWER_CENTER_Y, 0);
        cs.velocityAzimuth = 0;
        cs.velocityElevation = 0;
        hapticBlockDeselect();
      }
    }

    // ─── Momentum coasting (when finger lifted) ─
    if (!cs.isTouching) {
      if (
        Math.abs(cs.velocityAzimuth) > MOMENTUM_MIN_VEL ||
        Math.abs(cs.velocityElevation) > MOMENTUM_MIN_VEL
      ) {
        cs.targetAzimuth += cs.velocityAzimuth;
        cs.targetElevation += cs.velocityElevation;

        // Friction decay
        cs.velocityAzimuth *= MOMENTUM_FRICTION;
        cs.velocityElevation *= MOMENTUM_FRICTION;

        // Clamp elevation during coast
        cs.targetElevation = Math.max(
          ELEVATION_MIN,
          Math.min(ELEVATION_MAX, cs.targetElevation),
        );
      }
    }

    // ─── Auto-rotate at overview when idle ───────
    const currentTier = getZoomTier(cs.zoom);
    if (
      idleTime > IDLE_TIMEOUT &&
      !selectedBlockId &&
      currentTier === "overview"
    ) {
      cs.targetAzimuth += AUTO_ROTATE_SPEED;
    }

    // ─── Spring-damped lerp ─────────────────────
    cs.azimuth += (cs.targetAzimuth - cs.azimuth) * CAMERA_LERP;
    cs.elevation += (cs.targetElevation - cs.elevation) * CAMERA_LERP;
    cs.zoom += (cs.targetZoom - cs.zoom) * CAMERA_LERP;
    cs.lookAt.lerp(cs.targetLookAt, CAMERA_LERP);

    // Clamp elevation
    cs.elevation = Math.max(ELEVATION_MIN, Math.min(ELEVATION_MAX, cs.elevation));

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
        <meshBasicMaterial
          color="#0a1530"
          transparent
          opacity={0.6}
        />
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
 * - PanResponder only captures on MOVE (not on start), so taps
 *   pass through to the R3F Canvas for block raycasting/onClick.
 * - Orbit uses velocity tracking + momentum for a tactile, free feel.
 * - Pinch zoom snaps to 3 tiers on release.
 * - Camera reset always returns to fixed elevation + overview zoom.
 */
export default function TowerScene() {
  const cameraState = useRef<CameraState>({
    azimuth: Math.PI / 5,
    elevation: OVERVIEW_ELEVATION,
    zoom: ZOOM_OVERVIEW,
    targetAzimuth: Math.PI / 5,
    targetElevation: OVERVIEW_ELEVATION,
    targetZoom: ZOOM_OVERVIEW,
    lookAt: new THREE.Vector3(0, TOWER_CENTER_Y, 0),
    targetLookAt: new THREE.Vector3(0, TOWER_CENTER_Y, 0),
    velocityAzimuth: 0,
    velocityElevation: 0,
    isTouching: false,
  });

  const lastTouchTime = useRef(performance.now() / 1000);

  // Touch tracking for tap vs drag
  const touchStart = useRef({ x: 0, y: 0 });
  const prevTouch = useRef({ x: 0, y: 0 });
  const touchMoved = useRef(false);
  const prevLayerRef = useRef(getLayerFromY(TOWER_CENTER_Y));
  const prevZoomTierRef = useRef<ZoomTier>("overview");

  // Pinch state
  const isPinching = useRef(false);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(ZOOM_OVERVIEW);

  // Double-tap state
  const lastTapTime = useRef(0);

  const selectBlock = useTowerStore((s) => s.selectBlock);

  // Double-tap → reset to overview with fixed elevation
  const resetCamera = useCallback(() => {
    const cs = cameraState.current;
    cs.targetAzimuth = Math.PI / 5;
    cs.targetElevation = OVERVIEW_ELEVATION;
    cs.targetZoom = ZOOM_OVERVIEW;
    cs.targetLookAt.set(0, TOWER_CENTER_Y, 0);
    cs.velocityAzimuth = 0;
    cs.velocityElevation = 0;
    selectBlock(null);
    hapticReset();
  }, [selectBlock]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // KEY: Don't capture on touch START — let taps through to R3F Canvas
        // for block raycasting. Only capture once finger starts MOVING.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => {
          // Only capture once finger has moved enough to be a drag
          return (
            Math.abs(gesture.dx) > DRAG_THRESHOLD ||
            Math.abs(gesture.dy) > DRAG_THRESHOLD
          );
        },

        onPanResponderGrant: (evt) => {
          const { pageX, pageY } = evt.nativeEvent;
          touchStart.current = { x: pageX, y: pageY };
          prevTouch.current = { x: pageX, y: pageY };
          touchMoved.current = true; // We only get here if drag threshold met
          cameraState.current.isTouching = true;
          // Kill any ongoing momentum
          cameraState.current.velocityAzimuth = 0;
          cameraState.current.velocityElevation = 0;
          lastTouchTime.current = performance.now() / 1000;
        },

        onPanResponderMove: (evt) => {
          lastTouchTime.current = performance.now() / 1000;

          // ─── Pinch zoom (2+ fingers) ────────────
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
            cameraState.current.targetZoom = Math.max(5, Math.min(55, raw));
            return;
          }

          // ─── Single finger orbit ────────────────
          if (isPinching.current) return;

          const { pageX, pageY } = evt.nativeEvent;
          const cs = cameraState.current;

          // Per-frame delta from previous position
          const dx = pageX - prevTouch.current.x;
          const dy = pageY - prevTouch.current.y;
          prevTouch.current = { x: pageX, y: pageY };

          // Apply orbit
          const vAz = -dx * ORBIT_SENSITIVITY;
          const vEl = -dy * ORBIT_SENSITIVITY;

          cs.targetAzimuth += vAz;
          cs.targetElevation += vEl;

          // Track velocity for momentum
          cs.velocityAzimuth = vAz;
          cs.velocityElevation = vEl;

          // Clamp elevation
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

          // ─── Pinch end: snap to zoom tier ───────
          if (isPinching.current) {
            isPinching.current = false;
            const cs = cameraState.current;
            cs.targetZoom = snapToTier(cs.targetZoom);

            const newTier = getZoomTier(cs.targetZoom);
            if (newTier !== prevZoomTierRef.current) {
              hapticZoomSnap();
              prevZoomTierRef.current = newTier;
            }
          }
          // Momentum continues automatically in CameraRig useFrame
        },
      }),
    [selectBlock, resetCamera],
  );

  // Handle double-tap on the background (not on a block)
  // This is handled via the View's onTouchEnd since PanResponder
  // doesn't capture taps (onStartShouldSetPanResponder = false).
  const handleTouchEnd = useCallback(
    (e: any) => {
      // Only process if PanResponder didn't capture this gesture
      // (i.e. it was a non-drag tap)
      const now = Date.now();
      if (now - lastTapTime.current < 350) {
        // Double-tap detected → reset camera
        resetCamera();
        lastTapTime.current = 0;
      } else {
        lastTapTime.current = now;
      }
    },
    [resetCamera],
  );

  return (
    <View
      style={styles.container}
      {...panResponder.panHandlers}
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

        {/* ─── Lighting ─────────────────────────────── */}
        <ambientLight intensity={0.25} color="#4444cc" />

        <directionalLight
          position={[12, 30, 8]}
          intensity={0.8}
          color="#ddeeff"
        />

        <directionalLight
          position={[-15, 15, -5]}
          intensity={0.35}
          color="#4466ff"
        />

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
