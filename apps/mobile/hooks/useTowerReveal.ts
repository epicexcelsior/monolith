/**
 * useTowerReveal — Tower build-up reveal + cinematic orbit animation.
 *
 * Runs inside R3F Canvas (needs useFrame). Two phases:
 *
 *   Phase A — Build reveal (3s): Blocks scale up layer by layer, camera sweeps 72°
 *   Phase B — Cinematic orbit (5s): Smooth ~300° orbit showing the full tower
 *
 * When both complete, sets `revealComplete = true` and advances onboarding
 * from `cinematic` → `title`.
 *
 * All math pre-allocated in refs (no `new` in useFrame).
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import { useTowerStore } from "@/stores/tower-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { CAMERA_CONFIG } from "@/constants/CameraConfig";
import { getTowerHeight, DEFAULT_TOWER_CONFIG } from "@monolith/common";

// ─── Phase A: Build Reveal ──────────────────────────
const REVEAL_DURATION = 3.0; // seconds
const TOWER_HEIGHT = getTowerHeight(DEFAULT_TOWER_CONFIG.layerCount);
const OVERVIEW_LOOKAT_Y = TOWER_HEIGHT * CAMERA_CONFIG.overview.lookAtY;

const REVEAL_START_ELEVATION = 0.8;
const REVEAL_END_ELEVATION = CAMERA_CONFIG.elevation.overview; // 1.2
const REVEAL_START_ZOOM = 35;
const REVEAL_END_ZOOM = CAMERA_CONFIG.zoom.overview; // 40
const REVEAL_AZIMUTH_SWEEP = Math.PI * 0.4; // ~72° during build

// ─── Phase B: Cinematic Orbit ───────────────────────
const CINEMATIC_ORBIT_DURATION = 5.0; // seconds after build reveal
const CINEMATIC_ORBIT_ARC = Math.PI * 1.67; // ~300 degrees

// Keyframes for elevation oscillation during orbit (interpolated via catmull-rom-like)
const CINEMATIC_ELEVATION_KEYS = [1.2, 1.0, 1.3, 1.2];
// Keyframes for zoom breathing during orbit
const CINEMATIC_ZOOM_KEYS = [40, 35, 42, 40];
// LookAt Y drift — starts at overview, drifts up slightly, settles
const CINEMATIC_LOOKAT_Y_KEYS = [1.0, 1.05, 1.1, 1.0]; // multipliers of OVERVIEW_LOOKAT_Y

/** Ease-out cubic: decelerating to zero velocity */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Ease-in-out cubic: smooth both ends */
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Interpolate through 4 keyframes using t (0→1) */
function lerpKeyframes(keys: number[], t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const segments = keys.length - 1;
  const pos = clamped * segments;
  const i = Math.min(Math.floor(pos), segments - 1);
  const frac = pos - i;
  return keys[i] + (keys[i + 1] - keys[i]) * frac;
}

export function useTowerReveal(
  cameraState: React.MutableRefObject<any> | null,
  lastTouchTime: React.MutableRefObject<number> | null,
) {
  const initialized = useTowerStore((s) => s.initialized);
  const revealComplete = useTowerStore((s) => s.revealComplete);
  const setRevealProgress = useTowerStore((s) => s.setRevealProgress);
  const setRevealComplete = useTowerStore((s) => s.setRevealComplete);

  const onboardingPhase = useOnboardingStore((s) => s.phase);
  const advancePhase = useOnboardingStore((s) => s.advancePhase);

  // Track reveal timing — pre-allocated refs
  const revealStartedRef = useRef(false);
  const revealStartTimeRef = useRef(0);
  const startAzimuthRef = useRef(0);
  const cinematicStartedRef = useRef(false);
  const cinematicStartTimeRef = useRef(0);
  const cinematicBaseAzimuthRef = useRef(0);
  const doneRef = useRef(false);
  const prevRevealCompleteRef = useRef(false);

  useFrame(() => {
    // Detect replay: revealComplete went from true → false (onboarding reset)
    if (prevRevealCompleteRef.current && !revealComplete) {
      doneRef.current = false;
      revealStartedRef.current = false;
      cinematicStartedRef.current = false;
    }
    prevRevealCompleteRef.current = revealComplete;

    if (doneRef.current) return;
    if (revealComplete) { doneRef.current = true; return; }
    if (!initialized) return;
    if (!cameraState?.current) return;

    const cs = cameraState.current;
    const now = performance.now() / 1000;

    // ─── Phase A: Build Reveal ──────────────────
    if (!revealStartedRef.current) {
      revealStartedRef.current = true;
      revealStartTimeRef.current = now;
      startAzimuthRef.current = cs.azimuth;

      // Initial camera position
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

    // Suppress auto-rotate
    if (lastTouchTime) {
      lastTouchTime.current = now;
    }

    // Phase A still running
    if (rawT < 1) {
      setRevealProgress(t);

      const startAz = startAzimuthRef.current;
      cs.targetAzimuth = startAz + REVEAL_AZIMUTH_SWEEP * t;
      cs.azimuth = cs.targetAzimuth;
      cs.targetElevation = REVEAL_START_ELEVATION + (REVEAL_END_ELEVATION - REVEAL_START_ELEVATION) * t;
      cs.elevation = cs.targetElevation;
      cs.targetZoom = REVEAL_START_ZOOM + (REVEAL_END_ZOOM - REVEAL_START_ZOOM) * t;
      cs.zoom = cs.targetZoom;

      const lookAtY = OVERVIEW_LOOKAT_Y * (0.3 + 0.7 * t);
      cs.lookAt.set(0, lookAtY, 0);
      cs.targetLookAt.set(0, lookAtY, 0);
      return;
    }

    // Phase A complete — ensure progress is at 1
    setRevealProgress(1);

    // If not in cinematic onboarding phase, skip orbit and finish
    if (onboardingPhase !== "cinematic") {
      setRevealComplete(true);
      doneRef.current = true;
      return;
    }

    // ─── Phase B: Cinematic Orbit ───────────────
    if (!cinematicStartedRef.current) {
      cinematicStartedRef.current = true;
      cinematicStartTimeRef.current = now;
      cinematicBaseAzimuthRef.current = cs.azimuth;
      return;
    }

    const orbitElapsed = now - cinematicStartTimeRef.current;
    const orbitRawT = Math.min(orbitElapsed / CINEMATIC_ORBIT_DURATION, 1);
    const orbitT = easeInOutCubic(orbitRawT);

    // Drive camera
    const baseAz = cinematicBaseAzimuthRef.current;
    cs.targetAzimuth = baseAz + CINEMATIC_ORBIT_ARC * orbitT;
    cs.azimuth = cs.targetAzimuth;

    cs.targetElevation = lerpKeyframes(CINEMATIC_ELEVATION_KEYS, orbitT);
    cs.elevation = cs.targetElevation;

    cs.targetZoom = lerpKeyframes(CINEMATIC_ZOOM_KEYS, orbitT);
    cs.zoom = cs.targetZoom;

    const lookAtYMul = lerpKeyframes(CINEMATIC_LOOKAT_Y_KEYS, orbitT);
    cs.lookAt.set(0, OVERVIEW_LOOKAT_Y * lookAtYMul, 0);
    cs.targetLookAt.set(0, OVERVIEW_LOOKAT_Y * lookAtYMul, 0);

    // Complete orbit
    if (orbitRawT >= 1) {
      setRevealComplete(true);
      doneRef.current = true;
      // Advance onboarding: cinematic → title
      advancePhase();
    }
  });

  return { revealComplete, initialized };
}
