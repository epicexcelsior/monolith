/**
 * ClaimVFX — Multi-phase claim celebration with enhanced particles.
 *
 * PHASE 1: Energy Charge (0 → 1.5s)
 *   160 violet/gold converging particles + 20 large ambient glow orbs.
 *   Uses wawa-vfx spawnMode:"time" + negative speed trick.
 *
 * WAVE 1: Impact Explosion (at 1.5s)
 *   280 chunky sparks, 80 stretch streaks, 50 upward rays, 60 ring particles.
 *
 * WAVE 2: (at 1.8s)
 *   180 confetti bits, 120 rising embers.
 *
 * WAVE 3: (at 2.05s)
 *   40 aurora orbs, 30 lingering trail particles.
 *
 * Zero React re-renders — all controlled via useFrame + mutable refs.
 */

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VFXParticles, VFXEmitter, RenderMode } from "wawa-vfx";
import { useTowerStore } from "@/stores/tower-store";
import { CLAIM_IMPACT_OFFSET_SECS } from "@/constants/ClaimEffectConfig";

type EmitterRef = {
  startEmitting: (reset?: boolean) => void;
  stopEmitting:  () => void;
  emitAtPos:     (position: THREE.Vector3 | null, reset?: boolean) => void;
} & THREE.Object3D;

// Staggered wave delays
const WAVE2_DELAY = 0.30;
const WAVE3_DELAY = 0.55;

export function ClaimVFX() {
  // Phase 1 — charge-up (time mode, positioned group)
  const chargeGroupRef = useRef<THREE.Group>(null);
  const chargeRef      = useRef<EmitterRef>(null);
  const glowRef        = useRef<EmitterRef>(null);

  // Wave 1 — core explosion at impact
  const sparksRef   = useRef<EmitterRef>(null);
  const starsRef    = useRef<EmitterRef>(null);
  const raysRef     = useRef<EmitterRef>(null);
  const ringRef     = useRef<EmitterRef>(null);

  // Wave 2 — staggered confetti burst
  const confettiRef  = useRef<EmitterRef>(null);
  const embersRef    = useRef<EmitterRef>(null);

  // Wave 3 — aurora drift + lingering trails
  const auroraRef    = useRef<EmitterRef>(null);
  const trailRef     = useRef<EmitterRef>(null);

  // Tracking
  const lastCelebStart = useRef(-1);
  const buildupFired   = useRef(false);
  const wave1Fired     = useRef(false);
  const wave2Fired     = useRef(false);
  const wave3Fired     = useRef(false);
  const blockPos       = useRef(new THREE.Vector3());

  const claimCelebrationRef = useTowerStore((s) => s.claimCelebrationRef);

  useFrame(() => {
    const cel = claimCelebrationRef?.current;
    if (!cel?.active) return;

    // ── Detect new celebration ─────────────────────────────────────────────
    if (cel.startTime !== lastCelebStart.current) {
      lastCelebStart.current = cel.startTime;
      buildupFired.current = false;
      wave1Fired.current   = false;
      wave2Fired.current   = false;
      wave3Fired.current   = false;
      blockPos.current.set(cel.blockPosition.x, cel.blockPosition.y, cel.blockPosition.z);
    }

    // ── Keep charge group at block position ───────────────────────────────
    chargeGroupRef.current?.position.copy(blockPos.current);

    // ── Phase 1: start charge-up immediately ──────────────────────────────
    if (!buildupFired.current) {
      buildupFired.current = true;
      chargeRef.current?.startEmitting(true);
      glowRef.current?.startEmitting(true);
    }

    const elapsed = performance.now() / 1000 - cel.startTime;
    const pos = blockPos.current;

    // ── Wave 1: explosion at impact ───────────────────────────────────────
    if (!wave1Fired.current && elapsed >= CLAIM_IMPACT_OFFSET_SECS) {
      wave1Fired.current = true;
      sparksRef.current?.emitAtPos(pos.clone(), true);
      starsRef.current?.emitAtPos(pos.clone(), true);
      raysRef.current?.emitAtPos(pos.clone(), true);
      ringRef.current?.emitAtPos(pos.clone(), true);
    }

    // ── Wave 2: staggered confetti + embers ──────────────────────────────
    if (!wave2Fired.current && elapsed >= CLAIM_IMPACT_OFFSET_SECS + WAVE2_DELAY) {
      wave2Fired.current = true;
      confettiRef.current?.emitAtPos(pos.clone(), true);
      embersRef.current?.emitAtPos(pos.clone(), true);
    }

    // ── Wave 3: aurora drift + lingering trails ─────────────────────────
    if (!wave3Fired.current && elapsed >= CLAIM_IMPACT_OFFSET_SECS + WAVE3_DELAY) {
      wave3Fired.current = true;
      auroraRef.current?.emitAtPos(pos.clone(), true);
      trailRef.current?.emitAtPos(pos.clone(), true);
    }
  });

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
          PHASE 1: CHARGE BUILDUP — 1.5s inward convergence + glow orbs
          ═══════════════════════════════════════════════════════════════════ */}
      <group ref={chargeGroupRef}>
        {/* ─── Converging particles (violet + gold/amber) ─────────────── */}
        <VFXParticles
          name="charge-gather"
          settings={{
            nbParticles: 160,
            gravity: [0, 0.10, 0],
            fadeAlpha: [0.10, 0.85],
            fadeSize:  [0.05, 0.70],
            intensity: 3.0,
            easeFunction: "easeInPower3",
            blendingMode: THREE.AdditiveBlending,
            depthTest: false,
          }}
        />
        <VFXEmitter
          ref={chargeRef}
          emitter="charge-gather"
          autoStart={false}
          settings={{
            spawnMode: "time",
            duration: CLAIM_IMPACT_OFFSET_SECS,
            loop: false,
            nbParticles: 160,
            colorStart: ["#9933ff", "#6600cc", "#cc44ff", "#ff88ff", "#4422ff", "#00aaff", "#ee88ff", "#FFD700", "#FF8C00"],
            colorEnd:   ["#ffffff", "#cc88ff", "#6633ff", "#FFD700"],
            particlesLifetime: [0.8, 1.8],
            speed: [-14, -6],
            size:  [0.10, 0.35],
            directionMin: [-1, -0.6, -1],
            directionMax: [ 1,  1.0,  1],
            startPositionMin: [-5.0, -1.0, -5.0],
            startPositionMax: [ 5.0,  2.5,  5.0],
          }}
        />

        {/* ─── Glow orbs: large soft pulsing orbs during buildup ──────── */}
        <VFXParticles
          name="charge-glow"
          settings={{
            nbParticles: 20,
            gravity: [0, 0.05, 0],
            fadeAlpha: [0.10, 0.60],
            fadeSize:  [0.30, 0.85],
            intensity: 2.0,
            easeFunction: "easeInOutSine",
            blendingMode: THREE.AdditiveBlending,
            depthTest: false,
          }}
        />
        <VFXEmitter
          ref={glowRef}
          emitter="charge-glow"
          autoStart={false}
          settings={{
            spawnMode: "time",
            duration: CLAIM_IMPACT_OFFSET_SECS,
            loop: false,
            nbParticles: 20,
            colorStart: ["#FF8C00", "#FFD700", "#FFAA33", "#FF6600"],
            colorEnd:   ["#FF440044", "#FFD70044"],
            particlesLifetime: [1.0, 1.5],
            speed: [0.5, 2.0],
            size:  [0.80, 2.00],
            directionMin: [-0.5, -0.3, -0.5],
            directionMax: [ 0.5,  0.5,  0.5],
            startPositionMin: [-2.0, -0.5, -2.0],
            startPositionMax: [ 2.0,  1.0,  2.0],
          }}
        />
      </group>

      {/* ═══════════════════════════════════════════════════════════════════
          WAVE 1: CORE EXPLOSION — chunky burst + ring shockwave
          ═══════════════════════════════════════════════════════════════════ */}

      {/* ─── SPARKS: bold chunky gold/orange/white burst ────────────────── */}
      <VFXParticles
        name="boom-sparks"
        settings={{
          nbParticles: 280,
          gravity: [0, -7.0, 0],
          fadeAlpha: [0.45, 1],
          fadeSize:  [0.0, 0.30],
          intensity: 4.5,
          easeFunction: "easeOutCubic",
          blendingMode: THREE.AdditiveBlending,
          depthTest: false,
        }}
      />
      <VFXEmitter
        ref={sparksRef}
        emitter="boom-sparks"
        settings={{
          spawnMode: "burst",
          nbParticles: 280,
          colorStart: ["#FFD700", "#FF6600", "#FF3300", "#FFFFFF", "#FFAA00", "#FF8800", "#EEFFFF"],
          colorEnd:   ["#FF2200", "#CC4400", "#880000"],
          particlesLifetime: [0.4, 1.6],
          speed: [8, 32],
          size:  [0.12, 0.55],
          directionMin: [-1, -0.8, -1],
          directionMax: [ 1,  1.0,  1],
          startPositionMin: [-0.3, -0.3, -0.3],
          startPositionMax: [ 0.3,  0.3,  0.3],
        }}
      />

      {/* ─── STARS: StretchBillboard lightning streaks ───────────────────── */}
      <VFXParticles
        name="boom-stars"
        settings={{
          nbParticles: 80,
          gravity: [0, -12, 0],
          fadeAlpha: [0.80, 1],
          fadeSize:  [0.0, 0.15],
          intensity: 7,
          renderMode: RenderMode.StretchBillboard,
          stretchScale: 12.0,
          easeFunction: "easeOutPower4",
          blendingMode: THREE.AdditiveBlending,
          depthTest: false,
        }}
      />
      <VFXEmitter
        ref={starsRef}
        emitter="boom-stars"
        settings={{
          spawnMode: "burst",
          nbParticles: 80,
          colorStart: ["#FFFFFF", "#FFD700", "#FF8800", "#FFFF44", "#FFCC00"],
          colorEnd:   ["#FFD700", "#FF4400", "#882200"],
          particlesLifetime: [0.10, 0.55],
          speed: [25, 65],
          size:  [0.06, 0.20],
          directionMin: [-1, -1, -1],
          directionMax: [ 1,  1,  1],
          startPositionMin: [0, 0, 0],
          startPositionMax: [0, 0, 0],
        }}
      />

      {/* ─── RAYS: upward light shafts — tower beam of power ───────────── */}
      <VFXParticles
        name="boom-rays"
        settings={{
          nbParticles: 50,
          gravity: [0, 1.0, 0],
          fadeAlpha: [0.15, 0.90],
          fadeSize:  [0.0, 0.50],
          intensity: 5.0,
          renderMode: RenderMode.StretchBillboard,
          stretchScale: 18.0,
          easeFunction: "easeOutPower3",
          blendingMode: THREE.AdditiveBlending,
          depthTest: false,
        }}
      />
      <VFXEmitter
        ref={raysRef}
        emitter="boom-rays"
        settings={{
          spawnMode: "burst",
          nbParticles: 50,
          colorStart: ["#FFFFFF", "#FFE066", "#FFCC00", "#FFD700", "#FFFFFF", "#88FFFF"],
          colorEnd:   ["#FFD700", "#FF8800", "#9933FF", "#00CCCC"],
          particlesLifetime: [1.0, 3.5],
          speed: [5, 18],
          size:  [0.08, 0.25],
          directionMin: [-0.12, 0.80, -0.12],
          directionMax: [ 0.12, 1.00,  0.12],
          startPositionMin: [-1.2, 0.0, -1.2],
          startPositionMax: [ 1.2, 0.5,  1.2],
        }}
      />

      {/* ─── RING: expanding shockwave ring of particles ────────────────── */}
      <VFXParticles
        name="boom-ring"
        settings={{
          nbParticles: 60,
          gravity: [0, -0.5, 0],
          fadeAlpha: [0.30, 1],
          fadeSize:  [0.0, 0.50],
          intensity: 5.0,
          easeFunction: "easeOutPower3",
          blendingMode: THREE.AdditiveBlending,
          depthTest: false,
        }}
      />
      <VFXEmitter
        ref={ringRef}
        emitter="boom-ring"
        settings={{
          spawnMode: "burst",
          nbParticles: 60,
          colorStart: ["#FFD700", "#FFFFFF", "#FFEE88", "#88FFFF"],
          colorEnd:   ["#FFD70044", "#FFFFFF44"],
          particlesLifetime: [0.3, 0.8],
          speed: [15, 35],
          size:  [0.10, 0.30],
          directionMin: [-1, -0.1, -1],
          directionMax: [ 1,  0.1,  1],
          startPositionMin: [-0.1, 0.0, -0.1],
          startPositionMax: [ 0.1, 0.0,  0.1],
        }}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          WAVE 2 (+ 0.3s): CONFETTI + EMBERS — staggered for drama
          ═══════════════════════════════════════════════════════════════════ */}

      {/* ─── CONFETTI: bold saturated celebration bits ──────────────────── */}
      <VFXParticles
        name="boom-confetti"
        settings={{
          nbParticles: 180,
          gravity: [0, -3.0, 0],
          fadeAlpha: [0.35, 1],
          fadeSize:  [0.0, 0.30],
          intensity: 3.2,
          easeFunction: "easeOutSine",
          blendingMode: THREE.NormalBlending,
          depthTest: false,
        }}
      />
      <VFXEmitter
        ref={confettiRef}
        emitter="boom-confetti"
        settings={{
          spawnMode: "burst",
          nbParticles: 180,
          colorStart: [
            "#FFD700", "#FF1493", "#00FFFF", "#FF6600", "#00FF44",
            "#FF00FF", "#FFFFFF", "#FF4444", "#44AAFF", "#FFFF00",
            "#FF69B4", "#88FF88",
          ],
          colorEnd: ["#CC0066", "#0088CC", "#FF4400", "#008800", "#AA00AA"],
          particlesLifetime: [1.5, 4.5],
          speed: [3, 16],
          size:  [0.12, 0.50],
          directionMin: [-1, -0.8, -1],
          directionMax: [ 1,  1.0,  1],
          startPositionMin: [-0.8, -0.1, -0.8],
          startPositionMax: [ 0.8,  0.3,  0.8],
          rotationSpeedMin: [-10, -10, -10],
          rotationSpeedMax: [ 10,  10,  10],
        }}
      />

      {/* ─── EMBERS: warm amber/orange/rose rising glow ────────────────── */}
      <VFXParticles
        name="boom-embers"
        settings={{
          nbParticles: 120,
          gravity: [0, 1.2, 0],
          fadeAlpha: [0.25, 1],
          fadeSize:  [0.0, 0.65],
          intensity: 2.5,
          easeFunction: "easeOutPower2",
          blendingMode: THREE.AdditiveBlending,
          depthTest: false,
        }}
      />
      <VFXEmitter
        ref={embersRef}
        emitter="boom-embers"
        settings={{
          spawnMode: "burst",
          nbParticles: 120,
          colorStart: ["#FF8C00", "#FFD700", "#FF6600", "#FFA500", "#FFDD44", "#FF6699"],
          colorEnd:   ["#FF2200", "#8B0000", "#FF6600", "#CC3366"],
          particlesLifetime: [2.0, 5.5],
          speed: [0.5, 5.0],
          size:  [0.10, 0.40],
          directionMin: [-0.5, 0.5, -0.5],
          directionMax: [ 0.5, 1.0,  0.5],
          startPositionMin: [-0.2, -0.1, -0.2],
          startPositionMax: [ 0.2,  0.2,  0.2],
        }}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          WAVE 3 (+ 0.55s): AURORA + TRAILS — large slow ethereal lingering
          ═══════════════════════════════════════════════════════════════════ */}

      {/* ─── AURORA: large slow orbs — heaven-opening feel ─────────────── */}
      <VFXParticles
        name="boom-aurora"
        settings={{
          nbParticles: 40,
          gravity: [0, 0.3, 0],
          fadeAlpha: [0.05, 0.60],
          fadeSize:  [0.25, 0.85],
          intensity: 1.8,
          easeFunction: "easeOutSine",
          blendingMode: THREE.AdditiveBlending,
          depthTest: false,
        }}
      />
      <VFXEmitter
        ref={auroraRef}
        emitter="boom-aurora"
        settings={{
          spawnMode: "burst",
          nbParticles: 40,
          colorStart: ["#FF69B4", "#9933FF", "#00AAFF", "#FFD700", "#FF4400", "#00FF88", "#44DDBB"],
          colorEnd:   ["#6600CC", "#FF0066", "#0044CC", "#FF6600", "#228866"],
          particlesLifetime: [3.5, 7.0],
          speed: [0.3, 3.0],
          size:  [0.40, 1.50],
          directionMin: [-1, -0.1, -1],
          directionMax: [ 1,  2.0,  1],
          startPositionMin: [-2.5, -0.5, -2.5],
          startPositionMax: [ 2.5,  1.5,  2.5],
        }}
      />

      {/* ─── TRAILS: lingering aftermath particles — slow, large, faint ── */}
      <VFXParticles
        name="boom-trails"
        settings={{
          nbParticles: 30,
          gravity: [0, 0.1, 0],
          fadeAlpha: [0.03, 0.40],
          fadeSize:  [0.20, 0.80],
          intensity: 1.2,
          renderMode: RenderMode.StretchBillboard,
          stretchScale: 4.0,
          easeFunction: "easeOutSine",
          blendingMode: THREE.AdditiveBlending,
          depthTest: false,
        }}
      />
      <VFXEmitter
        ref={trailRef}
        emitter="boom-trails"
        settings={{
          spawnMode: "burst",
          nbParticles: 30,
          colorStart: ["#FFD70066", "#FF88CC44", "#88CCFF44", "#FFFFFF44"],
          colorEnd:   ["#FFD70011", "#FF88CC11"],
          particlesLifetime: [4.0, 8.0],
          speed: [0.1, 1.0],
          size:  [0.50, 2.00],
          directionMin: [-1, 0.0, -1],
          directionMax: [ 1, 1.5,  1],
          startPositionMin: [-3.0, -0.5, -3.0],
          startPositionMax: [ 3.0,  2.0,  3.0],
        }}
      />
    </>
  );
}
