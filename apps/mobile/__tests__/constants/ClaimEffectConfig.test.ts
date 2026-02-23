import {
  CLAIM_DURATIONS,
  CLAIM_PHASES,
  CLAIM_PARTICLES,
  CLAIM_HAPTICS,
  CLAIM_SHOCKWAVE,
  CLAIM_LIGHT,
  CLAIM_FLASH,
  CLAIM_SHAKE,
  CLAIM_PARTICLE_COLORS,
} from "@/constants/ClaimEffectConfig";

describe("ClaimEffectConfig", () => {
  describe("durations", () => {
    it("should have positive durations", () => {
      expect(CLAIM_DURATIONS.normal).toBeGreaterThan(0);
      expect(CLAIM_DURATIONS.firstClaim).toBeGreaterThan(0);
    });

    it("firstClaim should be longer than normal", () => {
      expect(CLAIM_DURATIONS.firstClaim).toBeGreaterThan(CLAIM_DURATIONS.normal);
    });
  });

  describe("phases", () => {
    it("should be contiguous from 0 to 1", () => {
      expect(CLAIM_PHASES.buildup.start).toBe(0);
      expect(CLAIM_PHASES.buildup.end).toBe(CLAIM_PHASES.impact.start);
      expect(CLAIM_PHASES.impact.end).toBe(CLAIM_PHASES.celebration.start);
      expect(CLAIM_PHASES.celebration.end).toBe(CLAIM_PHASES.settle.start);
      expect(CLAIM_PHASES.settle.end).toBe(1.0);
    });

    it("each phase should have positive duration", () => {
      for (const phase of Object.values(CLAIM_PHASES)) {
        expect(phase.end).toBeGreaterThan(phase.start);
      }
    });
  });

  describe("particles", () => {
    it("total budget should be <= 250", () => {
      const total = CLAIM_PARTICLES.convergeCount + CLAIM_PARTICLES.sparkCount
        + CLAIM_PARTICLES.emberCount + CLAIM_PARTICLES.trailCount;
      expect(total).toBeLessThanOrEqual(250);
    });

    it("each count should be positive", () => {
      expect(CLAIM_PARTICLES.convergeCount).toBeGreaterThan(0);
      expect(CLAIM_PARTICLES.sparkCount).toBeGreaterThan(0);
      expect(CLAIM_PARTICLES.emberCount).toBeGreaterThan(0);
      expect(CLAIM_PARTICLES.trailCount).toBeGreaterThan(0);
    });
  });

  describe("haptics", () => {
    it("all haptic delays should be non-negative and within duration", () => {
      const normalMs = CLAIM_DURATIONS.normal * 1000;
      for (const tap of CLAIM_HAPTICS.normal.buildup) {
        expect(tap.delay).toBeGreaterThanOrEqual(0);
        expect(tap.delay).toBeLessThanOrEqual(normalMs);
      }
      expect(CLAIM_HAPTICS.normal.impactDelay).toBeLessThanOrEqual(normalMs);
      expect(CLAIM_HAPTICS.normal.successDelay).toBeLessThanOrEqual(normalMs);
      for (const tap of CLAIM_HAPTICS.normal.settle) {
        expect(tap.delay).toBeLessThanOrEqual(normalMs);
      }
    });

    it("firstClaim haptics should be within firstClaim duration", () => {
      const firstMs = CLAIM_DURATIONS.firstClaim * 1000;
      for (const tap of CLAIM_HAPTICS.firstClaim.buildup) {
        expect(tap.delay).toBeLessThanOrEqual(firstMs);
      }
      expect(CLAIM_HAPTICS.firstClaim.impactDelay).toBeLessThanOrEqual(firstMs);
      for (const tap of CLAIM_HAPTICS.firstClaim.settle) {
        expect(tap.delay).toBeLessThanOrEqual(firstMs);
      }
    });

    it("impact should come after buildup", () => {
      const lastBuildup = CLAIM_HAPTICS.normal.buildup[CLAIM_HAPTICS.normal.buildup.length - 1];
      expect(CLAIM_HAPTICS.normal.impactDelay).toBeGreaterThan(lastBuildup.delay);
    });

    it("success should come after impact", () => {
      expect(CLAIM_HAPTICS.normal.successDelay).toBeGreaterThan(CLAIM_HAPTICS.normal.impactDelay);
    });
  });

  describe("shockwave", () => {
    it("should have positive values", () => {
      expect(CLAIM_SHOCKWAVE.maxRadius).toBeGreaterThan(0);
      expect(CLAIM_SHOCKWAVE.ringWidth).toBeGreaterThan(0);
      expect(CLAIM_SHOCKWAVE.peakIntensity).toBeGreaterThan(0);
    });
  });

  describe("light", () => {
    it("should have positive values", () => {
      expect(CLAIM_LIGHT.peakIntensity).toBeGreaterThan(0);
      expect(CLAIM_LIGHT.radius).toBeGreaterThan(0);
    });
  });

  describe("flash", () => {
    it("should have valid opacity and durations", () => {
      expect(CLAIM_FLASH.peakOpacity).toBeGreaterThan(0);
      expect(CLAIM_FLASH.peakOpacity).toBeLessThanOrEqual(1);
      expect(CLAIM_FLASH.fadeInDuration).toBeGreaterThan(0);
      expect(CLAIM_FLASH.fadeOutDuration).toBeGreaterThan(0);
      expect(CLAIM_FLASH.color).toHaveLength(3);
    });
  });

  describe("shake", () => {
    it("should have positive values", () => {
      expect(CLAIM_SHAKE.magnitude).toBeGreaterThan(0);
      expect(CLAIM_SHAKE.frequency).toBeGreaterThan(0);
      expect(CLAIM_SHAKE.decay).toBeGreaterThan(0);
      expect(CLAIM_SHAKE.duration).toBeGreaterThan(0);
    });
  });

  describe("particle colors", () => {
    it("should have valid RGB triplets (0-2 range for HDR)", () => {
      for (const color of Object.values(CLAIM_PARTICLE_COLORS)) {
        expect(color).toHaveLength(3);
        for (const c of color) {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(2);
        }
      }
    });
  });
});
