/**
 * useTowerReveal — Tower build-up reveal animation.
 *
 * Runs inside R3F Canvas (needs useFrame). When `initialized` becomes true,
 * ramps `revealProgress` 0→1 over ~3s with ease-out cubic.
 * Drives camera sweep: azimuth rotation + elevation transition during reveal.
 *
 * All math pre-allocated in refs (no `new` in useFrame).
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import { useTowerStore } from "@/stores/tower-store";
import { CAMERA_CONFIG } from "@/constants/CameraConfig";
import { getTowerHeight, DEFAULT_TOWER_CONFIG } from "@monolith/common";

const REVEAL_DURATION = 3.0; // seconds
const TOWER_HEIGHT = getTowerHeight(DEFAULT_TOWER_CONFIG.layerCount);
const OVERVIEW_LOOKAT_Y = TOWER_HEIGHT * CAMERA_CONFIG.overview.lookAtY;

// Camera reveal params
const REVEAL_START_ELEVATION = 0.8;
const REVEAL_END_ELEVATION = CAMERA_CONFIG.elevation.overview; // 1.2
const REVEAL_START_ZOOM = 35;
const REVEAL_END_ZOOM = CAMERA_CONFIG.zoom.overview; // 40
const REVEAL_AZIMUTH_SWEEP = Math.PI * 0.4; // Sweep ~72° during reveal

/** Ease-out cubic: decelerating to zero velocity */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function useTowerReveal(
  cameraState: React.MutableRefObject<any> | null,
  lastTouchTime: React.MutableRefObject<number> | null,
) {
  const initialized = useTowerStore((s) => s.initialized);
  const revealComplete = useTowerStore((s) => s.revealComplete);
  const setRevealProgress = useTowerStore((s) => s.setRevealProgress);
  const setRevealComplete = useTowerStore((s) => s.setRevealComplete);

  // Track reveal timing — pre-allocated refs
  const revealStartedRef = useRef(false);
  const revealStartTimeRef = useRef(0);
  const startAzimuthRef = useRef(0);

  useFrame(() => {
    if (revealComplete) return;
    if (!initialized) return;
    if (!cameraState?.current) return;

    const cs = cameraState.current;
    const now = performance.now() / 1000;

    // Start reveal on first frame after initialized
    if (!revealStartedRef.current) {
      revealStartedRef.current = true;
      revealStartTimeRef.current = now;
      startAzimuthRef.current = cs.azimuth;

      // Set initial camera position for reveal (looking more from above)
      cs.elevation = REVEAL_START_ELEVATION;
      cs.targetElevation = REVEAL_START_ELEVATION;
      cs.zoom = REVEAL_START_ZOOM;
      cs.targetZoom = REVEAL_START_ZOOM;
      cs.lookAt.set(0, OVERVIEW_LOOKAT_Y * 0.3, 0);
      cs.targetLookAt.set(0, OVERVIEW_LOOKAT_Y * 0.3, 0);

      // Play tower rise SFX
      try {
        const { playTowerRise } = require("@/utils/audio");
        playTowerRise();
      } catch { /* audio not ready yet */ }

      return;
    }

    const elapsed = now - revealStartTimeRef.current;
    const rawT = Math.min(elapsed / REVEAL_DURATION, 1);
    const t = easeOutCubic(rawT);

    // Update store progress (drives TowerGrid layer gating)
    setRevealProgress(t);

    // Drive camera during reveal — override targets
    const startAz = startAzimuthRef.current;
    cs.targetAzimuth = startAz + REVEAL_AZIMUTH_SWEEP * t;
    cs.azimuth = cs.targetAzimuth; // Direct set for smooth reveal
    cs.targetElevation = REVEAL_START_ELEVATION + (REVEAL_END_ELEVATION - REVEAL_START_ELEVATION) * t;
    cs.elevation = cs.targetElevation;
    cs.targetZoom = REVEAL_START_ZOOM + (REVEAL_END_ZOOM - REVEAL_START_ZOOM) * t;
    cs.zoom = cs.targetZoom;

    // Sweep lookAt Y from low to overview center
    const lookAtY = OVERVIEW_LOOKAT_Y * (0.3 + 0.7 * t);
    cs.lookAt.set(0, lookAtY, 0);
    cs.targetLookAt.set(0, lookAtY, 0);

    // Mark last touch time to prevent auto-rotate from fighting
    if (lastTouchTime) {
      lastTouchTime.current = now;
    }

    // Complete
    if (rawT >= 1) {
      setRevealComplete(true);
      setRevealProgress(1);
    }
  });

  return { revealComplete, initialized };
}
