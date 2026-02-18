/**
 * Centralized Camera Configuration
 * ═════════════════════════════════════════════════════════════
 * All camera parameters are tunable here without touching camera logic.
 * This makes it easy to iterate on feel and physics in seconds, not hours.
 *
 * Philosophy: Every number that affects how the camera feels should live here.
 * When something doesn't feel right, change ONE value, not hunt through code.
 */

export const CAMERA_CONFIG = {
  // ─── Zoom Levels (distance from tower) ──────────────────────
  // Controls how close/far the camera is positioned
  zoom: {
    overview: 40, // Idle view: far back, see whole tower
    neighborhood: 18, // Transition zoom: between overview and block inspect
    block: 7, // Block inspect: close up, fill most of screen
    min: 7, // Absolute minimum (prevents camera clipping inside tower)
    max: 55, // Absolute maximum (zoomed way out)
  },

  // ─── Lerp Rates (0.0 - 1.0, controls smoothness) ────────────
  // Higher = faster/snappier, Lower = slower/smoother
  lerp: {
    orbit: 0.18, // 1-finger drag response (fast, snappy)
    zoom: 0.22, // Pinch zoom response (immediate)
    transition: 0.045, // Fly-to-block transitions (smooth, slow)
    pan: 0.15, // 2-finger vertical pan response
  },

  // ─── Idle Behavior (when user stops interacting) ────────────
  idle: {
    timeoutSeconds: 4, // How long before auto-rotate starts
    rotateSpeed: 0.0005, // Radians per frame (slower = more majestic)
    zoomOutTimeoutSeconds: 2, // If user is zoomed in, auto-zoom-out after this long
    zoomOutRate: 0.03, // How fast to zoom out (lerp rate)
  },

  // ─── Block Dimming (surrounding blocks visibility) ──────────
  // Controls how visible non-focused blocks are during inspection
  dimming: {
    unselected: 0.0, // Shader fade input for surrounding blocks (0.0 = normal, 1.0 = invisible)
    // Note: Currently keep this at 0.0 (fully visible)
    // If perf allows in the future, can gradually increase to fade surrounding blocks
  },

  // ─── Elevation Angles (radians, not degrees) ───────────────
  // Camera look-down angle (0 = horizontal, π/2 = straight down)
  elevation: {
    overview: 0.45, // ~26° down, cinematic view of whole tower
    block: 0.38, // ~22° down, eye-level inspect view (slightly less dramatic)
    min: 0.3, // Prevent camera going inside tower (too shallow)
    max: 1.3, // Prevent too-steep angles (boring from above)
  },

  // ─── Camera Frustum (clipping planes) ──────────────────────
  frustum: {
    near: 0.1, // Dynamic: Math.max(0.1, zoom * 0.03)
    far: 1200, // Far plane (sky/background)
  },

  // ─── Gesture Sensitivity ──────────────────────────────────
  gesture: {
    orbitSensitivity: 0.006, // Pixels → radians conversion for 1-finger drag
    panYSensitivity: 0.08, // Pixels → lookAt.y units for 2-finger vertical drag
    dragThreshold: 14, // Pixels before a touch becomes a drag (not a tap)
    doubleTapWindowMs: 350, // Time window to detect double-tap
    pinchCooldownMs: 100, // Ignore 1-finger after 2-finger pinch for this duration
  },

  // ─── Physics (momentum, bouncing) ─────────────────────────
  physics: {
    momentumFriction: 0.93, // Per-frame decay (0.93 = slow coast, 0.9 = fast stop)
    momentumMinVelocity: 0.00008, // Stop threshold (below this = halt momentum)
    elasticSpring: 0.08, // Bounce-back force when panning past bounds
  },

  // ─── Transition Thresholds ─────────────────────────────────
  transition: {
    completionThreshold: 0.5, // How close to target before transition complete
  },

  // ─── Camera Near Plane (dynamic) ───────────────────────────
  // Formula: Math.max(frustum.near, zoom * 0.03)
  // Prevents Z-fighting at far distances, keeps close geometry visible
  nearPlaneScale: 0.03, // multiplied by zoom

  // ─── Camera Y Bounds ───────────────────────────────────────
  // Prevents camera going too high/low
  cameraBounds: {
    yMin: 0.5, // Prevents underground viewing
    yMax: 100, // Prevents too-high viewing (adjust based on tower height)
  },

  // ─── Block Inspection State ────────────────────────────────
  // When a block is selected, what does the camera do?
  inspect: {
    zoom: 7, // Target zoom for block inspection
    elevation: 0.38, // Target elevation angle
    // Note: Camera position comes from block's position in space
  },

  // Helper: Determine mode based on zoom
  getMode(zoom: number): "overview" | "neighborhood" | "block" {
    if (zoom >= 29) return "overview";
    if (zoom >= 18) return "neighborhood";
    return "block";
  },

  // Helper: Get target elevation based on mode
  getTargetElevation(mode: "overview" | "neighborhood" | "block" | "inspect"): number {
    switch (mode) {
      case "overview":
        return this.elevation.overview;
      case "neighborhood":
        return this.elevation.overview; // Same as overview initially
      case "block":
      case "inspect":
        return this.elevation.block;
      default:
        return this.elevation.overview;
    }
  },

  // Helper: Clamp zoom within valid range
  clampZoom(z: number): number {
    return Math.max(this.zoom.min, Math.min(this.zoom.max, z));
  },

  // Helper: Clamp elevation within valid range
  clampElevation(e: number): number {
    return Math.max(this.elevation.min, Math.min(this.elevation.max, e));
  },

  // Helper: Clamp lookAt.y within tower bounds
  clampLookAtY(y: number): number {
    return Math.max(this.cameraBounds.yMin, Math.min(this.cameraBounds.yMax, y));
  },
};

// Type inference for easier use
export type CameraMode = "overview" | "neighborhood" | "block" | "inspect";
