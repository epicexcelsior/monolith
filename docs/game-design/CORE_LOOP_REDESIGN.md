# Core Loop Redesign — "Keeper of the Flame" v2

> **Status:** Design spec — ready for implementation
> **Goal:** Make every 10-15 second session feel satisfying, make players WANT to come back multiple times daily, and make charging meaningful.
> **Design Pillars:** Save + Grow + Surprise

---

## The Problem

The current charge mechanic is **defensive, repetitive, and invisible**:

1. **No visible consequence** — Charging changes a number (70→90%) but the block looks almost identical
2. **No meaningful choice** — There's only one button. No decision to make.
3. **No surprise** — Same action, same result, every time
4. **No progression** — Day 1 charge feels identical to Day 30 charge
5. **No urgency** — Decay is slow enough that charging feels optional
6. **No social dimension** — Charging is a completely solo activity
7. **Abstract rewards** — XP and energy % are numbers, not tangible visible rewards

**Result:** Players charge because they "should," not because they WANT to.

---

## The New Core Loop

### The 10-Second Session

```
┌──────────────────────────────────────────────────────────────┐
│              THE 10-SECOND LOOP (Returning Player)           │
│                                                              │
│  1. OPEN     → Camera snaps to YOUR block. You SEE its      │
│                current state instantly (glowing? fading?)     │
│  2. CHARGE   → Tap the big button. Satisfying burst.         │
│                Your block VISIBLY brightens + evolves.        │
│                "+32 energy ⚡ Day 5 streak!"                  │
│  3. SURPRISE → Variable bonus! "🎁 Charge Storm: 2x today!" │
│                OR "Your neighbor just charged — synergy +5!"  │
│  4. GLANCE   → See what changed: neighbor activity, rank     │
│                shift, new block nearby. World is alive.       │
│  5. CLOSE    → Feel good. Block is safe. See you in 4 hours. │
└──────────────────────────────────────────────────────────────┘
```

### Design Principles Applied

| Principle | How We Apply It |
|-----------|----------------|
| **Variable Rewards** (Nir Eyal) | Charge amount varies: +15 to +35 base (weighted random). Same average, more exciting. |
| **Visible Progress** (Idle game core) | Blocks physically evolve over time — brighter, new effects, badges visible to all |
| **Loss Aversion** (Kahneman) | Block state changes are DRAMATIC — a fading block looks visibly sick. You feel it. |
| **Meaningful Choices** (Sid Meier) | Which block to charge first? Where to claim next for synergy? When to use a boost? |
| **Social Proof** (Cialdini) | See neighbor charges in real-time. Activity feeds. "SolWhale just charged nearby!" |
| **Juiciness** (Game Feel) | Every charge = screen shake, particle burst, sound, haptic, color flash, number pop |
| **Escalating Stakes** (Flow theory) | Higher streaks = more to lose. More blocks = more to manage. Tower grows = new territory |
| **Compounding Returns** (Idle games) | Adjacent blocks boost each other. Network effects reward strategic placement. |

---

## New Mechanic: Celebration on Return

When the player opens the app, the first thing they see should make them feel something. Not guilt — curiosity.

### The "What Happened" Moment

Instead of immediately showing the charge button, show a 2-3 second **return summary** as the camera flies to their block:

```
"While you were away..."
  ⚡ 3 neighbors charged   ← Tower is alive without you
  📉 Your block: 78% → 52% ← Mild urgency (not guilt)
  🆕 New block claimed on your floor ← World changes
  🏆 You moved up 4 spots on Skyline ← Progress
```

This transforms the return from "I need to do my chore" to "I want to see what happened."

### Why This Works

From idle game design research: **the return to the game is the most emotionally satisfying moment.** The longer you've been away, the more happened. Players are rewarded with information, not punished with decay.

The key framing (from Egg Inc. design principles): show what they *could have earned*, not what they *lost*. "Your neighbors kept the tower alive while you were away. Charge your block to catch up!"

---

## New Mechanic: Block Evolution

Blocks are no longer static — they **visibly evolve** based on cumulative charges and streak length. This is the "grew something" payoff.

### Evolution Tiers

| Tier | Requirement | Visual Change | Name |
|------|-------------|---------------|------|
| **Spark** | Just claimed | Base glow, solid color | "New block" |
| **Ember** | 10 total charges | Warmer glow, subtle pulse | "Taking root" |
| **Flame** | 30 total charges + 7-day streak | Bright glow, gentle particle trail | "Established" |
| **Blaze** | 75 total charges + 14-day streak | Brilliant glow, persistent particles, slight size increase (1.05x) | "Veteran" |
| **Beacon** | 150 total charges + 30-day streak | Radiant glow, particle aura, size increase (1.1x), visible from far zoom | "Legendary" |

**Key:** Evolution is PERMANENT — it only goes UP. Even if your energy drops, your evolution tier stays. This rewards cumulative investment and means every charge contributes to something lasting.

### Evolution XP (Separate from Player XP)

Each block tracks its own `totalCharges` counter. This is the primary progression metric that drives evolution. It gives every single charge a tangible purpose: **"This charge brought me 1 step closer to Flame tier."**

---

## New Mechanic: Variable Charge Rewards

Replace the flat +20 energy charge with a variable system. Same average, more dopamine.

### Base Charge (Variable)

```
Base charge amount: random weighted between 15-35
  - 15-19: 25% chance (slightly below average)
  - 20-25: 40% chance (normal)
  - 26-30: 25% chance (good roll)
  - 31-35: 10% chance (great roll — "Lucky Charge!")
```

Average: ~23 (close to current 20). But the FEELING is completely different because each charge is a mini-reveal.

### Streak Multiplier (Unchanged)

The streak multiplier still applies on top of the variable base:
- Day 1-2: 1.0x
- Day 3-4: 1.5x
- Day 5-6: 1.75x
- Day 7+: 2.0x
- Day 30+: 3.0x

### Visual Feedback for Variable Amounts

| Roll | Visual | Sound |
|------|--------|-------|
| Below average (15-19) | Normal blue flash | Standard charge SFX |
| Average (20-25) | Blue-white flash | Standard charge SFX |
| Good (26-30) | Gold flash + small particle burst | Brighter charge SFX |
| Great (31-35) | Gold flash + large particle burst + "Lucky!" text | Special SFX + haptic |

---

## New Mechanic: Charge Windows (Multiple Daily Check-ins)

Replace the 30-second cooldown with a **charge window system** that creates natural reasons to check back multiple times daily.

### How It Works

- Each block gets **3 charge windows per day** (roughly every 8 hours)
- Each window gives a full-power charge (with variable amount + streak multiplier)
- Charging during a window resets the block's decay timer for that period
- Windows are staggered slightly per block (based on block ID hash) so different blocks peak at different times
- **All 3 windows don't need to be used** — using even 1 per day maintains your streak

### Window States

| State | Visual | Urgency |
|-------|--------|---------|
| **Window Open** | Pulsing glow on charge button, "CHARGE NOW" | High — this is your moment |
| **Recently Charged** | Calm, block is safe | Low — check back later |
| **Window Missed** | Slightly dimmer, "Missed window" label | Medium — block decayed extra |
| **All Windows Used** | "Fully charged today ✓" badge | None — you're done for the day |

### Why 3 Windows Instead of 1

- **1 charge/day** (Wordle model) = only 1 reason to open the app
- **Unlimited charges** (current) = no urgency, spam-tap feels hollow
- **3 charges/day** = 3 natural check-in moments. Morning, afternoon, evening. Matches natural phone habits.

### Decay Rebalancing

With 3 charge windows per day, decay should be rebalanced:
- **New decay rate:** ~4 energy per hour (instead of 1)
- **Full day without charging:** Block loses ~96 energy (nearly dead)
- **1 charge per day:** Block stabilizes around 40-60% (Fading/Thriving)
- **2 charges per day:** Block stays around 60-80% (Thriving)
- **3 charges per day:** Block stays around 80-100% (Blazing)

This creates a clear tradeoff: **casual players survive, dedicated players THRIVE.**

---

## New Mechanic: Neighbor Synergy

Adjacent blocks that are both charged create a **synergy bonus**. This makes WHERE you claim matter and creates emergent neighborhoods.

### How It Works

When you charge your block, check all 4 adjacent blocks (left, right, above, below):
- For each adjacent block that is **Thriving or Blazing** (energy ≥ 50), add a **+3 synergy bonus** to your charge
- Maximum synergy: +12 (all 4 neighbors healthy)
- The synergy bonus is shown separately: "+25 ⚡ +9 synergy"

### Visual Feedback

When synergy fires, draw brief **golden connection lines** between your block and the contributing neighbors. This makes the network effect VISIBLE.

### Strategic Implications

- Players want to claim blocks **near active players** (creates clusters)
- Players want to keep neighbors healthy (mutual benefit)
- The Lighthouse effect from the vision doc emerges naturally
- New players are drawn to active areas (more synergy = easier maintenance)

---

## New Mechanic: Environmental Events (Charge Storms)

2-3 times per day, a random **Charge Storm** sweeps across part of the tower. This creates surprise + urgency + shared moments.

### Storm Types

| Storm | Effect | Duration | Frequency |
|-------|--------|----------|-----------|
| **Energy Surge** | All charges give 2x energy for the next 5 minutes | 5 min | 2x/day |
| **Synergy Wave** | All synergy bonuses doubled | 5 min | 1x/day |
| **Decay Freeze** | No decay for 30 minutes | 30 min | 1x/day |
| **Golden Hour** | Charges award 3x XP | 10 min | 1x/day |

### Notification

Push notification when a storm is active: "⚡ Energy Surge on the tower! Double charge for 5 minutes!"

This creates the "I should check back" moment — you might miss a storm if you don't open the app.

### Visual

During a storm, the tower has a visible atmospheric effect (lightning, golden glow, aurora). Players online during a storm get to SEE it, creating a shared experience.

---

## Revised Charge Flow (Full Spec)

### When Player Taps CHARGE:

```
1. Check: Is a charge window open?
   → No: Show "Next window in Xh Xm" (greyed button)
   → Yes: Continue

2. Compute base charge:
   → Roll variable amount (15-35, weighted)
   → Apply streak multiplier

3. Compute synergy bonus:
   → Check 4 adjacent blocks
   → +3 per neighbor at ≥50% energy

4. Check for active storm:
   → Apply storm multiplier if active

5. Apply total charge to block:
   → Clamp at MAX_ENERGY (100)
   → Update lastChargeTime
   → Increment block.totalCharges (evolution counter)
   → Check evolution tier threshold

6. Update streak:
   → If first charge today: increment streak
   → If missed yesterday: reset to 1

7. Compute XP:
   → Base XP for charge + streak bonuses + combo
   → Apply storm XP multiplier if active

8. Visual feedback (all simultaneous):
   → Variable amount determines flash intensity
   → Synergy lines to neighbors (if any)
   → Evolution progress indicator (if close to next tier)
   → Floating text: "+27 ⚡ +9 synergy"
   → Haptic burst (intensity matches roll quality)
   → Sound (pitch varies with roll quality)

9. Post-charge state:
   → Block visually brightens
   → "Charged ✓" state on button
   → Next window countdown appears
   → Block evolution bar shows progress
```

---

## Block Inspector Redesign

The inspector panel needs to communicate all the new information clearly.

### For Your Own Block

```
┌─────────────────────────────────────┐
│  🔥 MyBlock          Flame Tier     │  ← Name + Evolution tier badge
│  ━━━━━━━━━━━━━━━━━━━━━━━ 78%       │  ← Energy bar (color = state)
│  🔥 12-day streak · 2.0× XP        │  ← Streak badge
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ⚡ CHARGE  ·  Window Open  │    │  ← Primary CTA (BIG, pulsing)
│  └─────────────────────────────┘    │
│                                     │
│  Evolution: 43/75 charges to Blaze  │  ← Progress toward next tier
│  ████████████████░░░░░░░░  57%      │
│                                     │
│  Neighbors: 3 active (+9 synergy)   │  ← Synergy preview
│                                     │
│  [ Customize ] [ 💬 3 ] [ Share ]   │  ← Action chips
└─────────────────────────────────────┘
```

### For Someone Else's Block

```
┌─────────────────────────────────────┐
│  ✨ SolWhale         Beacon Tier    │  ← Name + Evolution tier (aspirational)
│  ━━━━━━━━━━━━━━━━━━━━━━━ 95%       │  ← Energy bar
│  👑 47-day streak · Monument Keeper │  ← Impressive streak
│                                     │
│  Evolution: Beacon (150+ charges)   │  ← Shows their investment
│  Claimed 52 days ago                │  ← Tenure
│                                     │
│  [ POKE 👉 ] [ ❤ 12 ] [ 💬 5 ]    │  ← Social actions
│  [ + Follow ]                       │
└─────────────────────────────────────┘
```

---

## PvP Vision (Future — Not for March)

> Per user request: document what PvP could look like for the vision docs.

### Concept: "Energy Raids"

Players can raid a rival's block to siphon a small amount of energy. This creates defense-vs-offense dynamics without being pay-to-win.

**Rules:**
- You can raid any block that's NOT adjacent to yours (prevents neighbor griefing)
- A raid costs you 5 energy from YOUR block (risk/reward)
- If successful: you gain +10 energy, they lose -10 energy
- Success chance: based on your evolution tier vs. theirs
  - Spark vs Beacon: 10% success
  - Beacon vs Spark: 90% success
  - Same tier: 50%
- **Cooldown:** 1 raid per block per 24h
- **Shield mechanic:** Recently charged blocks (last 2 hours) are immune to raids
  - This creates another reason to charge on time — defense!

### Why This Isn't Pay-to-Win

- Raids cost energy (you risk your own block)
- Higher evolution tier = better defense, and evolution comes from TIME, not money
- Shield from charging = free defense for active players
- No monetary cost to raid or defend

### Concept: "Charge Duels"

Two players with nearby blocks can initiate a 24-hour duel:
- Both blocks start at current energy
- Whoever has higher energy after 24 hours wins
- Winner gets +20 bonus energy, loser gets -10
- Creates micro-competitions between neighbors

### Concept: "Territory Control"

Groups of adjacent blocks owned by the same player or alliance form a "District":
- Districts have a collective energy score
- Weekly: highest-energy district gets a visual crown effect
- Creates guild-like dynamics without formal guild system

---

## My Blocks Panel Redesign

With charge windows and multiple blocks, the "My Blocks" panel becomes critical.

### Urgency-Sorted List

```
┌─────────────────────────────────────┐
│  📋 My Blocks (3)                   │
│                                     │
│  🔴 Block #247  ·  12% ⚡ WINDOW!  │  ← Urgent: low energy + window open
│     Ember · Floor 7 · +6 synergy    │
│                                     │
│  🟡 Block #103  ·  54% ⚡ 2h left  │  ← Window closing soon
│     Flame · Floor 3 · +9 synergy    │
│                                     │
│  🟢 Block #412  ·  89% ✓ Charged   │  ← All good
│     Blaze · Floor 15 · +12 synergy  │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ⚡ CHARGE ALL (2 ready)    │    │  ← Batch charge available blocks
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Charge All

"Charge All" charges all blocks that have open windows in sequence (with staggered animations). Quick action for the 10-second session.

---

## Implementation Phases

### Phase 1: Core Feel (2-3 days) — SHIP THIS FIRST

Make the existing charge FEEL better without changing game mechanics:

1. **Variable charge amounts** — Random 15-35 instead of flat 20
2. **Roll-quality visual feedback** — Flash intensity + particle count varies with roll
3. **Block evolution tracking** — Add `totalCharges` field, show evolution progress bar
4. **Evolution tier visuals** — Shader changes per tier (glow intensity, particle density)
5. **Better charge button** — Pulsing animation when ready, satisfying press state
6. **Post-charge celebration** — Brief but satisfying (not as big as claim celebration)
7. **Charge amount in floating text** — "+27 ⚡" instead of "+25 XP"

### Phase 2: Charge Windows (1-2 days)

Replace 30-second cooldown with 3-window daily system:

1. **Server-side window computation** — Per-block staggered windows
2. **Window state in inspector** — Open/closed/next window countdown
3. **Decay rate rebalancing** — 4/hr instead of 1/hr
4. **My Blocks urgency sorting** — Window-aware priority
5. **Push notifications for windows** — "Your charge window is open!"

### Phase 3: Neighbor Synergy (1-2 days)

1. **Server-side adjacency check** — Compute synergy bonus on charge
2. **Synergy display in inspector** — "3 active neighbors (+9 synergy)"
3. **Golden connection lines** — Brief visual on charge showing synergy sources
4. **Synergy-aware claiming** — Show synergy potential on unclaimed blocks

### Phase 4: Charge Storms (1 day)

1. **Server-side storm scheduler** — Random events 2-3x/day
2. **Storm notification to online clients** — Real-time broadcast
3. **Storm visual on tower** — Atmospheric effect
4. **Push notification for storms** — Off-screen players alerted

### Phase 5: UI Polish (1-2 days)

1. **Inspector redesign** — Evolution tier, synergy info, window state
2. **My Blocks panel upgrade** — Urgency sorting with windows
3. **Charge All improvements** — Staggered batch with roll reveals
4. **Button feel** — Spring animations, press states, haptic tuning
5. **Smooth transitions** — Every panel open/close/swipe feels buttery

---

## Success Metrics

After these changes, we should see:

| Metric | Before | Target |
|--------|--------|--------|
| Charges per user per day | ~1 | 2-3 |
| Sessions per user per day | ~1 | 2-3 |
| Day 7 retention (testers) | Unknown | 50%+ |
| Average session length | ~30s | 10-15s (faster but more frequent) |
| "This is fun" qualitative feedback | "It's cool" | "I need to check my block" |

---

## Data Model Changes

### Block (new fields)

```typescript
interface Block {
  // ... existing fields ...
  totalCharges: number;       // Cumulative charges (drives evolution)
  evolutionTier: number;      // 0-4 (Spark, Ember, Flame, Blaze, Beacon)
  lastWindowCharge: number[]; // Timestamps of charges in each window today
}
```

### Server Constants (new/changed)

```typescript
// Charge windows
const CHARGE_WINDOWS_PER_DAY = 3;
const WINDOW_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours per window
const DECAY_AMOUNT = 4;  // per hour (up from 1)
const DECAY_INTERVAL_MS = 60_000; // unchanged

// Variable charge
const CHARGE_MIN = 15;
const CHARGE_MAX = 35;
const CHARGE_WEIGHTS = [
  { min: 15, max: 19, weight: 25 },
  { min: 20, max: 25, weight: 40 },
  { min: 26, max: 30, weight: 25 },
  { min: 31, max: 35, weight: 10 },
];

// Synergy
const SYNERGY_BONUS_PER_NEIGHBOR = 3;
const SYNERGY_MIN_ENERGY = 50;

// Evolution thresholds
const EVOLUTION_TIERS = [
  { name: "Spark",  charges: 0,   streakReq: 0  },
  { name: "Ember",  charges: 10,  streakReq: 0  },
  { name: "Flame",  charges: 30,  streakReq: 7  },
  { name: "Blaze",  charges: 75,  streakReq: 14 },
  { name: "Beacon", charges: 150, streakReq: 30 },
];

// Storms
const STORMS_PER_DAY = 3;
const STORM_DURATION_MS = 5 * 60 * 1000; // 5 minutes
```

---

## Design Philosophy: The Tamagotchi Bond

The block is a Tamagotchi. This framing should guide every design decision.

**When uncharged**, the block should visually wilt — dimming, flickering, losing its glow. Not as punishment, but as an emotional signal: your block *needs* you.

**When charged**, the block should pulse with life — bright, warm, emitting particles. You didn't just press a button. You *fed your creature*.

**The tower is the shared pet.** Everyone's blocks together create a living organism. When a section of the tower goes dim, it's not just those players' problem — it affects the whole tower's vibe. This creates organic social pressure without explicit messaging.

### Emotional Framing Guide

| Situation | BAD Framing (Punitive) | GOOD Framing (Nurturing) |
|-----------|------------------------|--------------------------|
| Block decayed | "Your block is dying! Charge NOW!" | "Your block misses you. Give it some energy." |
| Missed a day | "Streak broken! You lost your multiplier!" | "Welcome back! Your block is waiting. Let's get that streak going again." |
| Block dormant | "FAILURE: Block reclaimed" | "Your block found a new keeper. Claim a fresh spot and start again." |
| Neighbor inactive | "WARNING: Neighbor dead" | "Your neighbor's block is fading. Poke them to help!" |

**80% positive, 20% loss-framed.** Research shows this ratio creates sustainable engagement. Loss aversion (streak counter, energy decay) exists but the dominant emotion is nurturing, not anxiety.

---

## Future Consideration: Charge Types (Post-Phase 5)

> Not for initial implementation, but worth exploring after the core loop is proven.

When charging, give the player a simple choice of **how** to charge:

| Type | Effect | Personality |
|------|--------|-------------|
| **Deep Charge** | Full power to YOUR block only | The self-sustainer |
| **Spread Charge** | 60% to you, 20% to each of 2 nearest neighbors | The community builder |
| **Overcharge** | 150% power but decays 2x faster | The show-off (block blazes briefly) |

This creates identity: "I'm a Spreader" or "I Overcharge because I check in often." Different play styles emerge from the same simple mechanic.

**Why defer this:** The core loop needs to feel great with ONE charge type first. Adding choice too early fragments the feedback loop. Nail the single charge, then layer in options.

---

## Research Sources

Key game design principles applied in this document:

1. **Tamagotchi Responsibility Bond** — Emotional attachment through nurturing (Tamagotchi, 1996)
2. **Wordle Scarcity** — Constraining interaction creates craving (NYT Wordle analysis)
3. **Streak Flywheel** — Loss aversion compounds over time (Duolingo 9M+ year-long streaks)
4. **Celebration on Return** — Idle game homecoming (GDC 2015/2016, Anthony Pecorella)
5. **Maximum Juice** — Maximum output from minimum input (GDC "Juice It or Lose It", 2012)
6. **Variable Rewards on Fixed Rituals** — Unpredictability on top of habit (Nir Eyal, B.F. Skinner)
7. **Shared Responsibility** — Social obligation > personal ambition (Snapchat streaks research)
8. **Cosmetic Status as Endgame** — Visible evolution creates aspiration (GameAnalytics data)
9. **Meaningful Choice** — 2-3 options, none obviously dominant (Sid Meier, Alan Moon)
10. **Gentle Diminishing Returns** — First action most rewarding (Clash Royale session design)
11. **Positive > Punitive** — 80/20 ratio for sustainable retention (Bergstrom et al., 2024)
12. **One North Star** — Every feature should drive daily charges (Coin Master design philosophy)

---

## Open Questions

1. **Should evolution tiers unlock new customization options?** (e.g., Beacon tier unlocks exclusive colors/effects) — This would replace the streak-gated system with an evolution-gated one.

2. **Should synergy bonuses be symmetric?** (You boost neighbors AND they boost you) — Or only the charger gets the bonus?

3. **Charge windows: server-computed or client-computed?** Server is more secure but adds latency. Client is faster but manipulable.

4. **Storm notifications: push or in-app only?** Push is more engaging but risks notification fatigue.
