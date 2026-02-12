import React, { useRef, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { View, StyleSheet, PanResponder } from "react-native";
import * as THREE from "three";
import TowerGrid from "./TowerGrid";
import Particles from "./Particles";
import { useTowerStore } from "@/stores/tower-store";

/** How long (seconds) before auto-rotate kicks in */
const IDLE_TIMEOUT = 3;
/** Auto-rotate speed in radians per frame */
const AUTO_ROTATE_SPEED = 0.001;
/** Camera lerp factor (0 = no move, 1 = instant snap) */
const CAMERA_LERP = 0.05;
/** Threshold (px) to distinguish tap from pan */
const TAP_THRESHOLD = 8;
/** Tower center Y (approximate midpoint for lookAt) */
const TOWER_CENTER_Y = 10;

interface CameraState {
  azimuth: number;
  elevation: number;
  zoom: number;
  targetAzimuth: number;
  targetElevation: number;
  targetZoom: number;
  lookAt: THREE.Vector3;
  targetLookAt: THREE.Vector3;
}

/**
 * SceneSetup — Adds fog and extra lighting inside the R3F Canvas.
 */
function SceneSetup() {
  const { scene } = useThree();

  useMemo(() => {
    scene.fog = new THREE.FogExp2(0x0a0a0f, 0.012);
  }, [scene]);

  return null;
}

/**
 * CameraRig — Smooth camera with auto-rotate and zoom-to-block.
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
  const prevSelectedRef = useRef<string | null>(null);

  useFrame(() => {
    const cs = cameraState.current;
    const now = performance.now() / 1000;
    const idleTime = now - lastTouchTime.current;

    // Zoom-to-block when selection changes
    if (selectedBlockId !== prevSelectedRef.current) {
      prevSelectedRef.current = selectedBlockId;

      if (selectedBlockId) {
        const block = getDemoBlockById(selectedBlockId);
        if (block) {
          // Compute target camera position to face the block
          const bx = block.position.x;
          const by = block.position.y;
          const bz = block.position.z;

          cs.targetAzimuth = Math.atan2(bx, bz);
          cs.targetElevation = 0.6;
          cs.targetZoom = 25;
          cs.targetLookAt.set(bx, by, bz);
        }
      } else {
        // Deselect: return to default view
        cs.targetZoom = 50;
        cs.targetLookAt.set(0, TOWER_CENTER_Y, 0);
      }
    }

    // Auto-rotate when idle
    if (idleTime > IDLE_TIMEOUT && !selectedBlockId) {
      cs.targetAzimuth += AUTO_ROTATE_SPEED;
    }

    // Smooth lerp toward targets
    cs.azimuth += (cs.targetAzimuth - cs.azimuth) * CAMERA_LERP;
    cs.elevation += (cs.targetElevation - cs.elevation) * CAMERA_LERP;
    cs.zoom += (cs.targetZoom - cs.zoom) * CAMERA_LERP;
    cs.lookAt.lerp(cs.targetLookAt, CAMERA_LERP);

    // Clamp elevation
    cs.elevation = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, cs.elevation));

    // Spherical to cartesian
    const r = cs.zoom;
    const theta = cs.azimuth;
    const phi = cs.elevation;

    const x = r * Math.sin(phi) * Math.sin(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.cos(theta);

    camera.position.set(
      cs.lookAt.x + x,
      cs.lookAt.y + y,
      cs.lookAt.z + z,
    );
    camera.lookAt(cs.lookAt);
  });

  return null;
}

/**
 * TowerScene — Main R3F Canvas wrapper.
 * Includes PanResponder for camera orbit with tap detection.
 */
export default function TowerScene() {
  const cameraState = useRef<CameraState>({
    azimuth: Math.PI / 4,
    elevation: 0.8,
    zoom: 50,
    targetAzimuth: Math.PI / 4,
    targetElevation: 0.8,
    targetZoom: 50,
    lookAt: new THREE.Vector3(0, TOWER_CENTER_Y, 0),
    targetLookAt: new THREE.Vector3(0, TOWER_CENTER_Y, 0),
  });

  const lastTouchTime = useRef(performance.now() / 1000);
  const touchStart = useRef({ x: 0, y: 0 });
  const touchMoved = useRef(false);

  const selectBlock = useTowerStore((s) => s.selectBlock);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { pageX, pageY } = evt.nativeEvent;
          touchStart.current = { x: pageX, y: pageY };
          touchMoved.current = false;
          lastTouchTime.current = performance.now() / 1000;
        },
        onPanResponderMove: (evt) => {
          const { pageX, pageY } = evt.nativeEvent;
          const dx = pageX - touchStart.current.x;
          const dy = pageY - touchStart.current.y;

          // Check if we've moved enough to count as a pan
          if (
            Math.abs(dx) > TAP_THRESHOLD ||
            Math.abs(dy) > TAP_THRESHOLD
          ) {
            touchMoved.current = true;
          }

          if (touchMoved.current) {
            const SENSITIVITY = 0.005;
            const cs = cameraState.current;

            // Use delta from last frame, not from start
            const prevX = touchStart.current.x;
            const prevY = touchStart.current.y;

            cs.targetAzimuth -= (pageX - prevX) * SENSITIVITY;
            cs.targetElevation -= (pageY - prevY) * SENSITIVITY;

            touchStart.current = { x: pageX, y: pageY };
            lastTouchTime.current = performance.now() / 1000;
          }
        },
        onPanResponderRelease: () => {
          if (!touchMoved.current) {
            // It was a tap — dismiss selection
            // (Block selection is handled by R3F onClick in TowerGrid)
            // If nothing was tapped in the 3D scene, deselect
            // We use a small timeout to let the R3F click handler fire first
            setTimeout(() => {
              // Only deselect if no new selection was made
              const current = useTowerStore.getState().selectedBlockId;
              if (current !== null) {
                // Selection was just made by TowerGrid click — keep it
              }
            }, 50);
          }
        },
      }),
    [selectBlock],
  );

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Canvas
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
        }}
        camera={{ position: [0, 20, 50], fov: 50 }}
      >
        <SceneSetup />
        <CameraRig
          cameraState={cameraState}
          lastTouchTime={lastTouchTime}
        />

        <ambientLight intensity={0.3} color="#6666ff" />
        <directionalLight
          position={[10, 30, 10]}
          intensity={1.0}
          color="#ffffff"
        />
        <pointLight
          position={[0, 5, 0]}
          intensity={0.8}
          color="#00ffff"
          distance={60}
          decay={2}
        />
        <pointLight
          position={[0, 20, 0]}
          intensity={0.5}
          color="#6600ff"
          distance={40}
          decay={2}
        />

        <TowerGrid />
        <Particles />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#0a0a0f" transparent opacity={0.8} />
        </mesh>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
});
