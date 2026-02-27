# Exchange Art Bounty — Creator Track Submission Plan

> Deadline: **Feb 28, 2026**
> Tracks: Creator (best artwork) + BONK (BONK-inspired artwork)
> Prize: ~$5K split across winners per track
> Effort: ~1 hour total for both submissions

## Platform Research

- **No gating.** Self-service, no creator application or approval queue.
- **Video supported.** MP4/MOV up to **100 MB**.
- **1/1 minting.** Exchange Art is the largest 1/1 art marketplace on Solana.
- **Cost: 0.011 SOL** convenience fee per mint. No listing fee. That's it.
  - Have ~0.1 SOL in your mainnet wallet to cover fee + rent + storage.
  - Sales fee (5% primary, 2.5% secondary) only applies IF it sells — paid by buyer.
- **Timeline:** Sign up → mint → live listing in **30 minutes**.
- **New creators start as "Unknown" series** — normal, doesn't block anything.

---

## What We Already Have

The Remotion pipeline (`apps/video/`) renders **real GLSL shaders** from the game:

| Asset | Details |
|-------|---------|
| ShowcaseDemo.mp4 | 23s, 23MB, 1080x1920 vertical, 7 scenes |
| SpiralReveal | 12s spiral ascend + title card |
| OrbitPunch | 10s dramatic orbit + zoom punch |
| DollyParallax | 12s lateral dolly |
| VideoBlockShader | 514-line GLSL (SSS, AO, GGX specular, 6 styles, 6 textures, interior mapping) |
| NightSkybox | Procedural stars, 5-layer nebula wisps, aurora |
| 650 glowing blocks | Full energy spectrum (dead → blazing) |

---

## Track 1: Creator — "The Monolith"

### Plan: Simple Full Rotation

A clean, slow, full 360° orbit around the tower. No text, no overlays, no marketing. Just the tower and its shaders. Let the art speak.

### New Files (all in `apps/video/`)

#### 1. Camera path: `src/Camera/paths.ts` — add `artOrbit`

```typescript
// ─── Art Piece: Slow Full Orbit ──────────────────────────────────────────────
/**
 * artOrbit — One slow 360° revolution at mid-height.
 * Gentle vertical breathing. Pure contemplation.
 */
export const artOrbit: CameraPath = (progress) => {
  const angle = Math.PI * 0.5 + progress * Math.PI * 2; // full 360°
  const radius = 44;
  const bob = Math.sin(progress * Math.PI * 3) * 1.5; // gentle breathing
  const y = TOWER_HEIGHT * 0.38 + bob;

  return {
    position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
    lookAt: [0, TOWER_HEIGHT * 0.36, 0],
  };
};
```

This gives a smooth full rotation that starts and ends at the same angle — near-perfect loop if you wanted to loop it.

#### 2. Scene: `src/Scenes/ArtPiece.tsx` (NEW)

```typescript
import React from "react";
import { AbsoluteFill } from "remotion";
import { VideoTower } from "../Tower/VideoTower";
import { artOrbit } from "../Camera/paths";

/**
 * ArtPiece — Pure visual art. One slow orbit, no text, no overlays.
 * 15 seconds at 30fps = 450 frames.
 */
export const ArtPiece: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#120e18" }}>
      <VideoTower cameraPath={artOrbit} />
    </AbsoluteFill>
  );
};
```

#### 3. Register in `src/Root.tsx`

```typescript
import { ArtPiece } from "./Scenes/ArtPiece";

// Add inside <Folder name="Monolith">:
<Composition
  id="ArtPiece"
  component={ArtPiece}
  durationInFrames={15 * FPS}  // 450 frames = 15s
  fps={FPS}
  width={WIDTH}
  height={HEIGHT}
/>
```

#### 4. Render

```bash
cd apps/video
npx remotion render ArtPiece out/ArtPiece.mp4 --concurrency=6 --gl=angle
```

~2 min render. Output: ~10-15MB MP4 (well under 100MB limit).

### Submission Metadata

**Title:** The Monolith

**Description:**
```
A collaborative digital monument built on Solana.

650 blocks of light — each one claimed and charged by a player in a shared
tower. Custom GLSL shaders render subsurface scattering, interior-mapped
windows with parallax depth, and procedural aurora skies.

Every frame computed from the same shaders that run in real-time on mobile.
Built with React Three Fiber, Anchor, and Colyseus for the Solana Graveyard
Hack 2026.
```

---

## Track 2: BONK — "BONK Tower"

### Plan: Same Orbit, BONK Color Palette

Fork the block generator to an all-orange/gold blazing palette. Same simple orbit. The fire/neon shaders in warm orange already look incredible — this isn't a stretch, it's just a different seed.

### Approach: Color Palette + Max Energy (Not Tower Reshaping)

Don't reshape the tower. Don't touch mobile app code. Just change the block data generator in Remotion:

| What changes | How |
|---|---|
| Color palette | All oranges/golds/ambers (BONK brand colors) |
| Energy | All blocks blazing (80-100%) |
| Styles | Mostly fire (style 5) + neon (style 2) |
| Everything else | Same tower, same camera, same shaders |

### New Files

#### 1. Block generator: `src/Tower/generateBonkBlocks.ts` (NEW)

```typescript
import {
  DEFAULT_TOWER_CONFIG,
  SPIRE_START_LAYER,
  MONOLITH_HALF_W,
  MONOLITH_HALF_D,
} from "@monolith/common";
import {
  computeBodyLayerPositions,
  computeSpireLayerPositions,
} from "@monolith/common";
import type { VideoBlock } from "./generateBlocks";

// BONK palette — blazing oranges, golds, ambers
const BONK_COLORS = [
  "#FF6600", // BONK Orange
  "#FF8800", // Amber
  "#FFAA00", // Gold
  "#FF5500", // Deep Orange
  "#FFCC00", // Bright Gold
  "#CC5500", // Burnt Orange
  "#FF7711", // Tangerine
  "#E87400", // Marigold
  "#FFB833", // Honey
  "#CC4400", // Rust
  "#FF9933", // Peach Fire
  "#FFDD44", // Warm Yellow
];

/** Deterministic pseudo-random from seed */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * BONK tower variant — all blazing, all fire/neon, all orange.
 */
export function generateBonkBlocks(seed = 69): VideoBlock[] {
  const rand = seededRandom(seed);
  const config = DEFAULT_TOWER_CONFIG;
  const blocks: VideoBlock[] = [];

  for (let layer = 0; layer < config.layerCount; layer++) {
    const count = config.blocksPerLayer[layer];
    if (count === 0) continue;

    const positions =
      layer < SPIRE_START_LAYER
        ? computeBodyLayerPositions(layer, count, MONOLITH_HALF_W, MONOLITH_HALF_D, config.layerCount)
        : computeSpireLayerPositions(layer, count, config.layerCount);

    for (let i = 0; i < positions.length; i++) {
      const colorIdx = Math.floor(rand() * BONK_COLORS.length);

      // All blocks blazing energy (80-100%)
      const energy = 80 + rand() * 20;

      // Mostly fire and neon styles
      const styleRoll = rand();
      let style: number;
      if (styleRoll < 0.45) style = 5;       // 45% Fire
      else if (styleRoll < 0.75) style = 2;  // 30% Neon
      else if (styleRoll < 0.85) style = 1;  // 10% Holographic
      else if (styleRoll < 0.95) style = 0;  // 10% Default
      else style = 4;                         // 5% Glass

      const texRoll = rand();
      const textureId = texRoll < 0.6 ? 0 : 1 + Math.floor(rand() * 6);
      const imageIndex = rand() < 0.08 ? 1 + Math.floor(rand() * 6) : -1;

      blocks.push({
        id: `block-${layer}-${i}`,
        layer,
        index: i,
        color: BONK_COLORS[colorIdx],
        energy,
        position: positions[i],
        style,
        textureId,
        imageIndex,
      });
    }
  }

  return blocks;
}
```

#### 2. Scene: `src/Scenes/BonkTower.tsx` (NEW)

```typescript
import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { VideoTower } from "../Tower/VideoTower";
import { artOrbit } from "../Camera/paths";
import { generateBonkBlocks } from "../Tower/generateBonkBlocks";

/**
 * BonkTower — The Monolith in BONK. All orange, all blazing, all fire.
 * 15 seconds at 30fps = 450 frames. Same orbit as ArtPiece.
 */
export const BonkTower: React.FC = () => {
  const blocks = useMemo(() => generateBonkBlocks(69), []);

  return (
    <AbsoluteFill style={{ backgroundColor: "#1a0e05" }}>
      <VideoTower cameraPath={artOrbit} blocks={blocks} />
    </AbsoluteFill>
  );
};
```

Note the darker warm background (`#1a0e05`) instead of the cool purple (`#120e18`).

#### 3. Register in `src/Root.tsx`

```typescript
import { BonkTower } from "./Scenes/BonkTower";

// Add inside <Folder name="Monolith">:
<Composition
  id="BonkTower"
  component={BonkTower}
  durationInFrames={15 * FPS}  // 450 frames = 15s
  fps={FPS}
  width={WIDTH}
  height={HEIGHT}
/>
```

#### 4. Render

```bash
cd apps/video
npx remotion render BonkTower out/BonkTower.mp4 --concurrency=6 --gl=angle
```

### Submission Metadata

**Title:** BONK Tower

**Description:**
```
The Monolith, reimagined in BONK.

650 blazing blocks of orange light, rendered with custom GLSL shaders
featuring fire effects, subsurface scattering, and real-time energy glow.
A collaborative digital monument on Solana, dressed in the unmistakable
warmth of BONK.

Every pixel computed from GLSL. Built with React Three Fiber for the Solana
Graveyard Hack 2026.
```

---

## Implementation Summary

### Files to Create/Modify

| File | Action | Lines |
|------|--------|-------|
| `apps/video/src/Camera/paths.ts` | ADD `artOrbit` path | +15 |
| `apps/video/src/Scenes/ArtPiece.tsx` | NEW | ~15 |
| `apps/video/src/Scenes/BonkTower.tsx` | NEW | ~20 |
| `apps/video/src/Tower/generateBonkBlocks.ts` | NEW | ~70 |
| `apps/video/src/Root.tsx` | ADD 2 compositions | +16 |

**Total: 4 new files, 1 modified file, ~135 lines.**
**Zero mobile app changes. Zero server changes. Remotion only.**

### Rollback

```bash
rm apps/video/src/Scenes/ArtPiece.tsx
rm apps/video/src/Scenes/BonkTower.tsx
rm apps/video/src/Tower/generateBonkBlocks.ts
git checkout apps/video/src/Root.tsx
git checkout apps/video/src/Camera/paths.ts
```

---

## Execution Checklist

### Phase 1: Build (30 min)

- [ ] Add `artOrbit` camera path to `paths.ts`
- [ ] Create `ArtPiece.tsx` scene
- [ ] Create `generateBonkBlocks.ts`
- [ ] Create `BonkTower.tsx` scene
- [ ] Register both in `Root.tsx`
- [ ] Preview in Remotion Studio: `cd apps/video && pnpm studio`
- [ ] Render ArtPiece: `npx remotion render ArtPiece out/ArtPiece.mp4 --concurrency=6 --gl=angle`
- [ ] Render BonkTower: `npx remotion render BonkTower out/BonkTower.mp4 --concurrency=6 --gl=angle`
- [ ] Verify both MP4s play correctly and are under 100MB

### Phase 2: Mint (20 min)

- [ ] Ensure ~0.1 SOL in mainnet Phantom/Solflare wallet
- [ ] Go to exchange.art, connect wallet
- [ ] Complete artist profile (name, bio, pfp — can use tower screenshot)
- [ ] Create Brand: "The Monolith"
- [ ] Create Series: "Graveyard Hack 2026"

**Mint 1: Creator Track**
- [ ] Click Mint → upload ArtPiece.mp4
- [ ] Title: "The Monolith"
- [ ] Description: (see above)
- [ ] Mint as 1/1
- [ ] Confirm wallet tx (~0.011 SOL)
- [ ] Copy listing URL

**Mint 2: BONK Track**
- [ ] Click Mint → upload BonkTower.mp4
- [ ] Title: "BONK Tower"
- [ ] Description: (see above)
- [ ] Mint as 1/1
- [ ] Confirm wallet tx (~0.011 SOL)
- [ ] Copy listing URL

### Phase 3: Submit (5 min)

- [ ] Go to https://solanafoundation.typeform.com/graveyardhack
- [ ] Submit Creator track with Exchange Art URL
- [ ] Submit BONK track with Exchange Art URL
- [ ] Tweet both, tag @exchgART and @solaboratory

---

## Why This Wins

**It's not a screenshot-turned-NFT.** The tower is:

- **650 blocks** with individual GLSL shaders (SSS, AO, GGX specular)
- **Interior-mapped windows** — real 3D rendering technique (parallax depth)
- **Procedural aurora sky** — 5-layer nebula, animated stars
- **6 animated block styles** — holographic, neon, fire, ice, glass, matte
- **Subsurface scattering** — light bleeds through translucent blocks
- **The same shaders run in a live Solana game** — this is real-time art, not pre-rendered CGI

Exchange Art's mission is digital art on Solana. This is literally code-generated art running on Solana infrastructure. The BONK variant shows the tower is a canvas — the same 650-block monument, relit in a completely different mood just by changing the palette and energy distribution.
