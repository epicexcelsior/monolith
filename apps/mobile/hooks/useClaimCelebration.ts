import { useRef, useEffect, useCallback } from "react";
import { useTowerStore, type ClaimCelebrationState } from "@/stores/tower-store";
import { CLAIM_DURATIONS } from "@/constants/ClaimEffectConfig";
import { hapticClaimCelebration } from "@/utils/haptics";
import { playClaimCelebration } from "@/utils/audio";

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

  // Register the ref with the store on mount
  useEffect(() => {
    setClaimCelebrationRef(celebrationRef);
    return () => {
      // Clean up haptic timers on unmount
      for (const t of hapticTimersRef.current) clearTimeout(t);
    };
  }, [setClaimCelebrationRef]);

  const triggerCelebration = useCallback((
    blockPosition: { x: number; y: number; z: number },
    blockIndex: number,
    isFirstClaim: boolean,
  ) => {
    // Cancel any in-progress celebration
    for (const t of hapticTimersRef.current) clearTimeout(t);

    const duration = isFirstClaim ? CLAIM_DURATIONS.firstClaim : CLAIM_DURATIONS.normal;

    // Set celebration state (readable by useFrame loops)
    celebrationRef.current = {
      active: true,
      startTime: performance.now() / 1000,
      duration,
      blockPosition,
      blockIndex,
      isFirstClaim,
    };

    // Enter cinematic mode — hide all UI overlays for the full experience
    setCinematicMode(true);

    // Schedule haptic chain
    const timers = hapticClaimCelebration(isFirstClaim);
    if (timers) {
      hapticTimersRef.current = timers;
    }

    // Play celebration sound
    playClaimCelebration();

    // Exit cinematic mode after celebration (with a short buffer for settle phase)
    const cinematicEnd = setTimeout(() => {
      setCinematicMode(false);
    }, duration * 1000 + 300);

    // Auto-deactivate after duration (safety net)
    const cleanup = setTimeout(() => {
      if (celebrationRef.current) {
        celebrationRef.current.active = false;
      }
    }, duration * 1000 + 500);

    hapticTimersRef.current.push(cinematicEnd, cleanup);
  }, [setCinematicMode]);

  return { triggerCelebration };
}
