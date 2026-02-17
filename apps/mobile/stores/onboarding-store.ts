import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

// ─── Types ────────────────────────────────────────────────

/**
 * Onboarding phases — each maps to an interactive step:
 *
 *   title   → Stylish "THE MONOLITH" title reveal, camera flies to dormant block
 *   claim   → User taps highlighted block, ghost-claims it (celebration!)
 *   charge  → Block decays, user taps to charge (learns retention loop)
 *   complete → "Ready to play for real?" CTA card
 *   done    → Onboarding finished, never shown again
 */
export type OnboardingPhase =
    | "title"
    | "claim"
    | "charge"
    | "complete"
    | "done";

const PHASE_ORDER: OnboardingPhase[] = [
    "title",
    "claim",
    "charge",
    "complete",
    "done",
];

const ONBOARDING_KEY = "monolith_onboarding_done";

// ─── Store ────────────────────────────────────────────────

interface OnboardingStore {
    // State
    phase: OnboardingPhase;
    ghostBlockId: string | null;
    initialized: boolean;

    // Derived
    isOnboarding: () => boolean;

    // Actions
    init: () => Promise<void>;
    advancePhase: () => void;
    setGhostBlock: (blockId: string) => void;
    skipOnboarding: () => void;
    completeOnboarding: () => void;
    resetOnboarding: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
    phase: "title",
    ghostBlockId: null,
    initialized: false,

    isOnboarding: () => get().phase !== "done",

    init: async () => {
        try {
            const val = await SecureStore.getItemAsync(ONBOARDING_KEY);
            if (val === "true") {
                set({ phase: "done", initialized: true });
            } else {
                set({ phase: "title", initialized: true });
            }
        } catch {
            set({ phase: "title", initialized: true });
        }
    },

    advancePhase: () => {
        const { phase } = get();
        const currentIndex = PHASE_ORDER.indexOf(phase);
        if (currentIndex < 0 || currentIndex >= PHASE_ORDER.length - 1) return;
        const nextPhase = PHASE_ORDER[currentIndex + 1];
        set({ phase: nextPhase });

        // Persist when reaching "done"
        if (nextPhase === "done") {
            SecureStore.setItemAsync(ONBOARDING_KEY, "true").catch(() => { });
        }
    },

    setGhostBlock: (blockId) => set({ ghostBlockId: blockId }),

    skipOnboarding: () => {
        set({ phase: "done", ghostBlockId: null });
        SecureStore.setItemAsync(ONBOARDING_KEY, "true").catch(() => { });
    },

    completeOnboarding: () => {
        set({ phase: "done", ghostBlockId: null });
        SecureStore.setItemAsync(ONBOARDING_KEY, "true").catch(() => { });
    },

    resetOnboarding: async () => {
        try {
            await SecureStore.deleteItemAsync(ONBOARDING_KEY);
        } catch { }
        set({ phase: "title", ghostBlockId: null, initialized: true });
    },
}));
