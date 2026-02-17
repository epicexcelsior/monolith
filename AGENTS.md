# Agent Learnings & Development Notes

This file documents important lessons, gotchas, and discoveries for future development.

## Recent Lessons Learned

### 2026-02-16: R3F Custom Shaders — All Lights Are Baked, Use Additive Blending for Interior Glow

**Problem**: Attempted to add a solid opaque TowerCore mesh (dark stone) inside the tower to give depth when viewing through gaps. Result: "massive monolithic black structure" that obstructed blocks and darkened everything despite being BackSide-only.

**Root Cause**: ALL R3F light components (`ambientLight`, `hemisphereLight`, `directionalLight`, `pointLight`) have **zero visual effect** because every mesh uses custom `ShaderMaterial` without `lights: true`. All lighting is hardcoded in shader GLSL. Adding an opaque surface with traditional face shading just creates a dark void.

**Solution**: Replace opaque geometry with **additive-blended warm glow**:
```typescript
// Material properties
transparent: true,
depthWrite: false,
side: THREE.BackSide,
blending: THREE.AdditiveBlending,

// Fragment shader: height gradient + edge fade + breathing pulse
vec3 emberColor = vec3(0.6, 0.15, 0.02);   // deep orange-red base
vec3 amberColor = vec3(0.8, 0.45, 0.08);   // warm amber mid
vec3 goldColor  = vec3(0.95, 0.8, 0.3);    // pale gold top
float edgeFade = pow(1.0 - abs(dot(N, V)), 1.5);
float pulse = 0.85 + 0.15 * sin(uTime * 0.8);
gl_FragColor = vec4(glowColor * 0.4, edgeFade * pulse * 0.35);
```

**Key Insights**:
- BackSide rendering is NOT sufficient to prevent visual obstruction — opaque materials still darken whatever is behind them in the framebuffer
- Additive blending (`AdditiveBlending`) only ADDS light, never darkens — safe for interior glow effects
- `depthWrite: false` prevents z-fighting and overdraw issues
- For "light from within" effects in shader-based scenes, use emissive additive geometry, not traditional lit surfaces

**Result**: Warm amber glow visible only through gaps between blocks, creating a "keeper of the flame" monument aesthetic. Zero performance cost (additive + depthWrite:false means negligible overdraw).

### 2026-02-15: R3F InstancedMesh — Always Use Child Geometry for Raycasting

**Problem**: Passing geometry via `args` on `<instancedMesh args={[geometry, undefined, count]} />` (self-closing) breaks R3F raycasting/onClick. Blocks become unclickable.

**Solution**: Always use child `<boxGeometry>` or `<meshGeometry>` for the click-handling hit mesh:
```tsx
// ✅ Works — child geometry enables raycasting
<instancedMesh ref={hitRef} args={[undefined, undefined, count]} onClick={handleClick}>
  <boxGeometry args={[size, size, size]} />
</instancedMesh>

// ❌ Broken — geometry via args breaks raycasting
<instancedMesh args={[myGeometry, undefined, count]} onClick={handleClick} />
```
Visual-only instanced meshes can safely use `args` geometry (e.g., `RoundedBoxGeometry`).

### 2026-02-15: Mobile 3D Performance Budget — Shader ALU > Triangles > Lights

**Lesson**: On mobile GPUs, the performance priority order is:
1. **Fragment shader ALU ops** — most expensive. Hex pattern function called 3× per dead block fragment was the biggest cost. Replace with simple `fract()`-based cracks.
2. **Triangle count** — RoundedBoxGeometry(segments=2) = ~96 tris/block × 650 blocks = 62K. Segments=1 halves it with same visual.
3. **Light count** — each extra light adds per-fragment cost. Hemisphere light replaces 2-3 fill lights at once.
4. **Texture/noise lookups** — FBM with 4 octaves costs 25% more than 3, for <6% visual return.
5. **Particle count** — transparent blended objects especially expensive. 120→80 particles saves draw overhead.

### 2026-02-15: Camera State Must Fully Reset on Block Deselect

**Problem**: When closing a block viewer, only the lookAt X/Z were reset but zoom stayed at `ZOOM_BLOCK` distance — camera clipped inside tower.

**Solution**: On deselect, reset ALL camera targets to overview state — zoom, elevation, and lookAt — not just the center position:
```typescript
// ✅ Full reset
cs.targetZoom = ZOOM_OVERVIEW;
cs.targetElevation = OVERVIEW_ELEVATION;
cs.targetLookAt.set(0, TOWER_CENTER_Y, 0);
cs.isTransitioning = true;
```

### 2026-02-15: Azimuth Normalization Causes Rotation Jumps

**Problem**: Independently normalizing `azimuth` and `targetAzimuth` to `[-PI, PI]` every frame causes visible camera snaps when one wraps while the other doesn't.

**Solution**: Let azimuth grow unboundedly. Float64 handles years of continuous rotation. Only use a local copy for `Math.sin()/Math.cos()`:
```typescript
const theta = cs.azimuth; // local copy for trig only
camera.position.x = Math.sin(theta) * radius;
```


### 2026-02-13: Design System Work Should Follow Interview → Plan → Build → Migrate

**Pattern**: Instead of jumping into code, run a structured design interview first (10 questions covering aesthetic, typography, components, navigation, animations). This produces a specification that makes the build phase trivial.

**Workflow**: Interview → `UI_SYSTEM.md` spec → `theme.ts` overhaul → Component library → `AGENTS.md` agent rules → `UI_MIGRATION_PLAN.md` for screen-by-screen conversion.

**Key Insight**: Building the component library and theme tokens BEFORE migrating existing screens is safer. New components compile and type-check independently, and screens can be migrated one at a time without breaking the app.

### 2026-02-13: Use AGENTS.md + Barrel Exports to Prevent Component Drift

**Problem**: Without guardrails, every new screen creates ad-hoc buttons, cards, and inputs with inconsistent styling. AI agents are especially prone to this because they don't remember previous styling decisions.

**Solution**:
1. Create `components/ui/index.ts` barrel export for clean imports
2. Create per-app `AGENTS.md` with explicit rules: "always use `<Button>`, never create raw `<TouchableOpacity>`"
3. Include a component table, typography rules, and a new screen template

**Result**: Future agents (and humans) see the component catalog before writing any code. The barrel index makes the import path obvious.

### 2026-02-13: Theme Migration Requires Explicit Color Mapping Tables

**Gotcha**: Overhauling a theme file (e.g., removing `COLORS.cyan`) causes TypeScript errors in every file that referenced the old token. Simply renaming tokens isn't enough — you need a migration plan with exact `old → new` mappings for every screen.

**Solution**: After any theme overhaul, immediately:
1. Run `npx tsc --noEmit` to find all broken references
2. Fix type errors in existing code (map old names to new ones)
3. Create a migration plan doc listing every file + exact color/component substitutions

### 2026-02-13: `tsc --noEmit` Hangs in Monorepos — Always Use `timeout`

**Problem**: `npx tsc --noEmit --skipLibCheck` can hang indefinitely in monorepo workspaces (30+ minutes), blocking the entire workflow. This happened repeatedly in this project.

**Solution**: Always wrap tsc with a timeout:
```bash
timeout 60 npx tsc --noEmit --skipLibCheck 2>&1; echo "EXIT=$?"
```
Exit code 0 = clean, 124 = timed out (actual compilation issue). Applied to `/wrapup` and `/commit` workflows.

### 2026-02-13: Soft Magnetic Zoom Beats Hard Tier Snapping for 3D Camera UX

**Problem**: Hard-snapping zoom to fixed tiers (40/18/8) on pinch release felt broken — users zoom to 25, it snaps back to 40. Feels like "auto-reset."

**Solution**: Free zoom with soft magnetic pull near tier centers:
```typescript
function applySoftMagnetic(zoom: number): number {
  const tiers = [8, 18, 40]; // tier centers
  for (const tier of tiers) {
    const dist = Math.abs(zoom - tier);
    if (dist < 2.5 && dist > 0.1) { // magnetic zone
      return zoom + (tier - zoom) * 0.03; // gentle pull
    }
  }
  return zoom; // free zoom outside magnetic zone
}
```

Also: use dual lerp (fast 0.14 for orbit, slow 0.045 for fly-to/reset transitions) for smoother programmatic camera moves.

### 2026-02-13: BorshAccountsCoder Incompatibility with React Native

**Problem**: Anchor's `BorshAccountsCoder.decode()` uses Node.js `Buffer.readUIntLE()` which doesn't exist in React Native's Buffer polyfill. All account decoding was crashing with `"b.readUIntLE is not a function (it is undefined)"`.

**Solution**: Manual byte-level decoding using `DataView` and `Uint8Array` which work universally:

```typescript
// Read a u64 (8 bytes, little-endian) from raw account data
function readU64(data: Uint8Array, offset: number): number {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const lo = view.getUint32(offset, true);      // low 32 bits
    const hi = view.getUint32(offset + 4, true);  // high 32 bits
    return hi * 0x100000000 + lo;
}

// Read a PublicKey (32 bytes)
function readPubkey(data: Uint8Array, offset: number): PublicKey {
    return new PublicKey(data.slice(offset, offset + 32));
}

// Example: TowerState account (117 bytes)
// [0..8)     discriminator
// [8..40)    authority: Pubkey
// [40..72)   usdc_mint: Pubkey
// [104..112) total_deposited: u64
// [112..116) total_users: u32
const accountInfo = await connection.getAccountInfo(pda);
const authority = readPubkey(accountInfo.data, 8);
const totalDeposited = readU64(accountInfo.data, 104);
```

**Key Insight**: Map Rust struct byte layouts exactly. Use `DataView` for integers, `Uint8Array.slice()` for pubkeys. No Buffer methods needed.

**Related Gotcha**: IDL field names are `snake_case` (e.g., `usdc_mint`, `total_deposited`), not `camelCase`. BorshAccountsCoder returns snake_case field names matching the IDL.

### 2026-02-13: Workflow Improvements — Commit Verification

**Lesson**: Git commits can succeed even when the terminal hangs and doesn't return to prompt.

**Solution**: Always verify commit status after attempting commit:
```bash
git log --oneline -1  # Shows latest commit
git status --short     # Shows staged/unstaged changes
```

If the latest commit message matches what you just committed but the terminal hung, the commit succeeded.

**Applied**: Updated `/wrapup` and `/commit` workflows to include commit verification steps. Also added React Native platform compatibility notes to `expo-dev-client` skill documenting Buffer/crypto/fs limitations and Solana-specific gotchas.


### 2026-02-17: pnpm Strict Isolation Breaks Transitive Deps in Docker/Railway

**Problem**: Server deployed to Railway crashed with `Cannot find module '@colyseus/schema'` despite it being installed as a transitive dependency of `colyseus`. Worked perfectly locally.

**Root Cause**: pnpm's strict `node_modules` isolation intentionally prevents accessing undeclared transitive dependencies. When using `esbuild --packages=external`, the bundle contains `require("@colyseus/schema")` but `@colyseus/schema` was never declared as a direct dependency — only `colyseus` was. Locally this might work due to hoisting, but in a fresh Docker install with pnpm, it fails.

**Solution**:
1. **Declare ALL directly-imported packages** in `package.json`, even if they're transitive deps of other packages
2. **Never add `pnpm install --prod` prune step** in Dockerfile when using `--packages=external` — it breaks transitive dep resolution further
3. Check the esbuild output for all `require()` calls and ensure each one is a direct dependency:
```bash
grep 'require("' dist/index.js  # find all external requires
```

**Key Insight**: esbuild `--packages=external` + pnpm strict isolation = every `require()` in the bundle MUST be in your direct `dependencies`. npm/yarn hoist transitive deps so this isn't an issue there, but pnpm catches it.

### 2026-02-17: Railway Deployment — Port, Dockerfile, and Monorepo Setup

**Gotchas**:
- Railway sets `PORT` env var (usually 8080). Server must read `process.env.PORT`, NOT hardcode 2567
- Dockerfile must be at **repo root** (not `apps/server/`). Set Railway root directory to `/`
- External URL is standard `https://` / `wss://` — no port needed in client URL
- `EXPOSE 2567` in Dockerfile is informational only — Railway's proxy handles routing
- Railway GitHub integration auto-deploys on push to main — no manual `railway up` needed
- For pnpm monorepos: `corepack enable && corepack prepare pnpm@<version> --activate` in Dockerfile

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
