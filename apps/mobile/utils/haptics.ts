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

/** Error occurred — warning vibration */
export function hapticError() {
    safeHaptic(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    );
}
