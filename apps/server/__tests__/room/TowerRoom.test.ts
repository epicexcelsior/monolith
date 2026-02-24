/**
 * TowerRoom integration tests using @colyseus/testing.
 *
 * Spins up a real TowerRoom in-process (WebSocket on localhost:2568) with:
 *   - Mocked Supabase (no network, no env vars needed)
 *   - Fake timers for controlling cooldowns and bot simulation
 *   - Real game logic: claim, charge, ownership enforcement, XP, broadcasts
 *
 * Room is registered as "tower" (matches apps/server/src/index.ts).
 *
 * Design notes:
 *   - `client.waitForMessage(type)` is augmented by @colyseus/testing on colyseus.js Room.
 *     It registers a listener and resolves when the message arrives. Call it BEFORE
 *     triggering the action that sends the message, or after connectTo (tower_state is
 *     sent async in onJoin so arrives after connectTo resolves for single clients).
 *   - `jest.useFakeTimers` with doNotFake:Promise/nextTick/setImmediate keeps async working.
 *     Use setImmediate (not setTimeout) for any yields in test setup.
 */
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { TowerRoom } from "../../src/rooms/TowerRoom.js";
import { _clearAllCombos } from "../../src/utils/xp.js";

// ── Mock Supabase before any room code runs ──────────────────────────────────
jest.mock("../../src/utils/supabase.js", () => ({
  loadPlayerBlocks: jest.fn().mockResolvedValue([]),
  loadOrCreatePlayer: jest.fn().mockImplementation((wallet: string) =>
    Promise.resolve({
      wallet,
      xp: 0,
      level: 1,
      total_claims: 0,
      total_charges: 0,
      combo_best: 0,
      username: null,
    })
  ),
  setPlayerUsername: jest.fn().mockResolvedValue({ success: true }),
  upsertBlock: jest.fn(),
  bulkUpsertBlocks: jest.fn(),
  updatePlayerXp: jest.fn(),
  insertEvent: jest.fn(),
  initSupabase: jest.fn().mockResolvedValue(undefined),
  getTopPlayers: jest.fn().mockResolvedValue([]),
  getRecentEvents: jest.fn().mockResolvedValue([]),
  getClient: jest.fn().mockReturnValue(null),
}));

// ── Constants ────────────────────────────────────────────────────────────────
const WALLET_A = "PlayerWalletA111111111111111111111";
const WALLET_B = "PlayerWalletB222222222222222222222";

// Deterministic seed=42: layer 0 has ~70% bot density — block-0-0 and block-0-1 are bot-owned
const BOT_BLOCK_ID = "block-0-0";
const BOT_BLOCK_ID_2 = "block-0-1";

/** Yield to the event loop so pending I/O and microtasks can drain. */
const nextTick = () => new Promise<void>((r) => setImmediate(r));

// ── Test suite ───────────────────────────────────────────────────────────────
describe("TowerRoom — multiplayer integration", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    jest.useFakeTimers({ doNotFake: ["Promise", "nextTick", "setImmediate"] });

    const gameServer = new Server({
      transport: new WebSocketTransport(),
      gracefullyShutdown: false,
    });
    gameServer.define("tower", TowerRoom);
    colyseus = await boot(gameServer);
  }, 15_000);

  afterAll(async () => {
    jest.useRealTimers();
    await colyseus.shutdown();
  });

  afterEach(async () => {
    await colyseus.cleanup();
    jest.clearAllMocks();
    _clearAllCombos();
  });

  // ── Test 1: Join → tower_state ───────────────────────────────────────────
  it("client receives tower_state on join", async () => {
    const room = await colyseus.createRoom("tower", {});
    const client = await colyseus.connectTo(room, { wallet: WALLET_A });

    // tower_state is sent synchronously at the start of onJoin.
    // onJoin is async (awaits getOrCreatePlayer), so the join ack arrives after
    // tower_state is queued — by the time connectTo resolves, tower_state is in-flight.
    const msg = await client.waitForMessage("tower_state");

    expect(msg).toBeDefined();
    expect(msg.blocks).toBeDefined();
    expect(Array.isArray(msg.blocks)).toBe(true);
    expect(msg.blocks.length).toBeGreaterThan(0);
  }, 10_000);

  // ── Test 2: Claim bot block → success + broadcast ────────────────────────
  it("claiming a bot block succeeds and broadcasts to other clients", async () => {
    const room = await colyseus.createRoom("tower", {});
    const clientA = await colyseus.connectTo(room, { wallet: WALLET_A });
    const clientB = await colyseus.connectTo(room, { wallet: WALLET_B });

    // Yield so both clients' onJoin async operations complete (mocked Supabase resolves)
    await nextTick();

    // Set up listeners BEFORE triggering the action
    const claimResultPromise = clientA.waitForMessage("claim_result");
    const broadcastPromise = clientB.waitForMessage("block_update");

    clientA.send("claim", {
      blockId: BOT_BLOCK_ID,
      wallet: WALLET_A,
      color: "#ff6600",
      amount: 1,
    });

    const [claimResult, blockUpdate] = await Promise.all([claimResultPromise, broadcastPromise]);

    expect(claimResult.success).toBe(true);
    expect(claimResult.blockId).toBe(BOT_BLOCK_ID);
    // First block: isFirstBlock=true → base 100 + 200 bonus = 300 (combo=0, mult=1)
    expect(claimResult.pointsEarned).toBeGreaterThanOrEqual(100);

    expect(blockUpdate.eventType).toBe("claim");
    expect(blockUpdate.owner).toBe(WALLET_A);
  }, 10_000);

  // ── Test 3: Claim already-owned block → error ─────────────────────────
  it("cannot claim a block already owned by another player", async () => {
    const room = await colyseus.createRoom("tower", {});
    const clientA = await colyseus.connectTo(room, { wallet: WALLET_A });
    const clientB = await colyseus.connectTo(room, { wallet: WALLET_B });
    await nextTick();

    // Client A claims first
    const firstClaim = clientA.waitForMessage("claim_result");
    clientA.send("claim", { blockId: BOT_BLOCK_ID, wallet: WALLET_A, color: "#ff6600", amount: 1 });
    const first = await firstClaim;
    expect(first.success).toBe(true);

    // Client B tries to claim same block → server sends "error" (not claim_result)
    const errorMsg = clientB.waitForMessage("error");
    clientB.send("claim", { blockId: BOT_BLOCK_ID, wallet: WALLET_B, color: "#0066ff", amount: 1 });
    const err = await errorMsg;

    expect(err.message).toMatch(/already claimed/i);
  }, 10_000);

  // ── Test 4: Charge own block → success after cooldown ────────────────────
  it("player can charge their own block after cooldown", async () => {
    const room = await colyseus.createRoom("tower", {});
    const client = await colyseus.connectTo(room, { wallet: WALLET_A });
    await nextTick();

    // Claim first
    const claimDone = client.waitForMessage("claim_result");
    client.send("claim", { blockId: BOT_BLOCK_ID, wallet: WALLET_A, color: "#ff6600", amount: 1 });
    await claimDone;

    // Bypass cooldown by back-dating lastChargeTime on the server-side block directly.
    // jest.advanceTimersByTime(31_000) would fire Colyseus WS ping timers and break the
    // connection, so we manipulate state directly instead.
    const serverBlock = room.state.blocks.get(BOT_BLOCK_ID);
    serverBlock.lastChargeTime = Date.now() - 31_000;

    // Now charge (cooldown passed: lastChargeTime is 31s in the past)
    const chargeResult = client.waitForMessage("charge_result");
    client.send("charge", { blockId: BOT_BLOCK_ID, wallet: WALLET_A });
    const result = await chargeResult;

    expect(result.success).toBe(true);
    expect(result.pointsEarned).toBeGreaterThanOrEqual(25);
  }, 10_000);

  // ── Test 5: Charge another player's block → error ────────────────────────
  it("cannot charge a block owned by another player", async () => {
    const room = await colyseus.createRoom("tower", {});
    const clientA = await colyseus.connectTo(room, { wallet: WALLET_A });
    const clientB = await colyseus.connectTo(room, { wallet: WALLET_B });
    await nextTick();

    // A claims the block
    const claimed = clientA.waitForMessage("claim_result");
    clientA.send("claim", { blockId: BOT_BLOCK_ID, wallet: WALLET_A, color: "#ff6600", amount: 1 });
    await claimed;

    // B tries to charge A's block → server sends "error" (ownership enforcement)
    const errorMsg = clientB.waitForMessage("error");
    clientB.send("charge", { blockId: BOT_BLOCK_ID, wallet: WALLET_B });
    const err = await errorMsg;

    expect(err.message).toMatch(/not your block/i);
  }, 10_000);

  // ── Test 6: Charge cooldown enforced ─────────────────────────────────────
  it("charge is rejected immediately after claim (cooldown not elapsed)", async () => {
    const room = await colyseus.createRoom("tower", {});
    const client = await colyseus.connectTo(room, { wallet: WALLET_A });
    await nextTick();

    // Claim (sets lastChargeTime = Date.now() in fake time)
    const claimed = client.waitForMessage("claim_result");
    client.send("claim", { blockId: BOT_BLOCK_ID_2, wallet: WALLET_A, color: "#ff6600", amount: 1 });
    await claimed;

    // Immediately try to charge without advancing timers — cooldown active
    const chargeResult = client.waitForMessage("charge_result");
    client.send("charge", { blockId: BOT_BLOCK_ID_2, wallet: WALLET_A });
    const result = await chargeResult;

    expect(result.success).toBe(false);
    expect(result.cooldownRemaining).toBeGreaterThan(0);
  }, 10_000);

  // ── Test 7: Customize broadcasts to other clients with all fields ───────
  it("customize broadcasts all appearance fields to other clients", async () => {
    const room = await colyseus.createRoom("tower", {});
    const clientA = await colyseus.connectTo(room, { wallet: WALLET_A });
    const clientB = await colyseus.connectTo(room, { wallet: WALLET_B });
    await nextTick();

    // A claims a block — drain the claim broadcast from clientB first
    const claimBroadcast = clientB.waitForMessage("block_update");
    const claimed = clientA.waitForMessage("claim_result");
    clientA.send("claim", { blockId: BOT_BLOCK_ID, wallet: WALLET_A, color: "#ff6600", amount: 1 });
    await claimed;
    await claimBroadcast; // drain claim broadcast

    // A customizes — set up listeners BEFORE sending
    const customizeResult = clientA.waitForMessage("customize_result");
    const broadcastPromise = clientB.waitForMessage("block_update");

    clientA.send("customize", {
      blockId: BOT_BLOCK_ID,
      wallet: WALLET_A,
      changes: {
        color: "#00ff00",
        emoji: "🎨",
        name: "MyBlock",
        style: 3,
        textureId: 2,
      },
    });

    const [custResult, blockUpdate] = await Promise.all([customizeResult, broadcastPromise]);

    expect(custResult.success).toBe(true);
    expect(custResult.pointsEarned).toBeGreaterThanOrEqual(10);

    expect(blockUpdate.eventType).toBe("customize");
    expect(blockUpdate.appearance.color).toBe("#00ff00");
    expect(blockUpdate.appearance.emoji).toBe("🎨");
    expect(blockUpdate.appearance.name).toBe("MyBlock");
    expect(blockUpdate.appearance.style).toBe(3);
    expect(blockUpdate.appearance.textureId).toBe(2);
    expect(blockUpdate.ownerColor).toBe("#00ff00");
  }, 10_000);

  // ── Test 8: Customize another player's block → error ───────────────────
  it("cannot customize a block owned by another player", async () => {
    const room = await colyseus.createRoom("tower", {});
    const clientA = await colyseus.connectTo(room, { wallet: WALLET_A });
    const clientB = await colyseus.connectTo(room, { wallet: WALLET_B });
    await nextTick();

    // A claims
    const claimed = clientA.waitForMessage("claim_result");
    clientA.send("claim", { blockId: BOT_BLOCK_ID, wallet: WALLET_A, color: "#ff6600", amount: 1 });
    await claimed;

    // B tries to customize A's block
    const errorMsg = clientB.waitForMessage("error");
    clientB.send("customize", {
      blockId: BOT_BLOCK_ID,
      wallet: WALLET_B,
      changes: { color: "#0000ff" },
    });
    const err = await errorMsg;

    expect(err.message).toMatch(/not your block/i);
  }, 10_000);

  // ── Test 9: Set username ────────────────────────────────────────────────
  it("set_username validates and returns success", async () => {
    const room = await colyseus.createRoom("tower", {});
    const client = await colyseus.connectTo(room, { wallet: WALLET_A });
    await nextTick();

    const result = client.waitForMessage("username_result");
    client.send("set_username", { wallet: WALLET_A, username: "TestPlayer" });
    const msg = await result;

    expect(msg.success).toBe(true);
    expect(msg.username).toBe("TestPlayer");
  }, 10_000);

  it("set_username rejects too-short username", async () => {
    const room = await colyseus.createRoom("tower", {});
    const client = await colyseus.connectTo(room, { wallet: WALLET_A });
    await nextTick();

    const errorMsg = client.waitForMessage("error");
    client.send("set_username", { wallet: WALLET_A, username: "ab" });
    const err = await errorMsg;

    expect(err.message).toMatch(/3-20 characters/i);
  }, 10_000);

  it("set_username rejects invalid characters", async () => {
    const room = await colyseus.createRoom("tower", {});
    const client = await colyseus.connectTo(room, { wallet: WALLET_A });
    await nextTick();

    const errorMsg = client.waitForMessage("error");
    client.send("set_username", { wallet: WALLET_A, username: "test player!" });
    const err = await errorMsg;

    expect(err.message).toMatch(/letters, numbers, and underscores/i);
  }, 10_000);

  it("set_username rejects duplicate username (in-memory check)", async () => {
    const room = await colyseus.createRoom("tower", {});
    const clientA = await colyseus.connectTo(room, { wallet: WALLET_A });
    const clientB = await colyseus.connectTo(room, { wallet: WALLET_B });
    await nextTick();

    // A sets username
    const resultA = clientA.waitForMessage("username_result");
    clientA.send("set_username", { wallet: WALLET_A, username: "UniqueOne" });
    await resultA;

    // B tries same username (case-insensitive)
    const errorMsg = clientB.waitForMessage("error");
    clientB.send("set_username", { wallet: WALLET_B, username: "uniqueone" });
    const err = await errorMsg;

    expect(err.message).toMatch(/already taken/i);
  }, 10_000);

  it("player_sync includes username after set_username", async () => {
    const room = await colyseus.createRoom("tower", {});
    const client = await colyseus.connectTo(room, { wallet: WALLET_A });
    await nextTick();

    // Set username
    const usernameResult = client.waitForMessage("username_result");
    client.send("set_username", { wallet: WALLET_A, username: "MyName" });
    await usernameResult;

    // Reconnect — player_sync should include username
    const client2 = await colyseus.connectTo(room, { wallet: WALLET_A });
    const sync = await client2.waitForMessage("player_sync");

    expect(sync.username).toBe("MyName");
  }, 10_000);

  // ── Test 14: Poke another player's block → success ────────────────────
  it("poke adds energy to target block and awards XP to poker", async () => {
    const room = await colyseus.createRoom("tower", {});
    const clientA = await colyseus.connectTo(room, { wallet: WALLET_A });
    const clientB = await colyseus.connectTo(room, { wallet: WALLET_B });
    await nextTick();

    // A claims a block
    const claimBroadcast = clientB.waitForMessage("block_update");
    const claimed = clientA.waitForMessage("claim_result");
    clientA.send("claim", { blockId: BOT_BLOCK_ID, wallet: WALLET_A, color: "#ff6600", amount: 1 });
    await claimed;
    await claimBroadcast;

    // B pokes A's block
    const pokeResult = clientB.waitForMessage("poke_result");
    clientB.send("poke", { blockId: BOT_BLOCK_ID, wallet: WALLET_B });
    const result = await pokeResult;

    expect(result.success).toBe(true);
    expect(result.energyAdded).toBe(10); // 10% of MAX_ENERGY(100)
    expect(result.pointsEarned).toBe(15);
  }, 10_000);

  // ── Test 15: Cannot poke own block ────────────────────────────────────
  it("cannot poke own block", async () => {
    const room = await colyseus.createRoom("tower", {});
    const client = await colyseus.connectTo(room, { wallet: WALLET_A });
    await nextTick();

    // Claim a block
    const claimed = client.waitForMessage("claim_result");
    client.send("claim", { blockId: BOT_BLOCK_ID, wallet: WALLET_A, color: "#ff6600", amount: 1 });
    await claimed;

    // Try to poke own block
    const errorMsg = client.waitForMessage("error");
    client.send("poke", { blockId: BOT_BLOCK_ID, wallet: WALLET_A });
    const err = await errorMsg;

    expect(err.message).toMatch(/can't poke your own/i);
  }, 10_000);

  // ── Test 16: Can poke bot blocks ──────────────────────────────────────
  it("can poke bot-owned blocks", async () => {
    const room = await colyseus.createRoom("tower", {});
    const client = await colyseus.connectTo(room, { wallet: WALLET_A });
    await nextTick();

    // Poke a bot block (BOT_BLOCK_ID_2 is bot-owned)
    const pokeResult = client.waitForMessage("poke_result");
    client.send("poke", { blockId: BOT_BLOCK_ID_2, wallet: WALLET_A });
    const result = await pokeResult;

    expect(result.success).toBe(true);
    expect(result.energyAdded).toBe(10);
  }, 10_000);

  // ── Test 17: Poke cooldown enforced ───────────────────────────────────
  it("second poke to same block is rejected (24h cooldown)", async () => {
    const room = await colyseus.createRoom("tower", {});
    const client = await colyseus.connectTo(room, { wallet: WALLET_A });
    await nextTick();

    // Use BOT_BLOCK_ID_2 (known to work from test 16)
    const firstPoke = client.waitForMessage("poke_result");
    client.send("poke", { blockId: BOT_BLOCK_ID_2, wallet: WALLET_A });
    await firstPoke;
    await nextTick();

    // Second poke to same block — should fail due to cooldown
    const errorMsg = client.waitForMessage("error");
    client.send("poke", { blockId: BOT_BLOCK_ID_2, wallet: WALLET_A });
    const err = await errorMsg;

    expect(err.message).toMatch(/already poked/i);
  }, 10_000);

  // ── Test 18: Bot simulation ticks ─────────────────────────────────────────
  it("bot simulation changes block energy over time", async () => {
    const room = await colyseus.createRoom("tower", {});
    await colyseus.connectTo(room, {});

    // Yield so onCreate's async loadPlayerBlocks completes before we read state
    await nextTick();
    await nextTick();

    // Record initial energies of bot-owned blocks
    const initialEnergies = new Map<string, number>();
    room.state.blocks.forEach((block: any, id: string) => {
      if (block.owner && block.owner !== "") {
        initialEnergies.set(id, block.energy);
      }
    });

    expect(initialEnergies.size).toBeGreaterThan(100);

    // Advance through 20 bot ticks (15s each = 300s total)
    // ~11% combined chance per bot per tick → many will change over 20 ticks
    jest.advanceTimersByTime(15_000 * 20);

    let changed = 0;
    room.state.blocks.forEach((block: any, id: string) => {
      if (initialEnergies.has(id) && block.energy !== initialEnergies.get(id)) {
        changed++;
      }
    });

    expect(changed).toBeGreaterThan(10);
  }, 15_000);
});
