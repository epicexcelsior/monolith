# Monolith Landing Page — Context & Architecture

> Preserved context for session continuity. Read this when resuming work on the landing page.

## File
- **`apps/web/index.html`** — single-file landing page, ~700 lines, zero build step

## Tech Stack
- Three.js 0.170.0 via CDN importmap (ES module)
- Syne (headlines) + Outfit (body) via Google Fonts
- Supabase REST API for waitlist (anon key, insert-only RLS)
- CSS-only animations (no GSAP dependency)
- Cloudflare Pages deployment

## Deployment
- Project: `monolith-landing`
- URL: https://monolith-landing.pages.dev
- Command: `wrangler pages deploy /home/epic/Downloads/monolith/apps/web --project-name monolith-landing --commit-dirty=true`

## Supabase
- URL: `https://pscgsbdznfitscxflxrm.supabase.co`
- Anon key embedded in HTML (insert-only RLS — safe for public)
- Table: `waitlist` (id, email UNIQUE, referral_source, created_at)
- Migration: `supabase/migrations/005_waitlist.sql`

## Architecture

### 3D Scene (Three.js)
1. **Tower**: InstancedMesh, ~650 blocks across 25 layers
   - Body layers (0–15): rectangular ring on 4 faces + 4 corner blocks
   - Spire layers (16–24): tapering crown
   - Custom ShaderMaterial with HSV hue cycling, fresnel, specular, AO
   - Mouse/touch interaction: raycaster pushes blocks radially outward

2. **Marble Pedestal**: 4 cylindrical tiers matching Foundation.tsx
   - Cornice (1.6x, h=0.6), Main (2.8x, h=1.2), Base (3.8x, h=0.8), Abyss (3.8x, h=10)
   - Procedural FBM marble shader (no external textures)
   - Classical molding lines (fillet, cavetto, astragal, fascia, scotia, torus, base lip, plinth)
   - Triplanar UV mapping, 3-light rig with Fresnel rim

3. **Aurora Skybox**: SphereGeometry(500) with procedural aurora bands
   - 5 aurora color bands with FBM turbulence
   - Stars via hash threshold
   - Horizon glow

4. **Ground Glow**: Additive blending plane at y=-3.2
5. **Particles**: 100 (50 mobile) rising + spiraling points
6. **Lights**: Ambient + Hemisphere + Directional + 4 PointLights (base, beacon, mid, abyss)

### Camera
- Intro: easeOutCubic zoom from radius 20→50 over 4 seconds
- Auto-orbit: `t * 0.025`
- Scroll-driven: adds `scrollNorm * PI` to orbit angle
- Elevation: `0.72 - scrollNorm * 0.12`
- LookAt target: `(0, TH * 0.38, 0)`

### CSS / Layout
- Full-screen hero with tower as background, gradient scrim at bottom
- `@keyframes fadeUp` with staggered delays (0.8s → 1.6s)
- Scroll-reveal via IntersectionObserver (`.rv` → `.rv.vis`)
- Responsive: 3-col → 2-col → 1-col at 768px/480px
- `prefers-reduced-motion` respected

### Waitlist
- Two forms (hero + bottom CTA), wired to same `submitWL()` function
- POST to Supabase REST API with email + referral_source
- Handles: success, duplicate (shows "already on list"), error
- Duplicate detection: checks response text for `duplicate`/`unique`

## Critical Bug History (DO NOT REPEAT)

### 1. GLSL Template Literal Bug (FATAL)
**Problem**: JS template literals like `${(-0.5).toFixed(1)}` produce `-0.5` in GLSL, creating:
- `abs(y--0.5)` → parsed as decrement operator
- `(-1.1+-2.3)` → invalid operator combination

These crash the ENTIRE WebGL context — no tower, no sky, nothing renders.

**Fix**: ALL marble shader constants are now `const float` declarations INSIDE the GLSL string. ZERO JS interpolation in the marble shader. The block shader safely uses `${THstr}` because TH is always positive.

### 2. GSAP Dependency Crash
**Problem**: `window.gsap` undefined if CDN fails → module crashes before Three.js init.
**Fix**: Removed GSAP entirely. CSS animations + native scroll listener.

### 3. CSS opacity:0 + JS Animation Dependency
**Problem**: Elements with `opacity:0` in CSS, relying on JS to animate them visible. If JS crashes, text stays invisible.
**Fix**: `@keyframes fadeUp` with `animation-fill-mode: both` — from state handles initial invisibility, to state handles final visibility.

### 4. Text "MONOL" Cutoff
**Problem**: Font size too large + `overflow-x: hidden` + max-width constraint on hero-inner.
**Fix**: Reduced to `clamp(2.8rem, 7vw, 6rem)`, removed max-width.

## Constants Reference
From `packages/common/src/constants.ts`:
- BLOCK_SIZE = 0.85, BLOCK_GAP = 0.005
- MONOLITH_HALF_W = 6, MONOLITH_HALF_D = 3.5
- TOTAL_LAYERS = 25, SPIRE_START_LAYER = 16
- Tower height: ~40 units (computed dynamically)

## Future Enhancements (Not Yet Implemented)
- Bloom postprocessing (EffectComposer + UnrealBloomPass) — removed due to crashes
- GSAP ScrollTrigger for more cinematic scroll animations
- Sound design (ambient + interaction sounds)
- Custom cursor
- Loading progress bar
- OG image / social preview image
