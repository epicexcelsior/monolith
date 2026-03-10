# Interior Mapping: Block Image Display

## Status: NOT IMPLEMENTED (reverted)

All code was reverted. This document captures the design, what was proven to work, and what blocked progress for a future attempt.

---

## Goal

Display user images (logos, art) inside tower blocks as "windows" into virtual interior rooms with parallax depth. Not flat decals — the outward-facing face of image blocks becomes a window, and the image sits on a back wall that shifts as the camera moves.

**Demo images available** at `/home/epic/Downloads/demo_images/`:
- `solana-sol-logo.png`, `Dogecoin_Logo.png`, `quicknode.png`, `toly.png`

## What Was Proven

### Attribute pipeline works
- Adding `aImageIndex` (float, `InstancedBufferAttribute`) to the block shader **works**.
- Hardcoding `imageIndexArray[i] = (i % 4) + 1` for ~80% of blocks and adding `if (vImageIndex > 0.5) { gl_FragColor = vec4(1,0,0,1); return; }` at the end of the fragment shader turned the tower red. **The varying reaches the fragment shader.**
- This means any per-block conditional rendering based on an instanced attribute is viable.

### Pop-out direction bug (CONFIRMED, FIX KNOWN)
The current block pop-out on selection uses radial-from-Y-axis:
```glsl
vec3 blockCenter = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
worldPos.xyz += (blockCenter / length(blockCenter)) * aHighlight * 0.5;
```
This is wrong for the rectangular monolith. Blocks on the short sides pop sideways.

**Fix**: Use the instance rotation to compute outward direction:
```glsl
vec3 outwardDir = normalize(mat3(instanceMatrix) * vec3(0.0, 0.0, 1.0));
worldPos.xyz += outwardDir * aHighlight * 0.5;
```
`computeBodyLayerPositions` sets `rotY` so local +Z faces outward:
- Front (+Z): `rotY = 0`
- Back (-Z): `rotY = π`
- Right (+X): `rotY = π/2`
- Left (-X): `rotY = -π/2`

Apply the same fix to the glow shader's pop-out code.

## What Blocked Progress

### Texture loading in React Native
`THREE.TextureLoader` does NOT work in React Native — it relies on DOM `Image` which doesn't exist. The texture silently fails to load, so `uImageAtlas` stays `null` and `texture2D()` returns black.

**`expo-three` was tried** (`loadAsync` from `expo-three`). It installs and types check, but we never confirmed the texture actually loaded on-device before reverting. The console logs (`[ImageAtlas] Atlas texture loaded successfully`) were never observed.

Possible issues with expo-three approach:
- `require("@/assets/demo-images/atlas.png")` might not resolve at runtime
- expo-three's `resolveAsync` chain might fail silently
- The texture format (isDataTexture passthrough) might not work with custom ShaderMaterial uniforms

### Interior mapping shader had coordinate space bugs
The face detection compared view-space normals (`vNormal`, transformed by `normalMatrix`) against world-space positions (`blockCenter.xz`). This comparison is invalid — a fix was written using `vWorldNormal` and `vOutwardDir` but was never tested on-device.

### Varying count near GLES 2.0 limit
Adding `vWorldNormal` (vec3), `vOutwardDir` (vec3), `vBlockCenter` (vec3), `vImageIndex` (float) brought the total to ~31 varying floats — near the 32-float minimum for GLES 2.0. Some mobile GPUs may have issues. `vLocalPos` was removed to compensate, but `vWorldY` could also be replaced with `vWorldPos.y` to save another slot.

## Implementation Plan (for next attempt)

### Phase 1: Fix pop-out (standalone, no image dependency)
1. Change pop-out in both main + glow vertex shaders to use `mat3(instanceMatrix) * vec3(0,0,1)`
2. Test on device — blocks should pop outward on all 4 faces

### Phase 2: Get ANY texture rendering in the shader
Before attempting interior mapping, prove a texture can be loaded and sampled:
1. Install `expo-three` (`pnpm add expo-three --filter @monolith/mobile`)
2. Add `uniform sampler2D uTestTex` to the block shader
3. In TowerGrid, load a single small PNG via expo-three's `loadAsync`
4. In the shader, just tint all blocks by `texture2D(uTestTex, vec2(0.5)).rgb`
5. If blocks change color, texture loading works. If not, debug expo-three.

**Alternative texture loading approaches if expo-three fails:**
- `@react-three/drei/native` may have `useTexture` that works
- `expo-gl` direct API: create WebGL texture manually, upload via `gl.texImage2D`
- Pre-encode image as base64 RGBA in a TypeScript file, create `THREE.DataTexture` from raw bytes (no image decoding needed, but large file size)
- Use a headless `<Canvas>` to render images and extract pixel data

### Phase 3: Interior mapping shader
Only after Phase 2 proves textures work:
1. Add `uImageAtlas`, `uCameraPos` uniforms
2. Add `aImageIndex` attribute (proven to work)
3. Add `vOutwardDir`, `vWorldNormal`, `vBlockCenter` varyings
4. Implement interior mapping function using world-space coordinates
5. Call from main() between Layer 1 (base color) and Layer 2 (style)

### Phase 4: Data model + seeding
1. Add `imageUrl?: string` and `imageIndex?: number` to `DemoBlock`
2. Add `imageUrl` to `CustomizeMessage.changes`, server schema, multiplayer store
3. Seed images in both client + server `seed-tower.ts`
4. Bump `CURRENT_TOWER_VERSION`

## Files That Would Be Modified

| File | Change |
|------|--------|
| `packages/common/src/types.ts` | Add `imageUrl` to CustomizeMessage |
| `apps/server/src/schema/TowerState.ts` | Add `imageUrl` to BlockAppearanceSchema |
| `apps/server/src/rooms/TowerRoom.ts` | Serialize + handle imageUrl |
| `apps/mobile/stores/tower-store.ts` | Add imageUrl/imageIndex to DemoBlock, bump version |
| `apps/mobile/stores/multiplayer-store.ts` | Map imageUrl in ServerBlock + serverBlockToDemo |
| `apps/mobile/utils/image-atlas.ts` | **NEW** — atlas loader + slot mapping |
| `apps/mobile/components/tower/BlockShader.ts` | Interior mapping shader, new uniforms/varyings, pop-out fix |
| `apps/mobile/components/tower/TowerGrid.tsx` | Atlas loading, aImageIndex attribute, uCameraPos update |
| `apps/mobile/utils/seed-tower.ts` | Assign demo images to blocks |
| `apps/server/src/utils/seed-tower.ts` | Same seeding for multiplayer |
| `apps/mobile/assets/demo-images/` | **NEW** — demo PNGs + pre-composed atlas |

## Atlas Details

A 2048x2048 PNG with a 4x4 grid of 512px slots. Pre-composed offline via Python PIL:
```bash
python3 -c "
from PIL import Image
atlas = Image.new('RGBA', (2048, 2048), (0,0,0,255))
images = ['solana-sol-logo.png', 'Dogecoin_Logo.png', 'quicknode.png', 'toly.png']
for i, name in enumerate(images):
    img = Image.open(f'/home/epic/Downloads/demo_images/{name}').convert('RGBA')
    img.thumbnail((512, 512))
    x = (i % 4) * 512 + (512 - img.width) // 2
    y = (i // 4) * 512 + (512 - img.height) // 2
    atlas.paste(img, (x, y), img)
atlas.save('atlas.png')
"
```

Slot mapping (1-based):
- 1: solana (col 0, row 0)
- 2: dogecoin (col 1, row 0)
- 3: quicknode (col 2, row 0)
- 4: toly (col 3, row 0)
