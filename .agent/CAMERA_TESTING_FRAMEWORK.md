# Phase 6: Camera System Testing & Tuning Framework

**Goal:** Validate camera system is production-ready, performant, and feels great on Seeker phones.

---

## Part 1: Quick Validation (Pre-Testing)

### ✅ Code Validation Checklist

- [ ] **TypeScript Compilation**
  ```bash
  npx tsc --noEmit --project apps/mobile/tsconfig.json
  ```
  Expected: No errors, only npm warnings about config

- [ ] **Code Organization**
  - [ ] CameraConfig.ts exists with all 50+ parameters
  - [ ] TowerScene.tsx imports and uses CAMERA_CONFIG
  - [ ] TowerGrid.tsx has enhanced block selection logging
  - [ ] multiplayer-store.ts has position cache validation
  - [ ] BlockInspector.tsx renders conditionally by ownership

- [ ] **Critical Files Check**
  ```bash
  wc -l apps/mobile/components/tower/TowerScene.tsx
  wc -l apps/mobile/constants/CameraConfig.ts
  wc -l apps/mobile/components/tower/TowerGrid.tsx
  ```
  Expected: TowerScene ~986 lines, CameraConfig ~140 lines, TowerGrid uses CAMERA_CONFIG

---

## Part 2: Functional Testing Checklist

### 🎮 User Interactions to Test

#### Overview Mode (Idle)
- [ ] App starts → camera at overview distance (zoom ≈ 40)
- [ ] Camera elevation ≈ 26° (dramatic, not bird's-eye)
- [ ] User doesn't interact for 4 seconds
- [ ] Camera slowly rotates around tower (visible auto-rotate)
- [ ] **Console logs:** Check for no warnings about missing positions

#### Block Inspection
- [ ] Tap any block
- [ ] Block immediately highlights (expand + glow)
- [ ] Camera smoothly flies to block (zoom ≈ 7, elevation ≈ 22°)
- [ ] UI appears with block details
- [ ] **Console logs:** `[BlockSelection] Raycast hit instance X: block-Y-Z`

#### Orbit Around Block
- [ ] While block selected, drag 1 finger left/right
- [ ] Camera orbits block smoothly
- [ ] Orbit feels responsive (not laggy, not too fast)
- [ ] Release finger → momentum keeps camera rotating, decays
- [ ] **No gestureActive blocking** — orbiting should feel fluid

#### Pinch Zoom (2-finger)
- [ ] Place 2 fingers on screen, pinch inward
- [ ] Camera zooms in (distance decreases)
- [ ] Pinch outward → zoom out
- [ ] Zoom smooth and responsive
- [ ] Doesn't interfere with block selection after pinch ends

#### Double-Tap Reset
- [ ] While inspecting block, double-tap screen
- [ ] Camera immediately transitions back to overview
- [ ] Smooth zoom back out
- [ ] Block deselected
- [ ] UI disappears

#### Empty Space Deselect
- [ ] Inspect a block
- [ ] Tap on empty 3D space (not a block)
- [ ] **Console logs:** `[BlockSelection] Tap hit no instance (empty space deselect)`
- [ ] Block deselects, UI disappears
- [ ] Camera returns to overview

#### Block Customization
- [ ] Select owned block
- [ ] Tap "Customize"
- [ ] Change color → block color updates in real-time
- [ ] Change emoji → block emoji updates
- [ ] Change style → block visual changes
- [ ] Input name → appears in inspector
- [ ] Tap "Done" → customization panel closes

#### Charge Button
- [ ] Own a block
- [ ] Tap "CHARGE" button
- [ ] Block gets energy boost
- [ ] Streak counter increments
- [ ] Button shows "Wait 24s" after charging (or immediate if <24h)

#### Claim Button
- [ ] Find unclaimed block
- [ ] Tap "Claim This Block"
- [ ] Opens ClaimModal
- [ ] Select amount to stake (>= 10 USDC)
- [ ] Confirm → transaction submitted
- [ ] Block becomes yours
- [ ] UI updates to show "CHARGE" + customize options

---

## Part 3: Visual Polish Checklist

### 🎨 Visual Quality Standards

- [ ] **Block Highlight Smooth**
  - [ ] Selected block expands 8% smoothly (not jarring)
  - [ ] Glow is visible but not blinding
  - [ ] Returns to normal size when deselected
  - [ ] No flicker or jitter

- [ ] **Camera Transitions Smooth**
  - [ ] Overview → Block inspect: smooth 1-2 second transition
  - [ ] Block → Overview: smooth, no snapping
  - [ ] Orbit momentum feels natural (coasts, doesn't stop abruptly)

- [ ] **UI Animations Smooth**
  - [ ] BlockInspector slides up from bottom: smooth, ~300ms
  - [ ] Slides down on deselect: smooth
  - [ ] Close button press: provides haptic feedback
  - [ ] Button presses: scale animation visible

- [ ] **No Visual Artifacts**
  - [ ] No blocks flickering in/out of view
  - [ ] No camera clipping through tower
  - [ ] No text rendering issues
  - [ ] No color banding or posterization

---

## Part 4: Performance Testing Checklist

### ⚡ Performance Targets

| Metric | Target | How to Measure |
|--------|--------|---|
| Frame Rate | 60 FPS | DevTools Profiler (React Native) |
| Load Time | < 3s | Time from app open to first frame |
| Block Selection | < 100ms | Tap to raycasting completion |
| Camera Transition | < 2s | Overview to block focus |
| Memory Usage | < 200MB | React Native Profiler |

### 🔍 Performance Test Steps

#### Setup
```bash
# On Seeker phone via USB, enable React Native Debugger:
# 1. Open app
# 2. Press Ctrl+M (Android) or Cmd+D (iOS)
# 3. Select "Open Debugger"
# 4. Go to Profiler tab
```

#### Test 1: Idle Rotation
- [ ] Open app (overview)
- [ ] Wait 4s for auto-rotate to start
- [ ] Monitor Profiler for FPS
- [ ] Target: 60 FPS sustained for 10+ seconds
- [ ] If drops: Check if particle system is running, too many blocks rendering, etc.

#### Test 2: Block Selection
- [ ] Tap multiple blocks in sequence (5-10 taps)
- [ ] Raycasting should complete < 100ms
- [ ] Camera transition smooth, no frame drops
- [ ] Target: 55+ FPS during transitions

#### Test 3: Orbit + Pan
- [ ] Select block
- [ ] Orbit with 1-finger drag for 5 seconds
- [ ] Add 2-finger vertical pan
- [ ] Monitor FPS
- [ ] Target: 50+ FPS (more complex than idle, some drop acceptable)

#### Test 4: Memory Stability
- [ ] Run test 1-3 for 5 minutes
- [ ] Monitor memory in Profiler
- [ ] Should not exceed 200MB
- [ ] Should not have memory leak (rising line)

---

## Part 5: Parameter Tuning Guide

### 🎛️ How to Adjust (edit CameraConfig.ts)

#### Problem: Camera zooms too fast
```typescript
// CameraConfig.ts, line ~35
lerp: {
  zoom: 0.22,  // ← Decrease to 0.15 for slower, smoother zoom
}
```
**Effect:** Slower zoom feels smoother but less responsive. Try 0.15–0.30.

#### Problem: Orbit feels sluggish
```typescript
lerp: {
  orbit: 0.18,  // ← Increase to 0.25 for snappier response
}
```
**Effect:** Higher value = snappier. Range: 0.12–0.35. Try 0.20–0.25 for responsive feel.

#### Problem: Auto-rotate too fast (distracting)
```typescript
idle: {
  rotateSpeed: 0.0005,  // ← Decrease to 0.0002 for slower rotation
}
```
**Effect:** Controls background rotation during idle. Try 0.0002–0.0008.

#### Problem: Block takes too long to focus
```typescript
lerp: {
  transition: 0.045,  // ← Increase to 0.08 for faster focus
}
```
**Effect:** "Fly-to-block" speed. Higher = faster. Try 0.05–0.12.

#### Problem: Surrounding blocks too visible when inspecting
```typescript
dimming: {
  unselected: 0.0,  // ← Increase to 0.15 to fade surrounding blocks
}
```
**Effect:** Makes surrounding blocks dimmer. Only enable if perf allows (60 FPS). Try 0.0–0.3.

#### Problem: Momentum coasting too long
```typescript
physics: {
  momentumFriction: 0.93,  // ← Decrease to 0.88 for quicker stop
}
```
**Effect:** Higher = longer coast. Try 0.85–0.95.

---

## Part 6: Testing on Seeker Phone

### 📱 Setup Instructions

#### Device Setup
1. Connect Seeker phone via USB
2. Enable USB Debugging:
   - Settings → Developer Options → USB Debugging (ON)
3. Verify connection: `adb devices` (should show device)

#### Build and Deploy
```bash
cd apps/mobile
npx expo run:android  # or expo run:ios

# Or build APK for install:
eas build --platform android --local
adb install build-*.apk
```

#### Monitor Performance
```bash
# Option 1: React Native DevTools (recommended)
# Press Ctrl+M on device, select "Open Debugger"
# Go to Profiler tab, record 10s

# Option 2: Android Studio Profiler
# Tools → Profiler → CPU/Memory graphs

# Option 3: Simple logs
# Filter logcat: adb logcat | grep "[BlockSelection]\|[PositionCache]\|[TowerScene]"
```

#### Console Logging Checklist
- [ ] On app start: `[PositionCache] Built cache: 846 blocks cached, 0 errors`
- [ ] Tap block: `[BlockSelection] Raycast hit instance X: block-Y-Z`
- [ ] No warnings about missing positions
- [ ] No TypeScript errors in DevTools console

---

## Part 7: Final Sign-Off Checklist

### ✅ Before Shipping Phase 6 Complete

**Code Quality**
- [ ] TypeScript compiles clean (0 errors)
- [ ] All camera parameters documented in CameraConfig.ts
- [ ] No hardcoded magic numbers in TowerScene.tsx
- [ ] Block selection logging is comprehensive

**Functional**
- [ ] Overview → Block → Overview transitions work smoothly
- [ ] Block selection (tap) works reliably
- [ ] Empty space deselect works (taps nothing, block deselects)
- [ ] Orbit + pan + zoom all responsive
- [ ] Double-tap resets to overview
- [ ] No console errors or warnings

**Visual**
- [ ] Block highlights expand smoothly (no jitter)
- [ ] Camera transitions are smooth (not snappy)
- [ ] UI slides up/down smoothly (not jarring)
- [ ] No visual artifacts (clipping, flickering, banding)

**Performance** (on Seeker phone)
- [ ] Idle rotation: 60 FPS sustained
- [ ] Block selection: 55+ FPS during transition
- [ ] Orbit: 50+ FPS acceptable (complex operation)
- [ ] Memory: < 200MB, no leaks
- [ ] No dropped frames during 5-minute session

**Documentation**
- [ ] This checklist completed
- [ ] Parameter tuning guide available
- [ ] Console logging explanation documented
- [ ] Testing methodology clear for future iterations

---

## Part 8: Performance Tuning Troubleshooting

### If 60 FPS Not Achieved

**Check 1: Block Count**
```bash
# In multiplayer-store.ts, line 78
console.log(`[PositionCache] Built cache: X blocks`)
```
If X > 900, tower may be too dense. Consider:
- Reducing SPIRE layers
- Reducing blocks per layer in @monolith/common

**Check 2: Particle System**
- Look at Particles.tsx
- Is emitter active during orbit?
- Try disabling particles during camera movement

**Check 3: Camera Update Frequency**
- CameraRig runs every frame (useFrame)
- Profile to see how much time spent on camera math
- If >5ms per frame, optimize position calculations

**Check 4: Shader Complexity**
- BlockShader has AO, SSS, GGX specular, glow
- If performance low, try disabling SSS or AO temporarily

**Check 5: Rendering**
- Are all 846 blocks being rendered every frame?
- Use frustum culling (TowerGrid sets frustumCulled={true})
- Verify LOD system is working (far blocks render simpler geometry)

---

## Next Steps After Phase 6

Once Phase 6 is complete and all checklist items pass:
1. **Document findings** in git commit
2. **Save optimal parameters** in CameraConfig.ts
3. **Create user-facing testing guide** (how users can report camera issues)
4. **Plan Phase 7+** if needed (advanced features like gesture customization, etc.)

---

## Quick Reference: All Parameters

| Category | Parameter | Default | Range | Effect |
|----------|-----------|---------|-------|--------|
| **Zoom** | overview | 40 | 30-50 | Idle view distance |
| | block | 7 | 5-12 | Block inspect distance |
| | min | 7 | 5-10 | Closest camera can be |
| | max | 55 | 45-65 | Farthest camera can be |
| **Lerp** | orbit | 0.18 | 0.10-0.35 | 1-finger drag snappiness |
| | zoom | 0.22 | 0.10-0.35 | Pinch zoom responsiveness |
| | transition | 0.045 | 0.03-0.15 | Fly-to-block speed |
| | pan | 0.15 | 0.10-0.25 | 2-finger vertical pan |
| **Idle** | timeoutSeconds | 4 | 2-6 | Seconds before auto-rotate |
| | rotateSpeed | 0.0005 | 0.0001-0.001 | Radians per frame |
| **Elevation** | overview | 0.45 | 0.40-0.55 | Overview angle (rad) |
| | block | 0.38 | 0.30-0.45 | Inspect angle (rad) |
| **Gesture** | orbitSensitivity | 0.006 | 0.003-0.015 | Pixels → radians |
| | dragThreshold | 14 | 8-20 | Pixels before drag detected |
| **Physics** | momentumFriction | 0.93 | 0.85-0.97 | Decay rate |
| | elasticSpring | 0.08 | 0.05-0.15 | Pan bounce strength |

