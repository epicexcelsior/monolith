---
description: Audit 3D tower performance. Run when modifying shaders, geometry, lighting, or particles.
---

# 3D Performance Audit

Run this checklist whenever you modify files in `components/tower/` — especially shaders, geometry, lighting, or particles. Mobile GPU budgets are tight; every change has a cost.

## 1. Geometry Budget

Check triangle counts for instanced meshes. With ~650 blocks, geometry cost multiplies fast.

| Geometry | Approx Tris/Instance | Budget |
|---|---|---|
| BoxGeometry | 12 | ✅ Cheapest |
| RoundedBoxGeometry(segments=1) | ~24 | ✅ Good balance |
| RoundedBoxGeometry(segments=2) | ~96 | ⚠️ Gets expensive at scale |
| RoundedBoxGeometry(segments=3+) | ~216+ | ❌ Too many for 650 instances |

**Rule**: Total scene triangles should stay under ~25K for smooth 60fps on mid-range mobile.

```bash
# Quick grep to check geometry params
grep -n "RoundedBoxGeometry\|BoxGeometry\|sphereGeometry\|SphereGeometry" apps/mobile/components/tower/*.tsx
```

## 2. Shader Complexity

Fragment shaders run per-pixel per-object. On a 1080p screen, that's millions of invocations.

**Cost hierarchy** (most to least expensive):
1. `pow()` with high exponents (>32) — use lower exponents or approximations
2. Noise/FBM loops — each octave = full noise eval. Max 3 octaves for mobile
3. `sin()`/`cos()` — moderate cost, avoid in tight loops
4. `smoothstep()` — cheap, prefer over `pow()` for soft transitions
5. `step()`/`clamp()`/`mix()` — essentially free

**Check for red flags:**
```bash
# Count expensive operations in shaders
grep -c "pow\|fbm\|noise\|hexPattern" apps/mobile/components/tower/BlockShader.ts
grep -c "pow\|fbm\|noise" apps/mobile/components/tower/TowerScene.tsx
```

**Rules**:
- No function called 3+ times per fragment (e.g., old hexPattern × 3 was costly)
- Skip expensive ops for dead/low-energy blocks using `step()` guards
- Use `step(0.1, energy)` to zero out specular/glow on dead blocks — avoids computing effects that contribute nothing visually

### 2a. mediump Precision + Time Uniforms (CRITICAL)

> ⚠️ **Progressive lag root cause**: `precision mediump float` uses float16 on mobile GPUs.
> Any uniform that grows over time (`uTime`, frame count) will lose precision after ~10 minutes,
> making `sin()`/`cos()` return garbage. The app gets progressively laggier.

```bash
# Check that ALL uTime uniforms in mediump shaders have highp override
grep -B5 "uniform.*uTime" apps/mobile/components/tower/BlockShader.ts
# Should see: uniform highp float uTime;
# NOT: uniform float uTime; (inherits mediump → breaks after 10 min)
```

**Rules**:
- Any `uniform float uTime` in a `precision mediump float` shader MUST be `uniform highp float uTime`
- Other uniforms (colors, positions, intensities) are fine at mediump — they don't grow
- mediump float16 precision: ±1 at value 1000, ±8 at 10000 — `sin()` is meaningless
- This is invisible in short test sessions — only shows after 10+ minutes of continuous rendering

## 3. Light Count

Each additional light = extra per-fragment computation for every lit object.

```bash
# Count lights in scene
grep -c "Light\|light" apps/mobile/components/tower/TowerScene.tsx
```

**Budget**: Max 5 lights total for mobile.

| Light Type | Cost | Notes |
|---|---|---|
| ambientLight | Free | No per-fragment cost |
| hemisphereLight | Very cheap | Replaces 2-3 fill/bounce lights |
| directionalLight | Moderate | 1 key + 1 fill is ideal |
| pointLight | Expensive | Use sparingly, set `distance` and `decay` |
| spotLight | Most expensive | Avoid on mobile |

**Tip**: A single `hemisphereLight` replaces ground bounce + back-rim + ambient fill lights.

## 4. Particle Count

Transparent blended objects are especially expensive on mobile GPUs (no early-Z rejection).

```bash
grep "PARTICLE_COUNT" apps/mobile/components/tower/Particles.tsx
```

**Budget**: 60-80 particles max. Over 100 causes visible frame drops on mid-range devices.

## 5. Skybox Cost

The skybox shader runs for every visible sky pixel — often 30-50% of the screen.

**Check**:
- FBM octaves: max 3 (grep for `for.*int i.*<`)
- Cloud layers: max 1 (each layer = 1 FBM call = 3 noise evals)
- God ray loop iterations: max 2
- Star computation: must be behind an `if (lat < threshold)` guard

## 6. R3F / Three.js Settings

```bash
# Check Canvas config
grep -A5 "Canvas" apps/mobile/components/tower/TowerScene.tsx | head -10
```

**Ensure**:
- `antialias: false` — huge perf win on mobile
- `alpha: false` — avoids compositing overhead
- `powerPreference: "high-performance"` — requests dedicated GPU
- `frustumCulled={true}` on instanced meshes

## 7. InstancedMesh Raycasting

> ⚠️ **Critical gotcha**: Passing geometry via `args` on `<instancedMesh>` breaks R3F raycasting. Always use child `<boxGeometry>` for click-handling meshes.

```bash
# Verify hit meshes use child geometry, not args
grep -A3 "hitMesh\|onClick" apps/mobile/components/tower/TowerGrid.tsx
```

## 8. Per-Frame Allocation (GC Pressure)

Mobile GC pauses cause visible frame drops. Any object allocation inside `useFrame` runs 60x/sec.

```bash
# Check for new allocations inside useFrame callbacks
grep -n "new THREE\.\|\.clone()\|new Float32Array\|new Array" apps/mobile/components/tower/TowerGrid.tsx apps/mobile/components/tower/ClaimVFX.tsx apps/mobile/components/tower/TowerScene.tsx
```

**Red flags inside useFrame / render loops:**
- `new THREE.Color()` — use `ref.current.set()` instead
- `new THREE.Vector3()` / `.clone()` — use `ref.current.copy()` instead
- `new Float32Array()` — pre-allocate in `useRef` or `useMemo`
- `new THREE.Matrix4()` — reuse a single temp via `useRef`
- `performance.now()` called multiple times — cache once per frame

**Rules**:
- Pre-allocate reusable objects in `useRef()` (Color, Vector3, Matrix4, Object3D)
- Use `.set()` / `.copy()` instead of `new` / `.clone()` inside animation loops
- Cache `performance.now()` once at the top of `useFrame` and reuse the value
- If an array size is known and stable, allocate once and reuse

## 9. Store Update Batching

Zustand `set()` calls trigger React re-renders. In loops, each call cascades through useMemo → useEffect → attribute rebuild.

**Red flags:**
- `for (...) { updateDemoBlock(id, changes); }` — N calls = N cascades
- `setInterval` that calls store actions for individual items
- Bot simulation, decay loops, multiplayer sync hitting the store per-block

**Rules**:
- Collect all changes in a Map/array, apply in ONE `set({ demoBlocks: ... })` call
- Bot sim: batch all bot changes per tick (was 50 individual calls → now 1)
- Decay: skip tick entirely if no block has energy > 0
- Multiplayer: `applyFullState` already diffs — make sure `applySingleBlockUpdate` isn't called in a loop

## 10. useFrame Idle Cost

Per-frame loops over N items (650 blocks) should be gated so they cost near-zero when idle.

**Check for ungated loops:**
```bash
# Find useFrame callbacks that iterate over all blocks
grep -n "for.*popCur\|for.*fadeCur\|for.*hlCur\|for.*blockData" apps/mobile/components/tower/TowerGrid.tsx
```

**Pattern**: Use a `useRef<boolean>` dirty flag:
- Set `true` when targets change (e.g., `selectedBlockId` changes)
- Set `false` when the loop detects convergence (all deltas < 0.001)
- Guard the loop body: `if (!animatingRef.current) return;`

**Also check**:
- Pop-out restore: should restore only the last-popped block (tracked index), not all 650
- Charge flash cleanup: should use `filter()` + `Set`, not reverse `splice()` (O(n) per splice)
- `transparent: true` on additive-blended materials: unnecessary when using `AdditiveBlending` + fragment `discard` — removes 650 instances from the transparency sort pass

## 11. Summary Checklist

After reviewing, confirm:
- [ ] Total geometry < 25K tris
- [ ] No shader function called 3+ times per fragment
- [ ] FBM ≤ 3 octaves, ≤ 1 cloud layer
- [ ] ≤ 5 scene lights
- [ ] ≤ 80 particles
- [ ] antialias: false, alpha: false
- [ ] Hit meshes use child geometry for raycasting
- [ ] Expensive shader ops guarded by energy level
- [ ] All `uTime` uniforms in mediump shaders use `highp` override
- [ ] No `new THREE.*` or `.clone()` inside useFrame callbacks
- [ ] `performance.now()` cached once per frame (not called multiple times)
- [ ] useFrame loops gated by dirty flags (near-zero cost at idle)
- [ ] No `transparent: true` on additive-blended materials with `discard`
