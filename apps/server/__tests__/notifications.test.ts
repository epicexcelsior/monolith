/**
 * Tests for the push notification sender.
 */

import {
  sendPushNotification,
  isEnergyLow,
  isBlockDormant,
  shouldSendStreakReminder,
  shouldNotifyEnergyLow,
} from "../src/utils/notifications.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

describe("sendPushNotification", () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
    } as Response);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("sends a single fetch call for <= 100 tokens", async () => {
    const tokens = Array.from({ length: 50 }, (_, i) => `ExponentPushToken[token-${i}]`);
    sendPushNotification(tokens, "Test Title", "Test Body");
    // Allow microtasks to flush
    await Promise.resolve();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("batches 101 tokens into 2 fetch calls", async () => {
    const tokens = Array.from({ length: 101 }, (_, i) => `ExponentPushToken[token-${i}]`);
    sendPushNotification(tokens, "Test Title", "Test Body");
    await Promise.resolve();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("sends to correct Expo Push URL", async () => {
    sendPushNotification(["ExponentPushToken[abc]"], "Title", "Body");
    await Promise.resolve();
    expect(fetchSpy).toHaveBeenCalledWith(
      EXPO_PUSH_URL,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
  });

  it("includes sound and priority in payload", async () => {
    sendPushNotification(["ExponentPushToken[abc]"], "Title", "Body");
    await Promise.resolve();
    const callArgs = fetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body[0].sound).toBe("default");
    expect(body[0].priority).toBe("high");
    expect(body[0].title).toBe("Title");
    expect(body[0].body).toBe("Body");
  });

  it("does not throw on empty token array", () => {
    expect(() => sendPushNotification([], "Title", "Body")).not.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not throw when fetch fails", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("Network error"));
    expect(() => sendPushNotification(["ExponentPushToken[abc]"], "Title", "Body")).not.toThrow();
    // Allow rejection to be handled
    await new Promise((r) => setTimeout(r, 10));
  });
});

describe("isEnergyLow", () => {
  it("returns true for energy 1-20", () => {
    expect(isEnergyLow(1)).toBe(true);
    expect(isEnergyLow(20)).toBe(true);
    expect(isEnergyLow(10)).toBe(true);
  });

  it("returns false for energy 0 (dormant)", () => {
    expect(isEnergyLow(0)).toBe(false);
  });

  it("returns false for energy > 20", () => {
    expect(isEnergyLow(21)).toBe(false);
    expect(isEnergyLow(100)).toBe(false);
  });
});

describe("isBlockDormant", () => {
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

  it("returns false if energy > 0", () => {
    const now = Date.now();
    expect(isBlockDormant(1, now - THREE_DAYS_MS - 1000, now)).toBe(false);
  });

  it("returns true if energy 0 and lastChargeTime is exactly at 3-day boundary", () => {
    const now = Date.now();
    const lastChargeTime = now - THREE_DAYS_MS;
    expect(isBlockDormant(0, lastChargeTime, now)).toBe(true);
  });

  it("returns true if energy 0 and elapsed is just under 3 days + 1 hour", () => {
    const now = Date.now();
    const lastChargeTime = now - THREE_DAYS_MS - (60 * 60 * 1000 - 1000);
    expect(isBlockDormant(0, lastChargeTime, now)).toBe(true);
  });

  it("returns false if elapsed is >= 3 days + 1 hour (already past window)", () => {
    const now = Date.now();
    const lastChargeTime = now - THREE_DAYS_MS - 60 * 60 * 1000;
    expect(isBlockDormant(0, lastChargeTime, now)).toBe(false);
  });

  it("returns false if elapsed < 3 days", () => {
    const now = Date.now();
    const lastChargeTime = now - (2 * 24 * 60 * 60 * 1000);
    expect(isBlockDormant(0, lastChargeTime, now)).toBe(false);
  });
});

describe("shouldSendStreakReminder", () => {
  it("returns true when streak >= 3 and not charged today", () => {
    expect(shouldSendStreakReminder(3, "2026-02-22", "2026-02-23")).toBe(true);
    expect(shouldSendStreakReminder(10, "2026-02-22", "2026-02-23")).toBe(true);
  });

  it("returns false when streak < 3", () => {
    expect(shouldSendStreakReminder(0, "2026-02-22", "2026-02-23")).toBe(false);
    expect(shouldSendStreakReminder(2, "2026-02-22", "2026-02-23")).toBe(false);
  });

  it("returns false when lastStreakDate === today (already charged today)", () => {
    expect(shouldSendStreakReminder(5, "2026-02-23", "2026-02-23")).toBe(false);
  });
});

describe("shouldNotifyEnergyLow", () => {
  it("triggers for energy = 20", () => {
    expect(shouldNotifyEnergyLow(20)).toBe(true);
  });

  it("does not trigger for energy = 21", () => {
    expect(shouldNotifyEnergyLow(21)).toBe(false);
  });

  it("does not trigger for energy = 0", () => {
    expect(shouldNotifyEnergyLow(0)).toBe(false);
  });
});
