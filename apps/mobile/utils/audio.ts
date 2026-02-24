/**
 * Audio system for The Monolith.
 * Mirrors haptics.ts pattern: fire-and-forget, fail-safe, platform-aware.
 *
 * Uses expo-audio for playback. All sounds are pre-loaded on init.
 * Every function catches errors silently — never blocks gameplay.
 *
 * ─── Zero-latency design ────────────────────────────────────────────────────
 * Each AudioPlayer auto-resets to position 0 the instant playback ends.
 * So play() never has to seek — it just calls player.play() directly.
 * No await, no bridge round-trip, no perceptible delay.
 *
 * ─── Volume hierarchy ───────────────────────────────────────────────────────
 * WAV files carry the volume hierarchy. Player volume = 1.0.
 *   UI taps       (select/deselect/button/scroll): ~-14dB
 *   Feedback      (charge/customize/error):        ~-8dB
 *   Celebrations  (claim/streak/level-up):         ~-6dB
 *   Epic          (claim-celebration):             ~-0.5dB
 *
 * @see scripts/generate-sounds.js
 */
import { Platform } from "react-native";

// ─── State ──────────────────────────────────────────────────────────────────

let initialized = false;
let muted = false;
let audioAvailable = false;

const players: Record<string, any> = {};
let AudioModule: any = null;

// ─── Init ────────────────────────────────────────────────────────────────────

/**
 * Pre-load all sound effects. Call once on app start (in _layout.tsx).
 * Gracefully handles missing native module — sounds just won't play.
 */
export async function initAudio(): Promise<void> {
    if (initialized) return;
    if (Platform.OS === "web") {
        initialized = true;
        return;
    }

    try {
        const expoAudio = await import("expo-audio");
        AudioModule = expoAudio;

        // Play through silent mode + activate session upfront
        // (pre-warming avoids first-sound latency on iOS)
        await expoAudio.setAudioModeAsync({ playsInSilentMode: true });
        await expoAudio.setIsAudioActiveAsync(true);

        audioAvailable = true;

        // ─── Load all sounds ───────────────────────────────────────────────
        // Metro requires static require() — can't use dynamic paths.

        // UI tier  (~-14dB)
        await loadPlayer("blockSelect",   require("../assets/sfx/block-select.wav"));
        await loadPlayer("blockDeselect", require("../assets/sfx/block-deselect.wav"));
        await loadPlayer("buttonTap",     require("../assets/sfx/button-tap.wav"));
        await loadPlayer("layerScroll",   require("../assets/sfx/layer-scroll.wav"));
        await loadPlayer("panelOpen",     require("../assets/sfx/panel-open.wav"));

        // Feedback tier (~-8dB)
        await loadPlayer("chargeTap",  require("../assets/sfx/charge-tap.wav"));
        await loadPlayer("customize",  require("../assets/sfx/customize.wav"));
        await loadPlayer("error",      require("../assets/sfx/error.wav"));

        // Celebration tier (~-6dB)
        await loadPlayer("blockClaim",       require("../assets/sfx/block-claim.wav"));
        await loadPlayer("streakMilestone",  require("../assets/sfx/streak-milestone.wav"));
        await loadPlayer("levelUp",          require("../assets/sfx/level-up.wav"));
        await loadPlayer("claimCelebration", require("../assets/sfx/claim-celebration.wav"));

        initialized = true;
    } catch {
        initialized = true;
        audioAvailable = false;
    }
}

/**
 * Create an AudioPlayer for one sound.
 * Registers a didJustFinish listener so the player auto-seeks to 0 on end.
 * This means play() can always fire immediately without any seek overhead.
 */
async function loadPlayer(key: string, source: any): Promise<void> {
    if (!AudioModule) return;
    try {
        const player = AudioModule.createAudioPlayer(source);
        player.volume = 1.0; // WAV files carry the volume hierarchy

        // Auto-reset: seek to 0 the instant playback ends.
        // Next play() call will be zero-latency — no seeking required.
        player.addListener("playbackStatusUpdate", (status: any) => {
            if (status?.didJustFinish) {
                player.seekTo(0).catch(() => {});
            }
        });

        players[key] = player;
    } catch {
        // Load error — no-op, this sound won't play
    }
}

// ─── Playback ────────────────────────────────────────────────────────────────

function play(key: string): void {
    if (muted || !audioAvailable || !players[key]) return;
    try {
        players[key].play();
    } catch {
        // Playback error — no-op
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

// UI tier
/** Tiny crystal tick when scrubbing layers */
export function playLayerScroll()   { play("layerScroll"); }
/** Soft downward whoosh when inspector panel opens */
export function playPanelOpen()     { play("panelOpen"); }
/** Premium bell tap on block selection */
export function playBlockSelect()   { play("blockSelect"); }
/** Soft glass release on block deselect */
export function playBlockDeselect() { play("blockDeselect"); }
/** Clean 43ms click for UI buttons */
export function playButtonTap()     { play("buttonTap"); }

// Feedback tier
/** FM electric zap — energy pulse into a block */
export function playChargeTap()     { play("chargeTap"); }
/** Stamp + crystal ping on customization */
export function playCustomize()     { play("customize"); }
/** Descending minor-3rd for errors */
export function playError()         { play("error"); }

// Celebration tier
/** Glass impact → rising A major shimmer on claim */
export function playBlockClaim()       { play("blockClaim"); }
/** Crystal A→E→A arpeggio on streak milestone */
export function playStreakMilestone()  { play("streakMilestone"); }
/** Full A major fanfare on level-up */
export function playLevelUp()          { play("levelUp"); }
/** Epic multi-phase celebration — the big moment */
export function playClaimCelebration() { play("claimCelebration"); }

// ─── Settings ────────────────────────────────────────────────────────────────

export function setMuted(value: boolean) { muted = value; }
export function isMuted() { return muted; }

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export function unloadSounds(): void {
    for (const player of Object.values(players)) {
        try { player.remove(); } catch { /* no-op */ }
    }
}
