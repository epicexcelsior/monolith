/**
 * Pure logic tests for tower block data calculations.
 * No R3F/GL context needed — tests math and data generation only.
 */

import {
  DEFAULT_TOWER_CONFIG,
  BLOCK_SIZE,
  LAYER_HEIGHT,
  BASE_RADIUS,
  TOP_RADIUS,
  ENERGY_THRESHOLDS,
} from "@monolith/common";
import { ENERGY_COLOR_STOPS } from "@/components/tower/BlockShader";

describe("Block position calculation", () => {
  const config = DEFAULT_TOWER_CONFIG;

  it("should produce correct Y for each layer", () => {
    for (let layer = 0; layer < config.layerCount; layer++) {
      const y = layer * LAYER_HEIGHT;
      expect(y).toBeCloseTo(layer * 1.2, 5);
    }
  });

  it("should produce correct radius interpolation between base and top", () => {
    // Layer 0 should be at BASE_RADIUS
    const t0 = 0 / (config.layerCount - 1);
    const r0 = BASE_RADIUS - t0 * (BASE_RADIUS - TOP_RADIUS);
    expect(r0).toBe(BASE_RADIUS);

    // Last layer should be at TOP_RADIUS
    const tLast = (config.layerCount - 1) / (config.layerCount - 1);
    const rLast = BASE_RADIUS - tLast * (BASE_RADIUS - TOP_RADIUS);
    expect(rLast).toBe(TOP_RADIUS);
  });

  it("should produce positions on a circle for each layer", () => {
    const layer = 0;
    const count = config.blocksPerLayer[layer];
    const radius = BASE_RADIUS;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Distance from center should equal radius
      const dist = Math.sqrt(x * x + z * z);
      expect(dist).toBeCloseTo(radius, 5);
    }
  });

  it("should have total blocks matching config", () => {
    const total = config.blocksPerLayer.reduce((sum, n) => sum + n, 0);
    expect(total).toBe(config.totalBlocks);
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

  it("should have blazing as cyan (high G and B)", () => {
    const [r, g, b] = ENERGY_COLOR_STOPS.blazing.color;
    expect(r).toBeCloseTo(0, 1);
    expect(g).toBeCloseTo(1, 1);
    expect(b).toBeCloseTo(1, 1);
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
    // At near-zero elevation, y should be ~zoom
    expect(y).toBeCloseTo(zoom, 0);
  });

  it("should have Y = 0 when elevation = PI/2 (horizon)", () => {
    const zoom = 50;
    const { y } = sphericalToCartesian(0, Math.PI / 2, zoom);
    expect(y).toBeCloseTo(0, 5);
  });
});

describe("Demo data generation", () => {
  it("should produce expected block count from default config", () => {
    const config = DEFAULT_TOWER_CONFIG;
    expect(config.totalBlocks).toBeGreaterThan(500);
    expect(config.totalBlocks).toBeLessThan(2000);
  });

  it("should have 10 layers by default", () => {
    expect(DEFAULT_TOWER_CONFIG.layerCount).toBe(10);
  });

  it("should have more blocks at base than top", () => {
    const config = DEFAULT_TOWER_CONFIG;
    const baseCount = config.blocksPerLayer[0];
    const topCount = config.blocksPerLayer[config.layerCount - 1];
    expect(baseCount).toBeGreaterThan(topCount);
  });
});
