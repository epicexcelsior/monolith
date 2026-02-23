/**
 * Centralized haptics utility for The Monolith.
 *
 * All haptic feedback goes through this module so we can:
 * 1. Gate haptics behind platform checks (iOS/Android differences)
 * 2. Easily adjust intensity levels in one place
 * 3. Define named haptic patterns for consistency
 *
 * Uses `expo-haptics` which is already installed.
 *
 * See: /docs/design/HAPTICS.md for the full design spec.
 */
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/** Whether haptics are available on this device */
const HAPTICS_ENABLED = Platform.OS === "ios" || Platform.OS === "android";

/**
 * Fire a haptic only if available.
 * Wraps all calls so we don't crash on web or unsupported devices.
 */
function safeHaptic(fn: () => Promise<void>) {
    if (!HAPTICS_ENABLED) return;
    fn().catch(() => {
        // Silently ignore — haptic failure should never crash the app
    });
}

// ─── Named Haptic Events ─────────────────────────────────

/** Block tapped / selected — medium "click" feel */
export function hapticBlockSelect() {
    safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    );
}

/** Block deselected / panel closed — light "release" feel */
export function hapticBlockDeselect() {
    safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    );
}

/** Camera crosses a layer boundary while panning */
export function hapticLayerCross() {
    safeHaptic(() => Haptics.selectionAsync());
}

/** Camera zoom snaps to a tier (overview / neighborhood / block) */
export function hapticZoomSnap() {
    safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    );
}

/** Double-tap reset to overview */
export function hapticReset() {
    safeHaptic(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    );
}

/** Block successfully claimed — heavy + celebration */
export async function hapticBlockClaimed() {
    if (!HAPTICS_ENABLED) return;
    try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        // Small delay then success notification for a two-beat rhythm
        setTimeout(() => {
            Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
            ).catch(() => { });
        }, 150);
    } catch {
        // Silently ignore
    }
}

/** Button press — soft tap */
export function hapticButtonPress() {
    safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    );
}

/**
 * Multi-phase claim celebration haptic sequence.
 * Inspired by Duolingo's escalating-then-resolving pattern.
 * Builds tension → explosive impact → satisfying settle.
 */
export function hapticClaimCelebration(isFirstClaim: boolean) {
    if (!HAPTICS_ENABLED) return;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // ─── Buildup: escalating taps that build anticipation ───
    const buildupTaps = isFirstClaim
        ? [
            { delay: 0,   style: Haptics.ImpactFeedbackStyle.Light },
            { delay: 150, style: Haptics.ImpactFeedbackStyle.Light },
            { delay: 280, style: Haptics.ImpactFeedbackStyle.Light },
            { delay: 400, style: Haptics.ImpactFeedbackStyle.Medium },
            { delay: 520, style: Haptics.ImpactFeedbackStyle.Medium },
            { delay: 640, style: Haptics.ImpactFeedbackStyle.Medium },
            { delay: 780, style: Haptics.ImpactFeedbackStyle.Heavy },
            { delay: 900, style: Haptics.ImpactFeedbackStyle.Heavy },
          ]
        : [
            { delay: 0,   style: Haptics.ImpactFeedbackStyle.Light },
            { delay: 120, style: Haptics.ImpactFeedbackStyle.Light },
            { delay: 240, style: Haptics.ImpactFeedbackStyle.Medium },
            { delay: 360, style: Haptics.ImpactFeedbackStyle.Medium },
            { delay: 480, style: Haptics.ImpactFeedbackStyle.Heavy },
          ];

    for (const tap of buildupTaps) {
        timers.push(setTimeout(() => {
            Haptics.impactAsync(tap.style).catch(() => {});
        }, tap.delay));
    }

    // ─── Impact: BOOM — double Heavy + Success for maximum punch ───
    const impactDelay = isFirstClaim ? 1000 : 600;
    timers.push(setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, impactDelay));
    // Double tap for extra weight
    timers.push(setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, impactDelay + 40));
    // Success notification for the "ding" resolution
    timers.push(setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, impactDelay + 120));

    // ─── Celebration: rhythmic pulses during the sparkle phase ───
    const celebTaps = isFirstClaim
        ? [1400, 1700, 2000, 2400]
        : [1000, 1300];
    for (const delay of celebTaps) {
        timers.push(setTimeout(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }, delay));
    }

    // ─── Settle: gentle fade-out pulses ───
    const settleTaps = isFirstClaim
        ? [4000, 4300, 4600]
        : [2400, 2700];
    for (const delay of settleTaps) {
        timers.push(setTimeout(() => {
            Haptics.selectionAsync().catch(() => {});
        }, delay));
    }

    return timers;
}

/** Error occurred — warning vibration */
export function hapticError() {
    safeHaptic(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    );
}
