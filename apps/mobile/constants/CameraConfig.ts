/**
 * Centralized Camera Configuration
 *
 * Every number that affects how the camera feels lives here.
 * Pure data — no methods, no logic. Import and use directly.
 */

export const CAMERA_CONFIG = {
  // ─── Zoom Levels (distance from tower) ──────────────────────
  zoom: {
    overview: 40,
    neighborhood: 18,
    block: 12,           // Block inspect — close but outside tower geometry
    min: 12,             // Matches block zoom — can't clip inside tower
    max: 55,
    overviewThreshold: 29, // zoom >= this → "overview" tier
  },

  // ─── Lerp Rates (0–1, higher = snappier) ────────────────────
  lerp: {
    orbit: 0.18,
    zoom: 0.22,
    transition: 0.045,
  },

  // ─── Idle Behavior ──────────────────────────────────────────
  idle: {
    timeoutSeconds: 4,
    rotateSpeed: 0.0005,
  },

  // ─── Elevation Angles (radians) ─────────────────────────────
  // 0 = directly above, π/2 = horizontal (side-on)
  elevation: {
    overview: 1.2,       // ~69° from vertical — dramatic side view of tower
    block: 1.35,         // ~77° from vertical — nearly eye-level with the block
    min: 0.3,            // floor — prevents looking straight down
    max: 1.5,            // ceiling — just under horizontal to avoid ground clipping
  },

  // ─── Frustum ────────────────────────────────────────────────
  frustum: {
    near: 0.1,           // dynamic: Math.max(near, zoom * nearPlaneScale)
    far: 1200,
  },
  nearPlaneScale: 0.03,

  // ─── Gesture Sensitivity ────────────────────────────────────
  gesture: {
    orbitSensitivity: 0.006,
    panYSensitivity: 0.08,
    dragThreshold: 14,
    doubleTapWindowMs: 350,
    pinchCooldownMs: 100,
  },

  // ─── Physics ────────────────────────────────────────────────
  physics: {
    momentumFriction: 0.93,
    momentumMinVelocity: 0.00008,
    elasticSpring: 0.08,
    lookAtYOverscroll: 2,
  },

  // ─── Transition ─────────────────────────────────────────────
  transition: {
    completionThreshold: 0.5,
  },

  // ─── Overview Reset ─────────────────────────────────────────
  overview: {
    azimuth: Math.PI / 5,
    yFloor: 0.5,         // camera Y never goes below this
  },
} as const;

export type CameraMode = "overview" | "neighborhood" | "block";

/** Determine camera mode from current zoom distance */
export function getZoomMode(zoom: number): CameraMode {
  if (zoom >= CAMERA_CONFIG.zoom.overviewThreshold) return "overview";
  if (zoom >= CAMERA_CONFIG.zoom.neighborhood) return "neighborhood";
  return "block";
}
