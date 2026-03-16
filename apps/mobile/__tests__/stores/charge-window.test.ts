/**
 * Tests for chargeBlock with qualityOverride (Charge Window timing mechanic).
 *
 * Verifies that the quality override parameter correctly determines
 * charge amounts, and that the existing RNG path is preserved.
 */

(globalThis as any).__DEV__ = true;

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "/mock/",
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  readAsStringAsync: jest.fn().mockResolvedValue(""),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/services/mwa", () => ({
  SECURE_STORE_KEYS: {
    AUTH_TOKEN: "mwa_auth_token",
    BASE64_ADDRESS: "mwa_base64_address",
    WALLET_URI_BASE: "mwa_wallet_uri_base",
    HAS_COMPLETED_ONBOARDING: "monolith_onboarding_complete",
  },
}));

import { useTowerStore } from "@/stores/tower-store";

/** Helper: seed a single owned block with no cooldown */
function seedOwnedBlock(blockId = "block-0-0") {
  useTowerStore.setState({
    demoBlocks: [
      {
        id: blockId,
        layer: 0,
        index: 0,
        energy: 50,
        ownerColor: "#FF0000",
        owner: "test-wallet",
        stakedAmount: 10_000_000,
        position: { x: 0, y: 0, z: 0 },
        lastChargeTime: 0, // no cooldown
        streak: 1,
        lastStreakDate: "",
        totalCharges: 5,
        bestStreak: 3,
        evolutionTier: 0,
      },
    ],
  });
}

beforeEach(() => {
  seedOwnedBlock();
});

describe("chargeBlock with qualityOverride", () => {
  it('qualityOverride "perfect" gives exactly 40 base (before streak multiplier)', () => {
    const result = useTowerStore.getState().chargeBlock("block-0-0", "perfect");
    expect(result.success).toBe(true);
    expect(result.chargeQuality).toBe("perfect");
    // Base amount is 40, multiplied by streak multiplier (streak 1 → 1.0x)
    expect(result.chargeAmount).toBe(40);
  });

  it('qualityOverride "great" gives 31-35 base', () => {
    // Run multiple times to validate range
    const amounts: number[] = [];
    for (let i = 0; i < 50; i++) {
      seedOwnedBlock();
      const result = useTowerStore.getState().chargeBlock("block-0-0", "great");
      expect(result.success).toBe(true);
      expect(result.chargeQuality).toBe("great");
      // streak 1 → multiplier 1.0, so chargeAmount === baseAmount
      amounts.push(result.chargeAmount!);
    }
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    expect(min).toBeGreaterThanOrEqual(31);
    expect(max).toBeLessThanOrEqual(35);
  });

  it('qualityOverride "good" gives 26-30 base', () => {
    const amounts: number[] = [];
    for (let i = 0; i < 50; i++) {
      seedOwnedBlock();
      const result = useTowerStore.getState().chargeBlock("block-0-0", "good");
      expect(result.success).toBe(true);
      expect(result.chargeQuality).toBe("good");
      amounts.push(result.chargeAmount!);
    }
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    expect(min).toBeGreaterThanOrEqual(26);
    expect(max).toBeLessThanOrEqual(30);
  });

  it("no qualityOverride uses existing RNG (15-35 range)", () => {
    const amounts: number[] = [];
    for (let i = 0; i < 100; i++) {
      seedOwnedBlock();
      const result = useTowerStore.getState().chargeBlock("block-0-0");
      expect(result.success).toBe(true);
      // Quality should be one of the original RNG values
      expect(["normal", "good", "great"]).toContain(result.chargeQuality);
      amounts.push(result.chargeAmount!);
    }
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    // RNG brackets: 15-35 base × 1.0 multiplier (streak 1)
    expect(min).toBeGreaterThanOrEqual(15);
    expect(max).toBeLessThanOrEqual(35);
  });

  it('qualityOverride "normal" falls through to existing RNG', () => {
    const result = useTowerStore.getState().chargeBlock("block-0-0", "normal");
    expect(result.success).toBe(true);
    // "normal" override uses rollChargeAmount(), which can return any quality
    expect(result.chargeAmount).toBeGreaterThanOrEqual(15);
    expect(result.chargeAmount).toBeLessThanOrEqual(35);
  });

  it("perfect charge respects streak multiplier", () => {
    // Use same-day charge (streak preserved, not incremented).
    // Streak 7 → multiplier 2.0x. Same-day = lastStreakDate matches today.
    const today = new Date().toISOString().slice(0, 10);

    useTowerStore.setState({
      demoBlocks: [
        {
          id: "block-0-0",
          layer: 0,
          index: 0,
          energy: 50,
          ownerColor: "#FF0000",
          owner: "test-wallet",
          stakedAmount: 10_000_000,
          position: { x: 0, y: 0, z: 0 },
          lastChargeTime: 0,
          streak: 7,
          lastStreakDate: today,
          totalCharges: 5,
          bestStreak: 7,
          evolutionTier: 0,
        },
      ],
    });

    const result = useTowerStore.getState().chargeBlock("block-0-0", "perfect");
    expect(result.success).toBe(true);
    // Same-day charge: streak stays at 7, multiplier is 2.0
    expect(result.streak).toBe(7);
    expect(result.multiplier).toBe(2.0);
    // 40 base × 2.0 = 80
    expect(result.chargeAmount).toBe(80);
  });
});
