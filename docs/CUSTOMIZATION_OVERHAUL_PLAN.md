# Block Customization Overhaul — Implementation Plan

> **Purpose:** Autonomous implementation blueprint for Ralph Loop.
> **Branch:** `feat/customization-overhaul` (worktree)
> **Priority order:** Phase 1 → 2 → 3 → 4 → 5

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 1: Frosted Glass Unclaimed Blocks](#phase-1-frosted-glass-unclaimed-blocks)
3. [Phase 2: Isolated 3D Configurator](#phase-2-isolated-3d-configurator)
4. [Phase 3: Streamlined Customization Controls](#phase-3-streamlined-customization-controls)
5. [Phase 4: Haptics & Sound Polish](#phase-4-haptics--sound-polish)
6. [Phase 5: Image Upload Architecture (Design Only)](#phase-5-image-upload-architecture-design-only)
7. [Testing Strategy](#testing-strategy)
8. [Risk Areas](#risk-areas)
9. [File Index](#file-index)

---

## Overview

### What We're Building

Replace the inline customization panel with a full-screen isolated 3D configurator, streamline customization to 3 impactful knobs (color wheel, style picker, name), make unclaimed blocks beautiful (frosted glass), and polish every interaction with haptics and sound.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Configurator architecture | Separate R3F Canvas (not tower camera manipulation) | Tower camera is complex; separate Canvas = clean control, 1 draw call, mount/unmount on demand |
| Block rendering in configurator | Single-instance `InstancedMesh` (count=1) | Reuses exact same shader — zero duplication |
| Customization knobs | 3: Color (HSL wheel), Style (11 cards), Name (text input) | Maximum impact, minimum cognitive load |
| Cut from UI | Emoji picker, texture picker, face/personality picker | Still in data model but not manually selectable; faces auto-assigned by hash |
| Network sync | Live local preview, broadcast only on save | One network message per customization session, not per scrub |
| Unclaimed blocks | Frosted glass (cool blue-gray, soft edges, gentle pulse) | Elegant, inviting, replaces "ugly golden wireframe" |
| Testing mode | `__TESTING__` flag unlocks all options | Like existing `__DEV__` pattern |
| Image upload | Design architecture only, implement later | Highest complexity, lowest priority per user |

### Key Conventions (MUST follow)

1. **Dual-path pattern**: All customization changes MUST work in both offline (`customizeBlock()` in `tower-store.ts`) AND multiplayer (`sendCustomize()` in `multiplayer-store.ts`). The existing `applyCustomize()` in `useBlockActions.ts` handles this routing — always call through it.
2. **No `new` in useFrame**: Pre-allocate Color/Vector3/Matrix4 in `useRef`, use `.set()`/`.copy()`.
3. **No `transparent: true` on InstancedMesh**: Frosted glass effect achieved via shader math only (solid alpha=1.0 output).
4. **One SFX per action chain**: Don't add sounds to downstream effects, only at gesture origin.
5. **`anyOverlayOpen` in `index.tsx`**: Any new overlay MUST be added to this boolean.
6. **mediump uTime**: All `uTime` uniforms MUST use `uniform highp float uTime;`.
7. **BlockMeta uses plain `{x,y,z}`**: Not `THREE.Vector3` — avoids 650 constructor calls.
8. **Fire-and-forget audio**: No `await` on sound playback.
9. **Conditional spread for store updates**: `...(condition && { key: value })`.
10. **pnpm strict isolation**: Any new dependency MUST be declared as direct dep.

---

## Phase 1: Frosted Glass Unclaimed Blocks

### Goal

Replace the warm golden wireframe unclaimed block aesthetic with frosted glass: cool blue-gray translucent look, soft edges, subtle inner glow, gentle breathing pulse.

### Files to Modify

#### `apps/mobile/components/tower/BlockShader.ts` — lines 1105-1168

This is the **only file** modified in Phase 1. The unclaimed block rendering section starts at the comment `// ─── Dead blocks: dark glass with glowing amber edges ──` (line 1105).

### Exact Changes

The section between lines 1131-1155 defines the unclaimed block appearance. Replace this section:

**REMOVE (lines 1131-1155):**
```glsl
// ── Warm glass interior — inviting, like empty lanterns ──
vec3 glassBase = vec3(0.22, 0.17, 0.13);
// Face shading so it reads as 3D
glassBase += vec3(0.04, 0.03, 0.02) * max(0.0, N.y);
glassBase += vec3(0.03, 0.02, 0.01) * max(0.0, dot(N, normalize(vec3(0.4, 0.6, -0.3))));

// Subtle height-based ambient warmth — unclaimed blocks glow faintly near the base
float dormantWarmth = 0.06 + 0.04 * vLayerNorm;
glassBase += vec3(0.18, 0.10, 0.04) * dormantWarmth;

// Warm breathing pulse — the tower is alive even where unclaimed
float dormantPulse = 0.88 + 0.12 * sin(uTime * 0.6 + vInstanceOffset * 2.0);
glassBase *= dormantPulse;

// ── Warm gold edge color — height-graded ──
vec3 edgeColorLow = vec3(0.65, 0.45, 0.18);   // warm gold
vec3 edgeColorHigh = vec3(0.85, 0.68, 0.28);   // bright gold
vec3 edgeColor = mix(edgeColorLow, edgeColorHigh, vLayerNorm);

// Compose: dark glass + glowing edges
vec3 deadColor = glassBase + edgeColor * edgeGlow;

// Fresnel rim — amber glow at viewing angle edges
float rimPulse = 0.85 + 0.15 * sin(uTime * 0.6 + vInstanceOffset * 2.0);
deadColor += vec3(0.18, 0.10, 0.04) * fresnel * 0.7 * rimPulse;
```

**REPLACE WITH:**
```glsl
// ── Frosted glass interior — elegant, cool, inviting ──
vec3 glassBase = vec3(0.10, 0.12, 0.16);  // cool blue-gray
// Face shading for 3D depth
glassBase += vec3(0.02, 0.02, 0.03) * max(0.0, N.y);
glassBase += vec3(0.01, 0.02, 0.02) * max(0.0, dot(N, normalize(vec3(0.4, 0.6, -0.3))));

// Subtle height-based cool glow — higher blocks catch more "sky light"
float frostGlow = 0.04 + 0.03 * vLayerNorm;
glassBase += vec3(0.04, 0.06, 0.10) * frostGlow;

// Interior frost noise — visual depth without UV complexity
float frostNoise = sin(vLocalPos.x * 12.0 + uTime * 0.2) * sin(vLocalPos.y * 10.0 + vInstanceOffset) * 0.02;
glassBase += vec3(0.06, 0.08, 0.12) * max(0.0, frostNoise);

// Gentle breathing pulse — slower and subtler than warm version
float frostPulse = 0.92 + 0.08 * sin(uTime * 0.4 + vInstanceOffset * 2.0);
glassBase *= frostPulse;

// ── Cool white-blue edge color — height-graded ──
vec3 edgeColorLow = vec3(0.25, 0.35, 0.50);   // steel blue
vec3 edgeColorHigh = vec3(0.40, 0.50, 0.65);   // ice blue
vec3 edgeColor = mix(edgeColorLow, edgeColorHigh, vLayerNorm);

// Compose: frosted glass + soft glowing edges
vec3 deadColor = glassBase + edgeColor * edgeGlow;

// Fresnel rim — cool blue glow at viewing angle edges
float rimPulse = 0.90 + 0.10 * sin(uTime * 0.4 + vInstanceOffset * 2.0);
deadColor += vec3(0.06, 0.10, 0.18) * fresnel * 0.6 * rimPulse;

// Inner scatter — view-angle dependent cool glow (frosted glass refraction feel)
deadColor += vec3(0.04, 0.07, 0.12) * fresnel * fresnel * 0.5;
```

### Also update edge detection (lines 1112-1129)

Soften the wireframe edges to feel more "frosted" and less "wireframe":

**Change** `edgeW` from `0.06` to `0.08` (line 1112) — slightly softer edges.

**Change** `faceEdgeW` from `0.06` to `0.07` (line 1123) — slightly wider face borders for frosted look.

**Change** `wireframe * 0.6` to `wireframe * 0.4` (line 1129) — reduce wireframe intensity, it should be subtle not dominant.

**Change** `faceOutline * 0.15` to `faceOutline * 0.20` (line 1129) — slightly boost face outlines since wireframe is reduced.

The final `edgeGlow` line becomes:
```glsl
float edgeGlow = max(wireframe * 0.4, faceOutline * 0.20);
```

### What NOT to touch

- The dormant block section (lines 1157-1166) where `isDormant > 0.5` — this handles OWNED blocks with 0 energy. Keep as-is.
- The `deadMask` calculation (line 1106) — keep as-is.
- Everything before line 1108 and after line 1168.

### Verification

- Unclaimed blocks should look cool blue-gray with soft edges, not golden
- Owned blocks at 0 energy (dormant) should still show desaturated owner color
- 60fps maintained (no new texture lookups, minimal new math)
- All 222 mobile tests pass (shader isn't unit-tested but run tests for regressions)

---

## Phase 2: Isolated 3D Configurator

### Goal

Full-screen product-viewer style configurator: block floats alone against gradient background, 2x scale, auto-orbit + drag-orbit, transitions from inspector "Customize" button.

### New Files to Create

#### `apps/mobile/components/configurator/BlockConfigurator.tsx`

Full-screen wrapper component. Structure:

```typescript
import React, { useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Canvas } from "@react-three/fiber/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTowerStore } from "@/stores/tower-store";
import { ConfiguratorScene } from "./ConfiguratorScene";
import { ConfiguratorControls } from "./ConfiguratorControls";
import { useConfiguratorState } from "./useConfiguratorState";
import { hapticConfiguratorOpen, hapticConfiguratorSave } from "@/utils/haptics";
import { playConfiguratorSave, playBlockDeselect } from "@/utils/audio";
import { COLORS, SPACING, RADIUS, GLASS_STYLE, FONT } from "@/constants/theme";

interface Props {
  blockId: string;
  onClose: () => void;
}

export function BlockConfigurator({ blockId, onClose }: Props) {
  // ... implementation
}
```

**Layout:**
```
View (position: absolute, fill screen, zIndex above tower)
  LinearGradient (dark navy → deep purple → near-black, full screen)
  Canvas (flex: 1, transparent background)
    ConfiguratorScene
  View (absolute bottom, controls overlay)
    ConfiguratorControls
  View (absolute top, header bar)
    TouchableOpacity "Back" (left)
    Text "Customize" (center)
    TouchableOpacity "Save" (right, gold accent)
```

**Key behavior:**
- Mounts with fade-in animation (Animated.Value 0→1 over 300ms)
- On mount: `hapticConfiguratorOpen()`
- Save button: calls `configuratorState.save()` → `hapticConfiguratorSave()` + `playConfiguratorSave()` → `onClose()`
- Back button: calls `configuratorState.discard()` → `playBlockDeselect()` → `onClose()`
- The R3F `Canvas` should have `style={{ backgroundColor: 'transparent' }}` so the gradient shows through

**Entrance animation:**
```typescript
const fadeAnim = useRef(new Animated.Value(0)).current;
useEffect(() => {
  hapticConfiguratorOpen();
  Animated.spring(fadeAnim, {
    toValue: 1,
    tension: 65,
    friction: 10,
    useNativeDriver: true,
  }).start();
}, []);
```

**Exit (wrap onClose):**
```typescript
const handleClose = useCallback(() => {
  Animated.timing(fadeAnim, {
    toValue: 0,
    duration: 200,
    useNativeDriver: true,
  }).start(() => onClose());
}, [onClose]);
```

---

#### `apps/mobile/components/configurator/ConfiguratorScene.tsx`

R3F scene with a single block + orbit camera.

```typescript
import React, { useRef, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber/native";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { createBlockMaterial } from "../tower/BlockShader";
import { DemoBlock } from "@/stores/tower-store";
import { DEFAULT_TOWER_CONFIG } from "@monolith/common";

interface Props {
  block: DemoBlock;
  previewColor?: string;
  previewStyle?: number;
  previewName?: string;
}
```

**Architecture — Single-instance InstancedMesh:**

Use a `THREE.InstancedMesh` with `count = 1` and the same `createBlockMaterial()` from `BlockShader.ts`. This is critical — it ensures the exact same visual quality as the tower, zero shader duplication.

**Setup:**
```typescript
const { geometry, material } = useMemo(() => {
  const geo = new RoundedBoxGeometry(1, 1, 1, 1, 0.04);
  const mat = createBlockMaterial();

  // Set up per-instance attributes (count=1)
  const floatAttr = (name: string, itemSize: number) => {
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(itemSize), itemSize);
    geo.setAttribute(name, attr);
    return attr;
  };

  // All the attributes the shader expects
  floatAttr("aEnergy", 1);
  floatAttr("aOwnerColor", 3);
  floatAttr("aLayerNorm", 1);
  floatAttr("aStyle", 1);
  floatAttr("aTextureId", 1);
  floatAttr("aFade", 1);
  floatAttr("aHighlight", 1);
  floatAttr("aImageIndex", 1);
  floatAttr("aEvolutionTier", 1);
  floatAttr("aPersonality", 1);
  floatAttr("aIsBot", 1);
  floatAttr("aHasOwner", 1);
  floatAttr("aChargeReaction", 1);

  return { geometry: geo, material: mat };
}, []);
```

**Attribute updates (in useFrame or useEffect when preview changes):**
```typescript
// When previewColor/previewStyle change, update the single instance's attributes
const color = new THREE.Color(previewColor || block.ownerColor);
const ownerColorAttr = geometry.getAttribute("aOwnerColor") as THREE.InstancedBufferAttribute;
ownerColorAttr.array[0] = color.r;
ownerColorAttr.array[1] = color.g;
ownerColorAttr.array[2] = color.b;
ownerColorAttr.needsUpdate = true;

const styleAttr = geometry.getAttribute("aStyle") as THREE.InstancedBufferAttribute;
styleAttr.array[0] = previewStyle ?? block.style ?? 0;
styleAttr.needsUpdate = true;

// Set energy high so block looks vibrant during customization
const energyAttr = geometry.getAttribute("aEnergy") as THREE.InstancedBufferAttribute;
energyAttr.array[0] = 0.85;
energyAttr.needsUpdate = true;

// Has owner = true
const hasOwnerAttr = geometry.getAttribute("aHasOwner") as THREE.InstancedBufferAttribute;
hasOwnerAttr.array[0] = 1.0;
hasOwnerAttr.needsUpdate = true;

// Set evolution tier
const evoAttr = geometry.getAttribute("aEvolutionTier") as THREE.InstancedBufferAttribute;
evoAttr.array[0] = block.evolutionTier ?? 0;
evoAttr.needsUpdate = true;

// Personality (auto hash)
const persAttr = geometry.getAttribute("aPersonality") as THREE.InstancedBufferAttribute;
persAttr.array[0] = block.personality ?? -1;
persAttr.needsUpdate = true;
```

**Instance matrix (scale 2x, centered at origin):**
```typescript
const matrix = useMemo(() => {
  const m = new THREE.Matrix4();
  m.makeScale(2, 2, 2);  // 2x larger than tower blocks
  return m;
}, []);

// In useEffect or on mount:
if (meshRef.current) {
  meshRef.current.setMatrixAt(0, matrix);
  meshRef.current.instanceMatrix.needsUpdate = true;
}
```

**Camera orbit system:**
```typescript
// Pre-allocate (no new in useFrame!)
const cameraState = useRef({
  azimuth: 0,
  autoRotating: true,
  lastInteraction: 0,
  AUTO_RESUME_DELAY: 2000,  // resume auto-orbit after 2s idle
}).current;

// Camera distance and height
const ORBIT_DISTANCE = 4.0;
const ORBIT_HEIGHT = 0.6;
const AUTO_SPEED = 0.3;  // rad/s

useFrame((state, delta) => {
  const cam = state.camera;

  // Auto-rotate or idle
  if (cameraState.autoRotating) {
    cameraState.azimuth += AUTO_SPEED * delta;
  } else {
    // Check if enough time passed to resume auto-orbit
    const now = Date.now();
    if (now - cameraState.lastInteraction > cameraState.AUTO_RESUME_DELAY) {
      cameraState.autoRotating = true;
    }
  }

  cam.position.x = Math.sin(cameraState.azimuth) * ORBIT_DISTANCE;
  cam.position.y = ORBIT_HEIGHT;
  cam.position.z = Math.cos(cameraState.azimuth) * ORBIT_DISTANCE;
  cam.lookAt(0, 0, 0);

  // Update shader uniforms (uTime, camera-dependent)
  if (material.uniforms.uTime) {
    material.uniforms.uTime.value = state.clock.elapsedTime;
  }
  if (material.uniforms.uCameraPos) {
    material.uniforms.uCameraPos.value.copy(cam.position);
  }
});
```

**Drag gesture for manual orbit:**

Use a `PanResponder` on a transparent `View` overlaying the Canvas:

```typescript
const panResponder = useRef(
  PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      const sensitivity = 0.005;
      cameraState.azimuth += gestureState.dx * sensitivity;
      cameraState.autoRotating = false;
      cameraState.lastInteraction = Date.now();
    },
    onPanResponderRelease: () => {
      cameraState.lastInteraction = Date.now();
    },
  })
).current;
```

IMPORTANT: The PanResponder `View` must be overlaid on the Canvas but NOT cover the bottom controls. Use absolute positioning with a `bottom` offset matching the controls height.

**Shader uniforms to set on the material:**

The `createBlockMaterial()` function returns a `ShaderMaterial` with uniforms. The configurator scene needs to keep these updated:

- `uTime` — clock time (in useFrame)
- `uCameraPos` — camera position (in useFrame)
- `uTowerHeight` — use `getTowerHeight(DEFAULT_TOWER_CONFIG)` (static)
- `uSpireStartY` — from config (static)
- `uInspectedBlockId` — set to `-1` (not inspecting in tower context)
- `uClaimWaveIntensity` — set to `0` (no celebration)
- `uClaimLightIntensity` — set to `0`
- `uDimOthers` — set to `0` (no dimming)

---

#### `apps/mobile/components/configurator/useConfiguratorState.ts`

Local state hook for the configurator session.

```typescript
import { useCallback, useRef, useState } from "react";
import { DemoBlock, useTowerStore } from "@/stores/tower-store";
import { useBlockActions } from "@/hooks/useBlockActions";

interface ConfiguratorChanges {
  color?: string;
  style?: number;
  name?: string;
}

export function useConfiguratorState(blockId: string) {
  const block = useTowerStore((s) => s.demoBlocks.find((b) => b.id === blockId));

  // Snapshot original values for revert
  const originalRef = useRef({
    color: block?.ownerColor,
    style: block?.style,
    name: block?.name,
  });

  // Pending changes (not yet saved to network)
  const [pending, setPending] = useState<ConfiguratorChanges>({});

  // Preview values = original merged with pending
  const preview = {
    color: pending.color ?? originalRef.current.color,
    style: pending.style ?? originalRef.current.style,
    name: pending.name ?? originalRef.current.name,
  };

  const updatePreview = useCallback((changes: Partial<ConfiguratorChanges>) => {
    setPending((prev) => ({ ...prev, ...changes }));
  }, []);

  // On save: send all pending changes as ONE network message
  const { applyCustomize } = useBlockActions();

  const save = useCallback(() => {
    if (Object.keys(pending).length === 0) return;
    // applyCustomize handles dual-path (offline + multiplayer)
    applyCustomize(pending);
  }, [pending, applyCustomize]);

  const discard = useCallback(() => {
    // Revert local preview to original
    // Since we haven't sent anything to the network, nothing to undo
    setPending({});
  }, []);

  const hasChanges = Object.keys(pending).length > 0;

  return { block, preview, updatePreview, save, discard, hasChanges };
}
```

**IMPORTANT:** `applyCustomize` is currently defined inside `useBlockActions` hook (line 329 of `useBlockActions.ts`). The configurator needs access to it. Two options:

1. **Option A (preferred):** Import `useBlockActions` in `useConfiguratorState` and destructure `applyCustomize` from it. This requires `useBlockActions` to not depend on inspector-specific state that wouldn't be available in the configurator context. Check: `applyCustomize` depends on `selectedBlockId`, `mpConnected`, `sendCustomize`, `customizeBlock`. The configurator must ensure `selectedBlockId` is set (it should be, since we came from the inspector).

2. **Option B (if Option A has issues):** Extract `applyCustomize` into a standalone hook or into `tower-store.ts`.

For Option A, the configurator should NOT deselect the block when opening. The `selectedBlockId` in `tower-store` should remain set to the block being customized.

---

#### `apps/mobile/components/configurator/ConfiguratorControls.tsx`

Bottom overlay with the 3 customization sections.

```typescript
interface Props {
  preview: { color?: string; style?: number; name?: string };
  onColorChange: (color: string) => void;
  onStyleChange: (style: number) => void;
  onNameChange: (name: string) => void;
}
```

**Layout:**
```
View (glass background, borderTopLeftRadius/Right: 24, paddingBottom: insets.bottom)
  ScrollView (horizontal: false)
    Section "Color"
      ColorWheel component
    Section "Style"
      StylePicker component (horizontal scroll)
    Section "Name"
      TextInput + character count
```

**Section header styling:** Use `FONT.label` + `COLORS.textSecondary` from theme, uppercase, letter-spacing 1.5. Match the existing `InspectorCustomize` section headers.

---

#### `apps/mobile/components/configurator/ColorWheel.tsx`

Full HSL color wheel replacing the 16-preset grid.

**Implementation approach — pre-rendered image + touch math:**

1. Generate a 512x512 HSL color wheel PNG at build time (or include as static asset)
2. Use an `Image` component with the wheel PNG
3. Overlay a transparent `View` with a `PanResponder` for touch tracking
4. Map touch position to hue (angle from center) and saturation (distance from center)
5. Show a small circle indicator at the selected position
6. Add a vertical brightness slider below the wheel

**Touch-to-color math:**
```typescript
function touchToHSL(
  touchX: number,
  touchY: number,
  centerX: number,
  centerY: number,
  radius: number
): { h: number; s: number; l: number } {
  const dx = touchX - centerX;
  const dy = touchY - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const clampedDist = Math.min(dist, radius);

  const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  const saturation = (clampedDist / radius) * 100;

  return { h: hue, s: saturation, l: 50 }; // lightness from slider
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
```

**Quick-pick presets:** Show the 16 `BLOCK_COLORS` as small dots around the wheel perimeter so users can still tap a preset color quickly. These dots should have a gold border when selected.

**Lightness slider:** Horizontal strip below the wheel, gradient from dark to light at the current hue. Thumb position maps to lightness 10-90%.

**Haptic feedback:** Call `hapticColorScrub()` on each color change (debounce to ~50ms to avoid haptic spam during fast scrubbing).

**If generating the wheel PNG is too complex**, an alternative is to render the wheel using a series of `View` elements arranged radially with background colors, OR use `expo-gl` to render a small shader quad. The simplest path is a static PNG asset.

**Static asset path:** `apps/mobile/assets/images/color-wheel.png` — a 512x512 PNG of an HSL wheel (full saturation at edge, white at center). This can be generated programmatically with a Node.js script:

```javascript
// scripts/generate-color-wheel.js
const { createCanvas } = require("canvas");
const fs = require("fs");

const size = 512;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext("2d");
const center = size / 2;
const radius = center - 4;

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const dx = x - center;
    const dy = y - center;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > radius) continue;
    const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const sat = (dist / radius) * 100;
    ctx.fillStyle = `hsl(${hue}, ${sat}%, 50%)`;
    ctx.fillRect(x, y, 1, 1);
  }
}

fs.writeFileSync("apps/mobile/assets/images/color-wheel.png", canvas.toBuffer("image/png"));
```

---

#### `apps/mobile/components/configurator/StylePicker.tsx`

Horizontal scrolling list of 11 style cards.

```typescript
interface Props {
  currentStyle: number;
  onStyleChange: (style: number) => void;
}
```

**Layout:**
```
ScrollView (horizontal, showsHorizontalScrollIndicator: false)
  {BLOCK_STYLE_LABELS.map(style => (
    TouchableOpacity (
      key={style.id},
      style={[styles.card, currentStyle === style.id && styles.cardSelected]}
      onPress={() => {
        onStyleChange(style.id);
        hapticStyleSelect();
        playCustomize();
      }}
    )
      View (colored preview swatch — use style's representative color)
      Text (style.name)
      Text (style.description, secondary color, smaller)
    /TouchableOpacity
  ))}
```

**Card sizing:** 100w × 120h, 12px gap, borderRadius 12 (`RADIUS.md`).

**Selected state:** Gold border (2px `COLORS.goldAccent`), light gold background (`rgba(212, 175, 85, 0.08)`).

**Preview swatch:** A 60×60 rounded square showing a representative color for each style:
- Default: the user's current color
- Holographic: rainbow gradient
- Neon: bright saturated version of current color
- Matte: desaturated version
- Glass: lighter/translucent version
- Fire: orange-red gradient
- Ice: blue-white gradient
- Lava: red-black gradient
- Aurora: green-purple gradient
- Crystal: teal-white gradient
- Nature: green-brown gradient

These are static preview colors — the real preview is on the 3D block above.

---

### Files to Modify (Phase 2)

#### `apps/mobile/stores/tower-store.ts`

Add configurator state:

```typescript
// Add to TowerState interface:
configuratorBlockId: string | null;
setConfiguratorBlockId: (id: string | null) => void;

// Add to create() store:
configuratorBlockId: null,
setConfiguratorBlockId: (id) => set({ configuratorBlockId: id }),
```

#### `apps/mobile/app/(tabs)/index.tsx`

Mount the configurator:

```typescript
// Add import
import { BlockConfigurator } from "@/components/configurator/BlockConfigurator";

// Add to state reads
const configuratorBlockId = useTowerStore((s) => s.configuratorBlockId);
const setConfiguratorBlockId = useTowerStore((s) => s.setConfiguratorBlockId);

// Add to anyOverlayOpen
const anyOverlayOpen = !!selectedBlockId || showBoard || showSettings || showWalletConnect || showMyBlocks || lootPending || !!configuratorBlockId;

// Add to JSX (after BlockInspector, before FloatingNav)
{configuratorBlockId && (
  <BlockConfigurator
    blockId={configuratorBlockId}
    onClose={() => setConfiguratorBlockId(null)}
  />
)}
```

#### `apps/mobile/components/inspector/InspectorActions.tsx`

Change "Customize" button to open configurator:

```typescript
// Find the Customize button (around line 182-189)
// Change onPress from onCustomizeToggle() to:
onPress={() => {
  useTowerStore.getState().setConfiguratorBlockId(blockId);
  hapticButtonPress();
  playButtonTap();
}}
```

Remove the `showCustomize` prop and `onCustomizeToggle` callback — they're no longer needed.

#### `apps/mobile/components/ui/BlockInspector.tsx`

Remove inline InspectorCustomize:

1. Remove `showCustomize` state (line 89)
2. Remove `isExpanded` logic that depended on `showCustomize` (line 91)
3. Remove `InspectorCustomize` import and rendering (lines 376-388)
4. The inspector should always be at compact height (280px) — the expanded 540px mode was for inline customize
5. Remove `onCustomizeToggle` from `InspectorActions` props
6. Keep the inspector visible when configurator opens (user can see both, or we dismiss inspector when configurator opens — simpler: dismiss inspector)

**Decision: Dismiss inspector when configurator opens.** When `configuratorBlockId` is set, `BlockInspector` should not render. Add a check:

```typescript
// At top of BlockInspector render:
const configuratorBlockId = useTowerStore((s) => s.configuratorBlockId);
if (configuratorBlockId) return null;
```

#### `apps/mobile/components/tower/TowerScene.tsx`

**Pause tower animation when configurator is open** to save GPU:

```typescript
const configuratorBlockId = useTowerStore((s) => s.configuratorBlockId);

// In useFrame, early return if configurator is open:
useFrame((state, delta) => {
  if (configuratorBlockId) return; // pause tower when configurator active
  // ... rest of camera logic
});
```

This prevents two useFrame loops fighting for the GPU.

#### `packages/common/src/constants.ts`

Add style labels:

```typescript
export const BLOCK_STYLE_LABELS = [
  { id: 0, name: "Default", description: "Clean solid color" },
  { id: 1, name: "Holographic", description: "Rainbow sheen" },
  { id: 2, name: "Neon", description: "Bright glow edges" },
  { id: 3, name: "Matte", description: "Flat finish" },
  { id: 4, name: "Glass", description: "Transparent shine" },
  { id: 5, name: "Fire", description: "Warm flames" },
  { id: 6, name: "Ice", description: "Frozen crystal" },
  { id: 7, name: "Lava", description: "Flowing magma" },
  { id: 8, name: "Aurora", description: "Northern lights" },
  { id: 9, name: "Crystal", description: "Gem facets" },
  { id: 10, name: "Nature", description: "Organic growth" },
] as const;
```

---

## Phase 3: Streamlined Customization Controls

### Goal

Wire up the 3 knobs (ColorWheel, StylePicker, Name) to live-preview the 3D block in the configurator, batch-save on confirm.

### Data Flow

```
User scrubs color wheel
  → ColorWheel.onColorChange(hex)
  → ConfiguratorControls.onColorChange(hex)
  → useConfiguratorState.updatePreview({ color: hex })
  → ConfiguratorScene receives previewColor
  → Updates aOwnerColor attribute on single-instance mesh
  → Block updates in real-time (next useFrame)

User taps "Save"
  → useConfiguratorState.save()
  → applyCustomize({ color, style, name }) — ALL changes at once
  → if mpConnected: sendCustomize() → server validates → broadcasts to all
  → if offline: customizeBlock() → local store → persist

Other players see:
  → block_update message with eventType:"customize"
  → applySingleBlockUpdate() in multiplayer-store
  → tower-store updates → TowerGrid re-renders
```

### Implementation Details

#### Live Preview in ConfiguratorScene

The `ConfiguratorScene` component receives `previewColor`, `previewStyle`, `previewName` as props. In a `useEffect` (NOT useFrame — these change infrequently), update the instanced attributes:

```typescript
useEffect(() => {
  if (!meshRef.current) return;
  const geo = meshRef.current.geometry;

  if (previewColor) {
    const c = tmpColor.current.set(previewColor);
    const attr = geo.getAttribute("aOwnerColor") as THREE.InstancedBufferAttribute;
    attr.array[0] = c.r;
    attr.array[1] = c.g;
    attr.array[2] = c.b;
    attr.needsUpdate = true;
  }

  if (previewStyle !== undefined) {
    const attr = geo.getAttribute("aStyle") as THREE.InstancedBufferAttribute;
    attr.array[0] = previewStyle;
    attr.needsUpdate = true;
  }
}, [previewColor, previewStyle]);
```

Pre-allocate `tmpColor`:
```typescript
const tmpColor = useRef(new THREE.Color());
```

#### Name Input in ConfiguratorControls

Reuse the pattern from `InspectorCustomize.tsx` lines 100-116:
- `TextInput` with max 12 characters
- Monospace font (`Platform.OS === 'ios' ? 'Menlo' : 'monospace'`)
- "Set" button or auto-apply on blur
- Show character count: `{name.length}/12`
- Name doesn't affect 3D preview (it's metadata only), but update it in pending changes

#### Batch Save via applyCustomize

The existing `applyCustomize` in `useBlockActions.ts` (line 329) already accepts a `changes` object with multiple fields:

```typescript
const applyCustomize = useCallback((changes: {
  color?: string;
  emoji?: string;
  name?: string;
  style?: number;
  textureId?: number;
  personality?: number;
}) => {
  if (!selectedBlockId) return;
  if (mpConnected) {
    sendCustomize({ blockId: selectedBlockId, wallet, changes });
  } else {
    customizeBlock(selectedBlockId, changes);
  }
}, [selectedBlockId, mpConnected, sendCustomize, customizeBlock]);
```

This already supports batch! No server changes needed — `TowerRoom.ts` applies all fields from `changes` in one handler.

The configurator just needs to call it once on save with all pending changes:
```typescript
applyCustomize({
  ...(pending.color && { color: pending.color }),
  ...(pending.style !== undefined && { style: pending.style }),
  ...(pending.name && { name: pending.name }),
});
```

### CUT Items — What to Remove

**`apps/mobile/components/inspector/InspectorCustomize.tsx`:**
- This file is no longer rendered. Keep it in the codebase temporarily but it won't be imported anywhere after Phase 2 changes to `BlockInspector.tsx`.
- Once confirmed working, delete it.

**From InspectorCustomize, these sections are CUT from the new UI:**
- Emoji grid (lines 118-130)
- TextureId picker (not rendered but prop existed)
- Personality/face picker (lines 53-77)

**Data model stays intact** — emoji, textureId, personality fields remain in `DemoBlock`, `CustomizeMessage`, `BlockSchema`, and Supabase. They just don't have manual UI. Loot drops can still award emojis/textures. Faces are auto-assigned by hash.

---

## Phase 4: Haptics & Sound Polish

### Goal

Every configurator interaction should feel satisfying with appropriate haptic and audio feedback.

### New Haptic Functions

Add to `apps/mobile/utils/haptics.ts`:

```typescript
/** Color wheel scrub — ultra-light selection tick */
export function hapticColorScrub() {
  safeHaptic(() => Haptics.selectionAsync());
}

/** Style card tap — medium satisfying press */
export function hapticStyleSelect() {
  safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Configurator save — success confirmation */
export function hapticConfiguratorSave() {
  safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Configurator open — light entrance */
export function hapticConfiguratorOpen() {
  safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
```

### New Sound Effects

Add to `apps/mobile/utils/audio.ts`:

1. Generate a new save confirmation sound using `scripts/generate-sounds.js`. It should be in the A Dorian palette (matching existing sounds), ~200ms, satisfying "completion" tone — a rising major 3rd with a soft pad tail.

2. Register in `initAudio()`:
```typescript
await loadPlayer("configuratorSave", require("../assets/sfx/configurator-save.wav"));
```

3. Export:
```typescript
export function playConfiguratorSave() { play("configuratorSave"); }
```

### Interaction → Feedback Mapping

| Interaction | Haptic | Sound | Debounce |
|------------|--------|-------|----------|
| Color wheel scrub | `hapticColorScrub()` | None (too frequent) | 50ms |
| Color preset tap | `hapticButtonPress()` | `playButtonTap()` | None |
| Style card tap | `hapticStyleSelect()` | `playCustomize()` | None |
| Name "Set" button | `hapticButtonPress()` | `playButtonTap()` | None |
| Save button | `hapticConfiguratorSave()` | `playConfiguratorSave()` | None |
| Back/discard | `hapticBlockDeselect()` | `playBlockDeselect()` | None |
| Configurator open | `hapticConfiguratorOpen()` | None (panel open is visual enough) | None |
| Drag orbit start | None | None | N/A |

### Polish: Style Change Flash

When the user taps a style card, briefly flash the block to draw attention to the change:

In `ConfiguratorScene`, add a flash effect:
```typescript
const flashRef = useRef(0);

// When style changes, trigger flash
useEffect(() => {
  if (previewStyle !== undefined) {
    flashRef.current = 0.4; // flash intensity
  }
}, [previewStyle]);

// In useFrame, decay the flash
useFrame((_, delta) => {
  if (flashRef.current > 0) {
    flashRef.current = Math.max(0, flashRef.current - delta * 2.0);
    // Apply to highlight attribute
    const attr = geometry.getAttribute("aHighlight") as THREE.InstancedBufferAttribute;
    attr.array[0] = flashRef.current;
    attr.needsUpdate = true;
  }
});
```

This uses the existing `aHighlight` → `vHighlight` pipeline in the shader which does pop-out + brightness boost (vertex shader lines 72-84).

### Polish: Entrance Animation

The block should scale up from 0 to full size with a spring when the configurator opens:

```typescript
const scaleRef = useRef(0.01);
const scaleTarget = 2.0; // target scale
const matrixRef = useRef(new THREE.Matrix4());

useFrame((_, delta) => {
  // Spring toward target
  scaleRef.current += (scaleTarget - scaleRef.current) * Math.min(delta * 8, 1);
  matrixRef.current.makeScale(scaleRef.current, scaleRef.current, scaleRef.current);
  if (meshRef.current) {
    meshRef.current.setMatrixAt(0, matrixRef.current);
    meshRef.current.instanceMatrix.needsUpdate = true;
  }
});
```

---

## Phase 5: Image Upload Architecture (Design Only)

### NO CODE IN THIS PHASE — Design document only.

### Data Model (already exists)

- `BlockAppearanceSchema.imageUrl: string` in server TowerState
- `appearance.imageUrl` in Supabase JSONB column
- `aImageIndex` attribute in shader (for texture atlas)
- `inspectImageRef` in TowerGrid for lazy-loaded inspection texture

### Proposed Upload Flow

```
1. User taps "Add Image" in configurator
2. expo-image-picker opens camera roll
3. Client resizes to 512×512 via expo-image-manipulator
4. Client requests upload token: room.send("request_upload_token", { blockId })
5. Server validates ownership, returns signed token
6. Client POSTs to /api/blocks/:blockId/image with token + base64
7. Server stores image:
   - Phase A: Supabase Storage bucket (existing, 2MB limit)
   - Phase B: Cloudflare R2 (S3-compatible, better CDN)
8. Server updates block.appearance.imageUrl
9. Server broadcasts block_update to all clients
10. Clients lazy-load image texture when inspecting that block
```

### Storage Strategy

**Phase A (Supabase Storage — simplest):**
- Bucket: `block-images` (already created in migration 006)
- Path: `{blockId}.webp`
- Size limit: 2MB
- Formats: webp, png, jpeg
- Public URL: `https://pscgsbdznfitscxflxrm.supabase.co/storage/v1/object/public/block-images/{blockId}.webp`

**Phase B (Cloudflare R2 — better CDN):**
- Bucket: `monolith-block-images`
- Path: `{blockId}.webp`
- Public URL via custom domain: `https://images.monolith.app/{blockId}.webp`
- Server uses `@aws-sdk/client-s3` with R2 endpoint
- Add env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`

### Display LOD Strategy

| Context | Resolution | Load |
|---------|-----------|------|
| Tower overview (far) | 64×64 thumbnail | Lazy, batch |
| Tower zoomed (medium) | 128×128 | Lazy, on visible |
| Inspector (close) | 512×512 full | On inspect |
| Configurator | 512×512 full | Immediate |

Generate thumbnails server-side on upload using `sharp`:
```
Original (512×512) → medium (128×128) → thumb (64×64)
```

Store all three sizes:
```
{blockId}.webp        — 512×512
{blockId}_128.webp    — 128×128
{blockId}_64.webp     — 64×64
```

### Texture Atlas for Tower View

Loading 650 individual textures is not feasible. For the tower overview:

1. Build a texture atlas (2048×2048, fits 256 64×64 thumbnails)
2. Assign each image-having block a slot in the atlas
3. Pass slot index via `aImageIndex` attribute
4. Shader samples from atlas using calculated UVs
5. Atlas rebuilt when images change (debounced, not per-frame)

This is the most complex part and is why image upload is deferred.

### Moderation (Future)

- Option A: Client-side NSFW detection before upload (ML model)
- Option B: Server-side moderation API (AWS Rekognition, Google Cloud Vision)
- Option C: Community reporting + manual review queue
- Start with Option C (lowest effort), add A or B later

---

## Testing Strategy

### Per-Phase Test Plan

#### Phase 1 (Shader)
```bash
cd apps/mobile && npx jest                    # All 222 tests pass
timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json  # Type check
```
- Visual: unclaimed blocks = frosted glass, not gold wireframe
- Visual: owned dead blocks = desaturated owner color (unchanged)
- Perf: 60fps maintained

#### Phase 2 (Configurator)
```bash
cd apps/mobile && npx jest                    # All tests + new tests
timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json
```
New tests to write:
- `__tests__/configurator/useConfiguratorState.test.ts` — save/discard/preview logic
- `__tests__/configurator/BlockConfigurator.test.tsx` — mounts/unmounts correctly
- Visual: block renders in isolated scene
- Visual: orbit camera works (auto + drag)
- Visual: gradient background renders
- Flow: inspector "Customize" → configurator → back → inspector

#### Phase 3 (Controls)
```bash
cd apps/mobile && npx jest
timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json
```
New tests:
- `__tests__/configurator/ColorWheel.test.ts` — `touchToHSL` math
- `__tests__/configurator/ConfiguratorControls.test.tsx` — all 3 knobs render
- Integration: color change → preview updates → save → network message sent
- Integration: style change → preview updates → save → network message sent
- Offline mode: save works without Colyseus

#### Phase 4 (Polish)
- Haptic events fire on correct interactions
- Sound plays on save only (not on scrub)
- No double-sounds
- Transitions smooth on low-end devices

#### Phase 5 (Design)
- Document review only

### Regression Checklist (Run After Each Phase)

- [ ] `cd apps/mobile && npx jest` — 222+ tests pass
- [ ] `timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json` — type check passes (3 known errors in useBlockActions.ts for dynamic imports are the baseline)
- [ ] Tower renders at 60fps with 650 blocks
- [ ] Block tap → inspector works
- [ ] Claim flow works
- [ ] Charge flow works
- [ ] Multiplayer sync works (if server running)
- [ ] Onboarding flow works (post-claim customize step may need updating)

---

## Risk Areas

| Risk | Impact | Mitigation |
|------|--------|------------|
| Two R3F Canvases fighting for GPU | Frame drops | Pause tower `useFrame` when configurator open |
| Single-instance InstancedMesh shader issues | Black/broken block | Test early in Phase 2; fallback: regular Mesh with adapted shader |
| Color wheel touch precision on mobile | Wrong colors selected | Use `event.nativeEvent.locationX/Y` relative to container |
| `applyCustomize` depends on `selectedBlockId` | Save fails | Keep `selectedBlockId` set when configurator opens |
| Onboarding references InspectorCustomize | Broken onboarding | Check `OnboardingFlow` for customize step, update if needed |
| `anyOverlayOpen` not updated | FloatingNav visible behind configurator | Add `configuratorBlockId` to the boolean |
| PanResponder on Canvas overlay steals tower touches | Broken tower interaction | Only mount PanResponder when configurator is open |
| `node-canvas` not available for wheel generation | Can't generate PNG | Alternative: hand-create the PNG in any image editor, or render wheel client-side with Canvas |

---

## File Index

### New Files (Phase 2-4)

| File | Phase | Purpose |
|------|-------|---------|
| `apps/mobile/components/configurator/BlockConfigurator.tsx` | 2 | Full-screen wrapper |
| `apps/mobile/components/configurator/ConfiguratorScene.tsx` | 2 | R3F scene (1 block + camera) |
| `apps/mobile/components/configurator/ConfiguratorControls.tsx` | 3 | Bottom controls layout |
| `apps/mobile/components/configurator/ColorWheel.tsx` | 3 | HSL color wheel picker |
| `apps/mobile/components/configurator/StylePicker.tsx` | 3 | Horizontal style cards |
| `apps/mobile/components/configurator/useConfiguratorState.ts` | 2 | Local preview state + batch save |
| `apps/mobile/assets/images/color-wheel.png` | 3 | Pre-rendered HSL wheel |
| `apps/mobile/assets/sfx/configurator-save.wav` | 4 | Save confirmation sound |
| `scripts/generate-color-wheel.js` | 3 | Generates color wheel PNG |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `apps/mobile/components/tower/BlockShader.ts` | 1 | Frosted glass unclaimed blocks (lines 1108-1155) |
| `apps/mobile/stores/tower-store.ts` | 2 | Add `configuratorBlockId` state |
| `apps/mobile/app/(tabs)/index.tsx` | 2 | Mount configurator, update `anyOverlayOpen` |
| `apps/mobile/components/inspector/InspectorActions.tsx` | 2 | "Customize" opens configurator |
| `apps/mobile/components/ui/BlockInspector.tsx` | 2 | Remove inline customize, hide when configurator open |
| `apps/mobile/components/tower/TowerScene.tsx` | 2 | Pause useFrame when configurator open |
| `packages/common/src/constants.ts` | 2 | Add `BLOCK_STYLE_LABELS` |
| `apps/mobile/utils/haptics.ts` | 4 | Add 4 new haptic functions |
| `apps/mobile/utils/audio.ts` | 4 | Add `configuratorSave` sound |

### Unchanged (but relevant for reference)

| File | Why |
|------|-----|
| `apps/server/src/rooms/TowerRoom.ts` | Already handles batched customize messages — no changes needed |
| `apps/mobile/stores/multiplayer-store.ts` | `sendCustomize` already works — no changes needed |
| `apps/mobile/hooks/useBlockActions.ts` | `applyCustomize` already supports batch — may need minor export adjustment |
| `packages/common/src/types.ts` | `CustomizeMessage.changes` already supports all fields — no changes |
| `supabase/migrations/` | No schema changes needed |

---

## Ralph Loop Execution Order

```
PHASE 1 — Frosted Glass (shader only)
  Step 1.1: Read BlockShader.ts lines 1105-1168
  Step 1.2: Replace unclaimed block section with frosted glass
  Step 1.3: Run tests + type check
  Step 1.4: Commit "feat(customization): frosted glass unclaimed blocks"

PHASE 2 — Configurator Shell
  Step 2.1: Add configuratorBlockId to tower-store.ts
  Step 2.2: Add BLOCK_STYLE_LABELS to constants.ts
  Step 2.3: Create useConfiguratorState.ts
  Step 2.4: Create ConfiguratorScene.tsx (single-instance InstancedMesh + orbit camera)
  Step 2.5: Create BlockConfigurator.tsx (full-screen wrapper + gradient + Canvas)
  Step 2.6: Modify InspectorActions.tsx — "Customize" opens configurator
  Step 2.7: Modify BlockInspector.tsx — hide when configurator open, remove InspectorCustomize
  Step 2.8: Mount in index.tsx, update anyOverlayOpen
  Step 2.9: Pause TowerScene.tsx useFrame when configurator open
  Step 2.10: Run tests + type check
  Step 2.11: Commit "feat(customization): isolated 3D block configurator"

PHASE 3 — Controls
  Step 3.1: Generate color-wheel.png (or create manually)
  Step 3.2: Create ColorWheel.tsx
  Step 3.3: Create StylePicker.tsx
  Step 3.4: Create ConfiguratorControls.tsx
  Step 3.5: Wire controls → useConfiguratorState → ConfiguratorScene
  Step 3.6: Implement save flow (batch applyCustomize)
  Step 3.7: Test offline + multiplayer paths
  Step 3.8: Write unit tests for touchToHSL, useConfiguratorState
  Step 3.9: Run all tests + type check
  Step 3.10: Commit "feat(customization): color wheel, style picker, batch save"

PHASE 4 — Polish
  Step 4.1: Add haptic functions to haptics.ts
  Step 4.2: Generate configurator-save.wav sound
  Step 4.3: Register sound in audio.ts
  Step 4.4: Wire haptics + sound to all interactions (per mapping table)
  Step 4.5: Add style-change flash effect in ConfiguratorScene
  Step 4.6: Add block entrance spring animation
  Step 4.7: Polish entrance/exit transitions
  Step 4.8: Run all tests + type check
  Step 4.9: Commit "feat(customization): haptics, sound, and animation polish"

PHASE 5 — Design Doc
  Step 5.1: This plan's Phase 5 section IS the design doc
  Step 5.2: No code changes
  Step 5.3: Commit plan file: "docs: image upload architecture design"
```

---

## How to Run with Ralph Loop

### Step 1: Create the Worktree

```bash
cd /home/epic/Downloads/monolith
git worktree add ../monolith-customization -b feat/customization-overhaul
cd ../monolith-customization
```

This creates an isolated copy of the repo at `/home/epic/Downloads/monolith-customization` on a new branch `feat/customization-overhaul`. All changes happen there — main branch is untouched.

### Step 2: Launch Ralph Loop

Run this from inside the worktree directory (`/home/epic/Downloads/monolith-customization`):

```
/ralph-loop "You are implementing the Block Customization Overhaul for the Monolith project.

## Your Blueprint

Read docs/CUSTOMIZATION_OVERHAUL_PLAN.md — this is your COMPLETE implementation blueprint. It contains exact code to write, exact files to modify, exact line numbers, and exact commit messages.

## Rules

1. Follow the 'Ralph Loop Execution Order' section EXACTLY — work through phases 1-4 in order (skip phase 5, it's already written in the plan)
2. Before EVERY file modification, READ the file first
3. Read CONTEXT.md for project conventions and gotchas
4. Read CLAUDE.md for agent instructions
5. After EACH phase, run validation:
   cd apps/mobile && npx jest
   timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json
6. Fix ALL test/type failures before moving to the next phase
7. Commit after each phase using the EXACT commit message from the plan
8. Check the plan's 'Key Conventions (MUST follow)' section — especially dual-path pattern, no new in useFrame, anyOverlayOpen
9. Check the plan's 'Risk Areas' section before starting each phase
10. The 3 pre-existing TS errors in useBlockActions.ts (dynamic imports) are BASELINE — ignore them

## Determining What's Done

At the start of each iteration:
1. Run git log --oneline -10 to see what phases are already committed
2. Check which phase you're on based on existing commits
3. Pick up from the NEXT incomplete step
4. If all 4 phases are committed and tests pass, you're done

## Completion

When ALL 4 phases are complete, tests pass, and type check passes, output:
<promise>CUSTOMIZATION OVERHAUL COMPLETE</promise>" --completion-promise "CUSTOMIZATION OVERHAUL COMPLETE" --max-iterations 30
```

### Step 3: Monitor Progress

While Ralph runs, you can check progress from another terminal:

```bash
# Watch commits landing
cd /home/epic/Downloads/monolith-customization
git log --oneline

# Check which files have been created/modified
git diff --stat main

# See current state
git status
```

### Step 4: Handle Issues

**If Ralph gets stuck looping without progress:**
```
/cancel-ralph
```
Then diagnose what's wrong (usually a test failure or type error), fix it manually, and relaunch.

**If Ralph finishes early (fewer iterations than expected):**
Check git log — it may have completed all phases. Verify with:
```bash
cd apps/mobile && npx jest && timeout 90 npx tsc --noEmit --project tsconfig.json
```

**If a phase has bugs after Ralph completes:**
You can fix them manually on the worktree branch, or relaunch Ralph with a more targeted prompt.

### Step 5: Merge Back to Main

Once all phases are complete and verified:

```bash
# From the main repo
cd /home/epic/Downloads/monolith

# Use merge-safe skill (recommended)
/merge-safe feat/customization-overhaul

# Or manually
git merge feat/customization-overhaul --no-ff -m "feat: block customization overhaul"

# Clean up worktree
git worktree remove ../monolith-customization
```

### Configuration Notes

| Setting | Value | Why |
|---------|-------|-----|
| `--max-iterations 30` | 30 iterations max | 4 phases × ~5 iterations each + buffer for fixes |
| `--completion-promise` | `"CUSTOMIZATION OVERHAUL COMPLETE"` | Ralph stops when it outputs this in a `<promise>` tag |
| Worktree path | `../monolith-customization` | Sibling to main repo, easy to find |
| Branch name | `feat/customization-overhaul` | Conventional feature branch naming |

### What Each Ralph Iteration Does

```
Iteration N:
  1. Receives the SAME prompt (above)
  2. Reads docs/CUSTOMIZATION_OVERHAUL_PLAN.md
  3. Runs git log to see what's already committed
  4. Identifies the next incomplete step
  5. Implements that step (reads files, writes code)
  6. Runs tests + type check
  7. If tests pass: commits with the phase's commit message
  8. If tests fail: fixes failures
  9. Tries to exit → stop hook intercepts → next iteration begins
  10. Repeat until all 4 phases committed → outputs <promise> tag → stops
```

### Estimated Runtime

- **Phase 1** (shader only): ~2-3 iterations
- **Phase 2** (configurator shell, 10 steps): ~5-8 iterations
- **Phase 3** (controls, 10 steps): ~5-8 iterations
- **Phase 4** (polish, 9 steps): ~3-5 iterations
- **Total**: ~15-24 iterations, well within the 30 max
