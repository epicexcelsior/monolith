/**
 * Tests for push token storage helpers.
 *
 * Tests graceful fallback when Supabase env vars are missing (same pattern as supabase.test.ts).
 */

const originalEnv = { ...process.env };

describe("push-tokens graceful fallback", () => {
  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    jest.resetModules();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("upsertPushToken is a no-op when env vars missing", async () => {
    const { upsertPushToken } = await import("../src/utils/push-tokens.js");
    // Should not throw — fire-and-forget, returns void
    upsertPushToken("test-wallet", "ExponentPushToken[test-token]");
  });

  it("removePushToken is a no-op when env vars missing", async () => {
    const { removePushToken } = await import("../src/utils/push-tokens.js");
    removePushToken("ExponentPushToken[test-token]");
  });

  it("getTokensForPlayer returns empty array when env vars missing", async () => {
    const { getTokensForPlayer } = await import("../src/utils/push-tokens.js");
    const result = await getTokensForPlayer("test-wallet");
    expect(result).toEqual([]);
  });

  it("getTokensForPlayers returns empty map when env vars missing", async () => {
    const { getTokensForPlayers } = await import("../src/utils/push-tokens.js");
    const result = await getTokensForPlayers(["wallet-1", "wallet-2"]);
    expect(result.size).toBe(0);
  });

  it("getTokensForPlayers returns empty map for empty input", async () => {
    const { getTokensForPlayers } = await import("../src/utils/push-tokens.js");
    const result = await getTokensForPlayers([]);
    expect(result.size).toBe(0);
  });
});
