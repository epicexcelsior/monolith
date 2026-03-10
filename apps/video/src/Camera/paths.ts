import { DEFAULT_TOWER_CONFIG, getTowerHeight, getLayerY } from "@monolith/common";

const TOWER_HEIGHT = getTowerHeight(DEFAULT_TOWER_CONFIG.layerCount);

export interface CameraTarget {
  position: [number, number, number];
  lookAt: [number, number, number];
}

export type CameraPath = (progress: number) => CameraTarget;

/** Smooth easeInOutCubic */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Smooth easeInOutExpo */
function easeInOutExpo(t: number): number {
  if (t === 0 || t === 1) return t;
  return t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2;
}

// ─── Scene 0: The Void ──────────────────────────────────────────────────────
/**
 * voidApproach — Tower emerges from the void. Camera far but closer than originally,
 * giving enough presence to see the tower's outline.
 */
export const voidApproach: CameraPath = (progress) => {
  const eased = easeInOutCubic(progress);
  const angle = Math.PI * 0.55 + eased * 0.06; // barely moves
  const radius = 56; // closer (was 72) so tower is more visible
  const y = TOWER_HEIGHT * 0.32 + eased * 4; // slightly higher for better view

  return {
    position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
    lookAt: [0, TOWER_HEIGHT * 0.36, 0],
  };
};

// ─── Scene 1: MONOLITH Reveal ────────────────────────────────────────────────
/**
 * monumentReveal — Camera stationed wide, slightly pushing in as the tower materialises.
 * Classic cinematic reveal on the drop beat.
 */
export const monumentReveal: CameraPath = (progress) => {
  const eased = easeInOutCubic(progress);
  const angle = Math.PI * 0.5 - eased * 0.10;
  const radius = 50 - eased * 6; // 50 → 44, gentle push-in
  const y = TOWER_HEIGHT * 0.22 + eased * TOWER_HEIGHT * 0.08;

  return {
    position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
    lookAt: [0, TOWER_HEIGHT * 0.4, 0],
  };
};

// ─── Scene 2: CLAIM ──────────────────────────────────────────────────────────
/**
 * claimOrbit — Stately slow arc around the front face of the tower.
 * Shows the blocks as territory to be claimed.
 */
export const claimOrbit: CameraPath = (progress) => {
  const eased = easeInOutCubic(progress);
  const angle = Math.PI * 0.28 + eased * Math.PI * 0.38;
  const radius = 46;
  const y = TOWER_HEIGHT * 0.40;

  return {
    position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
    lookAt: [0, TOWER_HEIGHT * 0.36, 0],
  };
};

// ─── Scene 3: EARN ───────────────────────────────────────────────────────────
/**
 * earnHover — Camera locks at mid-tower, gentle breathing bob.
 * The tower's glowing blocks pulse with passive income energy.
 */
export const earnHover: CameraPath = (progress) => {
  const angle = Math.PI * 0.62 + progress * 0.18; // very slow creep
  const radius = 38;
  const bob = Math.sin(progress * Math.PI * 2.5) * 1.8;
  const y = TOWER_HEIGHT * 0.44 + bob;

  return {
    position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
    lookAt: [0, TOWER_HEIGHT * 0.42, 0],
  };
};

// ─── Scene 4: CUSTOMIZE (inspect path) ───────────────────────────────────────
export interface InspectCameraTarget extends CameraTarget {
  inspectProgress: number;
  inspectY: number;
}

export type InspectCameraPath = (progress: number) => InspectCameraTarget;

// Reuse the same target block as VideoBlocks (layer 8, front face)
const INSPECT_LAYER = 8;
const INSPECT_BLOCK_Y = getLayerY(INSPECT_LAYER, DEFAULT_TOWER_CONFIG.layerCount);
const INSPECT_X = 3.0;
const INSPECT_Z = 4.5;
const popLen = Math.sqrt(INSPECT_X * INSPECT_X + INSPECT_Z * INSPECT_Z);
const POP_X = (INSPECT_X / popLen) * 1.2;
const POP_Z = (INSPECT_Z / popLen) * 1.2;

/**
 * customizeInspect — Approaches mid-tower block, flies in close, lingers.
 * Returns inspect data so VideoBlocks highlights the target block.
 */
export const customizeInspect: InspectCameraPath = (progress) => {
  const midY = TOWER_HEIGHT * 0.42;

  // Phase 1: Establishing orbit (0–0.3)
  if (progress < 0.3) {
    const t = easeInOutCubic(progress / 0.3);
    const angle = Math.PI * 0.72 + t * Math.PI * 0.28;
    const radius = 48 - t * 8;
    return {
      position: [Math.cos(angle) * radius, midY + 5, Math.sin(angle) * radius],
      lookAt: [0, midY * 0.92, 0],
      inspectProgress: 0,
      inspectY: INSPECT_BLOCK_Y,
    };
  }

  // Phase 2: Fly-in to the block (0.3–0.55)
  if (progress < 0.55) {
    const t = (progress - 0.3) / 0.25;
    const ease = easeInOutExpo(t);

    const startAngle = Math.PI * 0.72 + Math.PI * 0.28;
    const startRadius = 40;
    const startY = midY + 5;

    const targetAngle = Math.atan2(INSPECT_X + POP_X, INSPECT_Z + POP_Z);
    const endRadius = 11;
    const endY = INSPECT_BLOCK_Y + 1.5;

    const angle = startAngle + (targetAngle - startAngle) * ease;
    const radius = startRadius + (endRadius - startRadius) * ease;
    const camY = startY + (endY - startY) * ease;
    const lookX = (INSPECT_X + POP_X) * ease;
    const lookZ = (INSPECT_Z + POP_Z) * ease;
    const lookY = midY + (INSPECT_BLOCK_Y - midY) * ease;

    return {
      position: [Math.cos(angle) * radius, camY, Math.sin(angle) * radius],
      lookAt: [lookX, lookY, lookZ],
      inspectProgress: ease,
      inspectY: INSPECT_BLOCK_Y,
    };
  }

  // Phase 3: Hold (0.55–0.8) — tight on the block
  if (progress < 0.8) {
    const t = (progress - 0.55) / 0.25;
    const targetAngle = Math.atan2(INSPECT_X + POP_X, INSPECT_Z + POP_Z);
    const microOrbit = Math.sin(t * Math.PI) * 0.07;
    return {
      position: [
        Math.cos(targetAngle + microOrbit) * 11,
        INSPECT_BLOCK_Y + 1.5 + Math.sin(t * Math.PI) * 0.4,
        Math.sin(targetAngle + microOrbit) * 11,
      ],
      lookAt: [INSPECT_X, INSPECT_BLOCK_Y, INSPECT_Z],
      inspectProgress: 1,
      inspectY: INSPECT_BLOCK_Y,
    };
  }

  // Phase 4: Pull back (0.8–1.0)
  {
    const t = (progress - 0.8) / 0.2;
    const ease = easeInOutExpo(t);
    const targetAngle = Math.atan2(INSPECT_X + POP_X, INSPECT_Z + POP_Z);
    const endAngle = targetAngle + Math.PI * 0.25;
    const angle = targetAngle + (endAngle - targetAngle) * ease;
    const radius = 11 + (42 - 11) * ease;
    const camY = INSPECT_BLOCK_Y + 1.5 + (TOWER_HEIGHT * 0.4 - INSPECT_BLOCK_Y - 1.5) * ease;
    const lookX = INSPECT_X * (1 - ease);
    const lookZ = INSPECT_Z * (1 - ease);
    const lookY = INSPECT_BLOCK_Y + (TOWER_HEIGHT * 0.38 - INSPECT_BLOCK_Y) * ease;

    return {
      position: [Math.cos(angle) * radius, camY, Math.sin(angle) * radius],
      lookAt: [lookX, lookY, lookZ],
      inspectProgress: 1 - ease,
      inspectY: INSPECT_BLOCK_Y,
    };
  }
};

// ─── Scene 5: CONQUER ────────────────────────────────────────────────────────
/**
 * conquestPullback — Starts relatively close, then dramatically pulls back to
 * reveal the full height of the tower — the monument in its entirety.
 */
export const conquestPullback: CameraPath = (progress) => {
  const ease = easeInOutExpo(progress);
  const angle = Math.PI * 0.82 + ease * Math.PI * 0.28;
  const radius = 30 + ease * 30; // 30 → 60
  const y = TOWER_HEIGHT * 0.32 + ease * TOWER_HEIGHT * 0.22; // rises with pullback

  return {
    position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
    lookAt: [0, TOWER_HEIGHT * 0.42, 0],
  };
};

// ─── Scene 6: JOIN CTA ───────────────────────────────────────────────────────
/**
 * ctaLowAngle — Dramatically low angle, camera near the base looking way up.
 * Tower dominates the entire frame. Very slow clockwise creep.
 */
export const ctaLowAngle: CameraPath = (progress) => {
  const eased = easeInOutCubic(progress);
  const angle = Math.PI * 0.32 + eased * Math.PI * 0.14;
  const radius = 50;
  const y = 2 + eased * 4; // stays very low

  return {
    position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
    lookAt: [0, TOWER_HEIGHT * 0.52, 0], // looking way up into the tower
  };
};

// ─── Art Piece: Slow Full Orbit ──────────────────────────────────────────────
/**
 * artOrbit — One slow 360° revolution at mid-height.
 * Speed curve: slow → 1.5x faster → slow (sine easing on angle).
 * Cosine bob starts/ends with zero velocity (no jitter).
 * progress 0–1 covers the orbit portion only; caller handles end card timing.
 */
export const artOrbit: CameraPath = (progress) => {
  const p = Math.max(0, Math.min(1, progress));

  // Sine-based speed curve: slow at edges, ~1.5x faster in the middle
  // Integral of (1 - 0.35*cos(2πt)) from 0 to p, normalized to [0,1] at p=1
  // Raw integral = p - 0.35/(2π)*sin(2πp). At p=1 this equals 1, so it's self-normalizing.
  const easedP = p - (0.35 / (2 * Math.PI)) * Math.sin(2 * Math.PI * p);

  const angle = Math.PI * 0.5 + easedP * Math.PI * 2; // full 360°
  const radius = 44;

  // Cosine bob: starts at 0 with zero derivative, smooth loop
  const bob = (1 - Math.cos(p * Math.PI * 2)) * 0.75;
  const y = TOWER_HEIGHT * 0.38 + bob;

  return {
    position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
    lookAt: [0, TOWER_HEIGHT * 0.36, 0],
  };
};

// ─── Pitch Deck Slide 3: Cinematic Spin-In ──────────────────────────────────
/**
 * pitchDeckSpinIn — Matches the pitch deck slide 3 camera exactly.
 * Low-angle cinematic spin-in: starts far (radius 55), zooms to 22 with
 * easeOutExpo, spinning 1.8π radians, then slow auto-orbit.
 * Duration: 20 seconds.
 */
function easeOutExpo(x: number): number {
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

export const pitchDeckSpinIn: CameraPath = (progress) => {
  const totalSeconds = 20;
  const time = progress * totalSeconds;

  const introDur = 5.0;
  const introT = Math.min(time / introDur, 1);
  const introE = easeOutExpo(introT);
  const introSpin = (1 - introE) * Math.PI * 1.8;
  const autoOrbit = time * 0.015;
  const camAngle = 0.6 + autoOrbit + introSpin;

  const camRStart = 55, camREnd = 22;
  const camR = camRStart + (camREnd - camRStart) * introE;
  const introY = (1 - introE) * 8;

  return {
    position: [
      Math.sin(camAngle) * camR,
      introY,
      Math.cos(camAngle) * camR,
    ],
    lookAt: [0, TOWER_HEIGHT * 0.35, 0],
  };
};

// ─── Legacy paths (used by SpiralReveal / OrbitPunch / DollyParallax) ────────

export const spiralAscend: CameraPath = (progress) => {
  const eased = easeInOutCubic(progress);
  const angle = eased * Math.PI * 0.9;
  const radius = 52 - eased * 8;
  const y = 2 + eased * (TOWER_HEIGHT * 0.55);

  return {
    position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
    lookAt: [0, y * 0.5, 0],
  };
};

export const orbitPunch: CameraPath = (progress) => {
  const midY = TOWER_HEIGHT * 0.45;

  if (progress < 0.6) {
    const t = progress / 0.6;
    const angle = Math.PI * 0.25 + t * Math.PI * 1.2;
    const radius = 42;
    return {
      position: [Math.cos(angle) * radius, midY + 5, Math.sin(angle) * radius],
      lookAt: [0, midY, 0],
    };
  }

  const t = (progress - 0.6) / 0.4;
  const ease = 1 - Math.pow(2, -10 * t);
  const radius = 42 - ease * 26;
  const angle = Math.PI * 0.25 + (0.6 / 0.6) * Math.PI * 1.2 + t * 0.3;

  return {
    position: [Math.cos(angle) * radius, midY + 5 - ease * 3, Math.sin(angle) * radius],
    lookAt: [0, midY, 0],
  };
};

export const dollyParallax: CameraPath = (progress) => {
  const eased = easeInOutCubic(progress);
  const midY = TOWER_HEIGHT * 0.38;
  const x = -10 + eased * 20;
  const z = 38 - Math.sin(eased * Math.PI) * 4;

  return {
    position: [x, midY + 2, z],
    lookAt: [0, midY, 0],
  };
};

// Legacy inspect path (kept for SpiralReveal/OrbitPunch scenes)
export const inspectBlock: InspectCameraPath = (progress) => {
  return customizeInspect(progress);
};

// ─── Global showcase camera path ─────────────────────────────────────────────
// Matches ShowcaseDemo.tsx timing exactly. Single continuous path used at root
// level so no duplicate VideoTower instances exist during transitions.
//
// Durations mirror ShowcaseDemo constants:
const _GS0=30, _GS1=120, _GS2=105, _GS3=105, _GS4=120, _GS5=105, _GS6=180;
const _GT1=10,  _GT2=10,  _GT3=10,  _GT4=10,  _GT5=10,  _GT6=20;
// Global sequence starts (each sequence begins T frames before the previous ends)
const _G1 = _GS0 - _GT1;                 // 20  — S1 starts
const _G2 = _G1 + _GS1 - _GT2;           // 130 — S2 starts
const _G3 = _G2 + _GS2 - _GT3;           // 225 — S3 starts
const _G4 = _G3 + _GS3 - _GT4;           // 320 — S4 starts
const _G5 = _G4 + _GS4 - _GT5;           // 430 — S5 starts
const _G6 = _G5 + _GS5 - _GT6;           // 515 — S6 starts
const _GTOTAL = _G6 + _GS6;              // 695 — total frames

const _INSPECT_DEFAULT_Y = INSPECT_BLOCK_Y;

function _lerpPos(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function _lerpTarget(a: CameraTarget, b: CameraTarget, t: number): CameraTarget {
  return { position: _lerpPos(a.position, b.position, t), lookAt: _lerpPos(a.lookAt, b.lookAt, t) };
}

/**
 * globalShowcasePath — single continuous camera path for ShowcaseDemo.
 * Drives a root-level VideoTower so there is never more than one ThreeCanvas
 * active at a time, eliminating the camera glitch during crossfades.
 *
 * During each transition window the camera is smoothly lerped (easeInOutCubic)
 * between the exiting and entering scene paths.
 */
export const globalShowcasePath: InspectCameraPath = (progress) => {
  const gf = progress * _GTOTAL;
  const noInspect = { inspectProgress: 0, inspectY: _INSPECT_DEFAULT_Y } as const;

  // ── S0 pure (gf < G1=20) ───────────────────────────────────────────────────
  if (gf < _G1) {
    return { ...voidApproach(gf / _GS0), ...noInspect };
  }

  // ── T1: S0→S1 [20, 30) ────────────────────────────────────────────────────
  if (gf < _GS0) {
    const t = easeInOutCubic((gf - _G1) / _GT1);
    return {
      ..._lerpTarget(voidApproach(gf / _GS0), monumentReveal((gf - _G1) / _GS1), t),
      ...noInspect,
    };
  }

  // ── S1 pure [30, 130) ─────────────────────────────────────────────────────
  if (gf < _G2) {
    return { ...monumentReveal((gf - _G1) / _GS1), ...noInspect };
  }

  // ── T2: S1→S2 [130, 140) ──────────────────────────────────────────────────
  if (gf < _G1 + _GS1) {
    const t = easeInOutCubic((gf - _G2) / _GT2);
    return {
      ..._lerpTarget(monumentReveal((gf - _G1) / _GS1), claimOrbit((gf - _G2) / _GS2), t),
      ...noInspect,
    };
  }

  // ── S2 pure [140, 225) ────────────────────────────────────────────────────
  if (gf < _G3) {
    return { ...claimOrbit((gf - _G2) / _GS2), ...noInspect };
  }

  // ── T3: S2→S3 [225, 235) ──────────────────────────────────────────────────
  if (gf < _G2 + _GS2) {
    const t = easeInOutCubic((gf - _G3) / _GT3);
    return {
      ..._lerpTarget(claimOrbit((gf - _G2) / _GS2), earnHover((gf - _G3) / _GS3), t),
      ...noInspect,
    };
  }

  // ── S3 pure [235, 320) ────────────────────────────────────────────────────
  if (gf < _G4) {
    return { ...earnHover((gf - _G3) / _GS3), ...noInspect };
  }

  // ── T4: S3→S4 [320, 330) ──────────────────────────────────────────────────
  if (gf < _G3 + _GS3) {
    const t = easeInOutCubic((gf - _G4) / _GT4);
    const s3Cam = earnHover((gf - _G3) / _GS3);
    const s4Cam = customizeInspect((gf - _G4) / _GS4);
    return {
      ..._lerpTarget(s3Cam, s4Cam, t),
      inspectProgress: s4Cam.inspectProgress * t,
      inspectY: s4Cam.inspectY,
    };
  }

  // ── S4 pure [330, 430) ────────────────────────────────────────────────────
  if (gf < _G5) {
    return customizeInspect((gf - _G4) / _GS4);
  }

  // ── T5: S4→S5 [430, 440) ──────────────────────────────────────────────────
  if (gf < _G4 + _GS4) {
    const t = easeInOutCubic((gf - _G5) / _GT5);
    const s4Cam = customizeInspect((gf - _G4) / _GS4);
    const s5Cam = conquestPullback((gf - _G5) / _GS5);
    return {
      ..._lerpTarget(s4Cam, s5Cam, t),
      inspectProgress: s4Cam.inspectProgress * (1 - t),
      inspectY: s4Cam.inspectY,
    };
  }

  // ── S5 pure [440, 515) ────────────────────────────────────────────────────
  if (gf < _G6) {
    return { ...conquestPullback((gf - _G5) / _GS5), ...noInspect };
  }

  // ── T6: S5→S6 [515, 535) ──────────────────────────────────────────────────
  if (gf < _G5 + _GS5) {
    const t = easeInOutCubic((gf - _G6) / _GT6);
    return {
      ..._lerpTarget(conquestPullback((gf - _G5) / _GS5), ctaLowAngle((gf - _G6) / _GS6), t),
      ...noInspect,
    };
  }

  // ── S6 pure [535, 695) ────────────────────────────────────────────────────
  return { ...ctaLowAngle(Math.min((gf - _G6) / _GS6, 1)), ...noInspect };
};
