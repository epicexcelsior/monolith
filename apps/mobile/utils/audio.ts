/**
 * Audio system for The Monolith.
 * Mirrors haptics.ts pattern: fire-and-forget, fail-safe, platform-aware.
 *
 * Uses expo-audio for playback. All sounds are pre-loaded on init.
 * Every function catches errors silently — never blocks gameplay.
 *
 * IMPORTANT: expo-audio is loaded lazily so the app doesn't crash if
 * the native module isn't in the current dev build. Once you rebuild
 * with `npx expo run:android`, sounds will work automatically.
 *
 * NOTE: To enable sounds, add .wav files to assets/sfx/ and uncomment
 * the corresponding SFX_SOURCES entry below.
 *
 * @see /docs/game-design/SOUND_DESIGN.md
 */
import { Platform } from "react-native";

// ─── State ────────────────────────────────────────────────

let initialized = false;
let muted = false;
let audioAvailable = false;

// We store loaded players as opaque objects to avoid importing expo-audio types at top level
const players: Record<string, any> = {};

// Lazy reference to the Audio module — only loaded when initAudio() is called
let AudioModule: any = null;

// ─── Init ─────────────────────────────────────────────────

/**
 * Pre-load all sound effects. Call once on app start.
 * Gracefully handles missing native module or files — sounds just won't play.
 */
export async function initAudio(): Promise<void> {
    if (initialized) return;
    if (Platform.OS === "web") {
        initialized = true;
        return;
    }

    try {
        // Lazy import — won't crash if native module is missing
        const expoAudio = await import("expo-audio");
        AudioModule = expoAudio;

        await expoAudio.setAudioModeAsync({
            playsInSilentMode: true,
        });

        audioAvailable = true;

        // ─── Load SFX Sources ──────────────────────────────
        // Metro requires static require() — can't use dynamic paths.
        //
        // To add a sound:
        // 1. Place .wav file in apps/mobile/assets/sfx/
        // 2. Add a loadPlayer() call below
        // 3. Rebuild the app

        await loadPlayer("blockClaim", require("../assets/sfx/block-claim.wav"));
        await loadPlayer("chargeTap", require("../assets/sfx/charge-tap.wav"));
        await loadPlayer("blockSelect", require("../assets/sfx/block-select.wav"));
        await loadPlayer("blockDeselect", require("../assets/sfx/block-deselect.wav"));
        await loadPlayer("streakMilestone", require("../assets/sfx/streak-milestone.wav"));
        await loadPlayer("error", require("../assets/sfx/error.wav"));
        await loadPlayer("claimCelebration", require("../assets/sfx/claim-celebration.wav"));

        initialized = true;
    } catch {
        // expo-audio native module not available (dev build without it)
        // Audio just won't play — app continues normally
        initialized = true;
        audioAvailable = false;
    }
}

/** Create an AudioPlayer for a single sound file */
async function loadPlayer(key: string, source: any): Promise<void> {
    if (!AudioModule) return;
    try {
        const player = AudioModule.createAudioPlayer(source);
        player.volume = 0.7;
        players[key] = player;
    } catch {
        // Load error — no-op, this sound won't play
    }
}

// ─── Playback Helpers ─────────────────────────────────────

async function play(key: string): Promise<void> {
    if (muted || !audioAvailable || !players[key]) return;
    try {
        players[key].seekTo(0);
        players[key].play();
    } catch {
        // Playback error — no-op
    }
}

// ─── Public API ───────────────────────────────────────────

/** Epic celebration: rising shimmer + impact */
export function playBlockClaim() { play("blockClaim"); }

/** Satisfying electric zap */
export function playChargeTap() { play("chargeTap"); }

/** Soft glass click */
export function playBlockSelect() { play("blockSelect"); }

/** Softer release */
export function playBlockDeselect() { play("blockDeselect"); }

/** Ascending chime for streak milestones */
export function playStreakMilestone() { play("streakMilestone"); }

/** Muted buzz for errors */
export function playError() { play("error"); }

/** Epic multi-phase celebration sound */
export function playClaimCelebration() { play("claimCelebration"); }

// ─── Settings ─────────────────────────────────────────────

export function setMuted(value: boolean) { muted = value; }
export function isMuted() { return muted; }

// ─── Cleanup ──────────────────────────────────────────────

export async function unloadSounds(): Promise<void> {
    for (const player of Object.values(players)) {
        try { player.remove(); } catch { /* no-op */ }
    }
}
