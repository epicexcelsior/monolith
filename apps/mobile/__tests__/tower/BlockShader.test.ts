/**
 * Material creation tests for BlockShader.
 * Tests that createBlockMaterial() produces a valid ShaderMaterial
 * with expected uniforms and GLSL content.
 *
 * No GL context needed — we only inspect the JS object.
 */

import { createBlockMaterial, ENERGY_COLOR_STOPS } from "@/components/tower/BlockShader";

describe("createBlockMaterial", () => {
  const material = createBlockMaterial();

  it("should return a ShaderMaterial", () => {
    expect(material.type).toBe("ShaderMaterial");
    expect(material.isShaderMaterial).toBe(true);
  });

  it("should have uTime uniform initialized to 0", () => {
    expect(material.uniforms.uTime).toBeDefined();
    expect(material.uniforms.uTime.value).toBe(0);
  });

  it("should have uFogColor uniform", () => {
    expect(material.uniforms.uFogColor).toBeDefined();
    expect(material.uniforms.uFogColor.value).toBeDefined();
  });

  it("should have uFogDensity uniform", () => {
    expect(material.uniforms.uFogDensity).toBeDefined();
    expect(material.uniforms.uFogDensity.value).toBeCloseTo(0.008);
  });

  it("should have uSpireThreshold uniform", () => {
    expect(material.uniforms.uSpireThreshold).toBeDefined();
    expect(material.uniforms.uSpireThreshold.value).toBeCloseTo(14 / 18);
  });

  it("should have uTowerHeight uniform", () => {
    expect(material.uniforms.uTowerHeight).toBeDefined();
    expect(material.uniforms.uTowerHeight.value).toBeGreaterThan(0);
  });

  it("should have fog disabled (manual fog in shader)", () => {
    expect(material.fog).toBe(false);
  });

  it("should have non-empty vertex shader", () => {
    expect(material.vertexShader).toBeTruthy();
    expect(material.vertexShader.length).toBeGreaterThan(50);
  });

  it("should have non-empty fragment shader", () => {
    expect(material.fragmentShader).toBeTruthy();
    expect(material.fragmentShader.length).toBeGreaterThan(50);
  });

  it("vertex shader should contain instanceMatrix for instancing", () => {
    expect(material.vertexShader).toContain("instanceMatrix");
  });

  it("vertex shader should declare aEnergy attribute", () => {
    expect(material.vertexShader).toContain("aEnergy");
  });

  it("vertex shader should declare aOwnerColor attribute", () => {
    expect(material.vertexShader).toContain("aOwnerColor");
  });

  it("vertex shader should declare aLayerNorm attribute", () => {
    expect(material.vertexShader).toContain("aLayerNorm");
  });

  it("fragment shader should contain smoothstep for color ramp", () => {
    expect(material.fragmentShader).toContain("smoothstep");
  });

  it("fragment shader should contain fresnel calculation", () => {
    expect(material.fragmentShader).toContain("fresnel");
  });

  it("fragment shader should reference uTime for pulse animation", () => {
    expect(material.fragmentShader).toContain("uTime");
  });

  it("fragment shader should contain fog calculation", () => {
    expect(material.fragmentShader).toContain("uFogDensity");
    expect(material.fragmentShader).toContain("uFogColor");
  });

  it("fragment shader should reference spire threshold", () => {
    expect(material.fragmentShader).toContain("uSpireThreshold");
  });

  it("fragment shader should reference tower height for scanline", () => {
    expect(material.fragmentShader).toContain("uTowerHeight");
  });
});

describe("ENERGY_COLOR_STOPS", () => {
  it("should export all 5 energy states", () => {
    expect(ENERGY_COLOR_STOPS).toHaveProperty("blazing");
    expect(ENERGY_COLOR_STOPS).toHaveProperty("thriving");
    expect(ENERGY_COLOR_STOPS).toHaveProperty("fading");
    expect(ENERGY_COLOR_STOPS).toHaveProperty("dying");
    expect(ENERGY_COLOR_STOPS).toHaveProperty("dead");
  });

  it("each stop should have a threshold and color tuple", () => {
    for (const stop of Object.values(ENERGY_COLOR_STOPS)) {
      expect(typeof stop.threshold).toBe("number");
      expect(stop.color).toHaveLength(3);
    }
  });
});
