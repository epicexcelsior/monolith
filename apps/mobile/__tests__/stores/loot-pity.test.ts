/**
 * Tests for the loot pity system.
 */
import { rollLoot, PITY, LOOT_TABLE } from "@/constants/loot-table";

describe("loot pity system", () => {
  it("forces epic when chargesSinceEpic >= EPIC_GUARANTEE", () => {
    const item = rollLoot(0, PITY.EPIC_GUARANTEE, 0);
    expect(item).not.toBeNull();
    expect(item!.rarity === "epic" || item!.rarity === "legendary").toBe(true);
  });

  it("forces legendary when chargesSinceLegendary >= LEGENDARY_GUARANTEE", () => {
    const item = rollLoot(0, 0, PITY.LEGENDARY_GUARANTEE);
    expect(item).not.toBeNull();
    expect(item!.rarity).toBe("legendary");
  });

  it("legendary pity takes priority over epic pity", () => {
    const item = rollLoot(0, PITY.EPIC_GUARANTEE, PITY.LEGENDARY_GUARANTEE);
    expect(item).not.toBeNull();
    expect(item!.rarity).toBe("legendary");
  });

  it("normal roll still works without pity counters", () => {
    // Run 100 rolls to ensure no crashes
    for (let i = 0; i < 100; i++) {
      rollLoot(5, 0, 0);
    }
  });

  it("PITY constants are reasonable", () => {
    expect(PITY.EPIC_GUARANTEE).toBe(30);
    expect(PITY.LEGENDARY_GUARANTEE).toBe(100);
  });

  it("LOOT_TABLE has items of each rarity for pity to use", () => {
    expect(LOOT_TABLE.filter(i => i.rarity === "epic").length).toBeGreaterThan(0);
    expect(LOOT_TABLE.filter(i => i.rarity === "legendary").length).toBeGreaterThan(0);
  });
});
