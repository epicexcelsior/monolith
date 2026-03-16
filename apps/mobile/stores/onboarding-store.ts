import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { SECURE_STORE_KEYS } from "@/services/mwa";

// ─── Types ────────────────────────────────────────────────

/**
 * Onboarding phases — the full immersive first-60-seconds flow:
 *
 *   cinematic   → Camera fly-around showing the tower (5-8s, no UI)
 *   title       → "MONOLITH" overlay with GET STARTED CTA
 *   claim       → Dedicated CLAIM THIS BLOCK button (no BlockInspector)
 *   celebration → VFX plays out, no UI — pure spectacle
 *   customize   → Color + emoji picker
 *   charge      → Charge tutorial — teach the daily loop
 *   poke        → Optional poke prompt (dismissible)
 *   wallet      → Wallet connect card (dismissible)
 *   done        → Onboarding finished, never shown again
 */
export type OnboardingPhase =
    | "cinematic"
    | "cameraTutorial"
    | "title"
    | "claim"
    | "celebration"
    | "customize"
    | "charge"
    | "poke"
    | "wallet"
    | "done";

const PHASE_ORDER: OnboardingPhase[] = [
    "cinematic",
    "cameraTutorial",
    "title",
    "claim",
    "celebration",
    "customize",
    "charge",
    "poke",
    "wallet",
    "done",
];

const ONBOARDING_KEY = SECURE_STORE_KEYS.HAS_COMPLETED_ONBOARDING;

// ─── Store ────────────────────────────────────────────────

interface OnboardingStore {
    // State
    phase: OnboardingPhase;
    ghostBlockId: string | null;
    ghostMode: boolean;
    initialized: boolean;

    // Derived
    isOnboarding: () => boolean;

    // Actions
    init: () => Promise<void>;
    advancePhase: () => void;
    skipToPhase: (phase: OnboardingPhase) => void;
    setGhostBlock: (blockId: string) => void;
    setGhostMode: (val: boolean) => void;
    skipOnboarding: () => void;
    completeOnboarding: () => void;
    resetOnboarding: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
    phase: "cinematic",
    ghostBlockId: null,
    ghostMode: false,
    initialized: false,

    isOnboarding: () => get().phase !== "done",

    init: async () => {
        try {
            const val = await SecureStore.getItemAsync(ONBOARDING_KEY);
            if (val === "true") {
                set({ phase: "done", initialized: true });
            } else {
                set({ phase: "cinematic", initialized: true });
            }
        } catch {
            set({ phase: "cinematic", initialized: true });
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

    skipToPhase: (phase) => {
        set({ phase });
        // Persist if skipping straight to done
        if (phase === "done") {
            SecureStore.setItemAsync(ONBOARDING_KEY, "true").catch(() => { });
        }
    },

    setGhostBlock: (blockId) => set({ ghostBlockId: blockId }),

    setGhostMode: (val) => set({ ghostMode: val }),

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
        set({ phase: "cinematic", ghostBlockId: null, ghostMode: false, initialized: true });
    },
}));
