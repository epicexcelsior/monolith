import { useRef, useEffect, useCallback } from "react";
import { useTowerStore, type ClaimCelebrationState } from "@/stores/tower-store";
import { CLAIM_DURATIONS, CLAIM_CAMERA, CLAIM_SOUND_DELAY } from "@/constants/ClaimEffectConfig";
import { hapticClaimCelebration } from "@/utils/haptics";
import { playClaimCelebration } from "@/utils/audio";

// Module-level timers — survive component unmount/remount cycles.
let _cinematicEndTimer: ReturnType<typeof setTimeout> | null = null;
let _celebrationCleanupTimer: ReturnType<typeof setTimeout> | null = null;
let _inspectorReopenTimer: ReturnType<typeof setTimeout> | null = null;
let _soundDelayTimer: ReturnType<typeof setTimeout> | null = null;

// Module-level celebration tracking for cancel support
let _celebrationStartTime: number | null = null;
let _celebrationBlockId: string | undefined = undefined;
let _hapticTimers: ReturnType<typeof setTimeout>[] = [];

/**
 * useClaimCelebration — Orchestrator for the block claim celebration.
 *
 * Flow (synced to audio — claim-celebration.wav has 2.5s internal buildup):
 *  1. Deselect block (hide inspector)
 *  2. Enter cinematic mode (fade out all UI)
 *  3. Sound plays immediately — audio buildup matches visual buildup
 *  4. Buildup (0→2.5s): camera slowly pulls back from block, escalating jitter
 *  5. Impact (at 2.5s): audio 808 slam + camera snaps to full tower + VFX
 *  6. Hold (2.5→4.5s): camera stays at overview, particles fill sky
 *  7. Return (at 4.5s): camera gently zooms back to block + glow-up
 *  8. Exit cinematic, re-select claimed block → inspector shows
 */
export function useClaimCelebration() {
  const celebrationRef = useRef<ClaimCelebrationState | null>(null);
  const hapticTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const setClaimCelebrationRef = useTowerStore((s) => s.setClaimCelebrationRef);
  const setCinematicMode = useTowerStore((s) => s.setCinematicMode);
  const selectBlock = useTowerStore((s) => s.selectBlock);

  // Register the ref with the store on mount
  useEffect(() => {
    setClaimCelebrationRef(celebrationRef);
    return () => {
      for (const t of hapticTimersRef.current) clearTimeout(t);
    };
  }, [setClaimCelebrationRef]);

  const triggerCelebration = useCallback((
    blockPosition: { x: number; y: number; z: number },
    blockIndex: number,
    isFirstClaim: boolean,
    blockId?: string,
  ) => {
    // Cancel any in-progress celebration
    for (const t of hapticTimersRef.current) clearTimeout(t);
    if (_cinematicEndTimer) clearTimeout(_cinematicEndTimer);
    if (_celebrationCleanupTimer) clearTimeout(_celebrationCleanupTimer);
    if (_inspectorReopenTimer) clearTimeout(_inspectorReopenTimer);
    if (_soundDelayTimer) clearTimeout(_soundDelayTimer);

    // Re-register our ref — ensures this instance wins if multiple hooks exist
    setClaimCelebrationRef(celebrationRef);

    const duration = isFirstClaim ? CLAIM_DURATIONS.firstClaim : CLAIM_DURATIONS.normal;

    // Set celebration state (readable by useFrame loops in CameraRig + TowerGrid)
    celebrationRef.current = {
      active: true,
      startTime: performance.now() / 1000,
      duration,
      blockPosition,
      blockIndex,
      blockId,
      isFirstClaim,
    };

    // Deselect block to hide inspector, then enter cinematic mode
    selectBlock(null);
    setCinematicMode(true);

    // Track module-level for cancel support
    _celebrationStartTime = celebrationRef.current.startTime;
    _celebrationBlockId = blockId;

    // Haptic chain
    const timers = hapticClaimCelebration(isFirstClaim);
    if (timers) {
      hapticTimersRef.current = timers;
      _hapticTimers = timers;
    }

    // Celebration SFX — audio has 2.5s internal buildup matching CLAIM_IMPACT_OFFSET_SECS.
    // CLAIM_SOUND_DELAY is 0 (play immediately) so audio climax lands on visual impact.
    const soundDelayMs = CLAIM_SOUND_DELAY * 1000;
    if (soundDelayMs > 0) {
      _soundDelayTimer = setTimeout(() => {
        _soundDelayTimer = null;
        playClaimCelebration();
      }, soundDelayMs);
    } else {
      playClaimCelebration();
    }

    const capturedStartTime = celebrationRef.current.startTime;

    // Cinematic ends after zoom-back settles:
    // zoomReturnDelay (4.5s) + ~1.5s for slow lerp settle + 0.2s buffer ≈ 6.2s
    // Audio ends at 5.5s, so cinematic outlasts audio slightly — clean finish.
    const cinematicEndMs = (CLAIM_CAMERA.zoomReturnDelay + 1.5 + 0.2) * 1000;

    // Exit cinematic mode
    _cinematicEndTimer = setTimeout(() => {
      _cinematicEndTimer = null;
      useTowerStore.getState().setCinematicMode(false);
    }, cinematicEndMs);

    // Re-select the claimed block so inspector opens on it
    if (blockId) {
      _inspectorReopenTimer = setTimeout(() => {
        _inspectorReopenTimer = null;
        useTowerStore.getState().selectBlock(blockId);
      }, cinematicEndMs + 300);
    }

    // Safety: deactivate celebration ref after duration
    _celebrationCleanupTimer = setTimeout(() => {
      _celebrationCleanupTimer = null;
      if (celebrationRef.current?.startTime === capturedStartTime) {
        celebrationRef.current.active = false;
      }
    }, duration * 1000 + 500);

    // Safety: force cinematicMode off after 10s max
    const safetyTimer = setTimeout(() => {
      if (useTowerStore.getState().cinematicMode) {
        useTowerStore.getState().setCinematicMode(false);
      }
    }, 10000);
    hapticTimersRef.current.push(safetyTimer);
  }, [setCinematicMode, setClaimCelebrationRef, selectBlock]);

  return { triggerCelebration };
}

/**
 * Cancel an in-progress claim celebration (tap-to-skip).
 * Only callable after 2s of celebration start (let user see the impact).
 * Importable from anywhere — works with module-level state.
 */
export function cancelCelebration(): void {
  // Gate: only callable after 2s
  if (_celebrationStartTime != null) {
    const elapsed = performance.now() / 1000 - _celebrationStartTime;
    if (elapsed < 2) return;
  } else {
    return; // No celebration in progress
  }

  // Clear all timers
  for (const t of _hapticTimers) clearTimeout(t);
  _hapticTimers = [];
  if (_cinematicEndTimer) { clearTimeout(_cinematicEndTimer); _cinematicEndTimer = null; }
  if (_celebrationCleanupTimer) { clearTimeout(_celebrationCleanupTimer); _celebrationCleanupTimer = null; }
  if (_inspectorReopenTimer) { clearTimeout(_inspectorReopenTimer); _inspectorReopenTimer = null; }
  if (_soundDelayTimer) { clearTimeout(_soundDelayTimer); _soundDelayTimer = null; }

  _celebrationStartTime = null;

  // Exit cinematic mode
  useTowerStore.getState().setCinematicMode(false);

  // Re-select the block if we have one
  if (_celebrationBlockId) {
    const blockId = _celebrationBlockId;
    _celebrationBlockId = undefined;
    setTimeout(() => {
      useTowerStore.getState().selectBlock(blockId);
    }, 300);
  }
}
