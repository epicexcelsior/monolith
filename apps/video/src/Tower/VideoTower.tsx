import React, { useMemo, useCallback, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { getTowerHeight, DEFAULT_TOWER_CONFIG } from "@monolith/common";
import { VideoBlocks } from "./VideoBlocks";
import { VideoFoundation } from "./VideoFoundation";
import { VideoParticles } from "./VideoParticles";
import { generateBlocks } from "./generateBlocks";
import { NightSkybox } from "../Environment/NightSkybox";
import { GroundPlane } from "../Environment/GroundPlane";
import { AtmosphericHaze } from "../Environment/AtmosphericHaze";
import { TowerCore } from "../Environment/TowerCore";
import type { CameraPath, InspectCameraPath, InspectCameraTarget } from "../Camera/paths";

const TOWER_HEIGHT = getTowerHeight(DEFAULT_TOWER_CONFIG.layerCount);

interface VideoTowerProps {
  cameraPath: CameraPath | InspectCameraPath;
  blocks?: ReturnType<typeof generateBlocks>;
  /** Whether this path returns InspectCameraTarget (with inspectProgress) */
  isInspectPath?: boolean;
  /** Custom image atlas texture (overrides default procedural atlas) */
  atlasTexture?: THREE.Texture;
  /** Atlas grid layout (default: { cols: 3, rows: 2 }) */
  atlasLayout?: { cols: number; rows: number };
  /** Fog density override (default: 0.022, set 0 to disable) */
  fogDensity?: number;
  /** Custom skybox component (replaces default NightSkybox) */
  SkyboxComponent?: React.FC<{ frame: number; fps: number }>;
  /** Background fog color override */
  fogColor?: string;
}

/**
 * Complete tower scene for video rendering.
 * Features real GLSL shaders, night skybox, ground plane, atmospheric haze,
 * and tower core glow — matching the in-game rendering pipeline.
 */
export const VideoTower: React.FC<VideoTowerProps> = ({
  cameraPath,
  blocks: externalBlocks,
  isInspectPath = false,
  atlasTexture,
  atlasLayout,
  fogDensity,
  SkyboxComponent,
  fogColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const cameraRef = useRef<THREE.Camera | null>(null);

  const blocks = useMemo(
    () => externalBlocks ?? generateBlocks(42),
    [externalBlocks],
  );

  const handleCreated = useCallback((state: { camera: THREE.Camera }) => {
    cameraRef.current = state.camera;
  }, []);

  // Update camera position each frame
  const progress = frame / durationInFrames;
  const target = cameraPath(progress);
  const camera = cameraRef.current;
  if (camera) {
    camera.position.set(...target.position);
    camera.lookAt(new THREE.Vector3(...target.lookAt));
    if ("updateProjectionMatrix" in camera) {
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  }

  // Extract inspect progress if available
  const inspectTarget = isInspectPath ? (target as InspectCameraTarget) : null;
  const inspectProgress = inspectTarget?.inspectProgress ?? 0;
  const inspectY = inspectTarget?.inspectY ?? 0;

  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{ fov: 50, near: 0.1, far: 1200, position: target.position }}
      gl={{ antialias: true, alpha: false }}
      onCreated={handleCreated}
    >
      {/* ─── Lighting (brighter for video) ── */}
      <ambientLight intensity={0.18} color="#1a1020" />
      <hemisphereLight args={["#0d0818", "#2a1408", 0.40]} />
      <directionalLight position={[12, 40, 8]} intensity={0.16} color="#8090B0" />
      {/* Tower base uplight — warm glow */}
      <pointLight
        position={[0, 1, 0]}
        intensity={1.8}
        color="#CC6010"
        distance={35}
        decay={1.5}
      />
      {/* Spire crown — mystical glow */}
      <pointLight
        position={[0, TOWER_HEIGHT - 2, 0]}
        intensity={2.2}
        color="#804020"
        distance={25}
        decay={1.2}
      />
      {/* Mid-tower — prominent */}
      <pointLight
        position={[0, TOWER_HEIGHT * 0.5, 0]}
        intensity={1.2}
        color="#602010"
        distance={20}
        decay={1.5}
      />
      {/* Foundation — strong glow */}
      <pointLight
        position={[0, 4, 0]}
        intensity={1.5}
        color="#8A3010"
        distance={18}
        decay={1.6}
      />
      {/* Accent: deep purple from left — dimensional */}
      <pointLight
        position={[-32, TOWER_HEIGHT * 0.6, -6]}
        intensity={0.65}
        color="#200830"
        distance={55}
        decay={1.1}
      />
      {/* Accent: dark teal from right — cool depth */}
      <pointLight
        position={[30, TOWER_HEIGHT * 0.35, 14]}
        intensity={0.55}
        color="#081e22"
        distance={50}
        decay={1.1}
      />

      {/* ─── Environment ── */}
      {SkyboxComponent ? (
        <SkyboxComponent frame={frame} fps={fps} />
      ) : (
        <NightSkybox frame={frame} fps={fps} />
      )}
      <TowerCore frame={frame} fps={fps} />
      <GroundPlane />
      <AtmosphericHaze />

      {/* ─── Tower Content ── */}
      <VideoBlocks
        blocks={blocks}
        frame={frame}
        fps={fps}
        inspectProgress={inspectProgress}
        inspectY={inspectY}
        cameraPosition={target.position}
        atlasTexture={atlasTexture}
        atlasLayout={atlasLayout}
        fogDensity={fogDensity}
        fogColor={fogColor}
      />
      <VideoFoundation />
      <VideoParticles frame={frame} fps={fps} />
    </ThreeCanvas>
  );
};
