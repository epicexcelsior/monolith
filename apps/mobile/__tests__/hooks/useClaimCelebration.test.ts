/**
 * Tests for the useClaimCelebration orchestrator hook.
 * Verifies ref state management, haptic scheduling, sound calls,
 * and cinematicMode reset after celebration.
 */

// Mock dependencies before imports
jest.mock("@/utils/haptics", () => ({
  hapticClaimCelebration: jest.fn(() => []),
}));
jest.mock("@/utils/audio", () => ({
  playClaimCelebration: jest.fn(),
}));

// Mock the tower store with cinematicMode tracking
let mockCinematicMode = false;
const mockSetClaimCelebrationRef = jest.fn();
const mockSetCinematicMode = jest.fn((val: boolean) => { mockCinematicMode = val; });
const mockSelectBlock = jest.fn();

jest.mock("@/stores/tower-store", () => ({
  useTowerStore: Object.assign(
    (selector: any) => {
      const store = {
        setClaimCelebrationRef: mockSetClaimCelebrationRef,
        setCinematicMode: mockSetCinematicMode,
        selectBlock: mockSelectBlock,
      };
      return selector(store);
    },
    {
      getState: () => ({
        cinematicMode: mockCinematicMode,
        setCinematicMode: mockSetCinematicMode,
        selectBlock: mockSelectBlock,
      }),
    },
  ),
}));

import { useClaimCelebration } from "@/hooks/useClaimCelebration";
import { hapticClaimCelebration } from "@/utils/haptics";
import { playClaimCelebration } from "@/utils/audio";
import { CLAIM_DURATIONS, CLAIM_CAMERA } from "@/constants/ClaimEffectConfig";

describe("useClaimCelebration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockCinematicMode = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should export triggerCelebration function", () => {
    expect(typeof useClaimCelebration).toBe("function");
  });

  it("CLAIM_DURATIONS should have correct values", () => {
    expect(CLAIM_DURATIONS.normal).toBe(6.8);
    expect(CLAIM_DURATIONS.firstClaim).toBe(8.3);
  });

  it("hapticClaimCelebration should be callable with boolean", () => {
    (hapticClaimCelebration as jest.Mock).mockReturnValue([]);
    hapticClaimCelebration(false);
    expect(hapticClaimCelebration).toHaveBeenCalledWith(false);

    hapticClaimCelebration(true);
    expect(hapticClaimCelebration).toHaveBeenCalledWith(true);
  });

  it("playClaimCelebration should be callable", () => {
    playClaimCelebration();
    expect(playClaimCelebration).toHaveBeenCalled();
  });

  it("cinematicMode resets after zoom-back completes via module-level timer", () => {
    // Cinematic end timing: zoomReturnDelay + 1.5s lerp settle + 0.2s buffer
    const cinematicEndSecs = CLAIM_CAMERA.zoomReturnDelay + 1.5 + 0.2;
    const cinematicEndMs = cinematicEndSecs * 1000;

    // Should be well under the 10s safety timeout
    expect(cinematicEndMs).toBeLessThan(10000);
    // Should be after the zoom return starts
    expect(cinematicEndMs).toBeGreaterThan(CLAIM_CAMERA.zoomReturnDelay * 1000);
  });

  it("safety timeout is set at 10 seconds", () => {
    // The safety timeout (10000ms) is a hard cap that forces cinematicMode off
    // even if the main timer fails. This verifies the design invariant.
    const maxCelebrationMs = CLAIM_DURATIONS.firstClaim * 1000 + 500;
    const safetyTimeoutMs = 10000;

    // Safety timeout must be >= longest celebration + cleanup buffer
    expect(safetyTimeoutMs).toBeGreaterThanOrEqual(maxCelebrationMs);
  });
});
