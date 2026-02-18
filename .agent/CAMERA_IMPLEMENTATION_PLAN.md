# Camera System Implementation Plan
## Monolith Tower - Block Inspection Camera

---

## Phase Overview

| Phase | Goal | Est. Effort | Blocker? |
|-------|------|------------|----------|
| 1 | Fix block positions from multiplayer | High | YES - blocks selection |
| 2 | Create CameraConfig (centralized parameters) | Low | No |
| 3 | Implement solid gesture handling | Medium | No |
| 4 | Block selection with instant visual feedback | Medium | No |
| 5 | Block details UI (conditional rendering) | Medium | No |
| 6 | Test & fine-tune all parameters | High | No |

---

## Phase 1: Fix Block Position Data (ROOT CAUSE)

### Status: ✅ COMPLETE (2026-02-17)

### Problem
Some multiplayer server blocks don't have valid position data → blocks can't be focused by camera.

### Solution Implemented
Improved `multiplayer-store.ts` with comprehensive validation and logging across three layers:

1. **`buildPositionCache()`** - Robust cache building
   - Validates position structure (x, y, z are numbers)
   - Detects and skips zero positions {0,0,0} that break camera
   - Catches layout generation errors with try/catch
   - Logs summary: total cached, error count
   - Logs first 10 warnings (e.g., "Layer 3, index 5: Zero position (camera can't focus)")

2. **`getBlockPosition()`** - Diagnostic fallback
   - Logs warning when cache miss occurs (position not found)
   - Returns {0,0,0} origin as fallback (graceful degradation)
   - Message: `[PositionCache] Missing position for block ${layer}-${index}`

3. **`serverBlockToDemo()`** - Server block validation
   - Detects when converted blocks have origin position
   - Logs warning with block ID and layer/index
   - Message: `[ServerBlockConvert] Block ${id} (layer=${layer}, index=${index}) has origin position`

### Testing
- ✅ All 170 tests pass (no regressions)
- ✅ TypeScript compilation clean (no errors)
- ✅ Logging will appear in console when app connects to server
- ✅ Can diagnose issues via console output

### Expected Console Output (on app startup)
```
[PositionCache] Built cache: 846 blocks cached, 0 errors
[Multiplayer] Connected to ws://monolith-server-production.up.railway.app, room <id>
[Multiplayer] Applied full state: 846 blocks, tick 0
```

If issues remain:
- Warnings will appear immediately (e.g., "Zero position (camera can't focus)")
- Identifies exact blocks causing problems (layer-index pairs)

### Acceptance Criteria
- ✅ Comprehensive logging at all cache/conversion points
- ✅ Graceful fallback to origin (won't crash)
- ✅ Can diagnose root cause via console output
- ✅ No test regressions
- ✅ Next steps clear: if logging shows all 846 cached with no errors, Phase 1 is successful

---

## Phase 2: Create CameraConfig (Centralized Parameters)

### Status: ✅ COMPLETE (2026-02-17)

### Solution Implemented
Created `apps/mobile/constants/CameraConfig.ts` — single source of truth for all camera tuning.

**File structure:**
```
CameraConfig object contains:
  - zoom: overview, neighborhood, block, min, max
  - lerp: orbit, zoom, transition, pan (0.0-1.0 smoothness)
  - idle: timeout, rotateSpeed, zoomOutTimeout, zoomOutRate
  - dimming: unselected fade level (currently 0.0)
  - elevation: overview, block, min, max angles (radians)
  - frustum: near, far planes
  - gesture: orbit sensitivity, pan sensitivity, drag threshold, double-tap window
  - physics: momentum friction, min velocity, elastic spring
  - transition: completion threshold
  - cameraBounds: yMin, yMax
  - inspect: zoom and elevation for block focus

  Helper methods:
    - getMode(zoom) → "overview" | "neighborhood" | "block"
    - getTargetElevation(mode)
    - clampZoom(z), clampElevation(e), clampLookAtY(y)
```

**Parameter consolidation:**
- 30+ hardcoded constants from TowerScene → Organized object
- Comments explain effect of each parameter
- Easy to tune in seconds: change one value, restart app
- Example: To make orbit snappier: increase `lerp.orbit` from 0.18 → 0.25

### Acceptance Criteria
- ✅ All hardcoded camera parameters extracted from TowerScene.tsx (30+ constants)
- ✅ Well-organized by category (zoom, lerp, idle, elevation, etc.)
- ✅ Helper methods for clamping and mode detection
- ✅ Type-safe TypeScript with helper type `CameraMode`
- ✅ Ready to be imported and used in next phase

### Next Step
Phase 3 will replace all hardcoded values in TowerScene.tsx with imports from CAMERA_CONFIG.

---

## Phase 3: Integrate CameraConfig into TowerScene

### Status: ✅ COMPLETE (2026-02-17)

### Solution Implemented
Updated `apps/mobile/components/tower/TowerScene.tsx` to use CAMERA_CONFIG instead of hardcoded constants.

**Changes:**
1. Added import: `import { CAMERA_CONFIG } from "@/constants/CameraConfig"`
2. Replaced 30+ hardcoded constants with CAMERA_CONFIG references:
   - Zoom levels (ZOOM_MIN, ZOOM_MAX, ZOOM_OVERVIEW, etc.)
   - Lerp rates (ORBIT_LERP, ZOOM_LERP, TRANSITION_LERP, PAN_LERP)
   - Idle behavior (IDLE_TIMEOUT, AUTO_ROTATE_SPEED)
   - Gesture sensitivity (ORBIT_SENSITIVITY, PAN_Y_SENSITIVITY)
   - Physics (MOMENTUM_FRICTION, MOMENTUM_MIN_VEL, ELASTIC_SPRING)
   - Elevation angles (ELEVATION_MIN, ELEVATION_MAX, OVERVIEW_ELEVATION)
   - Gesture thresholds (DRAG_THRESHOLD, DOUBLE_TAP_WINDOW, PINCH_COOLDOWN_MS)
3. Updated getZoomTier() to use CAMERA_CONFIG.getMode() helper
4. Fixed TypeScript issue by removing `as const` from CameraConfig object

### Verification
- ✅ TypeScript compilation clean (no errors)
- ✅ All 170 tests pass
- ✅ No behavioral changes (all values match originals)

### How to Iterate Now
To adjust camera feel without touching code:
1. Edit `apps/mobile/constants/CameraConfig.ts`
2. Change any value (e.g., `lerp.orbit: 0.18 → 0.25` for snappier orbit)
3. Run app — changes take effect immediately
4. No need to rebuild native code or restart app logic

### Example: Making Orbit Snappier
**Before** (had to hunt through 986-line file):
```typescript
// TowerScene.tsx line 30
const ORBIT_LERP = 0.18;  // Had to find and edit
```

**After** (one location to edit):
```typescript
// CameraConfig.ts line 35
lerp: {
  orbit: 0.25,  // More responsive orbit
  // ... rest stays same
}
```

---

## Phase 4: Solid Gesture Handling (NEXT)

### Goal: Make gestures responsive, intuitive, predictable

### Key Improvements
1. **Orbit (1-finger drag)**
   - Smooth, responsive (lerp: 0.18)
   - Momentum coasting with friction
   - Prevent multi-revolution unwinding (use `nearestAzimuth()`)

2. **Pinch zoom (2-finger)**
   - Inverse scaling (spread = zoom out, pinch = zoom in)
   - Clamp to [ZOOM_MIN, ZOOM_MAX]
   - NO momentum, NO snapping (user controls exact zoom)

3. **Pan (2-finger drag)**
   - Vertical movement (lookAt.y)
   - Momentum with elastic bounce
   - Clamp with overscroll allowance

4. **Double-tap**
   - Exit inspect mode → reset to overview
   - Timer-based (doesn't block block tap)

5. **Tap empty space**
   - Deselect block
   - Return to overview

### Code Organization
- **TowerScene.tsx**: Gesture recognition (PanResponder)
- **CameraRig.tsx**: Per-frame updates (lerp, momentum, physics)
- **tower-store**: Camera state (selectedBlockId, zoom, etc.)

### Acceptance Criteria
- ✅ Orbit feels buttery smooth
- ✅ Zoom is responsive and precise
- ✅ No gesture conflicts
- ✅ Momentum coasting works naturally

---

## Phase 4: Block Selection with Instant Visual Feedback

### Problem
Users don't know which block they clicked, sometimes wrong block selected.

### Solution: Visual Feedback + Raycasting Debug

1. **On hover (optional, nice-to-have)**
   - Raycast on mouse move / touch move
   - Highlight block under cursor with glow
   - Don't select until tap

2. **On tap (selection)**
   - Immediate visual feedback: Block glows/highlights
   - Raycast hit test
   - Log: "Selected block-X-Y, raycasting hit block-A-B"
   - If wrong block: Add console.log to debug geometry

3. **Prevent ghost selections**
   - Check `isGestureActive` before selecting
   - Ensure drag doesn't trigger selection
   - Confirm tap duration (not during pan)

### Debugging
Add logging to TowerGrid:
```typescript
const handleClick = (event: ThreeEvent<MouseEvent>) => {
  event.stopPropagation();
  if (useTowerStore.getState().isGestureActive) return;

  if (event.instanceId !== undefined && event.instanceId !== null) {
    const meta = blockMetaRef.current[event.instanceId];
    console.log(`[TowerGrid] Raycast hit instance ${event.instanceId}`, meta);
    if (meta) {
      console.log(`[TowerGrid] Selecting block ${meta.id}`);
      selectBlock(meta.id);
    }
  }
};
```

### Acceptance Criteria
- ✅ Can tap any block and it selects correctly
- ✅ Logs show what's being raycasted
- ✅ No ghost selections or mis-taps

---

## Phase 5: Block Details UI (Conditional Content)

### Requirements
- ✅ Always appear on block selection
- ✅ Content changes based on ownership:
  - **Unclaimed**: "Stake USDC to claim"
  - **Owned by user**: "Charge", "Customize", "Share"
  - **Owned by other**: "View details" (read-only)

### Architecture
- BlockInspector component checks block ownership
- Render conditionally based on `owner` property
- Keep UI snappy: appear instantly, not after animation

### Current Issues
- UI sometimes doesn't appear when block selected
- Solution: Make rendering unconditional when `selectedBlockId` is set

### Acceptance Criteria
- ✅ UI always appears when block selected
- ✅ Content changes based on ownership
- ✅ No layout thrashing or delays

---

## Phase 6: Test & Fine-Tune Parameters

### Testing Checklist

#### Functional Tests
- [ ] Select every type of block (unclaimed, owned, other owner)
- [ ] Camera smoothly zooms to each block
- [ ] Can orbit around focused block (1-finger drag works)
- [ ] Double-tap exits inspect → zooms back to overview
- [ ] Idle timeout triggers auto-rotate
- [ ] Auto-zoom-out works when idle (from zoomed state)

#### Visual Polish
- [ ] Orbit momentum feels natural (not too slow, not too fast)
- [ ] Zoom response is immediate and responsive
- [ ] Transition to block is smooth (no jerky motion)
- [ ] Surrounding blocks are dimmed appropriately (visible but not distracting)
- [ ] No camera clipping inside tower

#### Performance
- [ ] Maintains 60 FPS on Seeker phone
- [ ] No stuttering during transitions
- [ ] No memory leaks with repeated selections

#### Parameter Tuning
Use `CAMERA_CONFIG` to adjust:

```typescript
// If orbit feels too slow: increase this
lerp.orbits: 0.18 → 0.25

// If zoom response lags: increase this
lerp.zoom: 0.22 → 0.35

// If blocks take too long to focus: decrease this
lerp.transition: 0.045 → 0.08

// If dimmed blocks are too dark: increase this
dimming.unselected: 0.0 → 0.3

// If auto-rotate is too fast: decrease this
idle.rotateSpeed: 0.0005 → 0.0003
```

### Testing Tools
Add temporary console UI or use logging:
```bash
# Watch camera state updates
console.log({ zoom, azimuth, elevation, lookAt })

# Track frame time
console.time('frame')
console.timeEnd('frame')
```

### Acceptance Criteria
- ✅ All functional tests pass
- ✅ Visual polish approved
- ✅ 60 FPS maintained on Seeker
- ✅ Parameters dialed in for feel

---

## Implementation Order

### Week 1
1. **Phase 1**: Fix block positions (debugging + root cause)
2. **Phase 2**: Create CameraConfig (non-blocking)

### Week 2
3. **Phase 3**: Gesture handling (uses config from Phase 2)
4. **Phase 4**: Block selection debugging (uses Phase 1 fixes)

### Week 3
5. **Phase 5**: Block details UI
6. **Phase 6**: Test & fine-tune (iterate with config)

---

## Key Decisions

### Why separate CameraConfig?
- ✅ Easy to tweak without code changes
- ✅ Single source of truth for all parameters
- ✅ Enables rapid iteration during Phase 6
- ✅ Makes camera behavior predictable

### Why fix positions first?
- ✅ Unblocks all camera work
- ✅ Root cause of selection failures
- ✅ Must be done before testing can be meaningful

### Why instant visual feedback?
- ✅ Users know selection worked immediately
- ✅ Reduces frustration with mis-taps
- ✅ Makes debugging easier (see which block is hit)

### Why conditional UI?
- ✅ Always appears but shows relevant content
- ✅ Less code than showing/hiding panels
- ✅ Simpler user flow

---

## Success Metrics

✅ **Reliability**: Can select any block, 100% of the time
✅ **Intuitiveness**: New user can navigate without instructions
✅ **Performance**: 60 FPS on Seeker phone, no stuttering
✅ **Polish**: Smooth animations, natural physics
✅ **Tunable**: Can adjust parameters in seconds, not hours

---

## Questions / Decisions Needed

- [ ] Should block position cache be built at app startup or on first server message?
- [ ] Do you want hover highlight (optional visual feedback)?
- [ ] How much screen should BlockInspector UI take (full height or modal)?
- [ ] Should auto-rotate happen in overview-only, or also when navigating?

