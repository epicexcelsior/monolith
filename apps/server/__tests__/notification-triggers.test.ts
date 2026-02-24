/**
 * Tests for notification trigger logic (extracted helpers).
 */

import {
  isEnergyLow,
  isBlockDormant,
  shouldSendStreakReminder,
  shouldNotifyEnergyLow,
} from "../src/utils/notifications.js";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

describe("energy low threshold detection", () => {
  it("triggers for energy exactly 20", () => {
    expect(shouldNotifyEnergyLow(20)).toBe(true);
  });

  it("triggers for energy 1", () => {
    expect(shouldNotifyEnergyLow(1)).toBe(true);
  });

  it("does not trigger for energy 21", () => {
    expect(shouldNotifyEnergyLow(21)).toBe(false);
  });

  it("does not trigger for energy 0 (dormant, not low)", () => {
    expect(shouldNotifyEnergyLow(0)).toBe(false);
  });

  it("does not trigger for energy 100 (full)", () => {
    expect(shouldNotifyEnergyLow(100)).toBe(false);
  });
});

describe("dormant block detection", () => {
  it("detects block that just became dormant (exactly 3 days)", () => {
    const now = Date.now();
    expect(isBlockDormant(0, now - THREE_DAYS_MS, now)).toBe(true);
  });

  it("does not trigger for non-dormant energy", () => {
    const now = Date.now();
    expect(isBlockDormant(1, now - THREE_DAYS_MS, now)).toBe(false);
  });

  it("does not trigger within first 3 days", () => {
    const now = Date.now();
    expect(isBlockDormant(0, now - (2 * 24 * 60 * 60 * 1000), now)).toBe(false);
  });

  it("does not trigger after the 1-hour detection window", () => {
    const now = Date.now();
    const pastWindow = now - THREE_DAYS_MS - 60 * 60 * 1000;
    expect(isBlockDormant(0, pastWindow, now)).toBe(false);
  });
});

describe("streak reminder", () => {
  it("triggers when streak >= 3 and not charged today", () => {
    expect(shouldSendStreakReminder(3, "2026-02-22", "2026-02-23")).toBe(true);
  });

  it("triggers for streak = 7", () => {
    expect(shouldSendStreakReminder(7, "2026-02-22", "2026-02-23")).toBe(true);
  });

  it("does not trigger for streak < 3", () => {
    expect(shouldSendStreakReminder(2, "2026-02-22", "2026-02-23")).toBe(false);
    expect(shouldSendStreakReminder(0, "2026-02-22", "2026-02-23")).toBe(false);
  });

  it("does not trigger if already charged today", () => {
    expect(shouldSendStreakReminder(5, "2026-02-23", "2026-02-23")).toBe(false);
  });
});
