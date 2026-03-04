# The Spark System — Living Faces on Blocks

> **Status:** Face overhaul shipped (2026-03-04) | **Next:** Neighbor interactions, advanced idle behaviors
>
> **Core insight:** The charge mechanic mirrors Tamagotchi's attention loop, but without the creature. Sparks add the creature — transforming "maintain a number" into "care for a living thing."

---

## What Is a Spark?

Every block on the tower is a **Spark** — a living geometric entity with a face, expressions, and breathing animation driven by the existing Charge system. The block IS the creature. It's not a pet inside a block or a character standing on a block — the block itself is alive.

**Creative direction:** Cute, graphic, geometric — NOT realistic. Think kaomoji faces on Minecraft blocks. `(◕‿◕)` rendered on geometry. If it looks creepy, simplify.

**Emotional register:** Caretaker/nurturing. Charging your Spark should feel like feeding a creature that depends on you — not fueling a machine.

---

## Game Psychology Principles

1. **The Creature Must React** — Every interaction produces visible feedback on the Spark's face and body. The creature's reaction IS the reward, not the number.

2. **Absence Must Be Felt** — When the player returns after hours away, their Spark looks sad/drowsy. Half-closed eyes communicate "I missed you" without text.

3. **Time > Money** — A $1 Spark with 500 cumulative charges should look dramatically more evolved than a $1000 Spark with 5 charges. Visual progression rewards consistency, not wealth.

4. **The 30-Second Session Is Sacred** — Open → see state → charge → see reaction → feel good → leave. No menus, no loading, no decisions.

5. **Identity Through Difference** — Players spot their Spark among hundreds by color, glow, and position — not by reading labels.

6. **Idle Aliveness** — Breathing, blinking, subtle animation. The tower never feels static.

---

## What's Shipped

### SDF Faces on All Blocks (2026-03-03)
- Kawaii faces rendered via Signed Distance Field functions in the block shader
- Faces on all 4 vertical faces of every non-image block
- Skipped on image blocks (interior-mapped windows take priority)
- Energy spike during charge flash gives free happy-face reaction

### Energy-Driven Expressions
| Charge State | Expression | Details |
|---|---|---|
| **Blazing** (80-100%) | Happy squint + big smile | Eyes half-squinted (0.55), wide smile (+0.07), eye glint |
| **Thriving** (50-79%) | Content + gentle smile | Eyes fully open, gentle smile (+0.02) |
| **Fading** (20-49%) | Worried + slight frown | Smaller pupils (0.7x), slight frown (-0.02) |
| **Dying** (1-19%) | Drowsy + frown | Nearly closed eyes (0.2), frown (-0.04) |
| **Dead** (0%) | Sleeping face | X_X or closed-line eyes, flat mouth, amber glow |

### Adaptive Contrast (2026-03-04)
- **Bright blocks** (blazing/thriving): dark face features for natural contrast
- **Dark blocks** (dying/dead): face features glow warm amber (bioluminescent)
- Faces are readable at ALL energy levels — no more invisible features

### Programmatic Face Variety (2026-03-04)
Each block gets a unique face personality from `hash21(instanceOffset)`:

| Type | Variants | Selection |
|---|---|---|
| **Eyes** | Circle (30%), Oval (20%), Star (15%), Heart (15%), Cat-eye (20%) | Hash-based, deterministic per block |
| **Mouths** | Arc (40%), Cat `:3` (20%), Small O (20%), Wide Grin (20%) | Hash-based, deterministic per block |

Variety unlocks at Tier 1+ (Ember). Tier 0 (Spark) blocks all have the simplest circle-eye + arc-mouth face.

### Evolution Tier Face Progression (2026-03-04)
Each tier adds visible face complexity — a visual journey from simple dot creature to radiant being:

| Tier | Name | Face Features | Scale |
|---|---|---|---|
| 0 | **Spark** | Dot eyes + thin line. No variety. | 0.70x |
| 1 | **Ember** | Face variety unlocked (5 eyes × 4 mouths). | 0.775x |
| 2 | **Flame** | + Blush marks (pink circles on cheeks, energy > 50%). | 0.85x |
| 3 | **Blaze** | + Eyebrow arcs (energy-driven angle). Sparkle in eye glints. | 0.925x |
| 4 | **Beacon** | + Halo ring above head (animated gold glow). | 1.0x |

### Tier-Aware LOD (2026-03-04)
Higher evolution tiers are visible from further away:
- Spark: fade at 38 units
- Beacon: fade at 54 units
- Overview distance (~45 units): Beacon faces faintly visible, Spark faces hidden
- Rewards evolution with visual hierarchy at distance

### Idle Blink Animation
- Per-block random blink period (2.5-5.0 seconds) using `hash21(instanceOffset)`
- Quick 0.12-second close-open cycle
- Each block blinks independently — the tower feels like a living colony

### Charge Bounce (Squash-and-Stretch)
When the player charges their Spark:
1. **0-0.1s:** Squash down (scaleY → 0.85) — absorbing energy
2. **0.1-0.25s:** Stretch up (scaleY → 1.12) — spring upward
3. **0.25-0.5s:** Settle back (scaleY → 1.0) — gentle return
- Volume preservation: X/Z scale = `2.0 - scaleY`
- Bottom-anchored: base stays planted, stretch goes upward

### Breathing Animation
- Energy-tiered breathing aura: blazing (warm gold pulse), thriving (amber), fading (anxious flicker), dying (cold sparks)

### Spark Dev Panel (`__DEV__` only)
Floating panel on tower view for testing all face variations:
- **Energy slider** — drag to set 0-100%
- **Evolution tier pills** — tap Spark/Ember/Flame/Blaze/Beacon
- **Eye variant pills** — tap Circle/Oval/Star/Heart/Cat
- **Mouth variant pills** — tap Arc/Cat :3/O/Grin
- **Shuffle button** — randomize everything
- Only appears when a block is selected

---

## Implementation Details

### Shader Architecture
GLSL functions in `BlockShader.ts` (after `energyGlowColor()`, before `getTexturePattern()`):

- **`faceHash(instanceOff, seed)`** — deterministic personality hash
- **`adaptiveFaceColor(energy)`** — dark features on bright blocks, glowing on dark blocks
- **`sdEyeShape(p, center, radius, openness, shapeType)`** — 5 eye shape variants
- **`sdMouthShape(p, center, width, curvature, shapeType)`** — 4 mouth shape variants
- **`sdBlush/sdEyebrow/sdHalo`** — tier decoration SDFs
- **`renderFace(uv, energy, instanceOff, time, evoTier)`** → `vec4(faceColor, faceMask)` — full face system

Face composited at **Layer 1.75** (between interior mapping and style modifiers). Dead blocks now render sleeping faces. LOD is tier-aware.

One dev-only uniform `uDevFaceOverride` (-1 = hash-based, ≥0 = eyeType×10+mouthType) enables the dev panel.

**Performance:** ~30-38 ALU ops for Tier 0, ~69 ops worst case (Tier 4 Beacon). Interior mapping costs 100+, so faces are not the bottleneck. LOD skip eliminates face rendering for ~80% of blocks at overview distance.

### Charge Bounce Architecture
Extends the charge flash loop in `TowerGrid.tsx`:
- Manipulates instance matrix via `tempObjRef` → `setMatrixAt()`
- Matrix restored to base values on flash completion
- Reuses existing `layoutData`, `tempObjRef`, `getLayerScale`

---

## The Two-Axis Model

Evolution tier and charge state are **independent axes on the same creature:**

| | High Charge | Low Charge |
|---|---|---|
| **High Tier** | Magnificent + alive. Aspirational. | Magnificent + dormant. Dramatic/motivating. |
| **Low Tier** | Simple + alive. Dedicated new player. | Simple + dormant. New or abandoned. |

No "done" state. Even the most evolved Spark still needs daily attention.

---

## What's Next

### Neighbor Interactions (Priority 1)
- Synchronized breathing pulses between neighbors
- Eyes "looking at" nearby active Sparks (eye direction)
- Particle exchange between high-energy blocks

### Advanced Idle Behaviors (Priority 2)
- Pupils that drift (looking around)
- Yawning animation at low energy
- Excited wiggle when owner approaches (camera proximity)
- Z's floating up at 0% energy

### PvP Visual Expression (Priority 3)
- Energy raids → visible pulse traveling between Sparks
- Charge duels → competing glow intensities
- Territory control → constellations of allied Sparks

---

## What We're Testing

1. **Emotional attachment:** Do testers say "my little guy looks sad" instead of "my block is at 40%"?
2. **Return motivation:** Higher next-day return rate than builds without faces?
3. **Tap satisfaction:** Is the charge bounce + expression change satisfying?
4. **Readability at distance:** Can testers read moods when zoomed out?
5. **Face variety:** Do testers notice and appreciate that blocks have different personalities?
6. **Evolution progression:** Is the Spark→Beacon journey motivating?
7. **Creepiness check:** Any "uncanny valley" feedback? → Simplify further if so.
8. **Performance:** Frame drops, overheating, battery drain on Seeker?

---

## Reference

- **Tamagotchi:** Periodic attention mechanic works because it serves a creature, not a number.
- **Slime Rancher:** Dot eyes + smiles on simple geometry = beloved creatures from a small team.
- **Peridot:** Even with full AR + cute creatures, retention fails when the underlying loop feels like a treadmill. Our loop is sound — we're adding the creature it was missing.
- **Companion autonomy research:** Even minimal autonomous behavior (blinking, breathing) dramatically increases perceived aliveness vs. static sprites.
