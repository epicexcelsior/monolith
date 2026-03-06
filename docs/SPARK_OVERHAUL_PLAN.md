# Spark Overhaul — Implementation Plan

> **Branch:** `feat/spark-overhaul` (create fresh from `main`)
> **Goal:** Make the Monolith feel like a living, breathing r/Place-in-3D with clear, cohesive player experience
> **Date:** 2026-03-04

---

## Ralph Loop Instructions

This doc is split into **two passes** with a hard gate between them.

- **Pass 1 — "Testable Loop" (5 phases):** Core fixes so testers understand the game and can customize. Push APK after this.
- **Pass 2 — "Delight & Polish" (7 phases):** Visual refinements, personality choice, reactions, celebrations. Run after tester feedback.

### How to Run

**Pass 1** — run this first:
```bash
/ralph-loop Read docs/SPARK_OVERHAUL_PLAN.md and implement the next incomplete phase from PASS 1. Check git log and the PROGRESS section at the bottom of the doc to see what's already done. Implement ONE phase per iteration, run tests, commit, then update the PROGRESS section. Follow all constraints in the plan doc. STOP when you reach the === PASS 1 GATE === marker. --completion-promise 'All 5 Pass 1 phases complete and committed' --max-iterations 10
```

**Pass 2** — run after reviewing Pass 1 APK and collecting tester feedback:
```bash
/ralph-loop Read docs/SPARK_OVERHAUL_PLAN.md and implement the next incomplete phase from PASS 2. Check git log and the PROGRESS section at the bottom of the doc to see what's already done. Implement ONE phase per iteration, run tests, commit, then update the PROGRESS section. Follow all constraints in the plan doc. --completion-promise 'All 7 Pass 2 phases complete and committed' --max-iterations 15
```

### Ralph Agent Rules

1. **Start of every iteration:** Read this doc. Check the PROGRESS section. Find the next phase marked `[ ]` in the current pass.
2. **Read before writing:** Always read the target files before modifying them. Check CONTEXT.md gotchas.
3. **One phase per iteration:** Implement exactly one phase, validate it, commit it, update PROGRESS.
4. **Branch:** Work on `feat/spark-overhaul`. If it doesn't exist yet, create it from `main`.
5. **Commit format:** `feat(sparks): pass N phase X — [description]`
6. **Validation:** After each phase, run `cd apps/mobile && npx jest` (must pass). If tests fail, fix them in the same iteration.
7. **TypeScript:** Run `timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json`. Fix errors (ignore the 3 baseline errors in useBlockActions.ts).
8. **Update PROGRESS:** After committing, edit the PROGRESS section at the bottom of this doc to mark the phase `[x]` with a short note.
9. **Do NOT skip phases.** Execute in order within each pass.
10. **STOP at the gate.** Pass 1 agent MUST stop after Phase 5. Do NOT continue into Pass 2.
11. **Do NOT modify files in the "Do NOT Modify" list** unless absolutely necessary for the phase.
12. **Shader changes:** After modifying `BlockShader.ts`, mentally verify: no `new` in render loop, `uTime` uses highp, mediump on fragment shader.
13. **UI changes:** Use `COLORS.*`, `FONT_FAMILY.*`, `RADIUS.*` tokens only. No hardcoded colors.
14. **If stuck:** Leave a note in PROGRESS describing the blocker, mark the phase `[~]` (partial), and move to the next independent phase.

### Phase Dependencies

**Pass 1:**
```
Phase 1 (Glow) ──────> Phase 2 (Face Scale) ──> Phase 3 (Customize Panel)
                                                          │
Phase 4 (Progression) ───────────────────────────────────>│──> Phase 5 (Onboarding)
```
Phases 1→2 must be sequential (shader stacks). Phase 3 is independent of 4. Phase 5 is last.

**Pass 2:**
```
Phase 6 (Unclaimed Restyle) ──┐
Phase 7 (Aesthetic Softening) ─┤──> Phase 10 (Charge Reactions) ──> Phase 12 (Polish)
Phase 8 (Personality Choice) ──┤
Phase 9 (Evo Progress Bar) ───> Phase 10a (Evo Celebration) ─────> Phase 12
Phase 11 (Onboarding V2) ─────────────────────────────────────────> Phase 12
```
Phases 6-9 can be done in any order. Phase 10 needs 7+8. Phase 12 is last.

---

## Table of Contents

1. [Current Problems](#1-current-problems) — 9 diagnosed issues with evidence
2. [Design Decisions](#2-design-decisions) — 12 confirmed decisions
3. [Block Visual Design Spec](#3-block-visual-design-spec) — exact surface layout for all block types
4. [Core Loop Definition](#4-core-loop-definition) — 30-second session + progression arc
5. [User Stories](#5-user-stories) — 6 stories with acceptance criteria
6. [Gamification & Progression Design](#6-gamification--progression-design) — unified evolution model
7. [Inspector Layout Spec](#7-inspector-layout-spec) — exact UI for own/other/unclaimed/dormant blocks
8. [Implementation Phases](#8-implementation-phases) — Pass 1 (5 phases) + Pass 2 (7 phases)
9. [Onboarding Alignment](#9-onboarding-alignment) — 9-phase mapping to Spark framing
10. [UI/UX Consistency Rules](#10-uiux-consistency-rules) — tokens, spacing, interactive states
11. [What We're Cutting](#11-what-were-cutting) — explicit out-of-scope list
12. [File Change Map](#12-file-change-map) — every file + what changes
13. [Testing Checklist](#13-testing-checklist) — visual, flow, perf, tester-facing
14. [Progress](#14-progress) — Ralph loop tracking

---

## 1. Current Problems

### 1.1 The Spark Face Is Invisible

**Problem:** Faces render at 0.90-1.0x scale on small block surfaces, competing with 7 additive glow layers (rim + inner + aura + specular + evo multiplier + spire + glow pass), breathing effects, interior-mapped windows, and style modifiers. The face — which is supposed to BE the creature — is buried under visual noise.

**Evidence:** Vision doc says "the block IS the creature" but visually the block is "a glowing cube with a tiny face sticker."

**Impact:** Players don't notice their Spark's mood, don't feel the Tamagotchi pull, don't understand what they're caring for.

### 1.2 Too Much Glow

**Problem:** A Beacon-tier block at 100% energy stacks: `(rim * 2.2 + aura + spec + spire + radiate + inner) * 1.8x evoGlow + separate glow pass material`. The tower looks like a neon sign, not a living colony.

**Specific offenders in `BlockShader.ts`:**
- `rimContrib` multiplied by 2.2 (~line 947)
- `evoGlowMult` goes up to 1.8x (~line 1025)
- `breatheIntensity` up to 0.7 for blazing blocks (~line 974)
- `radiate` kicks in at 60% energy (~line 1006)
- Glow pass alpha at 0.35 (~line 1318)

**Impact:** Faces are washed out by glow. Block colors are obscured. Evolution tiers are invisible because everything is bright.

### 1.3 No Unified Progression

**Problem:** 6 independent progression systems compete for attention:

| System | Visible Where | Player Understands? |
|--------|---------------|-------------------|
| XP/Levels (1-10) | Settings screen, small bar | No — "what does my level DO?" |
| Evolution tiers (Spark-Beacon) | Inspector progress bar | Partially — takes weeks to see change |
| Streaks (1-30 days) | Inspector badge | Yes — but only a number |
| Customization unlocks | Customize panel locks | No — all unlocked for testing |
| Achievements (7 types) | Toast notification | No — fire-and-forget, no lasting effect |
| Leaderboard rank | Board tab | View-only, no reward |

**Impact:** Player has no single thing to care about. No clear "what am I working toward?"

### 1.4 Customization Is Confusing

**Problem:** Current customize panel shows: 16 colors + 48 emojis + 11 styles + 7 textures + name field. Too many options, unclear what they do, style/texture distinction is meaningless to users.

**Impact:** Decision paralysis. Players pick a color and leave.

### 1.5 Bot Blocks vs Player Blocks Are Indistinguishable

**Problem:** Both bot and player blocks can show interior-mapped images. The `isBotOwner` guard was added but the visual hierarchy doesn't make it obvious which blocks are "real people."

**Impact:** New players can't tell if the tower has real people on it.

### 1.6 Unclaimed Blocks Look Dead and Boring

**Problem:** Unclaimed blocks are brown/dark with wireframe edges. They look abandoned, not inviting. The tower is ~70% unclaimed in early testing — meaning most of the tower looks ugly.

**Impact:** First impression is "mostly dead blocks" instead of "a beautiful structure waiting for me."

### 1.7 The Charge Tap Has No "Moment"

**Problem:** Tapping Charge produces: energy number goes up + a colored flash + "+25 XP" float. The face expression changes via smooth interpolation (smoothstep), so there's no perceptible before/after.

**Impact:** The core action of the entire game has no dopamine hit. This is the #1 thing that needs to feel amazing.

### 1.8 Aesthetic Is Too Dark/Cyber

**Problem:** Current palette is cyber-industrial (dark backgrounds, neon glow). The vision doc says "solarpunk" but the execution is closer to "Tron." For a Tamagotchi-care game, the moody darkness fights the vibe.

**Impact:** Emotional mismatch. Cute faces on dark, glowing, industrial blocks feel incongruent.

### 1.9 Onboarding Doesn't Teach the Core Loop

**Problem:** The 9-phase onboarding teaches mechanics ("tap to charge") but not meaning ("your Spark needs you"). It doesn't communicate that the block is a living creature.

**Impact:** Players understand HOW to charge but not WHY they should care.

---

## 2. Design Decisions

All decisions confirmed with the developer:

| # | Decision | Choice |
|---|----------|--------|
| 2.1 | Face style | Bigger vector SDF faces — fill 60-70% of block face, bolder lines. The face IS the block. |
| 2.2 | Core retention hook | Tamagotchi care — Spark mood is the entire game. Face communicates everything. |
| 2.3 | Customization scope | Simplified to 4 things: Color + Face personality + Emoji + Name. Drop style/texture. |
| 2.4 | Aesthetic direction | Soften everything — pastel + golden accents. More solarpunk, less cyber. |
| 2.5 | Unclaimed blocks | Soft translucent glass + thin golden wireframe edges. No face. Premium, inviting. |
| 2.6 | Bot blocks | Keep current interior-mapped images (Doge, Solana logos). No face. |
| 2.7 | Charge reaction | Random reactions (5 types). Variable reward = more engaging. |
| 2.8 | Face personality | 5 existing (Happy, Cool, Sleepy, Fierce, Derp). Player picks in customize, not random hash. |
| 2.9 | Evolution visibility | Explicit progress bar: "12/30 charges to Flame". |
| 2.10 | Progression unification | Evolution tier IS the one system. XP/streaks/achievements all feed into it. |
| 2.11 | Animated styles | Auto-activate at evolution tiers (not a choice). Flame=shimmer, Blaze=Aurora, Beacon=full animated. Reward, not customization. |
| 2.12 | Multiple blocks | Lean into as Spark collection. MyBlocksPanel = your collection. Each Spark has its own personality/evolution. |

---

## 3. Block Visual Design Spec

This section defines exactly what every block type looks like on the tower. This is the visual bible — Ralph must follow this for all shader/rendering work.

### 3.1 Block Types (Visual Hierarchy)

There are 4 visual categories of blocks on the tower, ordered by visual prominence:

```
MOST PROMINENT
  |
  v
1. Player blocks (pastel color + BIG face + emoji on top)     <-- THE STAR
2. Bot blocks (interior-mapped images, no face)                <-- VISUAL FILLER
3. Dormant blocks (sleeping face, faded color, "RECLAIM" CTA)  <-- TENSION
4. Unclaimed blocks (soft glass + golden wire, no face)        <-- OPPORTUNITY
  |
  v
LEAST PROMINENT
```

Player blocks MUST be the most visually interesting objects on the tower. If bots look better than players, we've failed.

### 3.2 Player Block Surface Layout

Each block is a cube with 6 faces. Here's what renders on each:

```
        TOP FACE
       +--------+
      / emoji  /|      <-- Chosen emoji rendered via texture atlas
     /  (SDF) / |          (visible when camera looks down)
    +--------+  |
    |        |  |
    | FACE   |  +      <-- Vertical faces: BIG SDF face (60-70%)
    | ^_^    | /           + owner color as background
    |        |/            + evolution decorations (blush, brows, halo)
    +--------+
     BOTTOM: just color, no features
```

**Vertical faces (x4):**
- Background: owner's chosen pastel/vibrant color (fills entire face)
- Face: SDF personality face, centered, fills 60-70% of surface area
- Evolution decorations: blush (tier 2+), eyebrows (tier 3+), halo (tier 4)
- NO emoji on vertical faces. NO name text on vertical faces.

**Top face (x1):**
- Background: slightly lighter shade of owner color
- NO emoji on top face (deferred — no texture atlas exists for this)
- Emoji is 2D inspector-only for this sprint

**Bottom face (x1):**
- Just owner color, nothing else (usually not visible)

**Name:** Renders ONLY in the 2D inspector UI. Not on the 3D block surface. Text rendering in GLSL is too complex and names would be unreadable at distance anyway.

### 3.3 Bot Block Surface Layout

```
    +--------+
    |        |
    | IMAGE  |      <-- Interior-mapped parallax image (Doge, Solana, etc.)
    | [3D]   |         on all 4 vertical faces
    |        |
    +--------+
```

- Vertical faces: interior-mapped images with parallax depth (existing system)
- NO face. NO emoji. Bot blocks are visual filler, not characters.
- Bot blocks are identified by `isBotOwner === true` or `aImageIndex > 0`
- Colors: bot blocks use their assigned colors (varied, from bot personas)

### 3.4 Dormant Block Surface Layout (Player, 0 Energy, 3+ Days)

```
    +--------+
    |        |
    | X_X    |      <-- Sleeping face (existing dead block face)
    | ---    |         Dimmed, desaturated owner color
    |        |         "RECLAIM" CTA in inspector
    +--------+
```

- Vertical faces: owner's color but DESATURATED (multiply by 0.5 saturation)
- Face: sleeping face (X_X or closed-line eyes) — already implemented
- Faint dark overlay to signal "abandoned"
- Distinguished from unclaimed by: HAS a face (sleeping), HAS a color (desaturated)
- Inspector shows "RECLAIM" button for other players (already implemented)

### 3.5 Unclaimed Block Surface Layout

```
    +--------+
    |        |
    |  soft  |      <-- Soft lavender-white glass
    |  glass |         Thin golden wireframe edges
    |        |         Faint golden shimmer pulse
    +--------+
```

- Vertical faces: soft lavender-white base (vec3 0.85, 0.82, 0.90)
- Golden wireframe on edges (thin, 0.04 width, 60% blend)
- NO face. The absence of face is the key differentiator.
- Faint golden shimmer (slow pulse, 0.03 amplitude)
- Should look INVITING, like a gift box waiting to be opened

### 3.6 Visual Hierarchy at Distance

At overview distance (~45 units from tower):
- **Player blocks:** Face visible (big enough now), color obvious, clearly "alive"
- **Bot blocks:** Images visible (already are), look populated
- **Dormant blocks:** Dark/desaturated, sleeping face faintly visible
- **Unclaimed blocks:** Soft uniform glass, golden shimmer, clearly "empty"

The tower should read as: "Some blocks are alive and colorful (players), some have images (bots), some are sleeping (dormant), and there are pretty empty spots waiting (unclaimed)."

### 3.7 Charge Reaction Labels

Each of the 5 random charge reactions shows a text label via FloatingPoints:

| # | Reaction | Float Text | Sound |
|---|----------|-----------|-------|
| 0 | Joy | "Happy!" | Existing `chargeTap` sound |
| 1 | Surprise | "Surprised!" | Existing `pokeReceive` sound (short ding) |
| 2 | Excited | "Excited!" | Existing `chargeGreat` sound (energetic) |
| 3 | Grateful | "Thanks!" | Existing `chargeGood` sound (warm) |
| 4 | Wake-up | "I'm awake!" | Existing `onboardingClaim` sound (gentle) |

Sound mapping uses existing SFX — no new audio assets needed. The label appears alongside the "+1 Charge" text (e.g. "+1 Charge - Happy!") or as a second FloatingPoints instance.

### 3.8 Evolution Celebration Spec

When a block crosses an evolution threshold:

1. **Detection:** In `tower-store.ts` `chargeBlock`, if `newEvolutionTier > oldEvolutionTier`, set `justEvolved: tierName`
2. **Camera:** Reuse claim celebration camera (zoom to block, hold 3s, return). Don't build a new one.
3. **Sound:** Play `onboardingCelebration` sound (the 8.5s cinematic pad — cut to first 3s or use `chargeGreat`)
4. **Face change:** The new decorations (blush/brows/halo) appear instantly on the block. The celebration gives the player a moment to notice.
5. **Float text:** "Evolved to FLAME!" in golden color, larger than normal float text (1.5x scale)
6. **Full-screen overlay:** Repurpose `LevelUpCelebration.tsx` — change text from "Level X!" to "Your Spark evolved to [TIER]!"
7. **Inspector reopens** after celebration (same pattern as claim celebration)

Keep it simple. Don't build a new animation system. Reuse claim celebration infrastructure.

### 3.9 Testing Mode Thresholds

For testing builds, dramatically lower evolution requirements so testers see progression in one session:

**Add to `packages/common/src/constants.ts`:**

```typescript
export const TESTING_MODE = __DEV__ || process.env.TESTING === 'true';

export const EVOLUTION_TIERS_TESTING = [
  { name: "Spark",  charges: 0,   streakReq: 0,  glowMultiplier: 1.0 },
  { name: "Ember",  charges: 3,   streakReq: 0,  glowMultiplier: 1.2 },
  { name: "Flame",  charges: 8,   streakReq: 0,  glowMultiplier: 1.4 },
  { name: "Blaze",  charges: 15,  streakReq: 0,  glowMultiplier: 1.6 },
  { name: "Beacon", charges: 25,  streakReq: 0,  glowMultiplier: 1.8 },
] as const;

// Use this everywhere instead of EVOLUTION_TIERS directly:
export const ACTIVE_EVOLUTION_TIERS = TESTING_MODE
  ? EVOLUTION_TIERS_TESTING
  : EVOLUTION_TIERS;
```

- **Testing:** Ember in 3 charges, Beacon in 25 charges. No streak requirements.
- **Production:** Original thresholds (10/30/75/150 with streak gates)
- Charge cooldown for testing: allow charging every 30 seconds (not once per day)
- This flag also used in `CUSTOMIZATION_TIERS` — all unlocked in testing mode (already true)

**Ralph must use `ACTIVE_EVOLUTION_TIERS` everywhere** instead of `EVOLUTION_TIERS` directly.

### 3.10 Onboarding First-Charge Fix

The current onboarding asks the player to charge a block that was just claimed at 100% energy. This is broken — "charge your full Spark" makes no sense.

**Fix:** Start the claimed block at 60% energy during onboarding (not 100%).

In the onboarding claim handler:
```typescript
// Instead of: energy = MAX_ENERGY (100)
// Use: energy = 60 during onboarding
const claimEnergy = isOnboarding ? 60 : MAX_ENERGY;
```

This way the Spark starts needing energy — the face shows as content but not blazing, and the charge step makes sense: "Your Spark needs energy!" The face visibly brightens and reacts, giving the player an immediate taste of the core loop.

### 3.11 Demo Moment for Judges

The single most impressive moment for a Solana hackathon judge is:

```
Player taps "Claim" -> Signs Solana transaction via MWA/Seed Vault ->
Block face lights up and smiles -> Player picks color and personality ->
Spark is alive on a shared 3D tower that anyone can see
```

This moment is ALREADY BUILT. The plan doesn't change it — just enhances it with bigger faces and warmer aesthetics. But Ralph should NOT break the claim flow, the wallet integration, or the on-chain staking. These are in the "Do NOT Modify" list for a reason.

For the demo: the claim celebration animation + face "birth" + Solana transaction + 3D tower = the pitch. Everything else supports this moment.

---

## 4. Core Loop Definition

### The 30-Second Session

```
OPEN APP
  |
  v
SEE YOUR SPARK'S FACE
  - Happy? "Nice, doing well"
  - Drowsy? "Aw, it needs me"
  - Sleeping? "Oh no, gotta charge!"
  |
  v
TAP CHARGE
  - Spark reacts! (random: smile, surprise, wiggle, sparkle)
  - Block bounces
  - Energy bar fills
  - "+1 charge toward [next tier]" if close
  |
  v
FEEL GOOD
  - Spark is happy again
  - Maybe evolution happened! (celebration)
  - Maybe a rare reaction! (variable reward)
  |
  v
OPTIONAL: CUSTOMIZE / EXPLORE / SHARE
  |
  v
CLOSE APP
  - Come back in 4-12 hours when Spark gets drowsy again
```

### The Progression Arc (Days/Weeks)

```
DAY 1: Claim block -> Pick color + face + emoji + name -> Charge -> Share
DAY 2-3: Return (notification: "Spark is getting drowsy") -> Charge -> See streak building
DAY 5-7: Streak milestone badge -> More charge reactions unlocked -> Ember evolution!
DAY 10-14: Flame evolution (blush marks appear!) -> Deep into daily routine
DAY 14-30: Blaze -> Beacon -> Tower legend -> Social status
```

### Why Players Return

1. **Emotional pull:** "My Spark looks sad, I should check on it" (primary)
2. **Progress:** "I'm 3 charges away from Flame tier" (secondary)
3. **Variable reward:** "I wonder what reaction I'll get today" (dopamine)
4. **Social:** "Someone poked my Spark" / "New neighbor appeared" (tertiary)
5. **Territory:** "If I stop charging, someone could take my spot" (loss aversion, background)

---

## 5. User Stories

### 4.1 First-Time Player (Onboarding)

```
AS a new player opening the app for the first time,
I WANT to understand that blocks are living Sparks that need energy to stay bright,
SO THAT I feel emotionally invested before I even claim one.

ACCEPTANCE CRITERIA:
- Tower appears with soft, inviting aesthetic (not dark/scary)
- I can see faces on blocks — some happy, some drowsy
- Onboarding text says "Choose a Spark to care for" (not "claim a block")
- After claiming, my Spark's face lights up with joy (the "moment")
- I'm prompted to customize: pick color, face personality, emoji, name
- I understand I need to come back to keep my Spark happy
- Total time: < 90 seconds
```

### 4.2 Returning Player (Daily Charge)

```
AS a returning player,
I WANT to see my Spark's current mood instantly and charge it in one tap,
SO THAT my daily session feels quick and satisfying.

ACCEPTANCE CRITERIA:
- App opens, camera goes to my block (or I tap MyBlockFAB)
- I can see my Spark's face: drowsy/worried/happy
- I tap Charge -> Spark reacts with a random expression (surprise, joy, wiggle)
- Energy bar visually fills
- If near evolution milestone: "2 more charges to Flame!"
- If evolution happens: celebration moment (camera zoom, sound, face transforms)
- Total time: < 15 seconds for the charge action
```

### 4.3 Customization Session

```
AS a player who wants to express themselves,
I WANT to make my block look unique and personal,
SO THAT I can identify it on the tower and feel ownership.

ACCEPTANCE CRITERIA:
- Customize panel shows 4 clear sections: Color, Face, Emoji, Name
- Color picker: 12-16 pastel + vibrant colors, current selection highlighted
- Face picker: 5 personalities with preview (^_^ Cool, >_< Fierce, etc.)
- Emoji picker: curated set of 20-30 relevant emojis
- Name field: short text input
- Changes preview LIVE on the 3D block behind the panel
- No confusing "style" or "texture" options
```

### 4.4 Evolution Milestone

```
AS a player who has been charging daily,
I WANT to see my Spark visually evolve and get a celebration,
SO THAT I feel my dedication has been rewarded.

ACCEPTANCE CRITERIA:
- Evolution progress bar in inspector: "12/30 charges to Flame"
- When threshold crossed: special celebration (bigger than regular charge)
- Face visibly changes (Flame adds blush marks, Blaze adds eyebrows, etc.)
- Notification text: "Your Spark evolved to Flame!"
- The change is VISIBLE at tower distance (not just in inspector)
- Evolution never regresses (already implemented)
```

### 4.5 Tower Explorer

```
AS any player looking at the tower,
I WANT to instantly distinguish unclaimed blocks, bot blocks, and player blocks,
SO THAT the tower tells a visual story at a glance.

ACCEPTANCE CRITERIA:
- Unclaimed: soft translucent glass + golden wireframe, no face, inviting
- Bot blocks: interior-mapped images (Doge, Solana, etc.), no face
- Player blocks: vibrant pastel color + BIG expressive face + emoji
- At overview distance: player blocks are obviously "alive" (faces visible)
- The tower looks beautiful even when 70% unclaimed
```

### 4.6 Social Interaction (Poke)

```
AS a player who sees another player's Spark,
I WANT to poke it and see a reaction,
SO THAT the tower feels social and alive.

ACCEPTANCE CRITERIA:
- Tap other player's block -> inspector shows Poke button
- Poke -> target block visually reacts (bounce + surprised face)
- Poker sees the reaction immediately
- Target gets push notification
- 30-second cooldown (already implemented)
```

---

## 6. Gamification & Progression Design

### The Problem With Current Progression

The player currently has 6 unconnected numbers:
- **XP** (displayed in TopHUD + Settings) — accrues on claim/charge, powers levels 1-10, but levels DO nothing
- **Level** (1-10) — derived from XP, triggers LevelUpCelebration, but doesn't unlock anything
- **Streak** (1-30+ days) — multiplies charge energy, required for evolution tiers, shown as badge
- **Evolution tier** (0-4) — derived from totalCharges + bestStreak, changes face decorations
- **Achievements** (7 types) — toast notifications, persisted but never referenced again
- **Leaderboard rank** — visible on Board tab, no reward for rank changes

A player charging daily sees: "+25 XP", "Streak: 5", "Level 2", evolution bar, and none of these clearly connect. It feels like 6 half-baked systems instead of one.

### The Unified Progression Model

**One number, one arc: Evolution Tier.**

Everything feeds into evolution. Everything unlocks FROM evolution. The player's mental model is:

```
"I charge my Spark -> it grows -> it unlocks new stuff -> I keep charging"
```

### Tier Progression Table

| Tier | Name | Charges Req | Streak Req | Face Change | Auto Style (index) | Unlock | LOD |
|------|------|-------------|------------|-------------|--------------------|---------|----|
| 0 | **Spark** | 0 (claim) | 0 | Base personality face | Default (0) | 8 pastel colors, 12 emojis, name | 48 |
| 1 | **Ember** | 10 | 0 | Slightly larger features | Default + evoShimmer (0) | +8 vibrant colors, all 24 emojis | 52 |
| 2 | **Flame** | 30 | 7 days | + Blush marks | Crystal (8) | (face + style are the reward) | 56 |
| 3 | **Blaze** | 75 | 14 days | + Eyebrows, sparkle glints | Aurora (7) | (face + style are the reward) | 60 |
| 4 | **Beacon** | 150 | 30 days | + Halo ring (animated gold) | Lava (9) | (face + style are the reward) | 65 |

**Style auto-assignment implementation:** In `TowerGrid.tsx`, when setting the `aStyle` attribute per-instance, override with tier-based style:
```typescript
// Auto-assign style based on evolution tier (player blocks only)
if (!block.isBotOwner && block.evolutionTier >= 2) {
  const tierStyles = [0, 0, 8, 7, 9]; // Spark, Ember, Flame=Crystal, Blaze=Aurora, Beacon=Lava
  styleArr[i] = tierStyles[block.evolutionTier] ?? 0;
} else {
  styleArr[i] = block.style ?? 0;
}
```

**Key insight:** Animated styles are NOT in the customize panel. They auto-activate when you reach a tier. The player doesn't choose "Aurora style"; they EARN it by reaching Blaze. The block literally transforms — this is the missing "wow" moment.

### How Each System Feeds Evolution

```
Daily Charge Tap
  |-> +1 to totalCharges (evolution counter)
  |-> Maintains/builds streak (evolution gate)
  |-> Awards XP (background, for SOAR)
  |-> Random face reaction (dopamine)
  |
  v
Evolution Tier Check
  |-> If threshold crossed: CELEBRATION
  |-> New face decorations appear
  |-> New customization options unlock
  |-> LOD distance increases (more visible on tower)
```

### What The Player Sees

**Inspector panel (always visible when block selected):**
```
+------------------------------------------+
|  [Spark face]  "Sparky"                  |
|  EMBER   [==========>------]  FLAME      |
|          28/30 charges                    |
|          Need: 7-day streak (current: 5) |
+------------------------------------------+
```

**After charge tap:**
```
+1 Charge!        <-- FloatingPoints text (replaces "+25 XP")
28/30 to Flame    <-- if close to next tier
```

**On evolution tier-up:**
```
Full-screen celebration:
  "Your Spark evolved to FLAME!"
  [Face with new blush marks preview]
  [New customization unlocked badge]
  Camera zooms to block, confetti, sound
```

### Communication Touchpoints

Every part of the UI should reinforce the same progression:

| Touchpoint | What It Shows | Example |
|------------|--------------|---------|
| **Inspector header** | Tier name + icon | "EMBER" with ember icon |
| **Inspector progress** | Bar + charges/streak | "28/30 charges, streak: 5/7" |
| **Charge float text** | "+1 Charge" (not XP) | "+1 Charge (28/30 to Flame)" |
| **Push notification** | Spark mood + progress | "Your Spark is drowsy! 2 charges to Flame" |
| **Customize locks** | Tier requirement | "Unlocks at Flame" with lock icon |
| **MyBlockFAB** | Urgency dot for low energy | Red dot = Spark needs you |
| **Share card** | Tier badge | "EMBER Spark on Floor 7" |
| **Onboarding** | "Help your Spark grow" | First goal: reach Ember (10 charges) |

### Gating Rules

1. **Customization gating by tier** (re-enable after testing):
   - Tier 0 (Spark): base colors + base emojis
   - Tier 1 (Ember): all colors + all emojis
   - Tier 2 (Flame): animated styles
   - Tier 3+ (Blaze/Beacon): special effects, particles

2. **For testing builds:** All unlocked (current behavior) BUT show "Normally unlocks at [tier]" label so testers understand the intended progression.

3. **Never gate face personality choice.** All 5 personalities available at Tier 0. Face is identity, not reward.

4. **Never gate colors completely.** 8 pastels at Tier 0 is enough to feel expressive. Vibrant/rare colors at Tier 1 gives something to look forward to.

### What Happens to XP/Levels

- **XP still accrues** internally (player-store.ts) — needed for SOAR on-chain leaderboard
- **XP is NOT displayed** as a primary metric anywhere (remove from TopHUD)
- **Levels are NOT displayed** — evolution tiers replace them entirely
- **LevelUpCelebration** repurposed for evolution tier-up
- **FloatingPoints** shows "+1 Charge" instead of "+25 XP"
- **SOAR badge** on leaderboard still works (shows verified XP)

### What Happens to Achievements

- **Keep achievement-store and toast** — they're fire-and-forget, no harm
- **Don't invest more in them** — evolution tiers are the progression
- **Future:** achievements could grant cosmetic badges displayed on block face (post-testing)

### What Happens to Leaderboard

- **Keep as-is** — Board tab shows owners + XP tabs
- **Add evolution tier icon** next to player names (visual flex)
- **Future:** "Evolved Sparks" tab showing tier distribution

---

## 7. Inspector Layout Spec

The block inspector is the primary UI for interacting with a selected block. Here's the exact layout:

### Player's Own Block (Selected)

```
+--------------------------------------------+
| [Face preview]  "Sparky"        [EMBER]    |  <- Header: face icon, name, tier badge
|                                             |
| EVOLUTION                                   |
| Ember [========>--------] Flame             |  <- Progress bar
| 8/30 charges | Streak: 5 days              |  <- Stats line
|                                             |
| ENERGY                                      |
| [====================--------] 72%          |  <- Energy bar (existing)
|                                             |
| [ ===== CHARGE ===== ]                      |  <- PRIMARY CTA: large gold button
|  +1 Charge (Spark needs energy!)            |  <- Contextual subtitle
|                                             |
| [ Customize ]  [ Share ]                    |  <- Secondary actions
+--------------------------------------------+
```

**Key layout rules:**
- **CHARGE button** is the #1 visual element — large, gold variant, above the fold
- Evolution progress bar is ABOVE the charge button (see progress, then act)
- Energy bar shows current charge level (existing)
- Customize and Share are secondary (smaller, below)
- Header shows face preview + name + evolution tier badge

### Other Player's Block (Selected)

```
+--------------------------------------------+
| [Face preview]  "Rival's Spark"  [FLAME]   |
|                                             |
| ENERGY                                      |
| [====================--------] 72%          |
|                                             |
| [ ===== POKE ===== ]                        |  <- Primary action for others
|  Say hi to this Spark!                      |
|                                             |
| Owner: @username                            |
+--------------------------------------------+
```

### Unclaimed Block (Selected)

```
+--------------------------------------------+
| Empty Spark                                 |
| This Spark is waiting for someone...        |
|                                             |
| Floor 7 | Position 42                       |
| Price: $0.25 USDC                           |  <- Layer-based pricing (existing)
|                                             |
| [ ===== CLAIM THIS SPARK ===== ]            |  <- Gold CTA
|  Wake it up and make it yours!              |
+--------------------------------------------+
```

### Dormant Block (Reclaimable)

```
+--------------------------------------------+
| [Sleeping face]  "Abandoned Spark"  [EMBER] |
| Dormant for 5 days                          |
|                                             |
| Previous owner: @someone                    |
| Floor 7 | Position 42                       |
|                                             |
| [ ===== RECLAIM ===== ]                     |  <- Gold CTA
|  This Spark needs a new keeper!             |
+--------------------------------------------+
```

**Note:** The inspector already has sub-components (`InspectorHeader`, `InspectorActions`, `InspectorStats`, `InspectorCustomize`). The changes above are about CONTENT and COPY, not structural rewrites. Reuse existing components.

---

## 8. Implementation Phases

### Phase Overview

#### Pass 1 — Testable Loop (push APK after this)

| # | Phase | What it fixes | Key Files |
|---|-------|---------------|-----------|
| 1 | Glow Reduction | Faces invisible under glow wash | `BlockShader.ts` |
| 2 | Face Scale-Up | Faces too small to read | `BlockShader.ts` |
| 3 | Customize Panel | Confusing 5-section panel → clean 3-section | `InspectorCustomize.tsx`, `constants.ts` |
| 4 | Progression Clarity | XP/levels confusing → evolution is the one system | `FloatingPoints.tsx`, `TopHUD.tsx`, `player-store.ts`, `constants.ts`, `tower-store.ts` |
| 5 | Onboarding Copy | "Block" language → "Spark" language | Onboarding step components |

#### Pass 2 — Delight & Polish (after tester feedback)

| # | Phase | Description | Key Files |
|---|-------|-------------|-----------|
| 6 | Unclaimed Block Restyle | Soft glass + golden wireframe | `BlockShader.ts`, `TowerGrid.tsx` |
| 7 | Aesthetic Softening | Pastel palette, warmer sky | `BlockShader.ts`, `TowerCore.tsx`, `theme.ts`, `constants.ts` |
| 8 | Face Personality Choice | Hash-based → player-chosen | `BlockShader.ts`, `TowerGrid.tsx`, `tower-store.ts`, `multiplayer-store.ts` |
| 9 | Evolution Progress Bar | Show "X/Y to next tier" | `InspectorStats.tsx` or `InspectorHeader.tsx` |
| 10 | Charge Reactions | Variable face expressions on charge | `BlockShader.ts`, `TowerGrid.tsx`, `tower-store.ts` |
| 10a | Evolution Celebration | Dramatic tier-up moment | `LevelUpCelebration.tsx`, `tower-store.ts` |
| 11 | Onboarding V2 | Add Face picker to onboarding customize step | Onboarding step components |
| 12 | Polish & Test | End-to-end flow, visual consistency | All touched files |

### ═══════════════════════════════════════════
### PASS 1 — TESTABLE LOOP
### ═══════════════════════════════════════════
###
### Goal: Tester can claim, customize, charge, and understand the loop.
### Push APK after these 5 phases.

### Phase 1: Glow Reduction

**Goal:** Make faces visible by reducing visual noise. Tower glows warmly, not blindingly.

**Changes in `BlockShader.ts` main fragment shader:**

| Property | Current Value | New Value | Location Hint |
|----------|--------------|-----------|---------------|
| `rimContrib` multiplier | `rimTint * 2.2 * rimStrength` | `rimTint * 0.8 * rimStrength` | ~line 947 |
| `rimStrength` formula | `fresnel * (0.35 + energy * 1.0)` | `fresnel * (0.2 + energy * 0.4)` | ~line 946 |
| `evoGlowMult` | `1.0 + evoTier * 0.2` | `1.0 + evoTier * 0.08` | ~line 1025 |
| `breatheIntensity` (blazing, e>0.8) | `0.35 + energy * 0.35` | `0.15 + energy * 0.15` | ~line 974 |
| `breatheIntensity` (thriving, e>0.5) | `0.2 + energy * 0.3` | `0.1 + energy * 0.15` | ~line 979 |
| `breatheIntensity` (fading, e>0.2) | `0.15 + energy * 0.2` | `0.08 + energy * 0.1` | ~line 986 |
| `radiate` threshold | `smoothstep(0.6, 1.0, energy)` | `smoothstep(0.85, 1.0, energy)` | ~line 1006 |
| `radiate` intensity | `0.3 + 0.2 * sin(...)` | `0.1 + 0.1 * sin(...)` | ~line 1006 |
| `innerGlow` | `coreFactor * energy * 0.15` | `coreFactor * energy * 0.06` | ~line 956 |
| `spireGlow` | `0.4 + 0.5 * sin(...)` | `0.15 + 0.2 * sin(...)` | ~line 1003 |
| `scanLine` | `* 0.25` | `* 0.08` | ~line 999 |

**Changes in glow fragment shader (~line 1274):**
- `glowColor` multiplier: `* 1.5` -> `* 1.0` (~line 1309)
- Pulse: `0.85 + 0.15 * sin(...)` -> `0.92 + 0.08 * sin(...)` (~line 1313)
- Alpha: `* 0.35` -> `* 0.15` (~line 1318)

**Done criteria:** Beacon block at 100% energy has clearly visible face features. Tower has warm glow, not washed-out neon.

### Phase 2: Face Scale-Up

**Goal:** Faces fill 60-70% of block's vertical face. Face IS the block.

**Changes in `BlockShader.ts` `renderFace()` function:**

1. **Scale UV coordinates** — zoom the face coordinate space:
   ```glsl
   // Scale UV to make face bigger (0.65 = face fills ~65% of surface)
   vec2 faceUV = uv * 0.65;
   ```
   Apply this scaling to the UV BEFORE passing to personality renderers.

2. **Increase feature sizes:**
   - Eye radius: ~0.055 -> ~0.08
   - Eye center separation: ~0.09 -> ~0.12
   - Mouth width: proportionally larger
   - All SDF `step()` thresholds for line thickness: multiply by ~1.6x (e.g. 0.006 -> 0.010)

3. **LOD distance increase** (faces readable from further now):
   - `lodFar` base: 42.0 -> 48.0
   - Per-tier bonus: stay at `+ evo * 4.0` (Beacon = 48+16 = 64 units)

4. **Keep all 4 vertical faces** — with bigger faces they should look good from any angle.

**Done criteria:** At overview distance (~45 units), moods are identifiable. At inspection distance, individual features (eyes, mouth, blush) are clearly visible and bold.

### Phase 3: Customization Panel Simplify

**Goal:** Strip to 3 clean sections. Remove confusing style/texture pickers. Keep face personality as hash-based for now (player choice comes in Pass 2).

**New layout for `InspectorCustomize.tsx`:**

```
CUSTOMIZE YOUR SPARK

  COLOR                          <-- PRIMARY: most visual impact
  [pastel row 1: 8 circles]
  [vibrant row 2: 8 circles]

  NAME                           <-- SECONDARY: text identity
  [text input field]

  EMOJI (optional flair)         <-- TERTIARY: de-emphasized
  [compact row of 12-16 emojis]
```

**Changes:**

1. **Remove:** Style picker section (was styles 0-10) — styles auto-assigned by evolution tier now
2. **Remove:** Texture picker section (was textures 0-6)
3. **Do NOT add Face personality picker yet** — that comes in Pass 2 Phase 8. Faces stay hash-based for now (already working).
4. **Reorder colors:** Pastel-first. **Replace the entire BLOCK_COLORS array** with new palette (clean break, 16 new hex values):
   - Row 1 (pastels): Blush Pink (#FFB5C2), Lavender (#C8B6FF), Mint (#B8F3D4), Peach (#FFD4B8), Sky Blue (#B8D4FF), Cream (#FFF3D4), Sage (#C2D4B8), Coral (#FF9B9B)
   - Row 2 (vibrant): Hot Pink (#FF4D8D), Purple (#8B5CF6), Teal (#14B8A6), Gold (#D4AF55), Crimson (#DC2626), Forest (#16A34A), Ocean (#0284C7), Charcoal (#4A4A5A)
5. **De-emphasize emoji:** Move to bottom, smaller section. Reduce from 48 to ~16 curated options in a single scrollable row.
6. **Add gold theme tokens** to `apps/mobile/constants/theme.ts`:
   - `COLORS.goldAccent: '#D4AF55'`
   - `COLORS.goldAccentLight: '#E8D48A'`
   - `COLORS.goldAccentDim: '#8B7832'`
7. **Section headers:** `FONT_FAMILY.bodySemibold`, 13px, `COLORS.textSecondary`, 16px gap between sections
8. **Selection indicator:** Gold border (2px) + subtle gold background tint on selected items

**Style note:** Do NOT include a style picker. Block style is auto-assigned based on evolution tier:
```typescript
const TIER_STYLES = [0, 0, 8, 7, 9]; // Default, Default, Crystal, Aurora, Lava
```
The `style` field is still sent to server but is set automatically, not by player.

**Done criteria:** Customize panel shows 3 sections (Color, Name, Emoji). Color is prominent. No style/texture/face pickers. All changes preview live on block.

### Phase 4: Progression Clarity

**Goal:** Make evolution the ONE progression system. Remove XP from player view. Add testing thresholds.

**Changes:**

1. **Testing mode thresholds** — add `ACTIVE_EVOLUTION_TIERS` to `packages/common/src/constants.ts`:
   - Testing: Ember=3, Flame=8, Blaze=15, Beacon=25 charges, no streak requirements
   - Production: original thresholds (10/30/75/150 with streak gates)
   - Use `__DEV__` flag or a `TESTING_MODE` constant to switch
   - Replace ALL references to `EVOLUTION_TIERS` with `ACTIVE_EVOLUTION_TIERS` in:
     - `packages/common/src/constants.ts` (export `ACTIVE_EVOLUTION_TIERS` + `getEvolutionTier` uses it)
     - `tower-store.ts` (`getEvolutionTier` calls)
     - `TowerRoom.ts` (server-side tier computation)
   - Also reduce charge cooldown in testing: allow charging every 30 seconds

2. **FloatingPoints.tsx** — change float text:
   - After charge: "+1 Charge" (not "+25 XP")
   - If close to tier: "+1 Charge (28/30 to Flame)"

3. **TopHUD.tsx** — remove XP pill/bar if present. Keep minimal (MONOLITH + wallet).

4. **player-store.ts** — keep XP accrual (needed for SOAR) but:
   - Remove `levelUp` state trigger (will be repurposed in Pass 2)

5. **InspectorActions.tsx** — update charge result text if it shows XP.

6. **tower-store.ts** `chargeBlock` action — after computing new evolution tier, if it changed:
   - Set `justEvolved: tierName` on the store state (used by Pass 2 celebration)
   - Auto-assign block style based on new tier: `TIER_STYLES[newTier]`

**Done criteria:** No XP numbers visible to player. FloatingPoints shows "+1 Charge". Testing thresholds active in dev. Evolution tier changes auto-assign block style.

### Phase 5: Onboarding Copy

**Goal:** All onboarding text uses "Spark" framing. Charge step is meaningful.

**Copy changes in onboarding step components:**

| Phase | Current Copy (approx) | New Copy |
|-------|----------------------|----------|
| 3 (Claim) | "Find your spot" / "Claim a block" | "Choose a Spark to care for" / "Wake up a Spark" |
| 4 (Celebration) | "This is your block!" | "Your Spark is alive!" |
| 5 (Customize) | "Pick a color" / "Customize" | "What color is your Spark?" / "Make it yours" |
| 6 (Charge) | "Tap to charge" | "Charge your Spark!" |
| 7 (Poke) | "Poke a block" | "Say hi to a neighbor Spark" |
| 9 (Done) | "You're ready" | "Take care of your Spark! Come back soon." |

**Locate the copy:** Grep for the current copy strings in onboarding step components referenced by `onboarding-store.ts`.

**Onboarding first-charge fix:**
- Start claimed block at 60% energy during onboarding (not 100%)
- In the onboarding claim handler, use `energy = 60` instead of `MAX_ENERGY`
- This makes the charge step meaningful: "Your Spark needs energy — charge it!"
- The face will show as content (not blazing), and the charge gives an immediate taste of the core loop

**Minimal structural changes:** Mostly changing text strings, not phase structure or animation. The energy change is a one-line tweak.

**Done criteria:** All onboarding text refers to "Spark" not "block." Claimed block starts at 60% energy so charge step is meaningful. Language uses "charge" consistently.

### ═══════════════════════════════════════════
### === PASS 1 GATE ===
### ═══════════════════════════════════════════
###
### STOP HERE. Push APK. Get tester feedback.
### Review shader changes visually before continuing.
### Run Pass 2 only after confirming Pass 1 looks right.
###
### ═══════════════════════════════════════════

### ═══════════════════════════════════════════
### PASS 2 — DELIGHT & POLISH
### ═══════════════════════════════════════════
###
### Goal: Visual refinements, personality choice, reactions,
### celebrations. Run after tester feedback informs priorities.

### Phase 6: Unclaimed Block Restyle

**Goal:** Unclaimed blocks look like premium display cases — inviting, not ugly.

**Changes in `BlockShader.ts`:**

1. **New unclaimed base color** — replace dark/brown with soft lavender-white:
   ```glsl
   vec3 unclaimedBase = vec3(0.85, 0.82, 0.90); // soft lavender-white
   ```
   Need to detect "unclaimed" = energy near 0 AND not a bot owner. May need a new attribute `aIsBot` or use existing `aImageIndex > 0` as bot proxy.

2. **Golden wireframe edges** — add golden highlight on block edges for unclaimed:
   ```glsl
   vec3 goldWire = vec3(0.85, 0.70, 0.35);
   float edgeDist = /* proximity to block face edge from vLocalPos */;
   float wireframe = (1.0 - smoothstep(0.0, 0.04, edgeDist)) * isUnclaimed;
   baseColor = mix(baseColor, goldWire, wireframe * 0.6);
   ```

3. **No face on unclaimed** — skip `renderFace()` when unclaimed (energy == 0 AND no owner). The absence of face makes claimed blocks POP.

4. **Subtle golden shimmer** — faint breathing pulse for unclaimed:
   ```glsl
   float unclaimedPulse = sin(uTime * 1.5 + vInstanceOffset) * 0.03 * isUnclaimed;
   baseColor += goldWire * unclaimedPulse;
   ```

5. **Dormant blocks (player-owned, 0 energy, 3+ days)** — visually distinct from unclaimed:
   - Keep sleeping face (X_X or closed eyes) — already implemented
   - Desaturate owner color (multiply saturation by ~0.4)
   - Apply faint dark overlay (mix with vec3(0.15) at 30%)
   - Detection: energy == 0 AND has owner AND NOT bot. May need `aHasOwner` attribute.

**TowerGrid.tsx changes needed:**
- Add `aIsBot` attribute (float, 0 or 1) from `block.isBotOwner`
- Possibly add `aHasOwner` attribute to distinguish unclaimed from dormant

**Done criteria:** Unclaimed = soft glass + golden edges. Dormant = sleeping face + desaturated. Three distinct visual states.

### Phase 7: Aesthetic Softening

**Goal:** Shift whole tower from cyber-industrial to warm solarpunk.

**Changes:**

1. **Canvas background** (`TowerCore.tsx`): `#0a0812` -> `#1a1525` (warmer, slightly lighter)

2. **Block shader** (`BlockShader.ts`):
   - Reduce AO intensity slightly (less dark crevices)
   - Warm up ambient light contribution
   - SSS tint slightly warmer

3. **Particles** (`Particles.tsx`): Shift colors warmer (gold/amber tones)

4. **Foundation** (`Foundation.tsx`): Warm up marble tones slightly if time allows

**Done criteria:** Tower screenshot feels "warm and inviting" not "dark and moody."

### Phase 8: Face Personality as Player Choice

**Goal:** Players pick their Spark's face personality during customization.

**Changes:**

1. **Data model** — add `personality` to DemoBlock in `tower-store.ts`:
   ```typescript
   personality?: number; // 0=Happy, 1=Cool, 2=Sleepy, 3=Fierce, 4=Derp. -1=hash
   ```

2. **New per-instance attribute** `aPersonality` (float) in `TowerGrid.tsx`:
   - -1 = use hash-based selection (unclaimed/bot blocks)
   - 0-4 = player-chosen personality

3. **Shader** `renderFace()` in `BlockShader.ts`:
   ```glsl
   int personality;
   if (vPersonality >= 0.0) {
     personality = int(vPersonality);
   } else {
     personality = int(faceHash(instanceOff, 10.0) * 5.0);
   }
   ```

4. **Customize message** — add `personality` to the customize action in:
   - `useBlockActions.ts` (client send)
   - `TowerRoom.ts` (server handler)
   - `multiplayer-store.ts` (sync handler)

5. **Add Face section to customize panel** (`InspectorCustomize.tsx`):
   - Insert between COLOR and NAME sections
   - 5 buttons with kaomoji + label, gold border on selected
   - Layout from the full 4-section spec in Section 7

6. **Remove `uDevFaceOverride` uniform** — personality is now a real player-facing choice.

**Done criteria:** Player picks "Fierce" -> block shows angry V-eyes -> persists across sessions and reconnects. Customize panel now has 4 sections (Color, Face, Name, Emoji).

### Phase 9: Evolution Progress Bar

**Goal:** Show explicit progress toward next evolution tier.

**Changes to `InspectorStats.tsx` or create new `InspectorEvolution.tsx`:**

```
[current tier icon] EMBER ----[=====>-------]---- FLAME
                               28/30 charges
                               Streak: 5 days (need 7 for Flame)
```

**Implementation:**
- Read `totalCharges`, `bestStreak`, `evolutionTier` from selected block (tower-store)
- Look up current tier and next tier from `EVOLUTION_TIERS` in `@monolith/common/constants`
- Calculate progress: `(totalCharges - currentTier.charges) / (nextTier.charges - currentTier.charges)`
- Show streak requirement if next tier has one and current streak doesn't meet it
- Pulse animation when < 3 charges from next tier
- At Beacon (max): show "Fully Evolved" with golden glow

**Styling:**
- Progress bar: gradient from current tier color to next tier color
- Tier names: `FONT_FAMILY.headingSemibold`, 12px
- Charges text: `FONT_FAMILY.body`, 14px, `COLORS.textSecondary`

**Done criteria:** Inspector shows accurate progress for any block. Tier names match EVOLUTION_TIERS. Streak requirement shown when relevant.

### Phase 10: Random Charge Reactions

**Goal:** Each charge tap has a random face reaction — variable dopamine hit.

**Define 5 reactions:**

| # | Reaction | Face Override | Block Motion |
|---|----------|--------------|-------------|
| 0 | **Joy** | Big smile, sparkle eyes, glint | Standard bounce (existing) |
| 1 | **Surprise** | Wide eyes (1.2x normal), small O mouth | Extra stretch (scaleY 1.18 instead of 1.12) |
| 2 | **Excited** | Squinty happy (0.4 openness), wide smile | Side-to-side wiggle (alternating X offset) |
| 3 | **Grateful** | Gentle smile, soft eyes (0.8), blush forced on | Slow nod (subtle Y bob, longer settle) |
| 4 | **Wake-up** | Eyes snap from 0.1 to 1.0 over 0.3s, delayed smile | Shake-awake (quick X jitter then settle) |

**Implementation:**

1. **New per-instance attribute** `aChargeReaction` (float):
   - -1.0 = no reaction (default)
   - 0.0-4.0 = reaction index during charge flash

2. **TowerGrid.tsx** charge flash handler:
   - On charge flash start: `reactionArr[i] = Math.floor(Math.random() * 5)`
   - On charge flash end: `reactionArr[i] = -1`
   - Block motion: switch on reaction type for different squash-stretch/wiggle patterns

3. **BlockShader.ts** `renderFace()`:
   - Read `vChargeReaction` varying
   - If >= 0.0, override expression parameters (eyeOpen, mouthOffset, blush) based on reaction type
   - Transition: snap to reaction state, hold for 0.6s, ease back to normal over 0.4s

**Done criteria:** Charge same block 5+ times — each charge feels different. Reactions are visually distinct.

### Phase 10a: Evolution Celebration

**Goal:** Dramatic moment when Spark evolves to a new tier.

**Changes:**

1. **LevelUpCelebration.tsx** — repurpose for evolution:
   - Trigger: reads `justEvolved` from tower-store (set in Pass 1 Phase 4)
   - Text: "Your Spark evolved to [TIER NAME]!" (e.g. "Your Spark evolved to FLAME!")
   - Keep existing animation (full-screen overlay + haptic)
   - Clear `justEvolved` after displaying

2. **Camera celebration** — reuse claim celebration infrastructure:
   - On evolution detected: zoom camera to block, hold 3s, return
   - Reuse `useClaimCelebration.ts` pattern (or call it directly if possible)
   - If too complex to reuse claim camera, just do the overlay + float text (skip camera zoom)

3. **Sound:** Play `chargeGreat` sound on evolution

4. **Float text:** "Evolved to [TIER]!" in `COLORS.goldAccent`, 1.5x normal scale

5. **Block style auto-changes:** The block's animated style switches to the new tier's style (from Pass 1 Phase 4). This makes the evolution visually dramatic — the block surface transforms.

6. **Inspector reopens** after celebration (same pattern as claim celebration)

**Done criteria:** Evolution tier-up triggers: overlay text + sound + float text. Block style auto-changes to new tier. Testing: charge 3 times -> Ember celebration fires.

### Phase 11: Onboarding V2

**Goal:** Add Face personality picker to onboarding customize step (now that Phase 8 added personality choice).

**Changes:**
- Onboarding customize step shows the full 4-section panel (Color, Face, Name, Emoji)
- Face picker works same as in inspector customize
- If personality hasn't been set, default to Happy (0) during onboarding

**Done criteria:** New players pick a face personality during onboarding. Choice persists.

### Phase 12: Polish & Test

**Goal:** End-to-end validation, consistency pass.

**Steps:**

1. **Run full test suite:** `cd apps/mobile && npx jest` — all tests pass
2. **TypeScript check:** `timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json` — only baseline errors
3. **Visual consistency scan:** Grep for hardcoded colors in modified files, replace with tokens
4. **End-to-end flow test:** mentally trace: onboarding -> claim -> customize -> charge -> evolution
5. **Cross-check:** Verify all user stories from Section 5 are satisfied
6. **Run testing checklist** from Section 13

**Done criteria:** Tests pass, TypeScript clean (baseline only), all user stories satisfied, testing checklist complete.

---

## 9. Onboarding Alignment

How the existing 9-phase onboarding maps to the new Spark care framing:

| Phase | Current | New Framing | Changes Needed |
|-------|---------|-------------|----------------|
| 1. Cinematic orbit | Tower spins | Same — tower now with warm aesthetic | Automatic from P2 Phase 7 |
| 2. Title | "MONOLITH" text | Same | None |
| 3. Claim | "Find your spot" | "Choose a Spark to wake up" | Copy change (P1 Phase 5) |
| 4. Celebration | Block ignites | Spark face appears and smiles (the birth) | Automatic from P1 Phase 2 (bigger face) |
| 5. Customize | Color + emoji | Color + Name + Emoji (Pass 1) / + Face (Pass 2) | P1 Phase 3 + P2 Phase 8 |
| 6. Charge | "Tap to charge" | "Charge your Spark!" | Copy change (P1 Phase 5) + reaction (P2 Phase 10) |
| 7. Poke | "Poke a block" | "Say hi to a neighbor" | Copy change (P1 Phase 5) |
| 8. Wallet | Connect wallet | Same | None |
| 9. Done | "You're ready" | "Take care of your Spark!" | Copy change (P1 Phase 5) |

**Key onboarding moment:** Phase 4 (celebration) = the face APPEARS for the first time. With bigger faces from P1 Phase 2, this moment is now dramatic. The face starts sleeping/blank on the unclaimed block, then wakes up and smiles on claim.

---

## 10. UI/UX Consistency Rules

All UI changes MUST follow these rules:

### Colors
- Use `COLORS.*` tokens only. Never hardcoded `rgba()` or `#hex`.
- New tokens: `COLORS.goldAccent`, `COLORS.goldAccentLight`, `COLORS.goldAccentDim`
- Golden accent: `#D4AF55`

### Typography
- Section headers: `FONT_FAMILY.bodySemibold`, 13px, `COLORS.textSecondary`
- Values: `FONT_FAMILY.body`, 15px
- Labels: `FONT_FAMILY.bodyMedium`, 12px
- **Valid FONT_FAMILY keys:** `heading`, `headingBlack`, `headingSemibold`, `headingRegular`, `body`, `bodyMedium`, `bodySemibold`, `bodyBold`, `mono`, `monoBold` — NO `headingBold`

### Spacing
- Section gap: 16px
- Item gap in grids: 8px
- Panel padding: 16px horizontal
- `RADIUS` tokens: `sm(8)`, `md(12)`, `lg(16)`, `xl(24)`, `full(9999)` — NO `xs`

### Interactive States
- Selected item: gold border (2px) + subtle gold background tint
- Unselected: `COLORS.glass` background
- Pressed: scale 0.95 spring animation
- Disabled/locked: 50% opacity + lock icon

### Panels
- All bottom panels use `BottomPanel` component
- Swipe-to-dismiss standard
- Glass background (`COLORS.hudGlass`)

---

## 11. What We're Cutting

Explicitly OUT OF SCOPE:

| Feature | Why Cut | Current Status |
|---------|---------|----------------|
| Style picker (11 styles) | Confusing, doesn't serve the core loop | Remove from UI (styles still render if already set) |
| Texture picker (7 textures) | Same | Remove from UI |
| Gacha/loot drops | Post-testing | Doc exists, don't build |
| Gravity Tax | Not needed for testing | Keep in GDD |
| Lighthouse effect | Complex, not built | Keep in GDD |
| Image upload | Too complex for timeline | Future |
| Advanced idle behaviors (yawn, look-around) | Nice-to-have | Post-testing |
| Neighbor eye contact | Complex | Post-testing |
| PvP mechanics (raids, duels) | Post-testing | Keep in vision doc |
| Deep face customization (mix-and-match parts) | Too complex | Maybe post-Pass 2 |

**KEEP but don't change:**
- Tapestry social (leave as-is)
- SOAR on-chain (leave as-is, feature-flagged)
- Poke mechanic (works)
- Push notifications (works)
- Leaderboard (works)
- Sound effects (works)
- Achievements (works)
- Bot simulation (works)
- Camera system (works)
- MyBlocksPanel + MyBlockFAB (works, frames as "your Sparks" collection)
- Charge All button (works, useful for multi-Spark owners)
- Multiple block ownership (works, leaned into as "Spark collection")

---

## 12. File Change Map

### Must Modify

| File | Changes | Pass.Phase |
|------|---------|------------|
| `apps/mobile/components/tower/BlockShader.ts` | Glow reduction, face scale-up | P1.1, P1.2 |
| `apps/mobile/components/inspector/InspectorCustomize.tsx` | Strip to 3 sections (Color, Name, Emoji) | P1.3 |
| `packages/common/src/constants.ts` | New pastel palette, ACTIVE_EVOLUTION_TIERS, testing thresholds | P1.3, P1.4 |
| `apps/mobile/constants/theme.ts` | Add golden accent tokens | P1.3 |
| `apps/mobile/components/ui/FloatingPoints.tsx` | "+1 Charge" instead of "+25 XP" | P1.4 |
| `apps/mobile/components/ui/TopHUD.tsx` | Remove XP pill | P1.4 |
| `apps/mobile/stores/tower-store.ts` | justEvolved flag, auto-assign tier styles | P1.4 |
| `apps/mobile/components/inspector/InspectorActions.tsx` | Update charge result text | P1.4 |
| Onboarding step components | Update copy to "Spark" framing | P1.5 |

### Pass 2 Files

| File | Changes | Pass.Phase |
|------|---------|------------|
| `apps/mobile/components/tower/BlockShader.ts` | Unclaimed restyle, aesthetic softening, personality attribute, charge reactions | P2.6, P2.7, P2.8, P2.10 |
| `apps/mobile/components/tower/TowerGrid.tsx` | New attributes (aPersonality, aChargeReaction, aIsBot), reaction animation variants | P2.6, P2.8, P2.10 |
| `apps/mobile/components/tower/TowerCore.tsx` | Background color warmth | P2.7 |
| `apps/mobile/components/inspector/InspectorCustomize.tsx` | Add Face personality picker (4th section) | P2.8 |
| `apps/mobile/hooks/useBlockActions.ts` | Add personality to customize action | P2.8 |
| `apps/mobile/stores/multiplayer-store.ts` | Handle personality in block sync | P2.8 |
| `apps/mobile/components/inspector/InspectorStats.tsx` | Evolution progress bar | P2.9 |
| `apps/mobile/components/ui/LevelUpCelebration.tsx` | Repurpose for evolution tier-up | P2.10a |
| `apps/server/src/rooms/TowerRoom.ts` | Accept personality in customize, ACTIVE_EVOLUTION_TIERS | P2.8 |

### May Modify (If Time)

| File | Changes | Pass.Phase |
|------|---------|------------|
| `apps/mobile/components/tower/Foundation.tsx` | Warmer marble tones | P2.7 |
| `apps/mobile/components/tower/Particles.tsx` | Warmer particle colors | P2.7 |
| `apps/mobile/components/tower/AuroraWisps.tsx` | Golden tint shift | P2.7 |
| `apps/mobile/components/ui/SparkDevSlider.tsx` | Simplify or remove | P2.8 |
| `apps/mobile/stores/player-store.ts` | Decouple XP display | P1.4 |
| `apps/mobile/components/ui/MyBlocksPanel.tsx` | Show mood instead of energy number | P2.12 |
| `apps/mobile/components/ui/HotBlockTicker.tsx` | Show mood icons | P2.12 |

### Do NOT Modify

| File | Why |
|------|-----|
| `apps/mobile/components/tower/TowerScene.tsx` | Camera system works |
| `apps/mobile/hooks/useClaimCelebration.ts` | Claim celebration works |
| `apps/mobile/utils/tapestry.ts` | Leave Tapestry as-is |
| `apps/mobile/stores/tapestry-store.ts` | Leave as-is |
| `apps/mobile/utils/soar.ts` | Leave SOAR as-is |
| `apps/mobile/services/soar-constants.ts` | Leave as-is |
| `apps/mobile/utils/audio.ts` | Sounds work |
| `apps/mobile/assets/sfx/*` | Audio files fine |

---

## 13. Testing Checklist

### Visual Tests — Pass 1

- [ ] Single block inspect: face fills ~60-70% of block face, expression clear and bold
- [ ] Glow level: blocks glow warmly but faces clearly visible (no wash-out)
- [ ] Customize panel: exactly 3 sections (Color, Name, Emoji) — no style/texture pickers
- [ ] Color picker: pastels in row 1, vibrant in row 2, gold border on selected
- [ ] No XP numbers visible anywhere — just "+1 Charge" float text
- [ ] Inspector layout: CHARGE button is the #1 visual element (large, gold, above fold)
- [ ] Low energy (20-49%): Spark looks worried (slight frown, smaller pupils)
- [ ] Dying energy (1-19%): Spark looks drowsy (nearly closed eyes)

### Visual Tests — Pass 2

- [ ] Tower overview: pastel player blocks visible, faces readable at ~45 unit distance
- [ ] Tower overview: unclaimed blocks are soft glass + golden wire, inviting
- [ ] Tower overview: bot blocks show images, clearly different from player blocks
- [ ] Tower overview: dormant blocks have sleeping face + desaturated color (distinct from unclaimed)
- [ ] Charge tap: random reaction plays (test 5+ charges, see at least 3 different reactions)
- [ ] Charge tap: block bounces with motion variety
- [ ] Evolution progress bar: shows "X/Y to next tier" with tier names
- [ ] Evolution tier-up: celebration triggers (overlay + sound + style change)
- [ ] Face picker: 5 personalities selectable with kaomoji previews, live preview on block
- [ ] Overall aesthetic: warm, inviting, "solarpunk" feel (not dark/cyber)

### Flow Tests — Pass 1

- [ ] Fresh install -> onboarding -> claim -> customize -> charge -> done (< 90 sec)
- [ ] Onboarding claim starts block at ~60% energy (not 100%) — charge step is meaningful
- [ ] Returning: app open -> see block -> charge -> close (< 15 sec)
- [ ] Customize: pick color + emoji + name -> all persist across sessions
- [ ] Onboarding text says "Spark" not "block"
- [ ] FloatingPoints: shows "+1 Charge" not "+25 XP"
- [ ] Inspector for own block: Charge button is primary, Customize secondary

### Flow Tests — Pass 2

- [ ] Personality choice: pick face in customize -> correct face shows on 3D block -> persists
- [ ] Poke: tap other block -> poke -> target block shows surprised reaction
- [ ] Evolution (testing mode): charge 3 times -> Ember evolution triggers with celebration
- [ ] Evolution (testing mode): charge 25 times -> Beacon reached (all tiers visible)
- [ ] Inspector: shows evolution progress bar with correct numbers and tier names
- [ ] FloatingPoints: shows reaction label ("Happy!", "Excited!" etc.)
- [ ] Inspector for unclaimed block: shows "Claim this Spark" with price
- [ ] Inspector for dormant block: shows "Reclaim" CTA

### Performance Tests

- [ ] 60 FPS at overview with 650 blocks
- [ ] No frame drops during charge animation + reaction
- [ ] Face rendering doesn't cause jank at close zoom
- [ ] Memory stable over 5 minutes of interaction
- [ ] Glow reduction should improve perf vs current (fewer additive layers)

### Tester-Facing Checks

- [ ] New user can figure out what to do without any explanation
- [ ] New user refers to block as "my Spark" or "my little guy" (emotional attachment)
- [ ] New user understands they should come back to charge (Spark will get sad)
- [ ] New user can distinguish: their block vs bot blocks vs unclaimed blocks
- [ ] Tower looks beautiful in a screenshot for sharing
- [ ] Solana transaction moment (claim) feels significant (face lights up, Spark comes alive)
- [ ] After 25 charges (testing mode), player has seen meaningful visual progression

---

## 14. Progress

> **Ralph Loop:** Update this section after completing each phase. Mark `[x]` when done, `[~]` if partial with notes.

### Pass 1 — Testable Loop
- [x] **Phase 1:** Glow Reduction — all 12 glow values reduced per spec, faces visible through warm glow
- [x] **Phase 2:** Face Scale-Up — features ~1.5x bigger, bolder SDF strokes, LOD 42→48
- [x] **Phase 3:** Customize Panel Simplify — 3 sections (Color/Name/Emoji), new pastel palette, 16 curated emojis
- [x] **Phase 4:** Progression Clarity — ACTIVE_EVOLUTION_TIERS, "+1 Charge" floats, XP removed from TopHUD, auto-style on tier-up
- [x] **Phase 5:** Onboarding Copy — "Spark" framing throughout, ghost claim starts at 60% energy, tests updated

> **=== PASS 1 GATE ===** Push APK. Get tester feedback. Review visuals.

### Pass 2 — Delight & Polish
- [ ] **Phase 6:** Unclaimed Block Restyle
- [ ] **Phase 7:** Aesthetic Softening
- [ ] **Phase 8:** Face Personality Choice (+ add Face section to customize)
- [x] **Phase 9:** Evolution Progress Bar — gold card above charge button, tier names both sides, streak req, pulse when close, FULLY EVOLVED at max, read-only for other players
- [ ] **Phase 10:** Random Charge Reactions
- [x] **Phase 10a:** Evolution Celebration — LevelUpCelebration watches justEvolved, "YOUR SPARK EVOLVED TO [TIER]" overlay, auto-clear 3.2s, float text label, multiplayer evolution detection
- [ ] **Phase 11:** Onboarding V2 (add Face picker)
- [ ] **Phase 12:** Polish & Test

**Notes:**
<!-- Ralph: Add notes here after each iteration -->

---

## 16. Pass 2 Remaining — Ralph Loop Sprint

> **Date:** 2026-03-05
> **Goal:** Complete remaining Pass 2 phases (6, 7, 8, 10, 11, 12) on a new branch.
> **Branch:** `feat/spark-pass2` (create from `main` at `d7024db`)
> **Predecessor:** All Pass 1 + hotfixes + Phase 9 + Phase 10a are on `main`.

### What's Left

| Phase | Status | Depends On | Effort |
|-------|--------|------------|--------|
| 6 | Partially done (hotfixes added bright glass + wireframe) — needs dormant block desaturation + `aIsBot`/`aHasOwner` attributes | None | Medium |
| 7 | Not started | None | Small |
| 8 | Not started | None | Large (shader + data model + server + UI) |
| 10 | Not started | Phase 7 + 8 | Large (shader + TowerGrid animation) |
| 11 | Not started | Phase 8 | Small |
| 12 | Not started | All above | Small |

### Phase Dependencies (execution order)

```
Phase 6 (Unclaimed finish) ──┐
Phase 7 (Aesthetic)          ├──> Phase 10 (Charge Reactions) ──> Phase 12 (Polish)
Phase 8 (Personality)        ├──> Phase 11 (Onboarding V2)   ──> Phase 12
                             └─────────────────────────────────> Phase 12
```

Phases 6, 7, 8 can run in ANY order (no dependencies between them).
Phase 10 needs Phase 8 (face personality attribute exists in shader).
Phase 11 needs Phase 8 (face picker component exists).
Phase 12 is always last.

**Recommended order:** 8 → 6 → 7 → 10 → 11 → 12
(Phase 8 first because 10 and 11 depend on it.)

### Detailed Gap Analysis Per Phase

#### Phase 6 Gaps (Unclaimed Block Restyle)

What the hotfixes already did:
- Unclaimed blocks are brighter (lavender-grey base)
- Golden wireframe edges exist
- Face not shown on unclaimed (no owner)

What's still missing:
- **`aIsBot` attribute** — shader has no way to distinguish "unclaimed" from "bot-owned". Currently bot detection uses `aImageIndex > 0` but that's indirect. Need a proper float attribute.
- **`aHasOwner` attribute** — to distinguish unclaimed (no owner, no face) from dormant (has owner, sleeping face, desaturated). Currently the shader uses energy-based checks which conflates the two.
- **Dormant desaturation** — dormant blocks should desaturate the owner color (multiply saturation by ~0.4) and apply dark overlay (mix with vec3(0.15) at 30%). Not implemented.
- **Dormant detection in shader** — needs `aHasOwner == 1.0 && energy == 0.0 && NOT bot`. This is only possible with the new attributes.

Files:
- `BlockShader.ts` — add `attribute float aIsBot; attribute float aHasOwner;` to vertex shader, pass as varyings, use in fragment to: (a) skip face on unclaimed, (b) desaturate dormant, (c) skip images on non-bots
- `TowerGrid.tsx` — create `isBotArr` and `hasOwnerArr` Float32Arrays, populate per block, register as InstancedBufferAttribute

#### Phase 7 Gaps (Aesthetic Softening)

The plan specifies exact changes but is vague on shader specifics. Here's what needs to happen:

- `TowerCore.tsx` — canvas background `#0a0812` → `#1a1525`
- `BlockShader.ts`:
  - AO: find the AO term (likely `aoFactor` or `ao`), reduce its darkening contribution by ~20% (e.g., `mix(1.0, aoFactor, 0.6)` → `mix(1.0, aoFactor, 0.45)`)
  - Ambient: increase ambient light floor (the `+ 0.08` or similar constant added to final color) by ~0.03
  - SSS tint: find `sssColor` or subsurface scatter tint, shift hue warmer (add a touch of vec3(0.02, 0.01, 0.0))
- `Particles.tsx` — find color definitions, shift toward warm gold/amber (the exact colors will vary; grep for `new THREE.Color` or hex values)
- `Foundation.tsx` — warm marble tones if time allows (optional, low priority)

**Testing:** Take before/after screenshots. The tower should look noticeably warmer.

#### Phase 8 Gaps (Face Personality Choice)

This is the most complex remaining phase. Full data flow:

1. **DemoBlock type** (`tower-store.ts` line ~86) — add `personality?: number;`
2. **customizeBlock** (`tower-store.ts` line ~427) — add `...(changes.personality !== undefined && { personality: changes.personality })`
3. **ghostCustomizeBlock** (`tower-store.ts` line ~555) — add `...(changes.personality !== undefined && { personality: changes.personality })`
4. **customizeBlock signature** (`tower-store.ts` line ~163) — add `personality?: number` to the changes type
5. **ghostCustomizeBlock signature** (`tower-store.ts` line ~181) — add `personality?: number`
6. **CustomizeMessage type** (`packages/common/src/types.ts` line ~180) — add `personality?: number;`
7. **TowerRoom.ts customize handler** (`apps/server/src/rooms/TowerRoom.ts` line ~471) — add `if (changes.personality !== undefined) block.appearance.personality = changes.personality;`
8. **TowerRoom serializeBlock** — include personality
9. **multiplayer-store.ts block_update handler** — ensure personality syncs from server broadcast
10. **TowerGrid.tsx** — add `aPersonality` InstancedBufferAttribute (float, -1 default for bots/unclaimed, 0-4 for player choice)
11. **BlockShader.ts** — declare `attribute float aPersonality;`, pass as varying `vPersonality`, in `renderFace()`: if `vPersonality >= 0.0` use it, else fall back to hash
12. **Remove `uDevFaceOverride` uniform** — personality is now a real choice. Remove from shader, from TowerGrid uniform assignments, and from SparkDevSlider if it sets this.
13. **InspectorCustomize.tsx** — add FACE section between Color and Name:
    ```
    FACE
    [^_^  Happy] [B-)  Cool] [-_-  Sleepy] [>_<  Fierce] [:P  Derp]
    ```
    5 TouchableOpacity buttons, kaomoji preview + label, gold border on selected. Set via `onPersonalityChange(index)`.
14. **useBlockActions.ts** — add `handlePersonalityChange` callback that calls `customizeBlock` or sends multiplayer customize message with `personality` field
15. **BlockInspector.tsx** — pass `handlePersonalityChange` to InspectorCustomize

**Data persistence:** `personality` is part of the block appearance, persisted via `upsertBlock` in TowerRoom and `persistBlocks` in tower-store. The `blockToRow` / `serializeBlock` functions in TowerRoom need to include it.

**SparkDevSlider.tsx** — currently sets `uDevFaceOverride`. After Phase 8, the dev slider should set personality on the selected block directly OR be simplified/removed. Simplest: remove the eye/mouth variant pickers (those were for the old hash system), keep energy slider + tier picker.

#### Phase 10 Gaps (Random Charge Reactions)

This requires both shader and TowerGrid animation changes:

**New attribute in TowerGrid.tsx:**
- `aChargeReaction` (float per instance, default -1.0)
- On charge flash start: set `reactionArr[blockIndex] = Math.floor(Math.random() * 5)`
- On charge flash end (after animation): set `reactionArr[blockIndex] = -1`
- Need to identify where the charge flash animation is handled — look for `recentlyChargedId` in TowerGrid

**Shader changes in BlockShader.ts:**
- Declare `attribute float aChargeReaction;` → varying `vChargeReaction`
- In `renderFace()`: if `vChargeReaction >= 0.0`, override expression parameters:
  - Reaction 0 (Joy): bigger smile, sparkle eyes (increase eyeOpen to 1.0, add glint)
  - Reaction 1 (Surprise): wide eyes (1.2x scale), small O mouth
  - Reaction 2 (Excited): squinty (eyeOpen 0.4), wide smile
  - Reaction 3 (Grateful): gentle smile, forced blush
  - Reaction 4 (Wake-up): eyes snap open (use uTime-based transition)
- Hold reaction for ~0.8s (use flash timer or uTime delta), ease back to normal

**TowerGrid.tsx animation variants per reaction type:**
Currently charge flash does a squash-and-stretch bounce. Add variants:
- Reaction 0 (Joy): standard bounce (existing)
- Reaction 1 (Surprise): taller stretch (scaleY 1.18)
- Reaction 2 (Excited): side-to-side wiggle (alternating X offset via sin)
- Reaction 3 (Grateful): slow Y bob (longer settle time)
- Reaction 4 (Wake-up): quick X jitter then settle

**FloatingPoints label per reaction:**
In `useBlockActions.ts` handleCharge, pick random reaction label:
```typescript
const REACTION_LABELS = ["Happy!", "Surprised!", "Excited!", "Thanks!", "I'm awake!"];
const reactionLabel = REACTION_LABELS[Math.floor(Math.random() * 5)];
```
Pass as `label` in `addPoints` (alongside or instead of "Daily Charge ✓").

**Sound per reaction:**
Use existing sounds mapped per reaction (no new audio):
```typescript
const REACTION_SOUNDS = [playChargeTap, playPokeReceive, playStreakMilestone, playChargeTap, playBlockClaim];
REACTION_SOUNDS[reactionIndex]();
```

#### Phase 11 Gaps (Onboarding V2 — Face Picker)

After Phase 8 adds personality choice to customize panel, onboarding needs it too:

- `OnboardingFlow.tsx` customize phase (~line 332) — add face personality picker between color and emoji rows
- 5 buttons matching the inspector face picker layout
- `ghostCustomizeBlock` already supports personality after Phase 8 changes
- Default personality to 0 (Happy) when ghost block is claimed

Small phase — mostly copying the face picker UI from InspectorCustomize into OnboardingFlow.

#### Phase 12 Gaps (Polish & Test)

Validation sweep:
1. Run full test suite (mobile + server)
2. TypeScript check
3. Grep for hardcoded colors in ALL modified files → replace with tokens
4. Mental trace of full flow: onboarding → claim → customize (color + face + emoji + name) → charge → see reaction → evolve → celebration
5. Cross-check all 6 user stories from Section 5
6. Run testing checklist from Section 13
7. Update CONTEXT.md with new files/changes
8. Check that SparkDevSlider still works or is cleaned up

### Test Points (Run After EACH Phase)

```bash
# After every phase:
cd apps/mobile && npx jest
cd apps/server && npx jest
timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json
```

Phase-specific manual checks:
- **After Phase 8:** Change personality in customize → block face updates on all 4 sides → survives app restart
- **After Phase 6:** At tower overview: unclaimed = glass, dormant = sleeping face + desaturated color, player = bright face, bot = images
- **After Phase 7:** Tower screenshot comparison — warmer, softer, inviting
- **After Phase 10:** Charge 5+ times → see at least 3 different reaction labels and block motion types
- **After Phase 11:** Full onboarding flow includes face picker → chosen face persists after onboarding
- **After Phase 12:** All Section 13 checklist items satisfied
