# Lessons Learned

> **Living document.** Add new entries at the top of the relevant section. Review periodically and prune anything no longer relevant.

## Topic Index

- [Camera & Gestures](#camera--gestures)
- [Shaders & 3D Rendering](#shaders--3d-rendering)
- [Multiplayer & Networking](#multiplayer--networking)
- [Solana & Anchor](#solana--anchor)
- [React Native & Expo](#react-native--expo)
- [Performance](#performance)
- [Deployment & DevOps](#deployment--devops)
- [UI/UX & Design System](#uiux--design-system)
- [Game Design & Core Loop](#game-design--core-loop)
- [Development Workflow](#development-workflow)
- [Tapestry & Social](#tapestry--social)

---

## Camera & Gestures

### Pop-Out Restore Fights Celebration — Guard TowerGrid Deselect Too (2026-02-27)
**Problem**: `selectBlock(null)` during celebration triggered TowerGrid's deselect handler which set `popOutTarget[i] = 0` for ALL blocks — the claimed block animated back flush with the tower. Camera lookAt pointed at the now-invisible block position. The block "receded into the tower" during buildup.
**Solution**: In TowerGrid's deselect handler, check `isCelActive && celBlockId` — keep the claimed block's pop-out at 1.0 and highlight at 1.0 during celebration. When celebration ends and `selectBlock(blockId)` fires, the block re-enters the normal pop-out state.
**Key Insight**: `selectBlock(null)` affects MULTIPLE systems (camera deselect, pop-out restore, fade/highlight). When adding a celebration guard, audit ALL downstream effects of the deselect, not just the camera.

### Audio-Visual Sync Requires Measuring the Actual Audio File (2026-02-27)
**Problem**: Config comment said "~1.5s internal buildup" but the audio file (`generate-claim-sound.js: IMPACT = 2.50`) actually has a 2.5s buildup. With `CLAIM_SOUND_DELAY = 1.0`, the audio 808 slam hit at T+3.5s while visual impact fired at T+2.5s — 1 full second of desync.
**Solution**: Verified with `ffprobe` + RMS analysis + reading the generator script. Set `CLAIM_SOUND_DELAY = 0.0` — audio plays immediately, its internal 2.5s buildup matches `CLAIM_IMPACT_OFFSET_SECS = 2.5` exactly.
**Key Insight**: Never trust comments about audio timing — measure the actual file. `ffprobe` for duration, `ffmpeg astats` for RMS envelope, and READ THE GENERATOR SCRIPT for the source of truth.

### Deselect Handler Fights Celebration Camera — Guard with Active Check (2026-02-26)
**Problem**: `selectBlock(null)` during claim celebration triggered the deselect handler which set `cs.targetZoom = ZOOM_OVERVIEW` + `cs.targetLookAt` to overview — directly fighting the celebration camera's zoom/lookAt targets on the same frame. Result: camera froze or jittered instead of doing the cinematic zoom-out.
**Solution**: Guard the deselect camera transition: `const isCelActive = claimCelebrationRef?.current?.active ?? false; if (!isCelActive) { /* set overview targets */ }`. The celebration camera phase state machine handles all zoom/lookAt during the sequence.
**Key Insight**: When two systems write to the same mutable camera state (targets), the lower-priority one must yield. Check for active override states before applying default transitions.

### Phase State Machine for Camera Sequences (2026-02-26)
**Problem**: Celebration camera used boolean flags and elapsed-time checks scattered across the useFrame loop. Adding phases (buildup → impact → orbit → return) required tracking which phases had fired, leading to stale-flag bugs and overlapping transitions.
**Solution**: Single `phase` field in a ref (`"idle" | "buildup" | "impact" | "orbit" | "return"`). Each phase transition is a one-time state change triggered by elapsed time. Phase gates prevent re-triggering. Pre-celebration camera state captured at `idle → buildup` transition, restored at `return`.
**Key Insight**: For multi-phase camera animations in useFrame, use an explicit state machine ref with named phases — not scattered boolean/time checks. Each phase fires once and advances cleanly.

### Pass blockId Through Animation Refs, Not Position Matching (2025-02-25)
**Problem**: The glow-up trigger in TowerScene needed to identify the claimed block after zoom-back. Initial approach used `cel.blockIndex` (always -1 from callers) with a fallback to float-tolerance position matching (`Math.abs(pos.x - target.x) < 0.01`). Index never matched; position matching was fragile with floating-point rounding.
**Solution**: Added `blockId?: string` to `ClaimCelebrationState` interface. Callers pass `blockId` through `triggerCelebration()` → `celebrationRef` → TowerScene `useFrame` reads `cel.blockId` directly. Clean, O(1), no tolerance issues.
**Key Insight**: When passing block identifiers through animation state refs across the pipeline (hook → ref → useFrame → store), always store the string `blockId` directly — it's the only truly reliable identifier.

### Onboarding Replay Requires Full Reveal State Reset (2026-02-25)
**Problem**: Long-press "Replay Onboarding" reset the onboarding store phase to `cinematic`, but the camera reveal never replayed. The HUD wrapper gated on `{revealComplete && ...}` stayed mounted, while `useTowerReveal`'s `doneRef` (a `useRef`) was still `true` from the previous run, causing the useFrame callback to exit immediately.
**Solution**: `resetOnboardingFlag()` must also set `revealComplete: false` and `revealProgress: 0`. The `useTowerReveal` hook must detect `revealComplete` transitioning from `true → false` (via a `prevRevealCompleteRef`) and reset all internal animation refs (`doneRef`, `revealStartedRef`, `cinematicStartedRef`).
**Key Insight**: When replaying animations driven by `useRef` state inside `useFrame`, resetting the store flag alone isn't enough — internal refs survive React re-renders and must be explicitly reset by detecting the store value change.

### Camera State Must Fully Reset on Block Deselect (2026-02-15)
**Problem**: When closing a block viewer, only lookAt X/Z were reset but zoom stayed at `ZOOM_BLOCK` — camera clipped inside tower.
**Solution**: On deselect, reset ALL camera targets (zoom, elevation, lookAt) to overview state:
```typescript
cs.targetZoom = ZOOM_OVERVIEW;
cs.targetElevation = OVERVIEW_ELEVATION;
cs.targetLookAt.set(0, TOWER_CENTER_Y, 0);
cs.isTransitioning = true;
```
**Key Insight**: Programmatic camera transitions must reset every axis — partial resets cause clipping or disorientation.

### Azimuth Normalization Causes Rotation Jumps (2026-02-15)
**Problem**: Independently normalizing `azimuth` and `targetAzimuth` to `[-PI, PI]` every frame causes visible camera snaps when one wraps while the other doesn't.
**Solution**: Let azimuth grow unboundedly. Float64 handles years of continuous rotation. Only use a local copy for trig:
```typescript
const theta = cs.azimuth;
camera.position.x = Math.sin(theta) * radius;
```
**Key Insight**: Never normalize angular values that are being interpolated — let them grow and use local copies for trig.

### Azimuth Unwinding on Reset (2026-02-16)
**Problem**: Unbounded azimuth means resetting to a fixed `OVERVIEW_AZIMUTH` caused multi-revolution unwinding.
**Solution**: `nearestAzimuth(current, target)` normalizes target to within ±PI of current azimuth — always takes the shortest rotational path. Apply to all programmatic azimuth changes.
**Key Insight**: Use shortest-arc normalization for programmatic rotation targets, not continuous drag values.

### Avoid Mode-Ambiguous Camera Gestures (2026-02-16)
**Problem**: Single-finger behavior that changed based on zoom level (orbit at overview, vertical pan when zoomed) confused users — they couldn't predict what a gesture would do.
**Solution**: Clear, mode-free gesture model — 1 finger always orbits, 2 fingers always pinch+pan. LayerIndicator scrubber handles precision vertical navigation.
**Key Insight**: Predictability > fewest gestures. Users should always know what their finger will do.

### Camera Clipping Issues in R3F (2026-02-16)
**Problem**: `ZOOM_MIN=6` caused blocks to disappear because the tower extends ~7 units from center. At low elevation angles, horizontal distance shrinks, letting camera clip inside geometry.
**Solution**: (1) `ZOOM_MIN=12` keeps camera outside tower, (2) `ELEVATION_MIN=0.3` prevents near-horizontal views, (3) Dynamic near plane `max(0.1, zoom * 0.03)`, (4) Camera Y floor at 0.5.
**Key Insight**: Camera bounds must account for the full geometry extent at all zoom/elevation combinations, not just center distance.

### Camera Angle Psychology (2026-02-16)
**Problem**: Initial camera elevations were too steep (bird's-eye), undermining the "admire from outside" design principle.
**Solution**: Lower angles (overview: 0.45 rad/26deg, inspect: 0.38 rad/22deg) create dramatic, monumental feel. Eye-level > bird's-eye for emotional impact.
**Key Insight**: Camera angle is a design decision, not a technical one — it communicates the relationship between player and object.

### Soft Magnetic Zoom Beats Hard Tier Snapping (2026-02-13)
**Problem**: Hard-snapping zoom to fixed tiers (40/18/8) on pinch release felt broken — users zoom to 25, it snaps back to 40.
**Solution**: Free zoom with soft magnetic pull near tier centers:
```typescript
function applySoftMagnetic(zoom: number): number {
  const tiers = [8, 18, 40];
  for (const tier of tiers) {
    const dist = Math.abs(zoom - tier);
    if (dist < 2.5 && dist > 0.1) return zoom + (tier - zoom) * 0.03;
  }
  return zoom;
}
```
**Key Insight**: Soft attraction feels natural; hard snapping feels hostile. Use dual lerp (fast 0.14 for interactive, slow 0.045 for transitions).

### Mobile 3D Camera Feel Best Practices (2026-02-12)
**Problem**: Basic lerp-only camera orbit felt sluggish and unresponsive on mobile.
**Solution**: (1) Momentum with friction decay 0.92 after release, (2) Higher sensitivity 0.006 rad/px, (3) Snappy lerp 0.12, (4) Kill momentum on programmatic moves.
**Key Insight**: Inertia and friction make a 3D camera feel physical; the right sensitivity/lerp values must be tuned empirically.

### PanResponder Touch Coordinate Reliability (2026-02-16)
**Problem**: `locationY` (component-relative) is unreliable in PanResponder on Animated views — coordinate system shifts during animations.
**Solution**: Use `pageY` (absolute screen coords) + `measureInWindow` to get container's absolute position once on layout. All touch math uses stable page coordinates.
**Key Insight**: Never trust component-relative coordinates in animated contexts — always use absolute page coordinates.

### Interactive UI Stealing Gestures from 3D Scene (2026-02-16)
**Problem**: LayerIndicator needed to prevent TowerScene's PanResponder from stealing touches mid-scrub.
**Solution**: `onPanResponderTerminationRequest: () => false` in LayerIndicator's PanResponder — parent can't steal once child claims the gesture.
**Key Insight**: Nested PanResponders require explicit termination control; the default allows parent to steal.

### Gesture Handler + R3F Canvas Touch Conflicts (2026-02-12)
**Problem**: `onStartShouldSetPanResponder: () => true` captures all touches immediately, preventing R3F Canvas from receiving taps for raycasting/onClick.
**Solution**: Use `onStartShouldSetPanResponder: () => false` and `onMoveShouldSetPanResponder` with a drag threshold (6px). Taps pass through to R3F, drags captured for orbit.
```typescript
PanResponder.create({
  onStartShouldSetPanResponder: () => false,
  onMoveShouldSetPanResponder: (_, gesture) =>
    Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
});
```
**Key Insight**: Let taps through by deferring PanResponder capture to move phase; use a drag threshold to distinguish taps from drags.

### GestureHandlerRootView Required (2026-02-12)
**Problem**: `GestureDetector must be used as a descendant of GestureHandlerRootView` runtime error.
**Solution**: Wrap root layout with `GestureHandlerRootView style={{ flex: 1 }}`.
**Key Insight**: This is a one-time setup — must be in the root layout before any gesture detectors work.

---

## Shaders & 3D Rendering

### Three.js Clock: getElapsedTime() Consumes getDelta() (2026-03-04)
**Problem**: Calling `clock.getElapsedTime()` then `clock.getDelta()` in the same frame always returns ~0 for getDelta. Internally, `getElapsedTime()` calls `getDelta()` which updates `oldTime`. The second `getDelta()` sees no time has passed. Result: any frame-delta-dependent logic (timers, countdowns) silently breaks.
**Solution**: Call `getDelta()` first, then read `clock.elapsedTime` (property, not method): `const dt = clock.getDelta(); const t = clock.elapsedTime;`. Or track dt manually with a `prevTime` variable.
**Key Insight**: Three.js Clock methods have hidden side effects — `getElapsedTime()` mutates the same internal state as `getDelta()`. Never call both methods in the same frame; use the property `clock.elapsedTime` after `getDelta()`.

### Mouse Displacement on 3D Scenes — Use Vertical Plane, Not Camera-Facing (2026-03-04)
**Problem**: Raycasting mouse position onto a camera-facing plane (`normal.applyQuaternion(camera.quaternion)`) causes the intersection point to project behind the tower — hovering the front pushes blocks on the back. Also, using `mA *= 0.97` decay means displacement springs back even while mouse is stationary over the scene.
**Solution**: Use a vertical plane aligned to camera's horizontal direction only: `camera.getWorldDirection(dir); dir.y = 0; dir.normalize()`. For sticky hover, track `mouseInViewport` flag — only decay `mA` on `mouseleave`/`touchend`, not every frame.
**Key Insight**: For mouse-reactive 3D scenes, the ray-plane intersection plane should be axis-aligned (not camera-rotated), and displacement should persist while the mouse is in the viewport — decay only on exit.

### SDF Faces on Instanced Blocks — Reuse Existing Varyings (2026-03-03)
**Problem**: Adding kawaii faces to 650+ instanced blocks could require new uniforms/attributes for per-block randomness and UV mapping. New attributes mean new typed arrays, geometry setup changes, and per-frame `needsUpdate` calls.
**Solution**: `renderFace()` uses only existing varyings: `vFaceUV` (already computed per-face in vertex shader), `vInstanceOffset` (unique per block), `uTime` (global). Per-block blink randomness via `hash21(vec2(instanceOff, seed))` — 4x cheaper than `noise2D`. LOD gate with `smoothstep(35.0, 25.0, vDist)` skips face rendering when blocks are sub-pixel. Total cost: ~18 ALU ops (trivial vs interior mapping's 100+).
**Key Insight**: Before adding new shader attributes, check if existing varyings (`vInstanceOffset`, `vFaceUV`, `vWorldNormal`) already provide what you need. `hash21` with offset seeds gives cheap per-instance randomness without new data.

### Squash-Stretch on InstancedMesh — Clone the Poke Pattern (2026-03-03)
**Problem**: Adding charge bounce required manipulating instance matrices during the charge flash loop, but the flash loop only modified color/energy attributes. Matrix manipulation needs position, scale, rotation from layout data, plus volume preservation math.
**Solution**: Clone the existing poke bounce pattern (which already does shake + pop-up via `tempObjRef` → `setMatrixAt`). Key additions: volume-preserving scale (`scaleXZ = 2.0 - scaleY`), bottom-anchoring (`y += (scaleY - 1.0) * halfHeight`), and matrix restore on flash completion. Must restore matrix in BOTH the active branch (when t > 0.5s, stop modifying) AND the completion branch.
**Key Insight**: When adding new matrix animations to InstancedMesh, find the existing pattern that does matrix manipulation (poke, pop-out) and replicate its restore logic exactly. Missing the restore = blocks stuck at wrong scale.

### Energy-Tiered Shader Branching — Use `if/else` Not Smoothstep Blending (2026-03-03)
**Problem**: The original pulse was a single `sin(uTime * pulseSpeed)` with pulseSpeed linearly interpolated from energy. This gave all blocks the same "feel" just faster/slower. Wanted distinct emotional states (warm confident vs cold sparking) but blending between tints with smoothstep would create mushy transitions and cost extra ALU ops.
**Solution**: Use discrete `if/else if` branches on energy thresholds (0.8/0.5/0.2/0.01). Each branch has its own frequency, amplitude, and tint. On InstancedMesh, all instances in the same draw call hit GPU branching, but since energy values cluster (most blocks are 50-80%), branch coherence is high. The hash21-based dying sparks (15% chance per frame) are cheaper than a sine wave.
**Key Insight**: For per-instance visual variety in shaders, discrete emotional tiers with hard thresholds read better than smooth interpolation. Players see "my block is dying" not "my block is 23% alive."

### Per-Instance Attributes for Evolution Tiers — Buffer Lifecycle (2026-03-01)
**Problem**: Adding `aEvolutionTier` as a new instanced buffer attribute to the existing InstancedMesh required coordinating: (1) vertex shader declaration, (2) varying to pass to fragment, (3) Float32Array creation sized to instance count, (4) per-block write in the attribute update loop, (5) `needsUpdate = true` on each frame's attribute cycle.
**Solution**: Follow the exact pattern of existing instanced attributes (aEnergy, aOwnerColor, etc.): declare in vertex, pass via varying, create typed array in the geometry setup useMemo, write in the blockData update loop, mark needsUpdate alongside siblings. The marginal cost of one additional float per instance (~2.6KB for 650 blocks) is negligible.
**Key Insight**: When adding a new per-instance attribute to an existing InstancedMesh, grep for an existing attribute name (e.g., `aEnergy`) and replicate its lifecycle in all 5 locations. Missing any one location results in all-zero data or stale values with no error.

### All New Shaders Must Use `highp` for `uTime` (2026-03-01)
**Problem**: The holographic pop-out shader used `precision mediump float;` with `uniform float uTime;`. On mobile GPUs with float16 mediump, `sin(uTime * N)` returns garbage after ~10 minutes of play because float16 precision degrades for large values.
**Solution**: Always declare `uniform highp float uTime;` in every shader that receives an unbounded time value. The main block shader and glow shader already had this — the new holographic shader was missing it.
**Key Insight**: Every new shader added to the project MUST override `uTime` to `highp`. This is the #1 mobile shader gotcha. Add a search for `uniform float uTime` (without highp) to any shader review checklist.

### BlockMeta Must Include All Fields Used in useFrame (2026-03-01)
**Problem**: Added `imageUrl` to `DemoBlock` in the store but forgot to include it in the `BlockMeta` interface and `blockData` useMemo in TowerGrid. The `blockData.find()` returned objects without `imageUrl`, making the entire holographic image display feature silently broken — no runtime error, just always `undefined`.
**Solution**: When adding a new field to `DemoBlock` that will be consumed by TowerGrid's useFrame, also add it to the `BlockMeta` interface AND the `blockData` push in the useMemo. The "Change Block data shape" entry in CONTEXT.md's dependency table should be updated to include `TowerGrid.tsx BlockMeta`.
**Key Insight**: `blockData` is a separate projection of `demoBlocks` — it is NOT the same array. Any field not explicitly copied is lost. Always check both the interface AND the useMemo when adding block fields.

### Cylindrical UV Seams — Use Triplanar Mapping for Multi-Face Geometry (2026-02-27)
**Problem**: Cylindrical UV mapping with `atan(pos.x, pos.z)` in the vertex shader creates a visible seam where vertices straddle the -π/+π wrap point — the GPU linearly interpolates, smearing the texture across the entire polygon. On top/bottom faces, cylindrical UVs create radial line artifacts from the center.
**Solution**: Use triplanar mapping — blend 3 planar projections (XZ, XY, YZ) weighted by `abs(normal)`. No atan, no seams, no radial artifacts. Works perfectly for cylinders, pedestals, any multi-face geometry. If cylindrical UVs are needed, compute `atan()` per-pixel in the fragment shader (not vertex) to avoid interpolation across the wrap.
**Key Insight**: Triplanar mapping is the cleanest UV solution for procedural geometry with mixed face orientations — avoids all atan seam/radial issues at the cost of 3 texture lookups (or 1 with blended UVs).

### wawa-vfx Burst Emitters Auto-Fire on Mount — Always Set autoStart={false} (2026-02-27)
**Problem**: 8 VFXEmitter components with `spawnMode: "burst"` fired immediately when `ConditionalClaimVFX` mounted (at `cinematicMode = true`, T+0). All particles exploded at the start of the celebration, then fired AGAIN when `emitAtPos()` was called at impact. Double-fire.
**Solution**: Add `autoStart={false}` to every VFXEmitter. Only trigger via `emitAtPos()` / `startEmitting()` in the useFrame callback at the correct elapsed time.
**Key Insight**: wawa-vfx burst emitters default to firing on mount. Any emitter controlled by imperative timing MUST have `autoStart={false}`, especially when the parent component mounts before the intended fire time.

### GLSL Voronoi: hash21() Returns float, Not vec2 (2026-02-21)
**Problem**: Crystal style used a Voronoi cell loop with `vec2 point = hash21(nc) * vec2(0.8, 0.8)` — `hash21()` returns `float`, so multiplying by `vec2` caused a GLSL type error and compiled to black blocks at runtime.
**Solution**: Call `hash21` twice with offset seeds to get two independent floats for x/y:
```glsl
float hx = hash21(nc);
float hy = hash21(nc + vec2(127.0, 311.0));
vec2 point = vec2(hx, hy) * 0.8 - 0.4;
```
**Key Insight**: GLSL `hash21()` (vec2→float) vs `hash22()` (vec2→vec2) — always check return type before using in vec2 context; a black shader is often a type error, not a logic error.

### R3F Custom Shaders — All Lights Are Baked (2026-02-16)
**Problem**: Added opaque TowerCore mesh for interior depth, but it created a dark void — R3F light components have zero effect because every mesh uses custom ShaderMaterial without `lights: true`.
**Solution**: Replace opaque geometry with additive-blended warm glow:
```typescript
transparent: true, depthWrite: false,
side: THREE.BackSide, blending: THREE.AdditiveBlending,
// Fragment: ember/amber/gold gradient with edge fade + breathing pulse
```
**Key Insight**: Additive blending only adds light, never darkens — safe for interior glow. `depthWrite: false` prevents z-fighting.

### R3F InstancedMesh — Child Geometry for Raycasting (2026-02-15)
**Problem**: Passing geometry via `args` on a self-closing `<instancedMesh>` breaks R3F raycasting/onClick.
**Solution**: Always use child `<boxGeometry>` for click-handling meshes. Visual-only meshes can use `args` geometry.
```tsx
<instancedMesh ref={hitRef} args={[undefined, undefined, count]} onClick={handleClick}>
  <boxGeometry args={[size, size, size]} />
</instancedMesh>
```
**Key Insight**: R3F raycasting requires child-declarative geometry; `args`-passed geometry doesn't register in the raycasting system.

### Shader Coordinate Space Confusion — Local vs World (2026-02-18)
**Problem**: Using `vWorldNormal` (world-space) to decide how to read `vLocalPos` (local-space) causes mismatch after instance rotation.
**Solution**: Compute face UVs in vertex shader using raw `normal` (local-space) before any transforms. Each face uses correct tangent axes.
**Key Insight**: Never mix coordinate spaces — if positions are local, normals must also be local.

### Interior Mapping for 3D Depth Illusion (2026-02-18)
**Problem**: Flat images on block faces lacked depth and visual interest.
**Solution**: Cast ray from camera through fragment into virtual room. Ray hits "back wall" at depth 0.55, creating parallax with camera movement. Apply on all 4 vertical faces. Add depth darkening, window frame mask, scanlines, chromatic aberration.
**Key Insight**: Interior mapping fakes 3D rooms on flat surfaces using only ray-box math in the fragment shader — no extra geometry needed.

### Highlight Visibility on Image Blocks (2026-02-18)
**Problem**: Standard emissive highlight (additive glow + brightness multiply) washes out images on selected blocks.
**Solution**: Branch by `vImageIndex` — image blocks get rim-only highlight (no flat emissive), non-image blocks get full highlight.
**Key Insight**: Selection feedback must adapt to content type — what works for solid colors destroys legibility on images.

### Block Pop-Out Direction for Rectangular Tower (2026-02-18)
**Problem**: Using `mat3(instanceMatrix) * vec3(0,0,1)` for pop-out fails on corners — they push toward +Z instead of diagonally outward.
**Solution**: Radial direction from tower center: `normalize(vec3(worldPos.x, 0, worldPos.z))`. Works for all faces including corners.
**Key Insight**: For non-cylindrical geometry, radial outward from the Y-axis is more robust than local face normals for pop-out effects.

### React Native Texture Loading — DataTexture Workaround (2026-02-18)
**Problem**: `THREE.TextureLoader` fails in React Native (no DOM Image). expo-three's `loadAsync` unreliable on device.
**Solution**: Pre-encode atlas as base64 RGBA bytes (1.4MB string) into a `THREE.DataTexture`. Include manual base64 decoder as `atob()` fallback.
**Key Insight**: Bypass all image loading APIs entirely — raw byte data into DataTexture is 100% reliable in React Native.

### InstancedMesh for 1000+ Blocks (2026-02-10)
**Problem**: Individual meshes for 1000+ blocks yielded ~5 FPS.
**Solution**: `InstancedMesh` reduces draw calls from 1000 to 1, achieving 60 FPS.
**Key Insight**: Instancing is mandatory for large block counts on mobile — batch everything into a single draw call.

---

## Multiplayer & Networking

### Always Reuse serializeBlock for block_update Broadcasts (2026-03-01)
**Problem**: The image upload REST endpoint in `index.ts` hand-rolled a block serialization object for `room.broadcast("block_update", ...)` instead of reusing the existing `serializeBlock()` from TowerRoom. This caused a subtle divergence: `serializeBlock` normalizes empty `imageUrl` to `undefined`, but the inline version passed it raw. The `blink-poke.ts` handler had a similar copy that omitted `imageUrl` entirely, causing image data loss on pokes.
**Solution**: Export `serializeBlock()` and `blockToRow()` from TowerRoom. All `block_update` broadcasts use `{ ...serializeBlock(block), eventType: "..." }`. All persistence uses `upsertBlock(blockToRow(block))`.
**Key Insight**: Block serialization is a central concern with ~6 call sites. Any new endpoint that touches blocks MUST use the shared helpers, not inline copies. The diff check in `multiplayer-store.ts` must also include every field in the serialized shape.

### Colyseus matchMaker.getRoomById() Returns a Proxy, Not the Room (2026-02-27)
**Problem**: Tried to call `broadcast()` and iterate `clients` on the object returned by `matchMaker.getRoomById()` — it returns a proxy/wrapper, not the actual `Room` instance. Broadcasts silently did nothing.
**Solution**: Store a module-level `activeRoom` reference directly: set it in `onCreate`, clear in `onDispose`, export via `getActiveRoom()`. External code (like blink-poke.ts) uses this direct reference.
**Key Insight**: When external code needs to interact with a live Colyseus room (broadcast, iterate clients), use a direct room reference — not the matchMaker API.

### Early-Return Optimization Can Skip Event Effects (2026-02-27)
**Problem**: `applySingleBlockUpdate` had an early-return when block data hadn't changed (energy/owner/color all equal). But poke broadcasts include `eventType: "poke"` which should trigger shake VFX even when energy is already at max (no data change). The early-return skipped all visual effects.
**Solution**: Restructure: compute `dataChanged` boolean, update store only if changed, but only early-return if `!dataChanged && !serverBlock.eventType`. Event effects always fire regardless of data changes.
**Key Insight**: When server messages carry both data updates AND event triggers, never early-return on "no data changed" without checking for event metadata first.

### Client Must Send Wallet on joinOrCreate for Targeted Messages (2026-02-27)
**Problem**: `poke_received` messages were sent to clients matching `_wallet === block.owner`, but the client called `joinOrCreate("tower")` with no options — `_wallet` was never set. Targeted messages silently reached nobody.
**Solution**: Pass wallet in room options: `joinOrCreate("tower", wallet ? { wallet } : undefined)`. Server sets `(client as any)._wallet = options.wallet` in `onJoin`.
**Key Insight**: If server-side code targets specific clients by property (wallet, userId), that property must be passed during `joinOrCreate` — it's not automatically available.

### Skip Client VFX During Cinematic Mode to Prevent Doubles (2026-02-26)
**Problem**: Client fires `triggerCelebration()` optimistically on claim, which enters cinematic mode. Then server broadcasts `block_update` with `eventType: "claim"` → `setRecentlyClaimedId()` → second gold flash on the block, doubling the VFX.
**Solution**: In multiplayer-store's `block_update` handler, check `if (!towerStore.cinematicMode)` before calling `setRecentlyClaimedId`. During cinematic mode, the celebration VFX already handles all visual feedback.
**Key Insight**: When optimistic client actions trigger VFX AND server broadcasts trigger the same VFX, gate the server-side trigger on the client's animation state.

### Remove XP From Farmable Actions (2026-02-26)
**Problem**: Customization awarded 10 XP per change with no cooldown or dedup. Players could spam color changes to farm unlimited XP. Both client (demo mode) and server awarded XP independently.
**Solution**: Removed XP from customization entirely — both `useBlockActions.ts` (client) and `TowerRoom.ts` (server). The `onCustomizeResult` callback is now a no-op. Customization should be free and expressive, not a points loop.
**Key Insight**: Any action that's free, instant, and repeatable should NEVER award XP/points. Gate rewards behind cooldowns (charge), real cost (claim), or social interaction (poke).

### Result Callbacks Must Be Registered, Not Just Imported (2026-02-21)
**Problem**: `onCustomizeResult` was imported and the `CustomizeResult` type was used — TypeScript was happy — but the callback was never actually *called* to register it. Server correctly sent `customize_result` with XP, but `customizeResultCallback` was always `null`, silently dropping the XP animation.
**Solution**: In the `useEffect` that registers `onChargeResult` and `onClaimResult`, add `onCustomizeResult` too. Also import the type explicitly: `import type { ..., CustomizeResult }`.
**Key Insight**: Callback-registration patterns (module-level refs + setter functions) can silently no-op if the registration call is forgotten — TypeScript won't catch it since the import is used for the type.

### Multiplayer Block Positions Must Be Computed Client-Side (2026-02-17)
**Problem**: Camera fly-to-block read `block.position` from the store, but in multiplayer mode `serverBlockToDemo()` set `position: {0,0,0}` because "TowerGrid computes from layout." Clicking any block flew camera to world origin.
**Solution**: Pre-compute positions in a cache at connect time using shared `@monolith/common` layout functions:
```typescript
const positionCache = new Map<string, {x,y,z}>();
// Build once from computeBodyLayerPositions / computeSpireLayerPositions
// Use: position: getBlockPosition(block.layer, block.index)
```
**Key Insight**: All position-consuming code should read from a single source of truth — compute once at store boundaries, cache, and use everywhere.

### Colyseus JSON Messages > Schema Auto-Sync (2026-02-17)
**Problem**: Schema auto-sync (`MapSchema<BlockSchema>`) failed silently — blocks decoded with `size: 0` due to `@colyseus/schema` version mismatch between server and client.
**Solution**: Explicit JSON room messages: `room.send("tower_state", {...})` for full state + `room.send("block_update", blockJSON)` for mutations. Client uses `room.onMessage()` handlers.
**Key Insight**: For MVP multiplayer, JSON messages are debuggable and version-stable; schema auto-sync breaks silently across version boundaries.

---

## Solana & Anchor

### SOAR SDK: Dual SoarProgram Pattern for Authority-Signed Submissions (2026-02-27)
**Problem**: `submitScoreToLeaderBoard` and `unlockPlayerAchievement` require TWO signers: `payer` (from the SDK provider's wallet) and `authority`. Creating `SoarProgram.getFromConnection(conn, playerWallet)` made the player the payer — but we only signed with the authority keypair. Result: "Signature verification failed. Missing signature for public key [player]".
**Solution**: Use two SoarProgram instances: `getSoarForAuthority()` (authority = provider wallet = payer = signer, for score/achievement submission with no MWA popup) and `getSoarForPlayer()` (player = provider wallet, for init txs that go through MWA signing).
**Key Insight**: The SOAR SDK sets `payer = provider.wallet`. When you need authority-only signing, make the authority the provider wallet so it's both payer and authority signer. The player pubkey is only used for PDA derivation (not a signer) in score submissions.

### JavaScript Truthy Check on Numeric Fields Skips Zero (2026-02-27)
**Problem**: `if (result.totalXp)` was used to guard SOAR score submission in 3 multiplayer result handlers. When a player's XP was 0 (new player, or edge case), the guard evaluated to `false` and silently skipped all SOAR calls. No logs, no errors — just silent no-ops.
**Solution**: Changed to `if (result.totalXp != null)` which correctly passes for `0` while still guarding against `undefined`/`null`.
**Key Insight**: Never use truthy checks on numeric fields that can legitimately be 0. Use `!= null` (catches both null and undefined) or `!== undefined` for proper null guards.

### Solana Blinks: SPL Memo v2 Requires All Keys to Be Signers (2026-02-27)
**Problem**: Added `MONOLITH_PROGRAM_ID` as a read-only non-signer key in the memo instruction (as a marker for future tx detection). Phantom wallet threw "WalletSendTransactionError: Unexpected error" on sign.
**Solution**: Remove non-signer accounts from memo instruction keys. SPL Memo v2 program validates that ALL accounts in the keys array are signers — no exceptions.
**Key Insight**: SPL Memo v2 is strict: every account in `keys[]` must be `isSigner: true`. Use the memo `data` field for metadata, not extra accounts.

### Solana Blinks: createActionHeaders Required for dial.to (2026-02-27)
**Problem**: Used `ACTIONS_CORS_HEADERS` from `@solana/actions` for CORS headers. dial.to returned "page failed to respond" — it requires `X-Action-Version` and `X-Blockchain-Ids` headers that `ACTIONS_CORS_HEADERS` doesn't include.
**Solution**: Use `createActionHeaders({ chainId: "devnet", actionVersion: "2.2.1" })` instead. This generates the full spec-compliant header set including the version and chain ID fields.
**Key Insight**: `ACTIONS_CORS_HEADERS` is just CORS. `createActionHeaders()` adds the Solana Actions spec headers that renderers (dial.to) actually validate.

### Solana Blinks: Express Middleware Order Matters for CORS (2026-02-27)
**Problem**: Express global `cors()` middleware intercepted OPTIONS preflight before the blinks router, returning minimal CORS headers without Solana-spec fields. dial.to rejected the response.
**Solution**: Mount the blinks router BEFORE `app.use(cors())` so blinks routes handle their own OPTIONS with full Solana headers.
**Key Insight**: When a specific route needs custom CORS headers (like Solana Actions spec), mount its router before any global CORS middleware.

### BorshAccountsCoder Incompatibility with React Native (2026-02-13)
**Problem**: Anchor's `BorshAccountsCoder.decode()` uses Node.js `Buffer.readUIntLE()` which doesn't exist in React Native's Buffer polyfill.
**Solution**: Manual byte-level decoding using `DataView` and `Uint8Array`:
```typescript
function readU64(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getUint32(offset + 4, true) * 0x100000000 + view.getUint32(offset, true);
}
```
**Key Insight**: Map Rust struct byte layouts exactly. Use `DataView` for integers, `Uint8Array.slice()` for pubkeys — no Buffer methods needed.

### MWA Auth Token Expiration — Always Fallback to Fresh Authorize (2026-02-17)
**Problem**: `wallet.reauthorize({ auth_token })` fails when cached token is stale/expired. Transaction signing path had no fallback.
**Solution**: Wrap `transact()` in try/catch — if `reauthorize()` fails with auth error, retry with `wallet.authorize()` (fresh approval).
**Key Insight**: Any code path using MWA `reauthorize()` MUST have a fallback to `authorize()` — auth tokens are not reliable across sessions.

### Public Devnet RPC Is Rate-Limited (2026-02-17)
**Problem**: `api.devnet.solana.com` frequently returns 500/429 errors, killing deposit flows.
**Solution**: `withRetry()` helper with up to 3 retries and linear backoff (1s, 2s) for `getLatestBlockhash`, `sendRawTransaction`, `confirmTransaction`.
**Key Insight**: Always wrap Solana RPC calls in retry logic — even paid providers return transient errors.

### Anchor 0.31 SPL Token Types (2026-02-12)
**Problem**: Using plain `Account<TokenAccount>` caused silent IDL generation failures in Anchor 0.31.
**Solution**: Must use `InterfaceAccount<TokenAccount>`, `InterfaceAccount<Mint>`, and `Interface<TokenInterface>`. Add `idl-build` feature for `anchor-spl` in `Cargo.toml`. Use `transfer_checked` (requires mint + decimals). All ATA accounts need `associated_token::token_program = token_program` constraint.
**Key Insight**: Anchor 0.31 SPL integration requires Interface types, not plain Account types — failures are silent.

### Program ID Sync After Anchor Build (2026-02-12)
**Problem**: Deployed keypair in `target/deploy/` may differ from `declare_id!()` after `anchor build`, causing `DeclaredProgramIdMismatch`.
**Solution**: Run `anchor keys sync` to update `lib.rs` and `Anchor.toml` automatically.
**Key Insight**: Always `anchor keys sync` after builds to prevent program ID drift.

### Dynamic IDL TypeScript Casts (2026-02-12)
**Problem**: Anchor 0.31 TS types don't expose account names from dynamically loaded IDLs.
**Solution**: Use `(program.account as any).towerState` — works at runtime, needs TS bypass.
**Key Insight**: Dynamic IDL loading in Anchor requires `as any` casts for account access.

### MWA Protocol Basics (2026-02-10)
**Problem**: Understanding how MWA integrates with dApps.
**Solution**: MWA works via Android intents (`solana-wallet://`). The dApp never touches private keys — dispatches intent, wallet signs, returns signed tx. Seed Vault is wallet-level, not dApp-level. For Anchor, create a custom wallet adapter wrapping `transact()`. Cache auth tokens in `expo-secure-store` (encrypted).
**Key Insight**: MWA is intent-based — the dApp is stateless regarding keys; all signing is delegated to the wallet app.

### MWA Transaction Signing Flow (2026-02-12)
**Problem**: Getting the full MWA signing flow right inside `transact()` sessions.
**Solution**: Always try `reauthorize()` first with cached `authToken`, fall back to `authorize()`. Set fee payer from `authResult.accounts[0].address` (base64). Fetch `recentBlockhash` inside session, send raw tx after closing.
**Key Insight**: The entire sign flow must happen inside a single `transact()` session — blockhash fetching included.

---

## React Native & Expo

### expo-audio initAudio Must Isolate setAudioModeAsync (2026-02-27)
**Problem**: No sounds played at all — only haptics worked. `initAudio()` wrapped `setAudioModeAsync`, `setIsAudioActiveAsync`, and all 17 `loadPlayer` calls in ONE try/catch. On Android, `setAudioModeAsync({ playsInSilentMode: true })` passes all `undefined` values to the native module (playsInSilentMode is iOS-only). If the native module rejects, the entire init fails silently — `audioAvailable` stays false, no players load.
**Solution**: Wrap `setAudioModeAsync` + `setIsAudioActiveAsync` in their own try/catch (best-effort). Add `interruptionMode: "mixWithOthers"` for proper Android audio session. Set `audioAvailable = true` before player loading. Add `console.warn` to all catch blocks.
**Key Insight**: Audio mode configuration is platform-specific and can fail — never let it gate player loading. Isolate setup steps in separate try/catch blocks, and ALWAYS log errors from catch blocks in init functions.

### expo-audio: seekTo(0) on Finished Player Causes Infinite Loop (2026-02-23)
**Problem**: Adding a `playbackStatusUpdate` listener that calls `seekTo(0)` when `didJustFinish` fires triggers expo-audio to auto-play again — creating an infinite playback loop.
**Solution**: Remove the listener entirely. Use fire-and-forget: `player.seekTo(0).catch(()=>{})` immediately followed by `player.play()`. Both calls queue to the same native player in FIFO order, so seek always completes before play executes.
**Key Insight**: Native audio player operations queue per-player — fire-and-forget seekTo + play is both safe and zero-latency. Never use status listeners to reset playback position.

### expo-audio Plugin Must Be in app.json (2026-02-23)
**Problem**: `expo-audio` in `package.json` is not enough — without `"expo-audio"` in the `plugins` array in `app.json`, the native module never links. All `import("expo-audio")` calls silently fail at runtime, `audioAvailable` stays false, and every sound is a no-op.
**Solution**: Add `"expo-audio"` to the `plugins` array in `app.json`, then do a full native rebuild (`npx expo run:android`).
**Key Insight**: Every Expo module with a native component requires both a package install AND a plugin entry in `app.json` to link correctly.

### Expo Go vs Dev-Client (2026-02-10)
**Problem**: Expo Go cannot run native modules like MWA.
**Solution**: Must use development build (`expo-dev-client`). Package must be installed AND listed in `app.json` plugins.
**Key Insight**: Any Solana Mobile feature requires `expo-dev-client` — Expo Go is insufficient.

### Expo Router Typed Routes (2026-02-12)
**Problem**: New route files cause TS errors until generated type declarations regenerate.
**Solution**: Use `pathname as any` cast or run `npx expo start` to regenerate types.
**Key Insight**: Expo Router types are generated — they lag behind new file creation.

### Metro + Hoisted Deps in Monorepos (2026-02-10)
**Problem**: With `node-linker=hoisted`, Metro can't resolve hoisted dependencies on EAS or release builds.
**Solution**: Set `nodeModulesPaths` in Metro config pointing to both monorepo root and app-level `node_modules/`.
**Key Insight**: Metro needs explicit paths to all potential `node_modules` locations in a hoisted monorepo.

### Debug APK for Device Testing (2026-02-10)
**Problem**: `npx expo run:android --variant release` fails in monorepos because Gradle resolves `index.js` from monorepo root.
**Solution**: Use debug APK for device testing — works identically on physical devices. Use `npx expo run:android` + `npx expo start --dev-client` for hot reload.
**Key Insight**: Debug APKs are perfectly fine for device testing; save EAS/release builds for distribution.

---

## Performance

### Dirty-Flag Zustand Updates — Mutate In-Place, New Ref Only (2026-02-25)
**Problem**: `decayTick()` ran `demoBlocks.map(b => b.owner && b.energy > 0 ? { ...b, energy: ... } : b)` every 60s — creating 650 new objects even though only ~400 blocks had decayable energy. Every new object triggered downstream `===` checks to fail, causing full attribute rebuilds for all 650 blocks in TowerGrid.
**Solution**: Mutate `energy` in-place on existing objects, then `set({ demoBlocks: [...blocks] })` to trigger React with a new array reference but reused objects. Blocks that didn't change keep the same object reference, so downstream `===` checks skip them.
**Key Insight**: When only a single field changes on many objects, mutate in-place and create a new container reference. This lets consumers do cheap `===` identity checks to skip unchanged items.

### useFrame Idle Skip — Guard 650-Element Loops with Dirty Flags (2026-02-25)
**Problem**: TowerGrid's `useFrame` ran three 650-element loops (fade, highlight, pop-out) every frame even when no block was selected and no animation was active. At idle, this was pure wasted CPU.
**Solution**: Add `fadeAnimatingRef` and `popAnimatingRef` boolean refs. Set `true` when `selectedBlockId` changes (new targets set), set `false` when the animation loop finds no deltas > 0.001. When `false`, skip the entire loop body — useFrame cost drops to near-zero at idle.
**Key Insight**: Any per-frame loop over N items should be gated by a dirty flag. Set the flag when targets change, clear it when convergence is detected.

### Single-Block Matrix Restore Instead of Full Rebuild (2026-02-25)
**Problem**: When a block was deselected, pop-out animation would detect `popCur.every(v => v < 0.001)` and restore ALL 650 block matrices — 3 meshes × 650 = 1950 `setMatrixAt` calls + `updateMatrix` for a single block returning to its home position.
**Solution**: Track `lastPoppedIndexRef`. On deselection convergence, restore only that one block's matrix across main + hit + glow meshes (3 calls instead of 1950).
**Key Insight**: Track the minimal dirty set. If only one item was modified, only restore that one item — don't scan or rebuild the entire collection.

### mediump uTime Causes Progressive Lag on Mobile (2026-02-23)
**Problem**: Tower got progressively laggier the longer it ran — shaders and lights degraded over ~10 minutes. Root cause: fragment shaders used `precision mediump float` (float16 on mobile GPUs) and `uTime` grew unboundedly. At `uTime ≈ 600` (~10 min), `sin(uTime * 4.0) = sin(2400)` has mediump precision of ±2 — results are garbage. GPU computes meaningless values, causing visual artifacts and frame stalls.
**Solution**: Declare time uniforms with explicit highp override while keeping everything else mediump:
```glsl
precision mediump float;  // 2x GPU throughput for color math
uniform highp float uTime; // time grows unboundedly — must be precise
```
**Key Insight**: Any uniform that grows over time (elapsed seconds, frame count) MUST use `highp` in mediump shaders. mediump float16 has only ~3 decimal digits of precision — values above ~500 make `sin()`/`cos()` produce random noise. This is invisible during short test sessions but guaranteed to break after 10+ minutes.

### Batch Store Updates — Individual Calls Cascade (2026-02-23)
**Problem**: Bot simulation called `updateDemoBlock()` ~50 times per 15-second tick. Each call triggered: new demoBlocks array (650 spreads) → React re-render → blockData rebuild (650 objects) → attribute Float32Array rebuild (6 arrays). Over 30 minutes = ~6000 full cascades = millions of objects for GC.
**Solution**: Collect all changes in a `Map`, apply in a single `setDemoBlocks()` call. 50 cascades → 1 cascade per tick.
```typescript
// BEFORE: 50 individual calls per tick
for (const block of blocks) { updateBlock(block.id, changes); }
// AFTER: 1 batched call per tick
const changes = new Map();
for (const block of blocks) { changes.set(block.id, delta); }
setBlocks(blocks.map(b => changes.has(b.id) ? { ...b, ...changes.get(b.id) } : b));
```
**Key Insight**: Any loop that calls a Zustand setter N times triggers N re-render cascades. Always batch into one `set()` call.

### Avoid `new` Inside useFrame — GC Pressure Kills Mobile Perf (2026-02-23)
**Problem**: `new THREE.Color(0.8, 0.9, 1.0)` was created inside `useFrame` during charge flash animation — allocating a new object 60 times/sec for 1.2 seconds per charge. Over many charges, GC pressure caused frame drops.
**Solution**: Pre-allocate reusable objects in `useRef` and call `.set()` to reuse:
```typescript
// BEFORE (bad — allocates every frame):
const flashColor = new THREE.Color(0.8, 0.9, 1.0);
// AFTER (good — reuses ref):
const chargeFlashColorRef = useRef(new THREE.Color(0.8, 0.9, 1.0));
const flashColor = chargeFlashColorRef.current.set(0.8, 0.9, 1.0);
```
**Key Insight**: Never use `new` inside `useFrame`, `requestAnimationFrame`, or any per-frame callback. Pre-allocate Vector3, Color, Matrix4, Float32Array in refs. Same rule applies to `.clone()` — use `.copy()` instead.

### Mobile 3D Performance Budget (2026-02-15)
**Problem**: Need to understand the performance priority order for mobile GPUs.
**Solution**: Priority order: (1) Fragment shader ALU ops — most expensive (hex pattern 3x/fragment was biggest cost, replace with `fract()` cracks), (2) Triangle count — RoundedBoxGeometry segments=2 is 96 tri/block x 650 = 62K, halve with segments=1, (3) Light count — hemisphere replaces 2-3 fill lights, (4) Texture/noise lookups — FBM 4 octaves costs 25% more than 3 for <6% visual return, (5) Particle count — 120->80 saves draw overhead.
**Key Insight**: Shader ALU > triangles > lights > textures > particles — optimize in that order on mobile.

### Pop Animation Loop Must Detect External State Changes (2026-02-27)
**Problem**: After claim celebration, tower performance degraded permanently. The pop-out animation loop (650-block matrix recomputation every frame) never stopped. Root cause: celebration-end didn't re-trigger target-setting because `selectedBlockId` hadn't changed (still null), so the claimed block's `popOutTarget` stayed at 1.0 forever — converged but never cleaned up.
**Solution**: Added `prevCelActiveRef` to detect celebration state transitions in useFrame. When `isCelActive` goes true→false, explicitly reset all targets to 0. Also added a 3-second safety timeout that force-snaps all popCur to popTgt and stops the loop.
**Key Insight**: useFrame animation loops gated by `prevSelectedIdRef` miss state changes from OTHER sources (celebration refs). Track ALL state sources that set animation targets, and add safety timeouts for loops that iterate 650+ elements per frame.

---

## Deployment & DevOps

### REST Endpoints Need Room-Available Guards (2026-03-01)
**Problem**: The `POST /api/blocks/:blockId/image` endpoint only checked block ownership when `getActiveRoom()` returned non-null. If the room wasn't ready yet, the upload proceeded without any ownership verification — anyone could upload images to any block.
**Solution**: Treat `!room` as 503 Service Unavailable, rejecting the request. Also sanitize the `blockId` URL parameter with `/^[\w-]+$/` since it becomes a Supabase Storage file path.
**Key Insight**: Any REST endpoint that interacts with Colyseus room state MUST guard `getActiveRoom()` as a hard prerequisite, not an optional enhancement. The room is the authority for ownership/permissions.

### Shell Scripts in Monorepos: Use SCRIPT_DIR for All Paths (2026-02-24)
**Problem**: `dev.sh` used relative paths (`cd apps/server && pnpm dev &`). The `&` background operator combined with `&&` chained `cd` caused the main shell to lose its working directory — later `cd apps/mobile` failed with "No such file or directory".
**Solution**: Resolve `SCRIPT_DIR` at the top and use it for every path:
```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
(cd "$SCRIPT_DIR/apps/server" && pnpm dev) &   # subshell isolates cd
cd "$SCRIPT_DIR/apps/mobile" && npx expo start  # absolute path
```
**Key Insight**: In monorepo scripts, never use relative `cd` — resolve `SCRIPT_DIR` once and use absolute paths everywhere. Background commands must run in subshells `(cd ... && cmd) &` to avoid polluting the parent shell's cwd.

### pnpm Strict Isolation Breaks Transitive Deps in Docker (2026-02-17)
**Problem**: Server crashed on Railway with `Cannot find module '@colyseus/schema'` — a transitive dep of `colyseus`, not declared directly.
**Solution**: Declare ALL directly-imported packages in `package.json`, even transitive deps. Never add `pnpm install --prod` prune step with `--packages=external`. Check esbuild output: `grep 'require("' dist/index.js`.
**Key Insight**: esbuild `--packages=external` + pnpm strict isolation = every `require()` must be a direct dependency.

### Railway Deployment Gotchas (2026-02-17)
**Problem**: Multiple deployment issues with Colyseus on Railway.
**Solution**: (1) Server must read `process.env.PORT` not hardcode 2567, (2) Dockerfile at repo root with Railway root dir `/`, (3) External URL is standard `wss://` — no port in client URL, (4) `EXPOSE` is informational only, (5) Auto-deploys on push to main, (6) For pnpm: `corepack enable && corepack prepare` in Dockerfile.
**Key Insight**: Railway sets PORT dynamically and proxies connections — never hardcode ports or expose them in client URLs.

### eas.json Env Vars Override .env Files (2026-02-17)
**Problem**: `.env` had correct Alchemy RPC URL but `eas.json` `base.env` hardcoded the public devnet RPC. EAS builds used wrong RPC.
**Solution**: Keep RPC URLs consistent between `.env` (local dev) and `eas.json` (EAS builds).
**Key Insight**: `eas.json` env vars take precedence during EAS builds — always check both sources.

### Push Notifications on Android — FCM Is Required, But You Don't Touch It (2026-02-25)
**Problem**: `expo-notifications` throws "Default FirebaseApp is not initialized" on Android when calling `getExpoPushTokenAsync()`.
**Solution**: Add `google-services.json` (from Firebase Console) to `apps/mobile/` and set `"googleServicesFile": "./google-services.json"` in the `android` section of `app.json`. Requires a native EAS rebuild — OTA won't activate it.
**Key Insight**: FCM is the mandatory Android transport for all push notifications. You don't write any Firebase SDK code — the `expo-notifications` config plugin auto-injects the Gradle plugin and Firebase init during the build. On the sending side, use Expo's push API (`https://exp.host/--/api/v2/push/send`) — it routes to FCM/APNs transparently with a single token format. Gitignore `google-services.json` (contains API keys).

### EAS Build + pnpm (2026-02-10)
**Problem**: EAS Build defaults to yarn if no `packageManager` field exists in root `package.json`.
**Solution**: Add `"packageManager": "pnpm@<version>"` to root `package.json`. Also need a separate `.easignore` (not `.gitignore`) with critical exclusions: `.agents/`, `android/`, `ios/` dirs.
**Key Insight**: EAS needs explicit pnpm declaration and its own ignore file — it does not inherit git settings.

### Gitignore for Anchor Workspace (2026-02-12)
**Problem**: Anchor workspace at monorepo root means `target/` and `.anchor/` need root-level gitignore entries.
**Solution**: Add `target/` and `.anchor/` to root `.gitignore`, not just `programs/monolith/`.
**Key Insight**: Anchor outputs at workspace root regardless of program location.

### ADB Screencap Corruption (2026-02-10)
**Problem**: `adb exec-out screencap -p > file.png` in PowerShell corrupts PNG via UTF-16LE encoding.
**Solution**: `adb shell screencap -p /sdcard/screen.png && adb pull /sdcard/screen.png output.png`.
**Key Insight**: PowerShell's `>` operator mangles binary output — use two-step capture+pull.

### gh repo create Needs a Commit (2026-02-10)
**Problem**: `gh repo create --push` requires at least one commit to exist.
**Solution**: Always `git commit` first, then create repo with `--push`.
**Key Insight**: Git repos need at least one commit before they can push to a remote.

### WSL Migration for Performance (2026-02-11)
**Problem**: Windows NTFS through `/mnt/c` was 5-10x slower for Rust/Anchor builds, had 260-char path limits, and symlink issues.
**Solution**: Migrate to WSL Ubuntu 24.04 on native ext4. Use `usbipd-win` for USB device passthrough (`usbipd bind --busid X-X` persistent, `usbipd attach --wsl --busid X-X` per-session). VS Code "Remote - WSL" extension for IDE. Android SDK requires Java 17+, cmdline-tools, `ANDROID_HOME` env var.
**Key Insight**: WSL on native ext4 gives 8x faster Anchor builds, 3x faster pnpm, native symlinks, and no path limits.

### Windows PATH Leaks into WSL (2026-02-11)
**Problem**: `wsl -e bash -lc "..."` from Windows leaks Windows PATH with spaces, breaking bash exports.
**Solution**: Use `wsl -e bash -c "..."` (non-login shell) or run commands from within WSL directly.
**Key Insight**: Login shells in WSL inherit Windows PATH — use non-login shells when calling from Windows.

### pnpm Path Limits on Windows (2026-02-10)
**Problem**: pnpm's symlinked layout creates paths exceeding Windows' 250-char `CMAKE_OBJECT_PATH_MAX`.
**Solution**: Add `node-linker=hoisted` and `shamefully-hoist=true` to `.npmrc`. Also recommended by Expo for monorepo setups.
**Key Insight**: Hoisted node_modules avoids Windows path length limits and is Expo-recommended for monorepos.

---

## UI/UX & Design System

### Glassmorphism Over WebGL Canvas — Use @supports Fallback (2026-03-04)
**Problem**: `backdrop-filter: blur()` on HTML elements overlaying a `<canvas>` may not work in all browsers (canvas content isn't always part of the same compositing layer). Cards looked broken — no blur, no background, just floating text.
**Solution**: Add `@supports not (backdrop-filter:blur(1px))` fallback with a solid dark background (`rgba(5,7,16,0.85)`). Also include `-webkit-backdrop-filter` for Safari. The glassmorphism is progressive enhancement; the fallback ensures readability everywhere.
**Key Insight**: When using `backdrop-filter` over WebGL/canvas content, always provide a `@supports not` fallback with an opaque-enough background. Test in both Chrome and Safari — they composite differently.

### AchievementToast pointerEvents Must Change for Interactive Buttons (2026-03-03)
**Problem**: AchievementToast had `pointerEvents="none"` (set in a previous fix to prevent blocking tower taps). Adding a "Share" button inside the toast meant the button was untappable — `pointerEvents="none"` on the parent prevents ALL descendant touch events.
**Solution**: Changed to `pointerEvents="box-none"` — the container itself doesn't consume touches (tower taps pass through), but child views (the Share button) can receive them. This is the standard RN pattern for overlay containers with interactive children.
**Key Insight**: `pointerEvents="none"` = nothing in the subtree is touchable. `pointerEvents="box-none"` = container transparent to touches, children still interactive. Always use `box-none` when overlays have buttons.

### Absolute Overlays Block R3F Canvas Touches by Default (2026-02-27)
**Problem**: Tapping blocks did nothing — inspector never opened. LayerIndicator's PanResponder had `onStartShouldSetPanResponder: () => true`, stealing ALL taps in its 52px-wide zone. AchievementToast (zIndex 999, spanning center) had no `pointerEvents` prop, intercepting touches even when invisible (opacity=0).
**Solution**: LayerIndicator → `onStartShouldSetPanResponder: () => false` (only captures on drag via `onMoveShouldSetPanResponder`). AchievementToast → `pointerEvents="none"`. Verified FloatingPoints and LevelUpCelebration already had `pointerEvents="none"`.
**Key Insight**: Every absolute-positioned overlay above the R3F Canvas must explicitly set `pointerEvents="none"` or `"box-none"`. PanResponder `onStartShouldSetPanResponder: () => true` steals taps from everything underneath — use `() => false` if you only need drag gestures.

### Explain Game Mechanics Inline, Not in Tooltips (2026-02-26)
**Problem**: Players didn't understand the charge mechanic — "what happens if I don't charge?" Energy decay and the dormant reclaim risk weren't surfaced anywhere in the UI. Users ignored the CHARGE button because the stakes were invisible.
**Solution**: Added a one-liner below the CHARGE button: "Energy decays daily. 0% for 3 days = anyone can reclaim it." Direct, concise, in the action context. No tooltip, no modal, no tutorial — just text next to the button where eyes already are.
**Key Insight**: The most effective UX copy is a single sentence placed next to the action, explaining the consequence. If players need to discover a mechanic to care about it, tell them right where they'll act on it.

### Dead Components — Always Verify Mount Point Exists (2026-02-25)
**Problem**: Redesigned HotBlockTicker from tiny 9px pills to 44px mini-cards with per-type colors, entrance animations, and priority sorting. The redesign was invisible — `HotBlockTicker` was never imported or rendered in `index.tsx`. `LiveActivityTicker` (a separate event feed component) had replaced it at some point, but the file stayed as dead code.
**Solution**: Grepped for `HotBlockTicker` imports across the codebase — found zero consumers. Mounted it in `index.tsx` inside the HUD wrapper, positioned bottom-right (LiveActivityTicker occupies bottom-left). Both serve complementary purposes: event stream vs notable block status.
**Key Insight**: Before modifying a component, verify it's actually mounted. A component file existing doesn't mean it's rendered. Quick check: `grep -r "ComponentName" --include="*.tsx" | grep -v "ComponentName.tsx"` to find consumers.

### Modal State Persists Across Opens — Reset in useEffect (2026-02-25)
**Problem**: ClaimModal used `useState(minPrice.toFixed(2))` for the initial amount. When the modal reopened for a different layer block, `amount` still showed the previous block's price. React Modal with `visible` prop doesn't unmount children — state persists.
**Solution**: Added `useEffect` that watches `visible` and `minPrice` — resets `amount`, `selectedColor`, and `error` when the modal opens. This pattern is necessary for any Modal that reuses state across different data contexts.
**Key Insight**: React Native `<Modal visible>` keeps children mounted when hidden. Any `useState` initial value only runs once. Always add a reset `useEffect` watching the `visible` prop when modal content depends on changing props.

### ScrollView + pointerEvents="box-none" = Broken Scrolling (2026-02-25)
**Problem**: HotBlockTicker used `ScrollView` with `pointerEvents="box-none"` to allow 3D scene touches to pass through. But `box-none` means the ScrollView itself doesn't receive touch events — only children do. Scroll gestures (which target the ScrollView container, not individual items) were silently dropped.
**Solution**: Replaced `ScrollView` with plain `View` + `pointerEvents="box-none"`. With MAX_CARDS=3 at 120px min-width, cards fit on all modern phones (360px+) without scrolling. If scrolling were truly needed, would need to remove `box-none` and accept blocking 3D touches in that strip.
**Key Insight**: `pointerEvents="box-none"` and scrollable containers are fundamentally incompatible. The container needs touch events to detect scroll gestures, but `box-none` prevents exactly that. Choose one: pass-through touches OR scrolling.

### Streak-Gated Unlocks — Gate at UI, Define in Shared Constants (2026-02-25)
**Problem**: Block customization had all options visible with no progression. Adding gamified unlock tiers required deciding where to gate: UI layer, store action layer, or server.
**Solution**: Define unlock tier thresholds + helper functions (`getUnlockedColorCount`, `isStyleUnlocked`, etc.) in `@monolith/common/constants.ts`. Gate at the UI layer only (InspectorCustomize reads `block.streak` and dims/locks items). No server-side enforcement — this is a soft gamification feature, not a security boundary. Locked items stay visible but dimmed with lock overlay showing streak requirement.
**Key Insight**: For gamification features (not security-critical), gate at the UI layer with shared constants defining thresholds. Keep locked items visible to create aspiration — hiding them entirely removes the motivation to unlock.

### Duplicated Charge Logic in MyBlocksPanel — Route Through Shared Pattern (2026-02-25)
**Problem**: MyBlocksPanel had its own `handleCharge` with hardcoded `pts = 25`, no `recentlyChargedId` set (no 3D flash), and no daily first-charge bonus. Meanwhile `useBlockActions.handleCharge` had the correct logic. The panel couldn't reuse `useBlockActions` directly because it takes a `blockId` parameter (charges any block), while `useBlockActions.handleCharge` operates on `selectedBlockId`.
**Solution**: Applied the same charge logic pattern to both locations: `setRecentlyChargedId(blockId)` for 3D flash + `isFirstChargeToday()` / `markChargeToday()` for daily bonus. Removed `onChargeResult` import from MyBlocksPanel (was imported but never called — silent dead code).
**Key Insight**: When two components handle the same action with different contexts (selectedBlockId vs arbitrary blockId), keep separate handlers but audit them together. Dead callback imports (`onChargeResult` imported but never called) are a silent footgun — the wrapup audit catches these.

### BottomPanel Animated Dismiss — Animate Off-Screen Before Calling onClose (2026-02-25)
**Problem**: Swipe-to-dismiss on BottomPanel caused a pop-back flash. Root cause: `dragOffset.setValue(0)` was called in the dismiss callback before React could unmount the component, so for one frame the panel snapped back to position 0. Also, a useEffect `else` branch tried to animate slide-out on `visible=false`, but the component had `if (!visible) return null` which unmounted it before the effect could run — dead code that caused race conditions.
**Solution**: Created an `animateClose()` callback that uses `Animated.timing` to slide off-screen (dragOffset → totalHeight, 200ms) and only calls `onClose()` in the `.start()` completion callback. Removed the dead `else` branch entirely. `dragOffset` is only reset to 0 when the panel opens (in the `if (visible)` branch).
```typescript
const animateClose = useCallback(() => {
    Animated.timing(dragOffset, {
        toValue: totalHeight, duration: 200, useNativeDriver: true,
    }).start(() => { onCloseRef.current(); });
}, [dragOffset, totalHeight]);
```
**Key Insight**: For dismissable panels with `if (!visible) return null`, always animate off-screen FIRST, then call the state setter in the animation callback. Never reset animation values before the component unmounts.

### Avoid Double SFX on Cascading UI Actions (2026-02-25)
**Problem**: Tapping a block played two sounds simultaneously — `playBlockSelect()` in TowerScene (on tap) and `playPanelOpen()` in BlockInspector (on visibility change). Similarly, FloatingNav `playButtonTap()` overlapped with BottomPanel's own `playSheetOpen()` on open. Users reported "two SFX playing at once."
**Solution**: Each user action should trigger exactly ONE sound at the point of interaction. Removed sounds from downstream effects (BottomPanel open, BlockInspector visibility change). The component that handles the user gesture owns the sound.
**Key Insight**: When action A triggers effect B, only A should play a sound. Audit SFX by tracing the full chain: gesture → state change → UI reaction. Each chain gets one sound.

### Consolidate Notification Components — Avoid Stacking Overlays (2026-02-24)
**Problem**: Three separate notification layers (ActivityTicker, ActivityFeed, HotBlockTicker) accumulated over multiple sprints. All competed for screen space, blocked touches on the 3D tower, and displayed similar information. HotBlockTicker was centered mid-screen in the HUD column, making "L0 Fading" pills look like a broken UI element.
**Solution**: Removed ActivityTicker and ActivityFeed entirely. Kept only HotBlockTicker, repositioned as absolute `bottom: 100, left: SPACING.sm` (above tab bar height of ~68px). Reduced to 3 pills max, compact labels, dark bg with text shadow for contrast.
**Key Insight**: Before adding a new notification component, audit existing ones — it's easy to accumulate 3+ overlapping systems across sprints. One well-positioned component beats three competing ones.

### Bottom-Anchored UI Must Clear Tab Bar Height (2026-02-24)
**Problem**: HotBlockTicker at `bottom: 40` was invisible — hidden behind the Expo Router tab bar (`height: 60 + Math.max(insets.bottom, 8)` ≈ 68px).
**Solution**: Use `bottom: 100` to clear the tab bar with margin. Reference tab bar height from `apps/mobile/app/(tabs)/_layout.tsx`.
**Key Insight**: Tab bar height on this project is ~68px. Any absolute-positioned bottom UI needs `bottom: 80+` to be visible. Always check `_layout.tsx` tabBarStyle for the exact calculation.

### Text Contrast Over 3D Scenes Needs Full Scrim, Not Just textShadow (2026-02-23)
**Problem**: Text overlays on the onboarding were unreadable because the bright tower color (blazing/thriving blocks) overwhelmed text shadows and subtle vignettes.
**Solution**: Use a `StyleSheet.absoluteFill` `<View>` with `backgroundColor: "rgba(6, 8, 16, 0.55-0.60)"` (the `BLUR.fallbackHudBg` token = 0.80 for panels, custom for scrims). Place it *behind* text in the Z order. Per-panel dark container (0.85-0.90 opacity) for inline UI. textShadow alone is insufficient.
**Key Insight**: For any text over a live 3D scene, scrim first, shadows second — you control the background, not the renderer.

### Demo Mode Must Mirror Server XP Feedback (2026-02-23)
**Problem**: The full XP/level/combo/floating-points system was 100% server-side. In demo/offline mode (no multiplayer connection), claim, charge, and customize gave zero XP feedback — the game felt empty and non-progressive.
**Solution**: In the `else` (demo) branches of `handleClaim`, `handleCharge`, `handleCustomize` in BlockInspector, call `usePlayerStore.getState().addPoints()` with the same XP values the server would award (claim: 100/300, charge: 25, customize: 10). Read tower state via `useTowerStore.getState()` to avoid adding deps.
**Key Insight**: Any feedback that only works when connected creates a silent two-tier experience. Mirror server feedback locally for all core actions.

### Reset Animated Values Synchronously Before Phase Transitions (2026-02-23)
**Problem**: After claiming a block, the customize panel animated from its current value instead of sliding in from below — the animation started mid-frame if the previous effect had already run.
**Solution**: Call `.setValue(initialValue)` synchronously on the animated refs *before* calling `advancePhase()`, in the same callback. This ensures the value is in the correct start position when the next phase's `useEffect` fires.
**Key Insight**: Animated values are mutable refs — reset them synchronously in the transition callback, not in the destination phase's effect.

### Onboarding: Communicate Stakes, Not Features (2026-02-21)
**Problem**: Early onboarding said "A living tower built by real people" and taught color-picking — felt like a cute toy. Users had no reason to return because they didn't understand what they'd lose.
**Solution**: Lead with competitive tension: "650 blocks. One tower. Yours to keep — or lose." Reveal phase: "Miss 3 days and anyone can take it." Keep customize to just color (fastest visual payoff). Defer emoji/style to post-onboarding discovery.
**Key Insight**: Onboarding must communicate the game loop's *stakes* in the first session — loss aversion ("you can lose this") is more motivating than features ("you can customize this").

### useCallback Deps: Use getState() Instead of Subscribing For Infrequent Reads (2026-02-21)
**Problem**: Added `demoBlocks` to a `useCallback` dependency array inside `BlockInspector` without extracting it from the store via `useTowerStore(s => s.demoBlocks)`. Runtime crash: `ReferenceError: Property 'demoBlocks' doesn't exist`.
**Solution**: For values only needed *inside* a callback (not for rendering), read via `useTowerStore.getState().demoBlocks` — no subscription, no dep array entry. Same pattern as `usePlayerStore.getState().addPoints()`.
**Key Insight**: `useStore.getState()` is the right tool inside callbacks/effects when you need a value once but don't need to re-render on changes — avoids the subscription + dep array pair entirely.

### Bottom Sheet Panels Must Account for Absolute Tab Bars (2026-02-18)
**Problem**: BlockInspector had `bottom: 0` but Expo Router tab bar uses `position: "absolute"` with height `60 + insets.bottom`. Panel content was hidden behind tab bar.
**Solution**: Offset panel bottom: `bottom: 60 + Math.max(insets.bottom, 8)`. Fix PanResponder to use `onStartShouldSetPanResponder: () => false` so ScrollView works. Split panel into fixed section (header + CTA) and scrollable section (customize pickers).
**Key Insight**: With absolute tab bars, ALL bottom-anchored UI must offset by tab bar height — check `_layout.tsx` tabBarStyle.

### Design System: Interview → Plan → Build → Migrate (2026-02-13)
**Problem**: Jumping into code without a design spec leads to inconsistent UI.
**Solution**: Run structured design interview (10 questions) → produce `UI_SYSTEM.md` spec → build `theme.ts` + component library → write agent rules in `AGENTS.md` → create `UI_MIGRATION_PLAN.md` for screen-by-screen conversion.
**Key Insight**: Build the component library and theme tokens BEFORE migrating existing screens — new components compile independently.

### Use AGENTS.md + Barrel Exports to Prevent Component Drift (2026-02-13)
**Problem**: Without guardrails, every new screen creates ad-hoc buttons/cards with inconsistent styling. AI agents especially prone to this.
**Solution**: (1) Create `components/ui/index.ts` barrel export, (2) Per-app `AGENTS.md` with rules like "always use `<Button>`, never create raw `<TouchableOpacity>`", (3) Component table + typography rules + new screen template.
**Key Insight**: Barrel exports + explicit agent rules make the design system discoverable and enforceable.

### Theme Migration Requires Explicit Color Mapping (2026-02-13)
**Problem**: Removing old theme tokens (e.g., `COLORS.cyan`) causes TypeScript errors everywhere.
**Solution**: After any theme overhaul: (1) `npx tsc --noEmit` to find broken refs, (2) Fix with old→new mappings, (3) Create migration plan doc listing every file + substitutions.
**Key Insight**: Theme changes are refactors — treat them like API migrations with explicit mapping tables.

---

## Development Workflow

### CWD Drift Breaks Git Commands After Subpackage Work (2026-02-25)
**Problem**: Running tests or tsc from `apps/mobile/` leaves the shell CWD in a subpackage. Subsequent `git add docs/LESSONS.md` fails with "pathspec did not match" because the path is relative to repo root, not the current directory.
**Solution**: Always use absolute paths for git commands, or use `git -C /path/to/repo` flag. Alternatively, `cd` back to repo root before git operations.
**Key Insight**: In monorepos, test/build commands require subpackage CWD but git commands require repo root — always be explicit about which context you're in.

### Shader Validation Checklist in Wrapup (2026-02-18)
**Problem**: Multiple coordinate space bugs during interior mapping implementation.
**Solution**: Added shader validation to `/wrapup` workflow: varying coordinate space labels, UV computation consistency, uniform updates, attribute counts, `needsUpdate` flags, debug color removal, LOD checks, transparency pitfalls. Created `react-native-three` skill.
**Key Insight**: Shaders fail silently — a systematic checklist catches bugs that visual inspection misses.

### tsc --noEmit Hangs in Monorepos (2026-02-13)
**Problem**: `npx tsc --noEmit --skipLibCheck` can hang indefinitely (30+ minutes) in monorepo workspaces.
**Solution**: Always wrap with timeout:
```bash
timeout 60 npx tsc --noEmit --skipLibCheck 2>&1; echo "EXIT=$?"
```
**Key Insight**: Exit 0 = clean, 124 = timed out. Applied to `/wrapup` and `/commit` workflows.

### Commit Verification After Terminal Hangs (2026-02-13)
**Problem**: Git commits can succeed even when the terminal hangs and doesn't return to prompt.
**Solution**: Always verify: `git log --oneline -1` (shows latest commit) + `git status --short` (shows staged/unstaged). If message matches, commit succeeded.
**Key Insight**: Never assume a commit failed just because the terminal hung — always verify with git log.

---

## Tapestry & Social

### Tapestry Content findOrCreate Requires Non-Empty Properties (2026-02-26)
**Problem**: Calling `/contents/findOrCreate` without a `properties` array (or with an empty one) returns `"properties cannot be empty"` — the content node is silently never created. All subsequent likes and comments on that content ID return 404 (`"Can't find nodes with ids [...]"`), making social features appear broken with no obvious cause.
**Solution**: Always include at least one default property: `properties: [{ key: "blockId", value: blockId }]`. Never conditionally omit the `properties` field.
**Key Insight**: Tapestry content nodes require at least one property to exist. Treat `properties` as a required field, not optional, even though the TypeScript types don't enforce it.

### Lazy Content Creation Before Social Interactions (2026-02-26)
**Problem**: Like/comment buttons were wired up in the BlockInspector, but the Tapestry content node for the block didn't exist yet (only created on claim). Tapping Like instantly reverted because the API 404'd, and the optimistic UI catch handler rolled it back.
**Solution**: Call `ensureBlockContent()` (findOrCreate) when the block inspector opens, gated by a `contentReadyRef`. Like/comment handlers check `contentReadyRef.current` before firing. Social state checks (checkLiked, getLikeCount, getComments) only run after content is confirmed to exist.
**Key Insight**: For optimistic UI over external APIs, ensure the target resource exists before allowing interactions — don't assume prior actions created it.

### Duplicate/Split Imports Silently Break React Native Components (2026-02-26)
**Problem**: BlockInspector had two separate import statements from `@/utils/tapestry` plus an unused import (`BOT_PERSONAS` from seed-tower). Metro bundler silently failed to evaluate the module, causing the entire component tree below it to not mount — block taps did nothing with zero error logs.
**Solution**: Consolidate all imports from the same module into a single import statement. Remove unused imports immediately.
**Key Insight**: In React Native with Metro, split imports from the same module or unused imports can cause silent component failures with no error boundary or log output. Always consolidate imports.

---

## Game Design & Core Loop

### Bot-Only Content Leaks to Players Without Owner Type Guards (2026-03-03)
**Problem**: TowerGrid assigned random demo images (Doge, Solana logos) to ALL owned blocks with `if (imgIdx === 0 && block.owner)`. Players saw bot-themed content on their own blocks — confusing and breaks the "this block is MINE" feeling.
**Solution**: Guard with `isBotOwner(block.owner)` — the function already existed in seed-tower.ts but wasn't used in the image assignment path. One-line fix: `if (imgIdx === 0 && block.owner && isBotOwner(block.owner))`.
**Key Insight**: When adding demo/bot content, always gate it with an explicit owner-type check. The "is this a real player?" question should be asked everywhere content diverges, not just in obvious places like UI labels.

### Evolution Tier Must Ratchet (Never Regress) — Track bestStreak Separately (2026-03-01)
**Problem**: `getEvolutionTier(totalCharges, streak)` used the current streak value. When a player missed a day and their streak reset to 1, blocks visually downgraded from e.g. Flame (streakReq=7) back to Ember — contradicting "permanent progression" design intent. Players who invested 30+ charges lost their visual achievement.
**Solution**: Track `bestStreak` as a separate field (all-time maximum, never decreases). Use `Math.max(currentTier, getEvolutionTier(totalCharges, bestStreak))` to ensure evolution tier never regresses. Added `bestStreak` to BlockSchema, DemoBlock, ServerBlock, BlockRow, and DB migration.
**Key Insight**: Any "permanent progression" system needs a ratchet mechanism. If the underlying inputs can regress (streak resets), the derived output must be protected with `Math.max(current, computed)`. Always ask: "Can this go backwards? Should it?"

### Duplicated Game Logic Across Client/Server Is a Desync Timebomb (2026-03-01)
**Problem**: `getStreakMultiplier()`, `isNextDay()`, and `rollChargeAmount()` were implemented separately in `tower-store.ts` (client) and `TowerRoom.ts` (server) with identical logic. When updating charge brackets, you'd need to change both files and hope they stay in sync. In multiplayer mode, both independently rolled charge amounts (different `Math.random()` results).
**Solution**: Moved all shared game logic to `@monolith/common/constants.ts`. Client re-exports via `tower-store.ts` for existing importers. In multiplayer, only the server rolls — client shows the server's authoritative result.
**Key Insight**: Game logic that must be identical client/server belongs in a shared package. The pattern: define in `@monolith/common`, import on both sides. Use re-exports (`export { fn } from "@monolith/common"`) to avoid breaking existing import paths.

### Variable Rewards Need Quality Embedded in the Source Data (2026-03-01)
**Problem**: `CHARGE_BRACKETS` defined `{min, max, weight}` but quality was a separate `CHARGE_QUALITY` array mapped by bracket index (`CHARGE_QUALITY[bracketIndex]`). This was fragile — reordering brackets or adding a new one would silently break quality mapping.
**Solution**: Embed quality directly in each bracket: `{ min: 15, max: 19, weight: 25, quality: "normal" }`. `rollChargeAmount()` returns `{ amount, quality }` directly. Removed the separate `CHARGE_QUALITY` array.
**Key Insight**: When data has a 1:1 relationship (bracket → quality), co-locate it in the same object. Index-based mapping between parallel arrays is a fragile coupling that breaks silently on reorder.

### noise2D Is Expensive Per-Fragment on Mobile — Use hash21 for Sparkle (2026-03-01)
**Problem**: Evolution shimmer effect used `noise2D()` in the fragment shader (4 `hash21` calls + bilinear interpolation per pixel). On mobile GPUs, both branches of an `if` are evaluated regardless, so this ran for ALL 650 blocks' fragments every frame, not just tier 2+ blocks.
**Solution**: Replaced with single `hash21(floor(...))` call — produces visually similar sparkle for shimmer effects at ~4x fewer GPU ops. `floor()` makes it cell-based (discrete sparkles) which is actually more visually appropriate for a "particle" effect than smooth noise.
**Key Insight**: For sparkle/shimmer effects, smooth noise is overkill — a simple hash produces the same visual at a fraction of the cost. On mobile GPUs, assume both branches always execute and optimize the expensive branch accordingly.
