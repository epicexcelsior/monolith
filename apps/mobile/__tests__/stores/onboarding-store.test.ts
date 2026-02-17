/**
 * Tests for the onboarding Zustand store.
 *
 * Validates phase transitions, ghost block tracking, skip/complete,
 * and persistence logic. Uses getState()/setState() for deterministic
 * testing without React rendering.
 */

// Mock expo-secure-store before importing the store
const mockSecureStore: Record<string, string> = {};
jest.mock("expo-secure-store", () => ({
    getItemAsync: jest.fn(async (key: string) => mockSecureStore[key] ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
        mockSecureStore[key] = value;
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
        delete mockSecureStore[key];
    }),
}));
jest.mock("@/services/mwa", () => ({
    SECURE_STORE_KEYS: {
        AUTH_TOKEN: "mwa_auth_token",
        BASE64_ADDRESS: "mwa_base64_address",
        WALLET_URI_BASE: "mwa_wallet_uri_base",
        HAS_COMPLETED_ONBOARDING: "monolith_onboarding_complete",
    },
}));

import { useOnboardingStore } from "@/stores/onboarding-store";

// Reset store and mock storage between tests
beforeEach(() => {
    Object.keys(mockSecureStore).forEach((k) => delete mockSecureStore[k]);
    useOnboardingStore.setState({
        phase: "title",
        ghostBlockId: null,
        initialized: false,
    });
});

describe("onboarding-store", () => {
    describe("initial state", () => {
        it("should start in title phase", () => {
            const state = useOnboardingStore.getState();
            expect(state.phase).toBe("title");
            expect(state.ghostBlockId).toBeNull();
            expect(state.initialized).toBe(false);
        });

        it("isOnboarding should return true when not done", () => {
            expect(useOnboardingStore.getState().isOnboarding()).toBe(true);
        });
    });

    describe("init", () => {
        it("should start at title phase on fresh launch", async () => {
            await useOnboardingStore.getState().init();
            const state = useOnboardingStore.getState();
            expect(state.phase).toBe("title");
            expect(state.initialized).toBe(true);
        });

        it("should skip to done if onboarding flag is set", async () => {
            mockSecureStore["monolith_onboarding_complete"] = "true";
            await useOnboardingStore.getState().init();
            const state = useOnboardingStore.getState();
            expect(state.phase).toBe("done");
            expect(state.initialized).toBe(true);
            expect(state.isOnboarding()).toBe(false);
        });
    });

    describe("advancePhase", () => {
        it("should transition title → claim → charge → complete → done", () => {
            const { advancePhase } = useOnboardingStore.getState();

            expect(useOnboardingStore.getState().phase).toBe("title");

            advancePhase();
            expect(useOnboardingStore.getState().phase).toBe("claim");

            advancePhase();
            expect(useOnboardingStore.getState().phase).toBe("charge");

            advancePhase();
            expect(useOnboardingStore.getState().phase).toBe("complete");

            advancePhase();
            expect(useOnboardingStore.getState().phase).toBe("done");
        });

        it("should not advance past done", () => {
            useOnboardingStore.setState({ phase: "done" });
            useOnboardingStore.getState().advancePhase();
            expect(useOnboardingStore.getState().phase).toBe("done");
        });

        it("should persist flag when reaching done", () => {
            useOnboardingStore.setState({ phase: "complete" });
            useOnboardingStore.getState().advancePhase();
            expect(useOnboardingStore.getState().phase).toBe("done");
            // SecureStore.setItemAsync is called asynchronously
            expect(require("expo-secure-store").setItemAsync).toHaveBeenCalledWith(
                "monolith_onboarding_complete",
                "true",
            );
        });
    });

    describe("setGhostBlock", () => {
        it("should store the ghost block ID", () => {
            useOnboardingStore.getState().setGhostBlock("block-5-3");
            expect(useOnboardingStore.getState().ghostBlockId).toBe("block-5-3");
        });
    });

    describe("skipOnboarding", () => {
        it("should jump to done and clear ghost block", () => {
            useOnboardingStore.setState({
                phase: "claim",
                ghostBlockId: "block-2-1",
            });

            useOnboardingStore.getState().skipOnboarding();
            const state = useOnboardingStore.getState();
            expect(state.phase).toBe("done");
            expect(state.ghostBlockId).toBeNull();
            expect(state.isOnboarding()).toBe(false);
        });

        it("should persist the onboarding-done flag", () => {
            useOnboardingStore.getState().skipOnboarding();
            expect(require("expo-secure-store").setItemAsync).toHaveBeenCalledWith(
                "monolith_onboarding_complete",
                "true",
            );
        });
    });

    describe("completeOnboarding", () => {
        it("should jump to done and clear ghost block", () => {
            useOnboardingStore.setState({
                phase: "complete",
                ghostBlockId: "block-8-0",
            });

            useOnboardingStore.getState().completeOnboarding();
            const state = useOnboardingStore.getState();
            expect(state.phase).toBe("done");
            expect(state.ghostBlockId).toBeNull();
        });
    });

    describe("resetOnboarding", () => {
        it("should reset phase to title and clear persisted flag", async () => {
            mockSecureStore["monolith_onboarding_complete"] = "true";
            useOnboardingStore.setState({ phase: "done" });

            await useOnboardingStore.getState().resetOnboarding();
            const state = useOnboardingStore.getState();
            expect(state.phase).toBe("title");
            expect(state.ghostBlockId).toBeNull();
            expect(state.initialized).toBe(true);
            expect(require("expo-secure-store").deleteItemAsync).toHaveBeenCalledWith(
                "monolith_onboarding_complete",
            );
        });
    });

    describe("isOnboarding", () => {
        it("should return true for all phases except done", () => {
            const phases = ["title", "claim", "charge", "complete"] as const;
            for (const p of phases) {
                useOnboardingStore.setState({ phase: p });
                expect(useOnboardingStore.getState().isOnboarding()).toBe(true);
            }
        });

        it("should return false when done", () => {
            useOnboardingStore.setState({ phase: "done" });
            expect(useOnboardingStore.getState().isOnboarding()).toBe(false);
        });
    });
});
