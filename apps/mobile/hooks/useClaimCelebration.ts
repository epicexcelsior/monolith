import { useRef, useEffect, useCallback } from "react";
import { useTowerStore, type ClaimCelebrationState } from "@/stores/tower-store";
import { CLAIM_DURATIONS, CLAIM_CAMERA } from "@/constants/ClaimEffectConfig";
import { hapticClaimCelebration } from "@/utils/haptics";
import { playClaimCelebration } from "@/utils/audio";

// Module-level timers — survive component unmount/remount cycles.
let _cinematicEndTimer: ReturnType<typeof setTimeout> | null = null;
let _celebrationCleanupTimer: ReturnType<typeof setTimeout> | null = null;
let _inspectorReopenTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * useClaimCelebration — Orchestrator for the block claim celebration.
 *
 * Flow:
 *  1. Deselect block (hide inspector)
 *  2. Enter cinematic mode (fade out all UI)
 *  3. Buildup: escalating camera shake (0→1.5s)
 *  4. Impact: big shake + zoom OUT to see full tower + VFX
 *  5. Orbit: slow cinematic drift around tower
 *  6. Zoom back: restore camera to pre-celebration position
 *  7. Exit cinematic, re-select claimed block → inspector shows
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

    // Haptic chain
    const timers = hapticClaimCelebration(isFirstClaim);
    if (timers) hapticTimersRef.current = timers;

    // Celebration SFX
    playClaimCelebration();

    const capturedStartTime = celebrationRef.current.startTime;

    // Cinematic ends after zoom-back completes:
    // ZOOM_RETURN_DELAY (3.5s) + zoomRestoreMs (1.2s) + buffer (0.3s) = 5.0s
    const cinematicEndMs = (CLAIM_CAMERA.zoomReturnDelay + CLAIM_CAMERA.zoomRestoreMs / 1000 + 0.3) * 1000;

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
