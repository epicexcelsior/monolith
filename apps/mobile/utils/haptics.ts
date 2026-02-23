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
import { CLAIM_HAPTICS } from "@/constants/ClaimEffectConfig";

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
 * Timing is driven by CLAIM_HAPTICS config to stay in sync with VFX + SFX.
 * Buildup escalates over 2.3s → Heavy impact at 2500ms → light settle.
 */
export function hapticClaimCelebration(isFirstClaim: boolean) {
    if (!HAPTICS_ENABLED) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const config = isFirstClaim ? CLAIM_HAPTICS.firstClaim : CLAIM_HAPTICS.normal;

    // ─── Buildup: escalating taps synced to the bass charge ───
    for (const tap of config.buildup) {
        timers.push(setTimeout(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle[tap.style]).catch(() => {});
        }, tap.delay));
    }

    // ─── Impact: BOOM at 2500ms — double Heavy + Success ───
    timers.push(setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, config.impactDelay));
    timers.push(setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, config.impactDelay + 80));
    timers.push(setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, config.successDelay));

    // ─── Settle: gentle fade-out pulses ───
    for (const tap of config.settle) {
        timers.push(setTimeout(() => {
            Haptics.selectionAsync().catch(() => {});
        }, tap.delay));
    }

    return timers;
}

/** Charge success — medium pulse with quick resolve */
export function hapticChargeTap() {
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Customize applied — light satisfying press */
export function hapticCustomize() {
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Level up — success notification */
export function hapticLevelUp() {
    safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Streak milestone — double-tap celebration */
export function hapticStreakMilestone() {
    if (!HAPTICS_ENABLED) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, 120);
}

/** Error occurred — warning vibration */
export function hapticError() {
    safeHaptic(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    );
}
