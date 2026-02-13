---
description: Best practices for mobile 3D camera navigation with React Three Fiber
---

# Mobile 3D UX Skill

Use this skill when building or debugging 3D navigation on mobile with React Three Fiber (R3F), handling touch gestures in 3D scenes, or implementing camera controls for mobile 3D apps.

## When to Use

- Building camera orbit/navigation for 3D scenes on React Native
- Debugging touch gesture issues with R3F Canvas
- Touch events not reaching 3D objects for raycasting/onClick
- Camera movement feels sluggish or unresponsive on mobile
- Need haptic feedback patterns for 3D interactions

## Core Principles

### 1. Touch Event Compatibility with R3F Canvas

**Problem**: Standard gesture handlers can capture touch events before R3F Canvas receives them, breaking raycasting and `onClick` on 3D objects.

**Solution**: Use `PanResponder` with a drag-threshold strategy:

```typescript
import { PanResponder } from 'react-native';

const panResponder = useMemo(
  () =>
    PanResponder.create({
      // KEY: Don't capture on touch START
      // This lets taps pass through to R3F Canvas for raycasting
      onStartShouldSetPanResponder: () => false,
      
      // Only capture after finger has moved enough to be a drag
      onMoveShouldSetPanResponder: (_, gesture) => {
        const DRAG_THRESHOLD = 6; // pixels
        return (
          Math.abs(gesture.dx) > DRAG_THRESHOLD ||
          Math.abs(gesture.dy) > DRAG_THRESHOLD
        );
      },

      onPanResponderGrant: (evt) => {
        // Finger started dragging (not a tap)
        // Initialize camera orbit state
      },

      onPanResponderMove: (evt) => {
        // Handle orbit/navigation
      },

      onPanResponderRelease: () => {
        // Finger lifted
      },
    }),
  []
);

// Apply to View wrapping Canvas
return (
  <View {...panResponder.panHandlers}>
    <Canvas>
      <mesh onClick={handleClick}> {/* This now works */}
        {/* ... */}
      </mesh>
    </Canvas>
  </View>
);
```

**Why it works**: Taps (< 6px movement) pass through to the Canvas, drags get captured for camera control.

### 2. Momentum-Based Camera for Tactile Feel

Users expect mobile 3D cameras to feel responsive and have satisfying inertia. Use velocity tracking + friction decay:

```typescript
interface CameraState {
  // ... position/rotation
  velocityAzimuth: number;
  velocityElevation: number;
  isTouching: boolean;
}

const MOMENTUM_FRICTION = 0.92; // Lower = longer coast
const MOMENTUM_MIN_VEL = 0.0001; // Stop threshold

// During drag
onPanResponderMove: (evt) => {
  const dx = pageX - prevTouch.current.x;
  const dy = pageY - prevTouch.current.y;
  
  const vAz = -dx * ORBIT_SENSITIVITY;
  const vEl = -dy * ORBIT_SENSITIVITY;
  
  cameraState.current.targetAzimuth += vAz;
  cameraState.current.targetElevation += vEl;
  
  // Track velocity for momentum
  cameraState.current.velocityAzimuth = vAz;
  cameraState.current.velocityElevation = vEl;
  
  prevTouch.current = { x: pageX, y: pageY };
}

// In useFrame (every frame)
useFrame(() => {
  const cs = cameraState.current;
  
  // Apply momentum when not touching
  if (!cs.isTouching) {
    if (Math.abs(cs.velocityAzimuth) > MOMENTUM_MIN_VEL) {
      cs.targetAzimuth += cs.velocityAzimuth;
      cs.velocityAzimuth *= MOMENTUM_FRICTION; // Decay
    }
    if (Math.abs(cs.velocityElevation) > MOMENTUM_MIN_VEL) {
      cs.targetElevation += cs.velocityElevation;
      cs.velocityElevation *= MOMENTUM_FRICTION;
    }
  }
  
  // Spring-damped lerp to target
  cs.azimuth += (cs.targetAzimuth - cs.azimuth) * CAMERA_LERP;
  cs.elevation += (cs.targetElevation - cs.elevation) * CAMERA_LERP;
  
  // Update THREE.Camera position
});
```

**Kill momentum on programmatic moves**:
```typescript
// When flying to a block or resetting camera
cameraState.current.velocityAzimuth = 0;
cameraState.current.velocityElevation = 0;
```

### 3. Tuning Parameters (Tested Values)

Based on user feedback from production mobile 3D app:

| Parameter | Value | Notes |
|-----------|-------|-------|
| `ORBIT_SENSITIVITY` | `0.006` | Radians per pixel of drag. 0.004 feels too slow. |
| `CAMERA_LERP` | `0.12` | Spring-damped interpolation. 0.08 feels sluggish. |
| `MOMENTUM_FRICTION` | `0.92` | Per-frame velocity decay. Lower = longer spin. |
| `DRAG_THRESHOLD` | `6` | Pixels before capturing as drag vs tap. |

Adjust based on your specific scene scale and user testing, but these are good starting points.

### 4. GestureHandlerRootView Requirement

If using `react-native-gesture-handler` anywhere in your app, wrap the root layout:

```typescript
// app/_layout.tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        {/* ... */}
      </Stack>
    </GestureHandlerRootView>
  );
}
```

**Error if missing**: `GestureDetector must be used as a descendant of GestureHandlerRootView`

### 5. Pinch Zoom Pattern

Handle 2-finger pinch for zoom with tier snapping:

```typescript
function getPinchDistance(evt: GestureResponderEvent): number | null {
  const touches = evt.nativeEvent.touches;
  if (!touches || touches.length < 2) return null;
  const dx = touches[1].pageX - touches[0].pageX;
  const dy = touches[1].pageY - touches[0].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

const isPinching = useRef(false);
const pinchStartDist = useRef(0);
const pinchStartZoom = useRef(40);

onPanResponderMove: (evt) => {
  const pinchDist = getPinchDistance(evt);
  
  if (pinchDist !== null) {
    if (!isPinching.current) {
      // Start pinch
      isPinching.current = true;
      pinchStartDist.current = pinchDist;
      pinchStartZoom.current = cameraState.current.zoom;
      return;
    }
    
    // Continue pinch
    const scale = pinchDist / pinchStartDist.current;
    cameraState.current.targetZoom = pinchStartZoom.current / scale;
    return;
  }
  
  // Single finger orbit...
}

onPanResponderRelease: () => {
  if (isPinching.current) {
    isPinching.current = false;
    // Snap to zoom tier (e.g., overview/neighborhood/block)
    cameraState.current.targetZoom = snapToTier(cameraState.current.targetZoom);
  }
}
```

## Haptic Feedback

Use `expo-haptics` for tactile feedback on key interactions:

```typescript
import * as Haptics from 'expo-haptics';

// Block selection
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

// Zoom tier snap
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// Camera reset / major action
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// Layer crossing during orbit (subtle)
Haptics.selectionAsync();
```

## Common Pitfalls

1. **Capturing all touches**: `onStartShouldSetPanResponder: true` breaks R3F onClick
2. **No momentum**: Camera feels unresponsive and stops dead when finger lifts
3. **Lerp too low**: < 0.1 feels sluggish on mobile. Aim for 0.12-0.15.
4. **Forgetting to kill momentum**: Programmatic camera moves fight with ongoing inertia
5. **Missing GestureHandlerRootView**: Runtime error if any GestureDetector used in app

## Testing Checklist

- [ ] Blocks selectable via tap at all zoom levels (overview, mid, close)
- [ ] Camera spins smoothly with inertia after finger release
- [ ] Pinch zoom feels natural and snaps to defined tiers
- [ ] Double-tap reset returns to consistent position
- [ ] No jank or stuttering during orbit on low-end devices
- [ ] Haptics fire at appropriate moments (not too frequent)

## References

- React Native PanResponder: https://reactnative.dev/docs/panresponder
- React Three Fiber: https://docs.pmnd.rs/react-three-fiber
- Expo Haptics: https://docs.expo.dev/versions/latest/sdk/haptics/
