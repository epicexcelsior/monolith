import React, { useRef, useLayoutEffect } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import type { CameraPath } from "./paths";

interface CameraRigProps {
  path: CameraPath;
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
}

/**
 * Frame-driven camera rig for Remotion.
 * Uses a ref to the camera rather than useThree() to avoid
 * R3F context boundary issues with @remotion/three's bundled fiber.
 */
export const CameraRig: React.FC<CameraRigProps> = ({ path, cameraRef }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = frame / durationInFrames;
  const target = path(progress);

  const camera = cameraRef.current;
  if (camera) {
    camera.position.set(...target.position);
    camera.lookAt(new THREE.Vector3(...target.lookAt));
    camera.updateProjectionMatrix();
  }

  return null;
};
