/**
 * Tests for ghost block actions in the tower store.
 *
 * Validates ghostClaimBlock, ghostChargeBlock, ghostDecayBlock, and
 * clearGhostBlock — the session-only simulated actions used during
 * the interactive onboarding tutorial.
 */

// Mock dependencies
jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "/mock/",
    getInfoAsync: jest.fn(async () => ({ exists: false })),
    readAsStringAsync: jest.fn(async () => ""),
    writeAsStringAsync: jest.fn(async () => { }),
}));
jest.mock("expo-secure-store", () => ({
    getItemAsync: jest.fn(async () => null),
    setItemAsync: jest.fn(async () => { }),
    deleteItemAsync: jest.fn(async () => { }),
}));
jest.mock("@/utils/seed-tower", () => ({
    generateSeedTower: jest.fn(() => []),
    startBotSimulation: jest.fn(() => () => { }),
    isBotOwner: jest.fn(() => false),
    getBotConfig: jest.fn(() => ({ simulation: { enabled: false } })),
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
import type { DemoBlock } from "@/stores/tower-store";

// Helper: create a minimal demo block
function makeBlock(overrides: Partial<DemoBlock> = {}): DemoBlock {
    return {
        id: "block-5-3",
        layer: 5,
        index: 3,
        energy: 0,
        ownerColor: "#999999",
        owner: null,
        stakedAmount: 0,
        position: { x: 0, y: 0, z: 0 },
        ...overrides,
    };
}

// Reset store between tests
beforeEach(() => {
    useTowerStore.setState({
        demoBlocks: [
            makeBlock({ id: "block-5-3" }),
            makeBlock({ id: "block-8-1", layer: 8, index: 1 }),
            makeBlock({
                id: "block-2-0",
                layer: 2,
                index: 0,
                owner: "real-owner",
                energy: 80,
            }),
        ],
        recentlyClaimedId: null,
        onboardingDone: false,
        initialized: true,
    });
});

describe("tower-store ghost block actions", () => {
    describe("ghostClaimBlock", () => {
        it("should claim a block with __ghost__ owner and 70% energy", () => {
            useTowerStore.getState().ghostClaimBlock("block-5-3");

            const block = useTowerStore
                .getState()
                .demoBlocks.find((b) => b.id === "block-5-3");
            expect(block).toBeDefined();
            expect(block!.owner).toBe("__ghost__");
            expect(block!.energy).toBe(70); // matches GHOST_CHARGE_CAP (was 60)
            expect(block!.ownerColor).toBe("#FFB800");
            expect(block!.stakedAmount).toBe(1.0);
            expect(block!.streak).toBe(1);
        });

        it("should set recentlyClaimedId", () => {
            useTowerStore.getState().ghostClaimBlock("block-8-1");
            expect(useTowerStore.getState().recentlyClaimedId).toBe("block-8-1");
        });

        it("should not affect other blocks", () => {
            useTowerStore.getState().ghostClaimBlock("block-5-3");

            const other = useTowerStore
                .getState()
                .demoBlocks.find((b) => b.id === "block-2-0");
            expect(other!.owner).toBe("real-owner");
            expect(other!.energy).toBe(80);
        });
    });

    describe("ghostChargeBlock", () => {
        it("should increase energy by 25", () => {
            // Set up a ghost block (starts at 70% energy)
            useTowerStore.getState().ghostClaimBlock("block-5-3");

            const result = useTowerStore.getState().ghostChargeBlock("block-5-3");
            expect(result.success).toBe(true);
            expect(result.chargeAmount).toBe(25);

            const block = useTowerStore
                .getState()
                .demoBlocks.find((b) => b.id === "block-5-3");
            expect(block!.energy).toBe(95); // 70 + 25
        });

        it("should not exceed max energy", () => {
            useTowerStore.getState().ghostClaimBlock("block-5-3");
            // Charge twice: 60 + 25 = 85, then 85 + 25 = 100 (capped)
            useTowerStore.getState().ghostChargeBlock("block-5-3");
            useTowerStore.getState().ghostChargeBlock("block-5-3");

            const block = useTowerStore
                .getState()
                .demoBlocks.find((b) => b.id === "block-5-3");
            expect(block!.energy).toBe(100);
        });

        it("should return success: false for nonexistent block", () => {
            const result = useTowerStore
                .getState()
                .ghostChargeBlock("block-nonexistent");
            expect(result.success).toBe(false);
        });
    });

    describe("ghostDecayBlock", () => {
        it("should reduce energy by specified amount", () => {
            useTowerStore.getState().ghostClaimBlock("block-5-3");
            useTowerStore.getState().ghostDecayBlock("block-5-3", 30);

            const block = useTowerStore
                .getState()
                .demoBlocks.find((b) => b.id === "block-5-3");
            expect(block!.energy).toBe(40); // 70 - 30
        });

        it("should default to 50 decay", () => {
            useTowerStore.getState().ghostClaimBlock("block-5-3");
            useTowerStore.getState().ghostDecayBlock("block-5-3");

            const block = useTowerStore
                .getState()
                .demoBlocks.find((b) => b.id === "block-5-3");
            expect(block!.energy).toBe(20); // 70 - 50
        });

        it("should not go below 0", () => {
            useTowerStore.getState().ghostClaimBlock("block-5-3");
            useTowerStore.getState().ghostDecayBlock("block-5-3", 150);

            const block = useTowerStore
                .getState()
                .demoBlocks.find((b) => b.id === "block-5-3");
            expect(block!.energy).toBe(0);
        });
    });

    describe("clearGhostBlock", () => {
        it("should reset ghost-claimed blocks to unclaimed", () => {
            useTowerStore.getState().ghostClaimBlock("block-5-3");
            useTowerStore.getState().clearGhostBlock();

            const block = useTowerStore
                .getState()
                .demoBlocks.find((b) => b.id === "block-5-3");
            expect(block!.owner).toBeNull();
            expect(block!.energy).toBe(0);
            expect(block!.stakedAmount).toBe(0);
            expect(block!.streak).toBe(0);
        });

        it("should clear recentlyClaimedId", () => {
            useTowerStore.getState().ghostClaimBlock("block-5-3");
            expect(useTowerStore.getState().recentlyClaimedId).toBe("block-5-3");

            useTowerStore.getState().clearGhostBlock();
            expect(useTowerStore.getState().recentlyClaimedId).toBeNull();
        });

        it("should not affect non-ghost blocks", () => {
            useTowerStore.getState().ghostClaimBlock("block-5-3");
            useTowerStore.getState().clearGhostBlock();

            const realBlock = useTowerStore
                .getState()
                .demoBlocks.find((b) => b.id === "block-2-0");
            expect(realBlock!.owner).toBe("real-owner");
            expect(realBlock!.energy).toBe(80);
        });
    });
});
