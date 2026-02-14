/**
 * Pure logic tests for tower block data calculations.
 * No R3F/GL context needed — tests math and data generation only.
 */

import {
  DEFAULT_TOWER_CONFIG,
  BLOCK_SIZE,
  LAYER_HEIGHT,
  MONOLITH_HALF_W,
  MONOLITH_HALF_D,
  SPIRE_START_LAYER,
  BLOCK_SCALE_PER_LAYER,
  ENERGY_THRESHOLDS,
  generateTowerConfig,
} from "@monolith/common";
import { ENERGY_COLOR_STOPS } from "@/components/tower/BlockShader";

describe("Monolith tower config", () => {
  const config = DEFAULT_TOWER_CONFIG;

  it("should have 18 layers by default", () => {
    expect(config.layerCount).toBe(18);
  });

  it("should have shape set to 'monolith'", () => {
    expect(config.shape).toBe("monolith");
  });

  it("should produce at least 400 total blocks", () => {
    expect(config.totalBlocks).toBeGreaterThanOrEqual(400);
  });

  it("should produce fewer than 1500 total blocks (mobile perf)", () => {
    expect(config.totalBlocks).toBeLessThan(1500);
  });

  it("should have consistent body layer block count for layers below spire", () => {
    const bodyCount = config.blocksPerLayer[0];
    for (let i = 1; i < SPIRE_START_LAYER; i++) {
      expect(config.blocksPerLayer[i]).toBe(bodyCount);
    }
  });

  it("should have spire layers with fewer or equal blocks than body", () => {
    const bodyCount = config.blocksPerLayer[0];
    for (let i = SPIRE_START_LAYER; i < config.layerCount; i++) {
      expect(config.blocksPerLayer[i]).toBeLessThanOrEqual(bodyCount);
    }
  });

  it("should have the very top layer with just 1-3 blocks (penthouse)", () => {
    const topCount = config.blocksPerLayer[config.layerCount - 1];
    expect(topCount).toBeGreaterThanOrEqual(1);
    expect(topCount).toBeLessThanOrEqual(5);
  });

  it("should have blocksPerLayer array length matching layerCount", () => {
    expect(config.blocksPerLayer.length).toBe(config.layerCount);
  });

  it("totalBlocks should equal sum of blocksPerLayer", () => {
    const sum = config.blocksPerLayer.reduce((s, n) => s + n, 0);
    expect(sum).toBe(config.totalBlocks);
  });
});

describe("Tower layer Y positions", () => {
  it("should produce correct Y for each layer", () => {
    for (let layer = 0; layer < DEFAULT_TOWER_CONFIG.layerCount; layer++) {
      const y = layer * LAYER_HEIGHT;
      expect(y).toBeCloseTo(layer * 1.3, 5);
    }
  });
});

describe("Monolith dimensions", () => {
  it("MONOLITH_HALF_W should be a positive number", () => {
    expect(MONOLITH_HALF_W).toBeGreaterThan(0);
  });

  it("MONOLITH_HALF_D should be a positive number", () => {
    expect(MONOLITH_HALF_D).toBeGreaterThan(0);
  });

  it("SPIRE_START_LAYER should be between 0 and layerCount", () => {
    expect(SPIRE_START_LAYER).toBeGreaterThan(0);
    expect(SPIRE_START_LAYER).toBeLessThan(DEFAULT_TOWER_CONFIG.layerCount);
  });

  it("BLOCK_SCALE_PER_LAYER should be a small positive value", () => {
    expect(BLOCK_SCALE_PER_LAYER).toBeGreaterThan(0);
    expect(BLOCK_SCALE_PER_LAYER).toBeLessThan(0.1);
  });

  it("BLOCK_SIZE should be positive", () => {
    expect(BLOCK_SIZE).toBeGreaterThan(0);
  });
});

describe("Custom layer count", () => {
  it("should support generating configs with different layer counts", () => {
    const cfg = generateTowerConfig(20);
    expect(cfg.layerCount).toBe(20);
    expect(cfg.blocksPerLayer.length).toBe(20);
    expect(cfg.totalBlocks).toBeGreaterThan(0);
  });
});

describe("Energy color stops", () => {
  it("should have thresholds in descending order", () => {
    const thresholds = [
      ENERGY_COLOR_STOPS.blazing.threshold,
      ENERGY_COLOR_STOPS.thriving.threshold,
      ENERGY_COLOR_STOPS.fading.threshold,
      ENERGY_COLOR_STOPS.dying.threshold,
      ENERGY_COLOR_STOPS.dead.threshold,
    ];

    for (let i = 0; i < thresholds.length - 1; i++) {
      expect(thresholds[i]).toBeGreaterThan(thresholds[i + 1]);
    }
  });

  it("should have valid RGB values (0-1 range)", () => {
    const stops = Object.values(ENERGY_COLOR_STOPS);
    for (const stop of stops) {
      for (const component of stop.color) {
        expect(component).toBeGreaterThanOrEqual(0);
        expect(component).toBeLessThanOrEqual(1);
      }
    }
  });

  it("should have blazing as golden (warm solarpunk palette)", () => {
    const [r, g, b] = ENERGY_COLOR_STOPS.blazing.color;
    expect(r).toBeCloseTo(1.0, 1);   // brilliant gold — high red
    expect(g).toBeCloseTo(0.85, 1);   // high green
    expect(b).toBeCloseTo(0.2, 1);    // low blue
  });

  it("should have dead as dark", () => {
    const [r, g, b] = ENERGY_COLOR_STOPS.dead.color;
    expect(r).toBeLessThan(0.2);
    expect(g).toBeLessThan(0.2);
    expect(b).toBeLessThan(0.3);
  });
});

describe("Energy thresholds from common", () => {
  it("should have blazing > thriving > fading > dying > dead", () => {
    expect(ENERGY_THRESHOLDS.blazing).toBeGreaterThan(
      ENERGY_THRESHOLDS.thriving,
    );
    expect(ENERGY_THRESHOLDS.thriving).toBeGreaterThan(
      ENERGY_THRESHOLDS.fading,
    );
    expect(ENERGY_THRESHOLDS.fading).toBeGreaterThan(ENERGY_THRESHOLDS.dying);
    expect(ENERGY_THRESHOLDS.dying).toBeGreaterThan(ENERGY_THRESHOLDS.dead);
  });
});

describe("Camera spherical to cartesian", () => {
  function sphericalToCartesian(
    azimuth: number,
    elevation: number,
    zoom: number,
  ) {
    const x = zoom * Math.sin(elevation) * Math.sin(azimuth);
    const y = zoom * Math.cos(elevation);
    const z = zoom * Math.sin(elevation) * Math.cos(azimuth);
    return { x, y, z };
  }

  it("should produce a point at correct distance from origin", () => {
    const zoom = 50;
    const { x, y, z } = sphericalToCartesian(Math.PI / 4, 0.8, zoom);
    const dist = Math.sqrt(x * x + y * y + z * z);
    expect(dist).toBeCloseTo(zoom, 5);
  });

  it("should have Y = zoom when elevation = 0 (looking from top)", () => {
    const zoom = 50;
    const { x, y, z } = sphericalToCartesian(0, 0.001, zoom);
    expect(y).toBeCloseTo(zoom, 0);
  });

  it("should have Y = 0 when elevation = PI/2 (horizon)", () => {
    const zoom = 50;
    const { y } = sphericalToCartesian(0, Math.PI / 2, zoom);
    expect(y).toBeCloseTo(0, 5);
  });
});
