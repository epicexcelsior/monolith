# Monolith Content Engine — Video Production Guide

> **`apps/video/`** is a self-contained [Remotion](https://remotion.dev) workspace.
> It renders marketing videos using the **same 3D tower and shaders as the real game**.
> The mobile app is never modified — only files in `apps/video/` are touched.

---

## Quick Start

```bash
# Preview interactively
cd apps/video
pnpm studio          # opens Remotion Studio at localhost:3000

# Render to MP4 (fast, GPU-accelerated)
npx remotion render ShowcaseDemo out/ShowcaseDemo.mp4 --concurrency=6 --gl=angle

# Render specific frame range (fast iteration)
npx remotion render ShowcaseDemo out/test.mp4 --frames=0-60 --concurrency=4 --gl=angle
```

**Render time**: ~3 min for 695 frames on 8-core CPU + AMD APU with `--gl=angle`.
Use `--concurrency=6` (not 8) to avoid memory pressure. `--gl=angle` enables GPU acceleration.

---

## Architecture

```
apps/video/
├── src/
│   ├── Root.tsx              # Remotion compositions registry
│   ├── Scenes/
│   │   └── ShowcaseDemo.tsx  # Main 23s showcase video
│   ├── Tower/
│   │   ├── VideoTower.tsx    # Root-level 3D scene (single ThreeCanvas)
│   │   ├── VideoBlocks.tsx   # InstancedMesh with real GLSL shaders
│   │   ├── VideoFoundation.tsx
│   │   ├── VideoParticles.tsx
│   │   └── generateBlocks.ts # Procedural block data for video
│   ├── Camera/
│   │   └── paths.ts          # All camera path functions + globalShowcasePath
│   ├── Environment/
│   │   ├── NightSkybox.tsx   # Procedural GLSL star/nebula skybox
│   │   ├── GroundPlane.tsx   # Concentric ring stone texture
│   │   ├── AtmosphericHaze.tsx
│   │   └── TowerCore.tsx     # Interior amber glow
│   └── Transitions/          # (Currently unused — using built-in fade())
└── public/
    ├── music.mp3             # Background music (trimmed segment)
    ├── icon.png              # Game icon (1869×1869 RGBA)
    └── solana.png            # Solana logo (2000×2000 RGBA)
```

### The Critical Rule: One ThreeCanvas

**Never put `<VideoTower>` inside a `<TransitionSeries.Sequence>`.**

During a crossfade transition, Remotion renders both sequences simultaneously. If each sequence has its own `<VideoTower>`, you get two ThreeCanvas instances with two cameras — producing a visible glitch where both camera positions bleed into the frame.

**Correct pattern:**
```tsx
export const MyVideo: React.FC = () => (
  <AbsoluteFill>
    {/* 3D tower at ROOT — always exactly one ThreeCanvas */}
    <VideoTower cameraPath={globalShowcasePath} blocks={blocks} isInspectPath />

    {/* TransitionSeries contains ONLY text/UI overlays */}
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={S0}>
        <Scene0TextOverlay />  {/* No VideoTower here! */}
      </TransitionSeries.Sequence>
      ...
    </TransitionSeries>
  </AbsoluteFill>
);
```

---

## Camera System

### Path Functions

Every camera path is a pure function `(progress: number) => CameraTarget` where `progress` is 0–1 over the scene duration.

```ts
// CameraTarget shape
interface CameraTarget {
  position: [number, number, number];  // XYZ in world space
  lookAt: [number, number, number];    // point to look at
}

// Standard path — wide shot orbiting
export const myPath: CameraPath = (progress) => {
  const eased = easeInOutCubic(progress);
  const angle = Math.PI * 0.5 + eased * Math.PI * 0.3; // arc around tower
  const radius = 46;
  const y = TOWER_HEIGHT * 0.4;
  return {
    position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
    lookAt: [0, TOWER_HEIGHT * 0.36, 0],
  };
};
```

**Key geometry references** (from `@monolith/common`):
```ts
import { getTowerHeight, DEFAULT_TOWER_CONFIG } from "@monolith/common";
const TOWER_HEIGHT = getTowerHeight(DEFAULT_TOWER_CONFIG.layerCount); // ~100 units
```

### Camera Distance Guide

| Radius | Feel |
|--------|------|
| 15–25 | Extreme close-up, single block inspection |
| 30–40 | Medium — see 5-6 layers clearly |
| 45–55 | Wide establishing — full tower visible |
| 60–75 | Very wide — tower appears as monument |

### Elevation Guide

```
y = TOWER_HEIGHT * 0.05    // ground level — dramatic low angle
y = TOWER_HEIGHT * 0.25    // low — looking up at tower
y = TOWER_HEIGHT * 0.4     // mid — most common cinematic view
y = TOWER_HEIGHT * 0.6     // high — looking slightly down
y = TOWER_HEIGHT * 1.1     // above — overhead view
```

### Inspect Camera Path (Block Highlight)

For scenes that show block inspection (block pops out, others dim):

```ts
// Returns InspectCameraTarget with extra fields
export type InspectCameraPath = (progress: number) => InspectCameraTarget;

interface InspectCameraTarget extends CameraTarget {
  inspectProgress: number;  // 0=normal, 1=fully inspecting
  inspectY: number;         // Y position of target block
}
```

Use the `customizeInspect` path as reference — it has 4 phases: orbit → fly-in → hold → pull-back.

### Global Camera Path for Multi-Scene Videos

When a video has multiple scenes with transitions, use a single `globalPath` that covers all frames:

```ts
// In paths.ts — add scene timing constants
const GS0=30, GS1=120, ...; // scene durations in frames
const G1 = GS0 - T1;        // scene 1 global start (offset by transition overlap)

export const myGlobalPath: InspectCameraPath = (progress) => {
  const gf = progress * TOTAL_FRAMES;

  if (gf < G1) return { ...scene0Path(gf / GS0), inspectProgress: 0, inspectY: 0 };

  // Smooth camera lerp during transition window
  if (gf < GS0) {
    const t = easeInOutCubic((gf - G1) / T1);
    return { ..._lerpTarget(scene0Path(gf / GS0), scene1Path((gf - G1) / GS1), t), inspectProgress: 0, inspectY: 0 };
  }

  return { ...scene1Path((gf - G1) / GS1), inspectProgress: 0, inspectY: 0 };
};
```

The `_lerpTarget` helper (in `paths.ts`) interpolates position and lookAt independently for smooth camera movement between scenes.

---

## Scene Anatomy

### Text Overlay Scene (standard)

```tsx
const MyScene: React.FC = () => {
  const frame = useCurrentFrame();         // 0 = start of THIS scene
  const { fps, durationInFrames } = useVideoConfig();

  // Spring entrance
  const wordIn = spring({ frame, fps, config: { damping: 15, stiffness: 160 }, delay: 8 });
  const wordScale = interpolate(wordIn, [0, 1], [0.65, 1]);

  // Exit fade (last 14 frames)
  const exitFade = interpolate(frame, [durationInFrames - 14, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  return (
    <AbsoluteFill>
      <DarkVignette />  {/* Always include for text readability */}
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 200 }}>
        <div style={{ opacity: exitFade }}>
          <div style={{ opacity: wordIn, transform: `scale(${wordScale})`, ...gradientText }}>
            MECHANIC
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

### Typography Constants

All text uses **Space Grotesk** (loaded via `@remotion/google-fonts/SpaceGrotesk`).

**Text width formula** (to avoid overflow on 1080px canvas):
```
max safe width = n_chars * fontSize * 0.62 + n_chars * letterSpacing
```

| Element | Size | Weight | Letter Spacing |
|---------|------|--------|----------------|
| Large title ("MONOLITH") | 160px | 700 | 10 |
| Section header ("THE") | 72px | 700 | 28 |
| Mechanic word ("CLAIM") | 156px | 700 | 20 |
| Sub-mechanic | 50px | 700 | 10 |
| CTA line 1 | 130px | 700 | 10 |
| Badge text | 36px | 700 | 10 |

**Text glow shadows:**
```ts
const GLOW = "0 0 120px rgba(255, 150, 40, 0.95), 0 0 60px rgba(255, 120, 20, 0.5), 0 8px 48px rgba(0,0,0,1)";
const AMBER_GLOW = "0 0 80px rgba(220, 140, 40, 0.8), 0 6px 32px rgba(0,0,0,0.98)";
const CYAN_GLOW = "0 0 40px rgba(100, 200, 255, 0.6), 0 4px 16px rgba(0,0,0,0.9)";
```

**Gradient text:**
```ts
const gradientText: React.CSSProperties = {
  background: "linear-gradient(160deg, #ffffff 0%, #ffe0a8 55%, #ffaa44 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};
```

---

## Animation Patterns

### Spring Entrance (punchy)
```ts
const wordIn = spring({ frame, fps, config: { damping: 15, stiffness: 160 }, delay: 8 });
const wordScale = interpolate(wordIn, [0, 1], [0.65, 1]);
// Use: opacity: wordIn, transform: `scale(${wordScale})`
```

### Smooth Glide In (cinematic)
```ts
const panelIn = spring({ frame, fps, config: { damping: 200 }, delay: 14 });
const panelY = interpolate(panelIn, [0, 1], [60, 0]);
// Use: opacity: panelIn, transform: `translateY(${panelY}px)`
```

### Staggered Word Entrance (STAKE. EARN. CONQUER.)
```ts
words.map((word, i) => {
  const wIn = spring({ frame, fps, config: { damping: 15, stiffness: 160 }, delay: 8 + i * 18 });
  const wScale = interpolate(wIn, [0, 1], [0.55, 1]);
  const wY = interpolate(wIn, [0, 1], [56, 0]);
  return <div style={{ opacity: wIn, transform: `scale(${wScale}) translateY(${wY}px)` }}>{word}</div>;
});
```

### Counting Number Animation
```ts
const amount = interpolate(frame, [20, durationInFrames * 0.8], [0, 2.847], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.out(Easing.cubic),
});
// Use: {amount.toFixed(3)}
```

### SVG Line Draw (chart animation)
```ts
const CHART_LEN = 760; // approximate path length
const chartProg = interpolate(frame, [26, durationInFrames * 0.75], [0, 1], { ... });
const dashOff = CHART_LEN * (1 - chartProg);
// Use on <path>: strokeDasharray={CHART_LEN} strokeDashoffset={dashOff}
```

---

## Music Sync

Music lives at `apps/video/public/music.mp3`. Reference it with `staticFile("music.mp3")`.

```tsx
<Audio
  src={staticFile("music.mp3")}
  startFrom={56 * fps}   // trim to segment starting at 0:56
  endAt={80 * fps}       // end at 1:20 (24s of audio)
  volume={(frame) => {
    const fadeIn  = interpolate(frame, [0, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const fadeOut = interpolate(frame, [TOTAL_FRAMES - 60, TOTAL_FRAMES], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return Math.min(fadeIn, fadeOut);
  }}
/>
```

**Beat-sync tip**: Identify the drop/beat time in seconds, multiply by 30 (fps) to get the target global frame, then align key scene transitions to that frame.

---

## Transitions

All transitions are `fade()` with `linearTiming`. Use `springTiming` only for the final scene (slower, organic):

```tsx
// Between action scenes (crisp)
<TransitionSeries.Transition
  presentation={fade()}
  timing={linearTiming({ durationInFrames: 10 })}
/>

// Into final CTA (slow, breathing)
<TransitionSeries.Transition
  presentation={fade()}
  timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
/>
```

**Total frames formula:**
```
TOTAL = sum(scene_durations) - sum(transition_durations)
Example: 30+120+105+105+120+105+180 - (5×10 + 20) = 695 frames
```

**Global scene start offsets:**
```
scene_N_global_start = scene_(N-1)_global_start + scene_(N-1)_duration - transition_duration
```

---

## Adding a New Scene

1. **Add duration constant** in `ShowcaseDemo.tsx` (e.g. `const S7 = 3 * FPS`)
2. **Add camera path** in `paths.ts` — pure function `(progress: number) => CameraTarget`
3. **Update `globalShowcasePath`** — add new segment with correct global frame offsets
4. **Update `_GTOTAL`** constant to match new total
5. **Create overlay component** (text + UI only, no VideoTower)
6. **Add to TransitionSeries** — new `Sequence` + `Transition`
7. **Update `SHOWCASE_FRAMES` in `Root.tsx`** — recalculate using the formula above

---

## Referencing the Mobile App

The video system replicates the mobile app's rendering. When updating video visuals to match game changes:

| Mobile source | Video equivalent |
|---------------|-----------------|
| `apps/mobile/components/tower/TowerScene.tsx` | Camera path patterns, lighting setup |
| `apps/mobile/components/tower/BlockShader.ts` | (same GLSL used in `VideoBlocks.tsx`) |
| `apps/mobile/components/tower/TowerCore.tsx` | `apps/video/src/Environment/TowerCore.tsx` |
| `apps/mobile/constants/CameraConfig.ts` | Camera distance/elevation constants |

**Adaptation pattern** (mobile → video):
```ts
// Mobile (useFrame-based delta accumulation)
useFrame((_, delta) => { material.uniforms.uTime.value += delta; });

// Video (deterministic frame-based time)
material.uniforms.uTime.value = frame / fps;
```

---

## What's Missing / Future Ideas

- **Screen recording integration**: Use the mobile app directly — record the real app running on device, then composite with Remotion overlays for text/music
- **Multi-video variants**: One composition per feature (CLAIM, EARN, CUSTOMIZE) each 15s for social ads
- **Dynamic block data**: Pull real Supabase block data (top players' actual blocks) instead of `generateBlocks(seed)`
- **Render pipeline CI**: GitHub Actions job to auto-render + upload when `apps/video/` changes
- **Storyboard system**: Simple JSON config that drives scene order/timing without code changes
- **Portrait + landscape variants**: 9:16 (TikTok/Reels), 1:1 (feed), 16:9 (YouTube)
