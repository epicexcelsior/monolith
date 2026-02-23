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
 * Pure ref + timer management — no re-renders.
 */
export function useClaimCelebration() {
  const celebrationRef = useRef<ClaimCelebrationState | null>(null);
  const hapticTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const setClaimCelebrationRef = useTowerStore((s) => s.setClaimCelebrationRef);

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

    // Schedule haptic chain
    const timers = hapticClaimCelebration(isFirstClaim);
    if (timers) {
      hapticTimersRef.current = timers;
    }

    // Play celebration sound
    playClaimCelebration();

    // Auto-deactivate after duration (safety net — useFrame also deactivates)
    const cleanup = setTimeout(() => {
      if (celebrationRef.current?.startTime === celebrationRef.current?.startTime) {
        if (celebrationRef.current) {
          celebrationRef.current.active = false;
        }
      }
    }, duration * 1000 + 200);
    hapticTimersRef.current.push(cleanup);
  }, []);

  return { triggerCelebration };
}
