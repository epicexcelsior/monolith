# The Spark System — Living Faces on Blocks

> **Status:** MVP shipped (2026-03-03) | **Next:** Evolution tier visuals, neighbor interactions
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

## What's Shipped (MVP — 2026-03-03)

### SDF Faces on All Blocks
- Kawaii faces rendered via Signed Distance Field functions in the block shader
- Two dot eyes + curved mouth line on all 4 vertical faces of every non-image block
- LOD fade at 25-35 units — faces disappear at distance (saves GPU, faces are sub-pixel anyway)
- Skipped on image blocks (interior-mapped windows take priority)

### Energy-Driven Expressions
| Charge State | Expression | Details |
|---|---|---|
| **Blazing** (80-100%) | Happy squint + big smile | Eyes half-squinted (0.55 openness), wide smile (+0.07 curvature), eye glint highlight |
| **Thriving** (50-79%) | Content + gentle smile | Eyes fully open, gentle smile (+0.02 curvature) |
| **Fading** (20-49%) | Worried + slight frown | Smaller pupils (0.7x), slight frown (-0.02 curvature) |
| **Dying** (1-19%) | Drowsy + frown | Nearly closed eyes (0.2 openness), frown (-0.04 curvature) |
| **Dead** (0%) | No face | Face skipped entirely — dark dormant block |

### Idle Blink Animation
- Per-block random blink period (2.5-5.0 seconds) using `hash21(instanceOffset)`
- Quick 0.12-second close-open cycle
- Each block blinks independently — the tower feels like a living colony

### Charge Bounce (Squash-and-Stretch)
When the player charges their Spark:
1. **0-0.1s:** Squash down (scaleY → 0.85) — the block compresses like it's absorbing energy
2. **0.1-0.25s:** Stretch up (scaleY → 1.12) — spring upward, the creature wakes up
3. **0.25-0.5s:** Settle back (scaleY → 1.0) — gentle return to rest
- Volume preservation: X/Z scale = `2.0 - scaleY` (block maintains mass)
- Bottom-anchored: block stays planted on its base, stretch goes upward
- Combined with existing charge flash (energy spike to 1.0 → happy expression automatically)

### Breathing Animation (Pre-existing)
- Energy-tiered breathing aura already drives subtle expansion/contraction
- Blazing: warm gold pulse. Thriving: amber. Fading: anxious flicker. Dying: cold sparks.

### All Customization Unlocked
- Streak gates removed: all 16 colors, 48 emojis, 11 styles, 7 textures available at streak 0
- Lets testers experience the full palette on day 1

---

## Implementation Details

### Shader Architecture
Three GLSL functions added to `BlockShader.ts` (after `energyGlowColor()`, before `getTexturePattern()`):

- **`sdEye(p, center, radius, openness)`** — Circle SDF with Y-squish for eyelid closing
- **`sdMouth(p, center, width, curvature)`** — Arc SDF with curvature control
- **`renderFace(uv, energy, instanceOff, time)`** → `vec4(faceColor, faceMask)` — Composes everything

Face composited in fragment main as **Layer 1.75** (between interior mapping and style modifiers):
```glsl
if (vImageIndex < 0.5 && energy > 0.01) {
  float isVertFace = step(abs(vWorldNormal.y), 0.5);
  float faceLOD = smoothstep(35.0, 25.0, vDist);
  if (isVertFace > 0.5 && faceLOD > 0.01) {
    vec4 face = renderFace(vFaceUV, energy, vInstanceOffset, uTime);
    baseColor = mix(baseColor, face.rgb, face.a * faceLOD);
  }
}
```

**Performance:** ~18 ALU ops total (trivial vs interior mapping's 100+). LOD skip at distance. No new uniforms or attributes — uses existing `vFaceUV`, `vInstanceOffset`, `uTime`, `vEnergy`.

### Charge Bounce Architecture
Extends the charge flash loop in `TowerGrid.tsx` (follows the proven poke bounce pattern):
- Manipulates instance matrix via `tempObjRef` → `setMatrixAt()` for first 0.5s of flash
- Matrix restored to base values on flash completion
- No new refs or state — reuses existing `layoutData`, `tempObjRef`, `getLayerScale`

---

## The Two-Axis Model

Evolution tier and charge state are **independent axes on the same creature:**

| | High Charge | Low Charge |
|---|---|---|
| **High Tier** | Magnificent + alive. Aspirational. | Magnificent + dormant. Dramatic/motivating. |
| **Low Tier** | Simple + alive. Dedicated new player. | Simple + dormant. New or abandoned. |

This means there is no "done" state. Even the most evolved Spark still needs daily attention.

---

## What's Next (Post-Tester Feedback)

### Evolution Tier Visuals (Priority 1)
Blocks visually evolve through five tiers based on cumulative charges:

| Tier | Name | Charges | Visual Change |
|---|---|---|---|
| 1 | **Mote** | 0-10 | Raw cube, basic face, faint glow |
| 2 | **Ember** | 11-50 | Softened edges, more expressive face, warmer glow |
| 3 | **Shard** | 51-150 | Crystalline facets, full expression range, ambient particles |
| 4 | **Prism** | 151-500 | Complex crystal, light refraction, glow reaches neighbors |
| 5 | **Monolith** | 500+ | Transcendent form, fragments orbit core, procedurally unique |

Currently these tiers exist as data (GLSL glow/rim/shimmer multipliers) but don't change geometry or face complexity. The visual evolution is the highest-impact post-MVP feature.

### Neighbor Interactions (Priority 2)
Adjacent Sparks subtly interact:
- Synchronized breathing pulses between neighbors
- Turning to "look at" nearby active Sparks (eye direction)
- Brief bump animations on proximity events
- Particle exchange between high-energy blocks

### Advanced Idle Behaviors (Priority 3)
- Pupils that drift (looking around)
- Yawning animation at low energy
- Excited wiggle when owner approaches (camera proximity)
- Sleep animation at 0% (Z's floating up)

### Advanced Customization (Priority 4)
Expanded self-expression options (all procedural):
- Eye shape variants (dot, star, heart, diamond)
- Mouth shape variants (cat mouth `:3`, excited `D`, smirk)
- Glow color independent of base color
- Surface pattern overlays
- Ambient sound/tone per block

### PvP Visual Expression (Priority 5)
Game mechanics expressed through Sparks:
- Energy raids → visible pulse traveling between Sparks
- Charge duels → competing glow intensities
- Territory control → constellations of allied Sparks with matching signatures

---

## What We're Testing

The test build exists to answer:

1. **Emotional attachment:** Do testers say "my little guy looks sad" instead of "my block is at 40%"?
2. **Return motivation:** Higher next-day return rate than builds without faces?
3. **Tap satisfaction:** Is the charge bounce + expression change satisfying?
4. **Readability at distance:** Can testers read moods when zoomed out?
5. **Creepiness check:** Any "uncanny valley" feedback? → Simplify further if so.
6. **Performance:** Frame drops, overheating, battery drain on Seeker?

---

## Reference

- **Tamagotchi:** Periodic attention mechanic works because it serves a creature, not a number.
- **Slime Rancher:** Dot eyes + smiles on simple geometry = beloved creatures from a small team.
- **Peridot:** Even with full AR + cute creatures, retention fails when the underlying loop feels like a treadmill. Our loop is sound — we're adding the creature it was missing.
- **Companion autonomy research:** Even minimal autonomous behavior (blinking, breathing) dramatically increases perceived aliveness vs. static sprites.
