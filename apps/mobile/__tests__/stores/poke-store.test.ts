import { usePokeStore } from "../../stores/poke-store";

describe("poke-store", () => {
  beforeEach(() => {
    usePokeStore.setState({ cooldowns: {} });
  });

  it("canPoke returns true for a block with no cooldown", () => {
    expect(usePokeStore.getState().canPoke("block-1-0")).toBe(true);
  });

  it("canPoke returns false after recordPoke", () => {
    usePokeStore.getState().recordPoke("block-1-0");
    expect(usePokeStore.getState().canPoke("block-1-0")).toBe(false);
  });

  it("getCooldownRemaining returns 0 for unpoked block", () => {
    expect(usePokeStore.getState().getCooldownRemaining("block-1-0")).toBe(0);
  });

  it("getCooldownRemaining returns positive value after poke", () => {
    usePokeStore.getState().recordPoke("block-1-0");
    const remaining = usePokeStore.getState().getCooldownRemaining("block-1-0");
    expect(remaining).toBeGreaterThan(0);
    // Should be close to 24 hours
    expect(remaining).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it("different blocks have independent cooldowns", () => {
    usePokeStore.getState().recordPoke("block-1-0");
    expect(usePokeStore.getState().canPoke("block-1-0")).toBe(false);
    expect(usePokeStore.getState().canPoke("block-2-0")).toBe(true);
  });
});
