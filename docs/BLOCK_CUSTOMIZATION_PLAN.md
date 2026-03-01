# Block Customization Enhancement Plan

> **Living decision document.** Reference for all block customization improvements.
> **Created:** 2026-03-01 | **Status:** Phase 1 complete (1A-1E), Phase 2 complete (2A-2C)

---

## Vision

Give players maximum freedom and delight when customizing their blocks. Make the customization experience intuitive, visually rewarding, and easy to onboard into. Eventually support full 3D block personalization — start with simple, high-impact features.

---

## Current State (Pre-Enhancement)

### What Exists
| Feature | Implementation | Notes |
|---------|---------------|-------|
| **Color** | 16 hex colors (8 base, +8 at streak 3+) | Grid picker in InspectorCustomize |
| **Emoji** | 48 emojis (20 base, +28 at streak 30+) | Horizontal scroller |
| **Style** | 11 GLSL styles (7 base, +4 animated at streak 7+) | Default/Holo/Neon/Matte/Glass/Fire/Ice/Lava/Aurora/Crystal/Nature |
| **Texture** | 7 procedural patterns (all locked behind streak 14+) | Bricks/Circuits/Scales/Camo/Marble/Carbon |
| **Name** | 12-char text input | Always available |
| **Interior images** | 5-slot pre-baked atlas (crypto logos) | Auto-assigned via hash, not user-controllable |
| **Persistence** | Supabase JSONB `blocks.appearance` column | Fire-and-forget writes |

### Pain Points
1. **Energy glow overpowers customization** — specular, rim, pulse, scanline all stack additively on the owner's color/style choices during inspection
2. **No user-uploaded images** — only pre-baked crypto logos in the atlas
3. **Interior-mapped windows** show random images, not user content
4. **Onboarding customize step** immediately shows streak locks, feels restrictive
5. **No 3D preview** of customization — user doesn't see changes reflected in a meaningful 3D way

---

## Architecture Decisions

### Decision 1: Image Storage → Supabase Storage

**Choice:** Supabase Storage bucket (`block-images`)

**Rationale:**
- Already have Supabase set up with service role on server
- Supabase Storage provides CDN, transformations, and RLS
- No need to manage file storage on the Railway server
- Supports image optimization (resize on upload via `transform` parameter)

**Implementation:**
- Create `block-images` public bucket in Supabase
- Server endpoint `POST /api/blocks/:blockId/image` handles upload
- Server resizes to max 512x512 and converts to WebP for optimization
- Store public URL in `blocks.appearance.imageUrl` (JSONB field)
- Client fetches images via Supabase public URL

**Migration needed:** `004_block_images_bucket.sql` (Supabase Storage bucket + RLS policy)

**Image constraints:**
- Max file size: 2MB (before optimization)
- Max dimensions: 512x512 (server resizes)
- Accepted formats: PNG, JPG, WebP
- Storage path: `block-images/{blockId}.webp`

---

### Decision 2: 3D Image Representation → Interior Windows + Holographic Pop-out

**Choice:** Both approaches, optimized

**A. Interior-Mapped Windows (Default View)**
- Extend existing interior mapping system to support dynamic user textures
- Currently uses a pre-baked 5-slot atlas (`image-atlas-data.ts`, 2.1MB base64)
- **Enhancement:** Add a second texture uniform `uUserImage` for user-uploaded images
- When a block has `imageUrl`, load it as a texture and assign it to the block's `imageIndex`
- The parallax depth window effect already works — just need to pipe user images into it
- Visible from outside the tower on all 4 vertical faces

**B. Holographic Pop-Out (Inspection Mode)**
- When inspecting a block that has a custom image:
  - Render a semi-transparent plane floating 0.5 units in front of the block
  - Apply holographic shader effect (scan lines, chromatic aberration, subtle glow)
  - Plane faces the camera (billboard orientation)
  - Scale: ~1.5x block size for visibility
- Uses a separate mesh, not part of the instanced rendering (only 1 block inspected at a time)
- Add/remove from scene dynamically when inspector opens/closes

**Performance considerations:**
- Interior mapping: No perf cost — same atlas sampling, just different texture data
- Holographic pop-out: Single plane mesh, only during inspection — negligible cost
- Texture loading: Lazy-load user images, cache in a TextureCache Map
- Atlas strategy: Keep the pre-baked atlas for default images, overlay user images per-block

---

### Decision 3: Glow Reduction During Inspection → Moderate (50% reduction)

**Choice:** Reduce energy overlay effects by ~50% on the selected/inspected block

**Implementation (SHIPPED — Phase 1A):**
- Added `inspectAtten = mix(1.0, 0.45, vHighlight)` in BlockShader.ts
- All energy-driven additive effects (specular, rim, pulse, scanline, spire, radiate, inner glow) are multiplied by `inspectAtten`
- Highlight effects (Layer 5) toned down: emissive reduced ~50%, more owner-color-dominant
- Glow pass highlight boost reduced from 0.8 to 0.35 alpha, 0.8 to 0.3 color boost
- **Result:** Inspected block retains "alive" feeling but customization (color, style, texture) is clearly visible

**What changed in the shader:**

| Effect | Before (inspected) | After (inspected) |
|--------|--------------------|--------------------|
| Pulse intensity | 100% | 45% |
| Rim glow | 100% | 45% |
| Specular | 100% | 45% |
| Scanline | 100% | 45% |
| Highlight emissive (non-image) | 0.7 | 0.35 |
| Highlight color multiply | 1.4x | 1.15x |
| Glow pass alpha boost | +0.8 | +0.35 |
| Glow pass color boost | +0.8 | +0.3 |

---

### Decision 4: Scope → Phased Rollout

**Phase 1 (Quick Wins — Target: March 3-5)**
- [x] 1A: Glow reduction during inspection (shader changes)
- [x] 1B: Improved onboarding customize UX
- [x] 1C: Image upload UI in InspectorCustomize
- [x] 1D: Supabase Storage bucket + server upload endpoint
- [x] 1E: Dynamic texture loading for user images in interior windows

**Phase 2 (Polish — Target: March 5-7)**
- [x] 2A: Holographic pop-out effect during block inspection
- [x] 2B: Image optimization pipeline (server-side resize/WebP)
- [x] 2C: Texture cache with LRU eviction

**Phase 3 (Post-Hackathon)**
- [ ] Full 3D block configuration system
- [ ] Multiple images per block (gallery mode)
- [ ] Animated GIF/video support
- [ ] Custom shader uploads
- [ ] NFT integration for block skins

---

## Technical Details

### Image Upload Flow

```
User taps "Add Image" in InspectorCustomize
  → expo-image-picker opens
  → User selects/takes photo
  → Client resizes to 512x512 (expo-image-manipulator)
  → Client uploads to server: POST /api/blocks/:blockId/image
  → Server validates ownership (wallet matches block.owner)
  → Server uploads to Supabase Storage: block-images/{blockId}.webp
  → Server updates blocks.appearance.imageUrl
  → Server broadcasts block_update with new imageUrl
  → All clients receive update
  → Client loads texture from URL, assigns to block's imageIndex slot
  → Interior-mapped windows show user's image with parallax depth
```

### Texture Atlas Strategy

**Current:** Single pre-baked atlas (3x2 grid = 6 slots, 5 used)
- Slot 0: Empty
- Slots 1-5: Solana, Dogecoin, QuickNode, Toly, Mike

**Enhanced:** Hybrid atlas + per-block dynamic textures
- Keep atlas for default/bot images (no network cost)
- Add per-block texture override: when `imageUrl` exists, load it
- Use a `TextureCache` Map<string, THREE.Texture> for loaded user images
- LRU eviction (max 50 cached textures)
- During render: check if block has cached texture → use it; else use atlas slot

**Shader changes needed:**
- Add `uniform sampler2D uUserImages[MAX_USER_IMAGES]` OR
- Switch to a dynamic texture atlas approach (more efficient):
  - Maintain a canvas-based dynamic atlas
  - When a user image loads, paint it into the next available atlas slot
  - Update the single atlas texture (no uniform array needed)
  - Map `imageIndex` to the dynamic atlas slot

**Recommended:** Dynamic atlas approach (single texture, no uniform limits)

### Holographic Pop-Out Effect

**Shader sketch:**
```glsl
// Holographic fragment shader
uniform sampler2D uImage;
uniform float uTime;
uniform float uOpacity;

varying vec2 vUv;

void main() {
  vec2 uv = vUv;

  // Scan lines
  float scanLine = sin(uv.y * 200.0 + uTime * 3.0) * 0.03;

  // Chromatic aberration at edges
  float dist = length(uv - 0.5);
  float aberration = dist * 0.01;
  float r = texture2D(uImage, uv + vec2(aberration, 0.0)).r;
  float g = texture2D(uImage, uv).g;
  float b = texture2D(uImage, uv - vec2(aberration, 0.0)).b;

  vec3 color = vec3(r, g, b);
  color += scanLine;

  // Edge glow
  float edgeFade = smoothstep(0.5, 0.3, dist);
  float alpha = edgeFade * uOpacity;

  // Holographic tint
  color += vec3(0.1, 0.3, 0.5) * (1.0 - edgeFade) * 0.3;

  gl_FragColor = vec4(color, alpha);
}
```

**Mesh:** Single `PlaneGeometry(1.2, 1.2)` with `DoubleSide`, positioned in front of inspected block, billboard-oriented toward camera.

### Onboarding Customize UX Improvements

**Current issues:**
- Lock icons appear immediately, new users see restrictions before possibilities
- Emoji picker is a horizontal scroll — easy to miss
- No visual preview of what the block will look like
- "Make it yours!" text is small and not prominent

**Planned improvements:**
- Show all base options prominently first, locks at the end (not interspersed)
- Bigger color cells (48x48 instead of 38x38) for easier tapping
- Color picker wraps nicely on screen (no scroll needed for 8 base colors)
- Emoji grid instead of horizontal scroll for base emojis
- "Make it yours!" as a larger, gold-highlighted heading
- Immediate visual feedback in the 3D scene (camera holds on the block)
- Progressive disclosure: show "Unlock more with streaks!" as a subtle footer, not per-item locks

---

## Files to Modify

| File | Change |
|------|--------|
| `apps/mobile/components/tower/BlockShader.ts` | Glow reduction (done), holographic shader (Phase 2) |
| `apps/mobile/components/tower/TowerGrid.tsx` | Holographic mesh (Phase 2), dynamic texture loading |
| `apps/mobile/components/inspector/InspectorCustomize.tsx` | Image upload UI, UX improvements |
| `apps/mobile/hooks/useBlockActions.ts` | Image upload handler |
| `apps/mobile/stores/tower-store.ts` | imageUrl field in DemoBlock |
| `apps/mobile/stores/multiplayer-store.ts` | Handle imageUrl in block_update |
| `apps/mobile/utils/image-atlas.ts` | Dynamic atlas slot management |
| `apps/server/src/rooms/TowerRoom.ts` | Image upload handling, imageUrl in customize |
| `apps/server/src/utils/supabase.ts` | Supabase Storage upload helper |
| `apps/server/src/index.ts` | POST /api/blocks/:blockId/image endpoint |
| `packages/common/src/types.ts` | imageUrl in BlockAppearance type |
| `supabase/migrations/004_block_images.sql` | Storage bucket creation |

---

## Dependencies & Packages Needed

| Package | Purpose | Phase |
|---------|---------|-------|
| `expo-image-picker` | Select images from gallery/camera | 1C |
| `expo-image-manipulator` | Client-side resize before upload | 1C |
| `sharp` (server) | Server-side image optimization | 1D |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Large image uploads on slow connections | Client-side resize to 512x512 before upload; WebP format |
| Atlas texture memory on low-end devices | LRU cache with max 50 textures; fallback to atlas slot |
| Inappropriate image content | Server-side moderation (future: AI content filter); flag/report system |
| Supabase Storage costs | 2MB max per image; 512x512 WebP ≈ 50-100KB each |
| Shader uniform limits | Use dynamic atlas (single texture) instead of uniform array |

---

## Implementation Log

> Append-only log of what was done, deviations, and decisions made during implementation.

### 2026-03-01 — Phase 1A: Glow Reduction (SHIPPED)
- Implemented `inspectAtten` factor in BlockShader.ts
- All energy overlays attenuated 55% on highlighted blocks
- Highlight emissive reduced ~50%, glow pass boost reduced ~56%
- No deviations from plan
- Committed: `73fe8f1`

### 2026-03-01 — Phase 1B+1C: Customize UX + Image Upload UI (SHIPPED)
- Key insight: OnboardingFlow.tsx has its OWN customize UI (separate from InspectorCustomize)
- **Deviation:** Merged 1B and 1C since they both modify InspectorCustomize.tsx
- Changes implemented:
  - Bigger color cells (38→44px) with cleaner grid
  - Emoji grid (wrapping) instead of horizontal scroll for all emojis
  - Progressive disclosure: unlocked items first, "+N" hint cell at end instead of per-item locks
  - Bolder "Make it yours!" heading + subtext for post-claim experience
  - Styles section: unlocked shown first, locked collapsed into "+N" hint
  - New IMAGE section with upload button (dashed border, camera icon)
  - "Keep your streak going" footer replaces all individual lock messages
- Added `onImageUpload` prop flowing through: InspectorCustomize → BlockInspector → useBlockActions
- `handleImageUpload` in useBlockActions.ts: expo-image-picker → resize → base64 → server upload
- Added `imageUrl` field to DemoBlock interface and customizeBlock changes type
- Updated multiplayer-store ServerBlock to include imageUrl in appearance

### 2026-03-01 — Phase 1D: Supabase Storage + Server Endpoint (SHIPPED)
- Created `supabase/migrations/004_block_images.sql`:
  - Public `block-images` Storage bucket (2MB limit, webp/png/jpg)
  - RLS policies for public read + service role write
  - `update_block_image_url()` helper function for JSONB merge
- Added `uploadBlockImage()` to `apps/server/src/utils/supabase.ts`
- Added `POST /api/blocks/:blockId/image` endpoint to `apps/server/src/index.ts`:
  - Validates ownership via active TowerRoom
  - Accepts base64-encoded image in JSON body (no multer needed)
  - Uploads to Supabase Storage, returns public URL
  - Updates in-memory block + broadcasts block_update
- Increased JSON body limit to 2MB for base64 images
- Added `imageUrl` to BlockAppearanceSchema (Colyseus schema)
- Updated `serializeBlock()` and `blockToRow()` to include imageUrl
- **Decision:** Used base64 JSON instead of FormData to avoid multer dependency

### 2026-03-01 — Phase 1E: Dynamic Texture Loading (SHIPPED)
- Added `uInspectImage` and `uInspectImageActive` uniforms to BlockShader.ts
- Interior mapping code now checks: if highlighted block + user image active, sample from uInspectImage
- Chromatic aberration also uses correct texture source (atlas vs user image)
- TowerGrid.tsx: Added `inspectImageRef` for caching loaded textures
- On block selection: if block has imageUrl, async-load via THREE.TextureLoader
- On deselection: deactivate uInspectImageActive
- **Deviation from plan:** Did NOT implement dynamic atlas expansion (too complex for hackathon).
  Instead: user images only visible during inspection via dedicated uniform.
  Tower-view still shows default atlas images. This is Phase 2 scope.

### 2026-03-01 — Phase 2A: Holographic Pop-Out Effect (SHIPPED)
- Created holographic GLSL shader in BlockShader.ts (`createHologramMaterial()`):
  - Scan lines (two frequencies: fast thin + slow wide bands)
  - Chromatic aberration (distance-based, stronger at edges)
  - Holographic rainbow shimmer via sin-shifted RGB at edges
  - Edge glow with circular + corner fade masking
  - Owner color tinting at edges (25% blend)
  - Subtle flicker effect (5% opacity variation)
  - Brightness boost (1.15x) so image reads clearly
- Added hologram mesh to TowerGrid.tsx:
  - `<mesh>` with `<planeGeometry>` at BLOCK_SIZE × 1.4 (40% larger than block)
  - Billboard orientation (lookAt camera each frame)
  - Position offset 0.8 × BLOCK_SIZE toward camera from selected block
  - Smooth opacity lerp (0.12 rate) for fade in/out
  - Automatically visible when inspecting a block with user-uploaded imageUrl
- Performance considerations:
  - Reused `tmpColorRef` for owner color to avoid per-frame GC allocations
  - Single mesh, only visible during inspection — negligible draw cost
  - `depthWrite: false`, `DoubleSide`, `toneMapped: false` for proper transparency
- **Deviation from plan sketch:** Final shader is richer than the plan's sketch —
  added second scan line frequency, corner fade, owner color tint, flicker.
  Aberration uses `dist²` instead of linear `dist` for more natural falloff.

### 2026-03-01 — Phase 2B: Image Optimization Pipeline (SHIPPED)
- Added `sharp` dependency to `@monolith/server`
- Created `optimizeImage()` helper in supabase.ts:
  - Resizes to max 512×512 (cover fit, no enlargement)
  - Converts to WebP at quality 80
  - Logs size reduction (e.g., "2.1MB → 48KB")
- Updated `uploadBlockImage()` to process images through sharp before Supabase upload
- Removed `contentType` parameter (always WebP after optimization)
- **Decision:** Server-side optimization is the safety net — client already resizes via
  expo-image-manipulator, but server ensures consistent 512×512 WebP regardless of client.

### 2026-03-01 — Phase 2C: Texture Cache with LRU Eviction (SHIPPED)
- Created `apps/mobile/utils/texture-cache.ts`:
  - Module-level `Map<string, CacheEntry>` with `{ texture, lastAccess }` entries
  - `getCachedTexture(url, onLoaded?)` — returns cached texture or starts async load
  - Deduplicates in-flight loads via `loading` Set
  - LRU eviction when cache exceeds 50 entries (disposes evicted THREE.Texture)
  - `clearTextureCache()` for full cleanup
- Updated TowerGrid.tsx to use `getCachedTexture` instead of inline THREE.TextureLoader:
  - Cache hits return immediately — no re-download when switching between blocks
  - Cache misses trigger async load with callback to set uniforms
  - Simpler code: 15 lines instead of 25
- **Deviation:** `inspectImageRef` kept as a "currently active" pointer for fast access
  in the hologram animation loop. The LRU cache handles persistence across selections.
