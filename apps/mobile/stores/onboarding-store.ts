import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { SECURE_STORE_KEYS } from "@/services/mwa";

// ─── Types ────────────────────────────────────────────────

/**
 * Onboarding phases — trimmed from 10 to 7 for faster time-to-value:
 *
 *   intro       → Cinematic orbit + camera tutorial overlay + "GET STARTED" CTA (~15s)
 *   claim       → Dedicated CLAIM THIS BLOCK button (no BlockInspector)
 *   celebration → VFX plays out, no UI — pure spectacle
 *   customize   → Spark naming + color + emoji picker
 *   charge      → Charge tutorial — teach the daily loop
 *   wallet      → Wallet connect card (dismissible)
 *   done        → Onboarding finished, never shown again
 *
 * Removed: cameraTutorial (merged into intro), title (merged into intro), poke (moved to post-onboarding contextual prompt)
 */
export type OnboardingPhase =
    | "intro"
    | "claim"
    | "celebration"
    | "customize"
    | "charge"
    | "wallet"
    | "done";

const PHASE_ORDER: OnboardingPhase[] = [
    "intro",
    "claim",
    "celebration",
    "customize",
    "charge",
    "wallet",
    "done",
];

const ONBOARDING_KEY = SECURE_STORE_KEYS.HAS_COMPLETED_ONBOARDING;

// ─── Random Spark names ────────────────────────────────────
const SPARK_NAMES = [
    "Luna", "Blaze", "Pixel", "Nova", "Ember", "Cosmo",
    "Nimbus", "Flick", "Spark", "Glo", "Puff", "Zest",
    "Mochi", "Zippy", "Wisp", "Dusk",
];

export function getRandomSparkName(): string {
    return SPARK_NAMES[Math.floor(Math.random() * SPARK_NAMES.length)];
}

// ─── Store ────────────────────────────────────────────────

interface OnboardingStore {
    // State
    phase: OnboardingPhase;
    ghostBlockId: string | null;
    ghostMode: boolean;
    initialized: boolean;
    sparkName: string | null;

    // Derived
    isOnboarding: () => boolean;

    // Actions
    init: () => Promise<void>;
    advancePhase: () => void;
    skipToPhase: (phase: OnboardingPhase) => void;
    setGhostBlock: (blockId: string) => void;
    setGhostMode: (val: boolean) => void;
    setSparkName: (name: string) => void;
    skipOnboarding: () => void;
    completeOnboarding: () => void;
    resetOnboarding: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
    phase: "intro",
    ghostBlockId: null,
    ghostMode: false,
    initialized: false,
    sparkName: null,

    isOnboarding: () => get().phase !== "done",

    init: async () => {
        try {
            const val = await SecureStore.getItemAsync(ONBOARDING_KEY);
            if (val === "true") {
                set({ phase: "done", initialized: true });
            } else {
                set({ phase: "intro", initialized: true });
            }
        } catch {
            set({ phase: "intro", initialized: true });
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

    setSparkName: (name) => set({ sparkName: name }),

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
        set({ phase: "intro", ghostBlockId: null, ghostMode: false, sparkName: null, initialized: true });
    },
}));
