/**
 * Audio system for The Monolith.
 * Mirrors haptics.ts pattern: fire-and-forget, fail-safe, platform-aware.
 *
 * Uses expo-av for playback. All sounds are pre-loaded on init.
 * Every function catches errors silently — never blocks gameplay.
 *
 * IMPORTANT: expo-av is loaded lazily so the app doesn't crash if
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

// We store loaded sounds as opaque objects to avoid importing expo-av types at top level
const sounds: Record<string, any> = {};

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
        const expoAv = await import("expo-av");
        AudioModule = expoAv.Audio;

        await AudioModule.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
        });

        audioAvailable = true;

        // ─── Load SFX Sources ──────────────────────────────
        // Uncomment entries as you add .wav files to assets/sfx/
        // Metro requires static require() — can't use dynamic paths.
        //
        // To add a sound:
        // 1. Place .wav file in apps/mobile/assets/sfx/
        // 2. Uncomment the corresponding loadSound() call below
        // 3. Rebuild the app

        await loadSound("blockClaim", require("../assets/sfx/block-claim.wav"));
        await loadSound("chargeTap", require("../assets/sfx/charge-tap.wav"));
        await loadSound("blockSelect", require("../assets/sfx/block-select.wav"));
        await loadSound("blockDeselect", require("../assets/sfx/block-deselect.wav"));
        await loadSound("streakMilestone", require("../assets/sfx/streak-milestone.wav"));
        await loadSound("error", require("../assets/sfx/error.wav"));

        initialized = true;
    } catch {
        // expo-av native module not available (dev build without it)
        // Audio just won't play — app continues normally
        initialized = true;
        audioAvailable = false;
    }
}

/** Load a single sound file into the cache */
async function loadSound(key: string, source: any): Promise<void> {
    if (!AudioModule) return;
    try {
        const { sound } = await AudioModule.Sound.createAsync(source, {
            shouldPlay: false,
            volume: 0.7,
        });
        sounds[key] = sound;
    } catch {
        // Load error — no-op, this sound won't play
    }
}

// ─── Playback Helpers ─────────────────────────────────────

async function play(key: string): Promise<void> {
    if (muted || !audioAvailable || !sounds[key]) return;
    try {
        await sounds[key].setPositionAsync(0);
        await sounds[key].playAsync();
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

// ─── Settings ─────────────────────────────────────────────

export function setMuted(value: boolean) { muted = value; }
export function isMuted() { return muted; }

// ─── Cleanup ──────────────────────────────────────────────

export async function unloadSounds(): Promise<void> {
    for (const sound of Object.values(sounds)) {
        try { await sound.unloadAsync(); } catch { /* no-op */ }
    }
}
