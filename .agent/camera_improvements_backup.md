# Camera Inspection Improvements (WIP - Saved for Later)

## Approach Attempted
1. Increased ZOOM_BLOCK from 7 → 12 for more breathing room
2. Added camera position tracking to store for distance-based calculations
3. Implemented distance-based block fading (blocks fade transparent as camera approaches)
4. Added smart block visibility:
   - Far blocks: fade = 0.35 (visible but dimmed)
   - Very close blocks: fade approaches 0.0 (transparent)

## What Works
- ✅ Zoom to block mechanism (when block positions are valid)
- ✅ Camera reset on deselect
- ✅ Block fading/transparency during orbit
- ✅ No performance issues on Seeker phones

## Issues Encountered
- ❌ Block position data missing from server blocks (blocks like block-19-26, block-21-12 return {0,0,0})
- ❌ Block selection sometimes fails (raycasting hitting wrong block?)
- ❌ Block details UI unreliable
- ❌ Complex distance-based recalculation interfering with other state updates

## Root Cause
Multiplayer mode: Server blocks don't have position data pre-computed. The `buildPositionCache()` in multiplayer-store.ts isn't populating positions correctly for all blocks. Need to investigate why `usable[i]` positions aren't being cached.

## Files Modified
- `TowerScene.tsx`: ZOOM_BLOCK constant + camera position tracking + CameraRig updates
- `TowerGrid.tsx`: Distance-based fade logic + camera position caching
- `tower-store.ts`: Added cameraPosition state + setCameraPosition action
- `multiplayer-store.ts`: Added logging to debug position cache

## Next Steps When Resuming
1. Debug multiplayer position cache - check what format `usable[i]` is in
2. Ensure ALL server blocks get positions before being converted to DemoBlocks
3. Fix block raycasting for reliable selection
4. Ensure block details UI always appears on selection
5. Keep the 12-unit zoom and fading - just make it more reliable

## Commands to Reference
- Zoom in: `cs.targetZoom = ZOOM_BLOCK` (12)
- Zoom out: `cs.targetZoom = ZOOM_OVERVIEW` (40)
- Block visibility: Controlled by `vFade` shader uniform (0.0 = invisible, 1.0 = normal)
