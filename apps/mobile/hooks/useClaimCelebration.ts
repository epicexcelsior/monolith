import { useRef, useEffect, useCallback } from "react";
import { useTowerStore, type ClaimCelebrationState } from "@/stores/tower-store";
import { CLAIM_DURATIONS, CLAIM_CAMERA } from "@/constants/ClaimEffectConfig";
import { hapticClaimCelebration } from "@/utils/haptics";
import { playClaimCelebration } from "@/utils/audio";

// Guard: only one instance should own the store ref at a time.
// Re-registered on every triggerCelebration call so the active caller always wins.

// Module-level cinematic timer — survives component unmount/remount cycles.
// This is critical because BlockInspector unmounts during celebration (selectBlock(null)
// causes it to return null), which would clear the timer if stored in a ref.
let _cinematicEndTimer: ReturnType<typeof setTimeout> | null = null;
let _celebrationCleanupTimer: ReturnType<typeof setTimeout> | null = null;
let _inspectorReopenTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * useClaimCelebration — Orchestrator hook for the block claim celebration.
 *
 * Sets up a mutable ref on the tower store that useFrame loops can read.
 * Schedules haptic chains and plays celebration sound.
 * Triggers cinematicMode to hide all UI overlays during the experience.
 * Pure ref + timer management — no re-renders.
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
      // Clean up haptic timers on unmount — but NOT cinematic timers
      // (cinematic timers are module-level so they survive unmount)
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

    // Set celebration state (readable by useFrame loops)
    celebrationRef.current = {
      active: true,
      startTime: performance.now() / 1000,
      duration,
      blockPosition,
      blockIndex,
      blockId,
      isFirstClaim,
    };

    // Dismiss any open block inspector before cinematic starts
    selectBlock(null);

    // Enter cinematic mode — hide all UI overlays for the full experience
    setCinematicMode(true);

    // Schedule haptic chain
    const timers = hapticClaimCelebration(isFirstClaim);
    if (timers) {
      hapticTimersRef.current = timers;
    }

    // Play celebration sound
    playClaimCelebration();

    // Capture startTime so stale timers don't deactivate a newer celebration
    const capturedStartTime = celebrationRef.current.startTime;

    // ── Timing: cinematic exits AFTER zoom-back completes ──
    // ZOOM_RETURN_DELAY (3.5s) + zoomRestoreMs (1.2s) + buffer (300ms)
    const cinematicEndMs = (CLAIM_CAMERA.zoomReturnDelay + CLAIM_CAMERA.zoomRestoreMs / 1000 + 0.3) * 1000;

    // Exit cinematic mode after zoom-back completes
    // CRITICAL: stored at module level so it survives BlockInspector unmount
    _cinematicEndTimer = setTimeout(() => {
      _cinematicEndTimer = null;
      useTowerStore.getState().setCinematicMode(false);
    }, cinematicEndMs);

    // Reopen inspector on the claimed block after cinematic ends
    if (blockId) {
      _inspectorReopenTimer = setTimeout(() => {
        _inspectorReopenTimer = null;
        useTowerStore.getState().selectBlock(blockId);
      }, cinematicEndMs + 200);
    }

    // Auto-deactivate after duration (safety net — guards against leaked active state)
    _celebrationCleanupTimer = setTimeout(() => {
      _celebrationCleanupTimer = null;
      if (celebrationRef.current?.startTime === capturedStartTime) {
        celebrationRef.current.active = false;
      }
    }, duration * 1000 + 500);

    // Safety timeout: force cinematicMode off after 10s max, even if everything else fails
    const safetyTimer = setTimeout(() => {
      if (useTowerStore.getState().cinematicMode) {
        useTowerStore.getState().setCinematicMode(false);
      }
    }, 10000);
    hapticTimersRef.current.push(safetyTimer);
  }, [setCinematicMode, setClaimCelebrationRef, selectBlock]);

  return { triggerCelebration };
}
