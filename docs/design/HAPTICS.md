# Haptics Design Spec — The Monolith

Defines all haptic feedback patterns used in the mobile app. This document serves as the single source of truth for haptic interactions, ensuring consistency across all future features.

## Implementation

All haptics flow through [`utils/haptics.ts`](file:///home/epic/Downloads/monolith/apps/mobile/utils/haptics.ts) using `expo-haptics`. Every function is platform-gated and fail-safe.

## Haptic Event Map

| Event | Function | expo-haptics API | Feel |
|-------|----------|-----------------|------|
| Block selected | `hapticBlockSelect()` | `impactAsync(Medium)` | Firm "click" — confirms selection |
| Block deselected | `hapticBlockDeselect()` | `impactAsync(Light)` | Soft "release" — dismissal |
| Layer boundary crossed | `hapticLayerCross()` | `selectionAsync()` | Subtle tick — spatial awareness |
| Zoom tier snap | `hapticZoomSnap()` | `impactAsync(Light)` | Gentle detent — "locking in" |
| Camera reset (double-tap) | `hapticReset()` | `notificationAsync(Success)` | Satisfying "home" confirmation |
| Block claimed | `hapticBlockClaimed()` | Heavy impact → 150ms → Success notification | Two-beat celebration |
| Button press | `hapticButtonPress()` | `impactAsync(Light)` | Standard UI feedback |
| Error | `hapticError()` | `notificationAsync(Error)` | Warning buzz |

## Design Principles

1. **Subtle by default** — Haptics confirm actions, not announce them
2. **Spatial awareness** — Layer-crossing ticks give users a sense of "where" they are vertically
3. **Celebration moments** — Claiming a block is the most significant action; give it a two-beat reward pattern
4. **Never blocking** — All haptic calls are fire-and-forget; failures are silently swallowed
5. **Platform-gated** — Only fires on iOS/Android; no-op on web

## Zoom Tier Haptics

| Transition | Haptic |
|------------|--------|
| Overview → Neighborhood | Light impact |
| Neighborhood → Block | Light impact |
| Block → Neighborhood | Light impact |
| Neighborhood → Overview | Light impact |
| Any → Reset (double-tap) | Success notification |

## Adding New Haptic Events

1. Add a named function to `utils/haptics.ts`
2. Document it in this table
3. Wire it into the relevant component/hook
4. Keep intensity proportional to action significance
