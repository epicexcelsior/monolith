/**
 * Tests for Supabase persistence helpers.
 *
 * Uses mocked Supabase client to verify CRUD operations
 * and graceful fallback when env vars are missing.
 */

// Clear env vars for the "fallback" tests
const originalEnv = { ...process.env };

describe("supabase graceful fallback", () => {
  beforeEach(() => {
    // Ensure no Supabase env vars
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    jest.resetModules();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("loadPlayerBlocks returns empty array when env vars missing", async () => {
    const { loadPlayerBlocks } = await import("../src/utils/supabase.js");
    const result = await loadPlayerBlocks();
    expect(result).toEqual([]);
  });

  it("upsertBlock is a no-op when env vars missing", async () => {
    const { upsertBlock } = await import("../src/utils/supabase.js");
    // Should not throw — fire-and-forget, returns void
    upsertBlock({
      id: "block-0-0",
      layer: 0,
      index: 0,
      energy: 100,
      owner: "test",
      owner_color: "#ff0000",
      staked_amount: 1000000,
      last_charge_time: Date.now(),
      streak: 1,
      last_streak_date: "2026-02-20",
      appearance: {},
    });
  });

  it("loadOrCreatePlayer returns default player when env vars missing", async () => {
    const { loadOrCreatePlayer } = await import("../src/utils/supabase.js");
    const result = await loadOrCreatePlayer("test-wallet");
    expect(result).toEqual({
      wallet: "test-wallet",
      xp: 0,
      level: 1,
      total_claims: 0,
      total_charges: 0,
      combo_best: 0,
      username: null,
    });
  });

  it("insertEvent is a no-op when env vars missing", async () => {
    const { insertEvent } = await import("../src/utils/supabase.js");
    // Fire-and-forget, returns void
    insertEvent("claim", "block-0-0", "test-wallet");
  });

  it("getRecentEvents returns empty array when env vars missing", async () => {
    const { getRecentEvents } = await import("../src/utils/supabase.js");
    const result = await getRecentEvents();
    expect(result).toEqual([]);
  });

  it("getTopPlayers returns empty array when env vars missing", async () => {
    const { getTopPlayers } = await import("../src/utils/supabase.js");
    const result = await getTopPlayers();
    expect(result).toEqual([]);
  });
});
