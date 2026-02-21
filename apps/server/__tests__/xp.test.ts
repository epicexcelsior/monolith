/**
 * Tests for the XP computation engine.
 */

import {
  computeXp,
  computeLevel,
  incrementCombo,
  getComboCount,
  resetCombo,
  _clearAllCombos,
  XP_TABLE,
  LEVEL_THRESHOLDS,
} from "../src/utils/xp.js";

beforeEach(() => {
  _clearAllCombos();
});

describe("computeXp", () => {
  it("returns base XP for claim", () => {
    expect(computeXp("claim")).toBe(XP_TABLE.claim);
  });

  it("adds first block bonus for claim", () => {
    expect(computeXp("claim", { isFirstBlock: true })).toBe(
      XP_TABLE.claim + XP_TABLE.claim_first_block_bonus,
    );
  });

  it("returns base XP for charge", () => {
    expect(computeXp("charge")).toBe(XP_TABLE.charge);
  });

  it("returns base XP for customize", () => {
    expect(computeXp("customize")).toBe(XP_TABLE.customize);
  });

  it("adds streak milestone bonus at day 3", () => {
    expect(computeXp("charge", { streak: 3 })).toBe(XP_TABLE.charge + XP_TABLE.streak_3d);
  });

  it("adds streak milestone bonus at day 7", () => {
    expect(computeXp("charge", { streak: 7 })).toBe(XP_TABLE.charge + XP_TABLE.streak_7d);
  });

  it("adds streak milestone bonus at day 30", () => {
    expect(computeXp("charge", { streak: 30 })).toBe(XP_TABLE.charge + XP_TABLE.streak_30d);
  });

  it("does not add streak bonus for non-milestone days", () => {
    expect(computeXp("charge", { streak: 5 })).toBe(XP_TABLE.charge);
    expect(computeXp("charge", { streak: 10 })).toBe(XP_TABLE.charge);
  });

  it("applies combo multiplier", () => {
    // comboCount 0 = 1x, 1 = 1.5x, 2 = 2x, 3 = 2.5x, 4+ = 3x
    expect(computeXp("charge", { comboCount: 1 })).toBe(Math.round(XP_TABLE.charge * 1.5));
    expect(computeXp("charge", { comboCount: 2 })).toBe(Math.round(XP_TABLE.charge * 2));
    expect(computeXp("charge", { comboCount: 3 })).toBe(Math.round(XP_TABLE.charge * 2.5));
    expect(computeXp("charge", { comboCount: 4 })).toBe(Math.round(XP_TABLE.charge * 3));
  });

  it("caps combo multiplier at 3x", () => {
    expect(computeXp("charge", { comboCount: 10 })).toBe(Math.round(XP_TABLE.charge * 3));
  });
});

describe("computeLevel", () => {
  it("returns level 1 for 0 XP", () => {
    expect(computeLevel(0)).toBe(1);
  });

  it("returns level 2 at 100 XP", () => {
    expect(computeLevel(100)).toBe(2);
  });

  it("returns level 5 at 1000 XP", () => {
    expect(computeLevel(1000)).toBe(5);
  });

  it("returns level 10 at 10000 XP", () => {
    expect(computeLevel(10000)).toBe(10);
  });

  it("stays at level 10 above max threshold", () => {
    expect(computeLevel(99999)).toBe(10);
  });

  it("returns correct level for values between thresholds", () => {
    expect(computeLevel(50)).toBe(1);
    expect(computeLevel(250)).toBe(2);
    expect(computeLevel(999)).toBe(4);
  });
});

describe("combo tracking", () => {
  const wallet = "test-wallet-123";

  it("starts at 0 combo count", () => {
    expect(getComboCount(wallet)).toBe(0);
  });

  it("increments combo count", () => {
    const now = Date.now();
    expect(incrementCombo(wallet, now)).toBe(1);
    expect(incrementCombo(wallet, now + 5000)).toBe(2);
    expect(incrementCombo(wallet, now + 10000)).toBe(3);
  });

  it("resets combo after 30s inactivity", () => {
    const now = Date.now();
    incrementCombo(wallet, now);
    incrementCombo(wallet, now + 5000);
    expect(getComboCount(wallet, now + 10000)).toBe(2);

    // 31s later
    expect(getComboCount(wallet, now + 36000)).toBe(0);
    expect(incrementCombo(wallet, now + 36000)).toBe(1);
  });

  it("resetCombo clears combo for wallet", () => {
    incrementCombo(wallet);
    incrementCombo(wallet);
    resetCombo(wallet);
    expect(getComboCount(wallet)).toBe(0);
  });
});
