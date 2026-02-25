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
- [Development Workflow](#development-workflow)

---

## Camera & Gestures

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

---

## Deployment & DevOps

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
