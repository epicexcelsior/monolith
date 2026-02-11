import React, { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import { View, StyleSheet, PanResponder, Dimensions } from "react-native";
import * as THREE from "three";
import TowerGrid from "./TowerGrid";

/**
 * CameraRig — Handles camera movement based on user gestures.
 * Reads from a shared mutable ref to avoid React re-renders.
 */
function CameraRig({
  cameraState,
}: {
  cameraState: React.MutableRefObject<{
    azimuth: number;
    elevation: number;
    zoom: number;
  }>;
}) {
  const { camera } = useThree();
  const vec = new THREE.Vector3();

  useFrame(() => {
    // 1. Convert spherical coords to Cartesian
    // azimuth (theta) = horizontal rotation
    // elevation (phi) = vertical angle (0 = top, PI/2 = horizon)

    // Clamp elevation to avoid flipping
    const minElevation = 0.1;
    const maxElevation = Math.PI / 2 - 0.1;
    cameraState.current.elevation = Math.max(
      minElevation,
      Math.min(maxElevation, cameraState.current.elevation),
    );

    const radius = cameraState.current.zoom;
    const theta = cameraState.current.azimuth;
    const phi = cameraState.current.elevation;

    // Standard spherical to cartesian conversion
    // y is up
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);

    camera.position.set(x, y, z);
    camera.lookAt(0, 10, 0); // Look at center of tower (approx height 10)
  });

  return null;
}

/**
 * TowerScene — The main R3F Canvas wrapper.
 * Includes custom PanResponder for camera orbit controls.
 */
export default function TowerScene() {
  // Mutable state for camera orbit
  // initial: looking from slightly above (elevation ~0.5 rad), zoom 50
  const cameraState = useRef({
    azimuth: Math.PI / 4,
    elevation: 0.8,
    zoom: 50,
  });

  // Track previous touch for delta calculation
  const touchState = useRef({ x: 0, y: 0 });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          touchState.current.x = evt.nativeEvent.pageX;
          touchState.current.y = evt.nativeEvent.pageY;
        },
        onPanResponderMove: (evt) => {
          const { pageX, pageY } = evt.nativeEvent;
          const dx = pageX - touchState.current.x;
          const dy = pageY - touchState.current.y;

          touchState.current.x = pageX;
          touchState.current.y = pageY;

          // Sensitivity
          const SENSITIVITY = 0.005;

          // Update rotation
          cameraState.current.azimuth -= dx * SENSITIVITY;
          cameraState.current.elevation -= dy * SENSITIVITY;
        },
      }),
    [],
  );

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Canvas
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
        }}
        // Initial camera (will be overridden by CameraRig immediately)
        camera={{ position: [0, 20, 50], fov: 50 }}
      >
        <CameraRig cameraState={cameraState} />

        <ambientLight intensity={0.3} color="#6666ff" />
        <directionalLight
          position={[10, 30, 10]}
          intensity={1.0}
          color="#ffffff"
        />
        <pointLight
          position={[0, 10, 0]}
          intensity={0.8}
          color="#00ffff"
          distance={60}
          decay={2}
        />

        <TowerGrid />

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
