/**
 * Integration test for the onboarding system.
 *
 * Validates the full flow end-to-end at the store level:
 * init → pick block → ghost claim → decay → charge → complete/skip → reset
 * Ensures unified persistence key is used consistently.
 */

// Mock dependencies
jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "/mock/",
    getInfoAsync: jest.fn(async () => ({ exists: false })),
    readAsStringAsync: jest.fn(async () => ""),
    writeAsStringAsync: jest.fn(async () => { }),
}));

const mockSecureStore: Record<string, string> = {};
jest.mock("expo-secure-store", () => ({
    getItemAsync: jest.fn(async (key: string) => mockSecureStore[key] ?? null),
    setItemAsync: jest.fn(async (key: string, val: string) => {
        mockSecureStore[key] = val;
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
        delete mockSecureStore[key];
    }),
}));

jest.mock("@/utils/seed-tower", () => ({
    generateSeedTower: jest.fn(() => [
        {
            id: "block-5-0",
            layer: 5,
            index: 0,
            energy: 0,
            ownerColor: "#999999",
            owner: null,
            stakedAmount: 0,
            position: { x: 0, y: 5, z: 0 },
        },
        {
            id: "block-8-1",
            layer: 8,
            index: 1,
            energy: 80,
            ownerColor: "#FF0000",
            owner: "bot-alice",
            stakedAmount: 5,
            position: { x: 1, y: 8, z: 0 },
        },
    ]),
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
import { useOnboardingStore } from "@/stores/onboarding-store";

const UNIFIED_KEY = "monolith_onboarding_complete";

beforeEach(() => {
    // Clear mock secure store
    Object.keys(mockSecureStore).forEach((k) => delete mockSecureStore[k]);

    // Reset stores
    useTowerStore.setState({
        demoBlocks: [],
        recentlyClaimedId: null,
        onboardingDone: false,
        initialized: false,
    });

    useOnboardingStore.setState({
        phase: "intro",
        ghostBlockId: null,
        initialized: false,
    });
});

describe("onboarding integration", () => {
    it("should init both stores — onboarding starts in intro phase", async () => {
        await useTowerStore.getState().initTower();
        await useOnboardingStore.getState().init();

        expect(useTowerStore.getState().initialized).toBe(true);
        expect(useTowerStore.getState().onboardingDone).toBe(false);
        expect(useOnboardingStore.getState().phase).toBe("intro");
        expect(useTowerStore.getState().demoBlocks.length).toBeGreaterThan(0);
    });

    it("should pick an unclaimed tutorial block", async () => {
        await useTowerStore.getState().initTower();

        const demoBlocks = useTowerStore.getState().demoBlocks;
        const unclaimed = demoBlocks.filter((b) => b.owner === null);
        expect(unclaimed.length).toBeGreaterThan(0);

        // Simulate picking (same logic as OnboardingFlow)
        const blockId = unclaimed[0].id;
        useOnboardingStore.getState().setGhostBlock(blockId);
        expect(useOnboardingStore.getState().ghostBlockId).toBe(blockId);
    });

    it("should ghost claim → verify block state", async () => {
        await useTowerStore.getState().initTower();
        const blockId = "block-5-0";

        useTowerStore.getState().ghostClaimBlock(blockId);

        const block = useTowerStore.getState().demoBlocks.find((b) => b.id === blockId);
        expect(block!.owner).toBe("__ghost__");
        expect(block!.energy).toBe(70); // starts at GHOST_CHARGE_CAP (was 60)
        expect(block!.ownerColor).toBe("#FFB800");
        expect(block!.stakedAmount).toBe(1);
        expect(block!.streak).toBe(1);
        expect(useTowerStore.getState().recentlyClaimedId).toBe(blockId);
    });

    it("should ghost decay → verify energy drop", async () => {
        await useTowerStore.getState().initTower();
        const blockId = "block-5-0";

        useTowerStore.getState().ghostClaimBlock(blockId);
        useTowerStore.getState().ghostDecayBlock(blockId, 30);

        const block = useTowerStore.getState().demoBlocks.find((b) => b.id === blockId);
        expect(block!.energy).toBe(40); // 70 - 30
    });

    it("should ghost charge → verify energy increase", async () => {
        await useTowerStore.getState().initTower();
        const blockId = "block-5-0";

        useTowerStore.getState().ghostClaimBlock(blockId);
        // starts at 60, charge adds 25
        const result = useTowerStore.getState().ghostChargeBlock(blockId);
        expect(result.success).toBe(true);
        expect(result.chargeAmount).toBe(25);

        const block = useTowerStore.getState().demoBlocks.find((b) => b.id === blockId);
        expect(block!.energy).toBe(95); // 70 + 25
    });

    it("should complete onboarding — both stores mark done", async () => {
        await useTowerStore.getState().initTower();
        await useOnboardingStore.getState().init();

        // Complete tower-store side
        useTowerStore.getState().completeOnboarding();
        expect(useTowerStore.getState().onboardingDone).toBe(true);

        // Complete onboarding-store side
        useOnboardingStore.getState().completeOnboarding();
        expect(useOnboardingStore.getState().phase).toBe("done");

        // Both should have written to the same key
        // Wait for async SecureStore writes
        await new Promise((r) => setTimeout(r, 10));
        expect(mockSecureStore[UNIFIED_KEY]).toBe("true");
    });

    it("should skip onboarding — both stores mark done", async () => {
        await useTowerStore.getState().initTower();
        await useOnboardingStore.getState().init();

        const blockId = "block-5-0";
        useTowerStore.getState().ghostClaimBlock(blockId);

        // Skip
        useTowerStore.getState().clearGhostBlock();
        useTowerStore.getState().completeOnboarding();
        useOnboardingStore.getState().skipOnboarding();

        // Ghost block should be cleared
        const block = useTowerStore.getState().demoBlocks.find((b) => b.id === blockId);
        expect(block!.owner).toBeNull();
        expect(useTowerStore.getState().recentlyClaimedId).toBeNull();

        // Both stores done
        expect(useTowerStore.getState().onboardingDone).toBe(true);
        expect(useOnboardingStore.getState().phase).toBe("done");
    });

    it("should reset — both stores reset cleanly", async () => {
        await useTowerStore.getState().initTower();
        await useOnboardingStore.getState().init();

        // Complete first
        useTowerStore.getState().completeOnboarding();
        useOnboardingStore.getState().completeOnboarding();
        await new Promise((r) => setTimeout(r, 10));

        expect(useTowerStore.getState().onboardingDone).toBe(true);
        expect(useOnboardingStore.getState().phase).toBe("done");
        expect(mockSecureStore[UNIFIED_KEY]).toBe("true");

        // Reset both
        await useTowerStore.getState().resetOnboardingFlag();
        await useOnboardingStore.getState().resetOnboarding();

        expect(useTowerStore.getState().onboardingDone).toBe(false);
        expect(useOnboardingStore.getState().phase).toBe("intro");
        expect(mockSecureStore[UNIFIED_KEY]).toBeUndefined();
    });

    it("should use unified persistence key consistently", async () => {
        // Simulate previous completion
        mockSecureStore[UNIFIED_KEY] = "true";

        await useTowerStore.getState().initTower();
        await useOnboardingStore.getState().init();

        // Both stores should detect completion from the same key
        expect(useTowerStore.getState().onboardingDone).toBe(true);
        expect(useOnboardingStore.getState().phase).toBe("done");
    });

    it("should NOT persist ghost block changes to file system", async () => {
        const FileSystem = require("expo-file-system/legacy");
        await useTowerStore.getState().initTower();

        // Clear the call count after init (which does persist)
        FileSystem.writeAsStringAsync.mockClear();

        // Ghost operations should NOT trigger persistence
        useTowerStore.getState().ghostClaimBlock("block-5-0");
        useTowerStore.getState().ghostDecayBlock("block-5-0", 30);
        useTowerStore.getState().ghostChargeBlock("block-5-0");
        useTowerStore.getState().clearGhostBlock();

        expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    });
});
