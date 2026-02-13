# Agent Learnings & Development Notes

This file documents important lessons, gotchas, and discoveries for future development.

## Recent Lessons Learned

### 2026-02-12: React Native Gesture Handler + R3F Canvas Touch Event Conflicts

**Problem**: When using `react-native-gesture-handler`'s `GestureDetector` with `onStartShouldSetPanResponder: () => true`, all touch events are captured immediately, preventing R3F Canvas from receiving tap events for raycasting/onClick on 3D objects.

**Solution**: Use `PanResponder` with `onStartShouldSetPanResponder: () => false` and `onMoveShouldSetPanResponder` that only captures after a drag threshold (e.g. 6px). This allows:
- Taps to pass through to R3F Canvas for block selection via raycasting
- Drags to be captured for camera orbit/navigation
- Pinch gestures to work for zoom

**Key Code Pattern**:
```typescript
PanResponder.create({
  // Don't capture on touch start — let taps through to R3F Canvas
  onStartShouldSetPanResponder: () => false,
  onMoveShouldSetPanResponder: (_, gesture) => {
    // Only capture once finger has moved enough to be a drag
    return (
      Math.abs(gesture.dx) > DRAG_THRESHOLD ||
      Math.abs(gesture.dy) > DRAG_THRESHOLD
    );
  },
  // ... handle drags
});
```

### 2026-02-12: Mobile 3D Camera Feel Best Practices

**Lesson**: For a tactile, responsive 3D camera orbit on mobile:
1. **Momentum**: Track velocity during drag, apply friction decay (0.92) after release for inertia
2. **Higher sensitivity**: 0.006 rad/px feels more responsive than 0.004
3. **Snappy lerp**: 0.12 feels more immediate than 0.08 while still smooth
4. **Kill momentum on programmatic camera moves**: Zero out velocity when flying to block or resetting

**Result**: Users reported "feels much better" and "more tactile/free" compared to basic lerp-only approach.

### 2026-02-12: GestureHandlerRootView Required for react-native-gesture-handler

**Problem**: `GestureDetector must be used as a descendant of GestureHandlerRootView` runtime error.

**Solution**: Wrap the root layout component with `GestureHandlerRootView`:
```typescript
// app/_layout.tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Stack navigator, etc. */}
    </GestureHandlerRootView>
  );
}
```

This enables gesture recognition throughout the entire app tree.
