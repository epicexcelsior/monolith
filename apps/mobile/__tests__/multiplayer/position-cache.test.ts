/**
 * Position Cache Tests
 *
 * Validates that block positions are correctly generated and cached.
 */

// Must define __DEV__ before any React Native module loads
(globalThis as any).__DEV__ = true;

import {
  DEFAULT_TOWER_CONFIG,
  MONOLITH_HALF_W,
  MONOLITH_HALF_D,
  SPIRE_START_LAYER,
  computeBodyLayerPositions,
  computeSpireLayerPositions,
} from "@monolith/common";

describe("Position Cache: Layout Generation", () => {
  describe("computeBodyLayerPositions", () => {
    it("should generate valid {x,y,z,rotY} for body layers", () => {
      const config = DEFAULT_TOWER_CONFIG;
      const layer = 0;
      const count = config.blocksPerLayer[layer];

      const positions = computeBodyLayerPositions(
        layer,
        count,
        MONOLITH_HALF_W,
        MONOLITH_HALF_D,
        config.layerCount
      );

      expect(positions.length).toBe(count);
      positions.forEach((pos, idx) => {
        expect(pos.x).toBeDefined();
        expect(pos.y).toBeDefined();
        expect(pos.z).toBeDefined();
        expect(pos.rotY).toBeDefined();
        expect(typeof pos.x).toBe("number");
        expect(typeof pos.y).toBe("number");
        expect(typeof pos.z).toBe("number");
        expect(typeof pos.rotY).toBe("number");
      });
    });

    it("should not return {0,0,0} positions for body layer 0", () => {
      const config = DEFAULT_TOWER_CONFIG;
      const positions = computeBodyLayerPositions(
        0,
        config.blocksPerLayer[0],
        MONOLITH_HALF_W,
        MONOLITH_HALF_D,
        config.layerCount
      );

      positions.forEach((pos) => {
        const isZero =
          Math.abs(pos.x) < 0.001 &&
          Math.abs(pos.y) < 0.001 &&
          Math.abs(pos.z) < 0.001;
        expect(isZero).toBe(false);
      });
    });
  });

  describe("computeSpireLayerPositions", () => {
    it("should generate valid {x,y,z,rotY} for spire layers", () => {
      const config = DEFAULT_TOWER_CONFIG;
      const layer = SPIRE_START_LAYER;
      const count = config.blocksPerLayer[layer];

      const positions = computeSpireLayerPositions(
        layer,
        count,
        config.layerCount
      );

      expect(positions.length).toBe(count);
      positions.forEach((pos) => {
        expect(typeof pos.x).toBe("number");
        expect(typeof pos.y).toBe("number");
        expect(typeof pos.z).toBe("number");
        expect(typeof pos.rotY).toBe("number");
      });
    });
  });

  describe("All tower blocks coverage", () => {
    it("should generate 846 total blocks", () => {
      const config = DEFAULT_TOWER_CONFIG;
      let totalCount = 0;

      for (let layer = 0; layer < config.layerCount; layer++) {
        totalCount += config.blocksPerLayer[layer];
      }

      expect(totalCount).toBe(846);
    });

    it("should generate no {0,0,0} positions across all layers", () => {
      const config = DEFAULT_TOWER_CONFIG;
      const zeroPositions: string[] = [];

      for (let layer = 0; layer < config.layerCount; layer++) {
        const count = config.blocksPerLayer[layer];
        const isSpire = layer >= SPIRE_START_LAYER;

        const positions = isSpire
          ? computeSpireLayerPositions(layer, count, config.layerCount)
          : computeBodyLayerPositions(
              layer,
              count,
              MONOLITH_HALF_W,
              MONOLITH_HALF_D,
              config.layerCount
            );

        positions.forEach((pos, idx) => {
          const isZero =
            Math.abs(pos.x) < 0.001 &&
            Math.abs(pos.y) < 0.001 &&
            Math.abs(pos.z) < 0.001;

          if (isZero) {
            zeroPositions.push(`Layer ${layer}, Index ${idx}`);
          }
        });
      }

      expect(zeroPositions).toEqual([]);
    });
  });
});
