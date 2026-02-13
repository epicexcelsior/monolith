# The Monolith — Game Design Document (GDD)

> **Canonical reference for all game mechanics.** Every agent, developer, and contributor starts here.
>
> **Version:** 1.0 — Hackathon MVP | **Deadline:** March 9, 2026 | **Identity:** Game first. Finance is the engine.

---

## 1. Elevator Pitch

**One sentence:** Stake crypto to claim a glowing block on a massive shared 3D tower — keep it charged, make it yours, and compete for the skyline.

**Demo sentence:** *"I stake $1 → my block lights up on the tower → I customize it → I see other people's blocks around mine → I keep it charged to stay visible → I share my spot on X."*

**The feeling:** It's your tiny piece of a living digital city. You built something. It's visible. Other people can see it. And if you stop caring, it fades.

**Genre:** Massively Multiplayer Idle Economy / Spatial Status Game

**Comparable to:** r/Place + Clash of Clans + a DeFi dashboard, in 3D.

---

## 2. The Core Loop (30 Seconds)

> [!IMPORTANT]
> Every session must feel complete in 30 seconds or less. If it takes longer than 30 seconds to feel good, the design has failed.

```
┌──────────────────────────────────────────────┐
│              THE 30-SECOND LOOP              │
│                                              │
│  1. SCAN    → Look at the tower, find your   │
│               block or spot an opportunity    │
│  2. ACT     → Tap to Charge, claim a block,  │
│               or customize                    │
│  3. FEEL    → Watch the glow, haptic burst,   │
│               rank changes, neighbor shifts   │
│  4. DECIDE  → Stay and explore? Check back    │
│               later? Share your block?        │
└──────────────────────────────────────────────┘
```

The loop works for both first-time and returning players:
- **First time:** SCAN (see tower) → ACT (stake + claim) → FEEL (block ignites) → DECIDE (customize or share)
- **Returning:** SCAN (check block status) → ACT (tap to Charge) → FEEL (Charge jumps, streak grows) → DECIDE (explore or exit)

---

## 3. The Charge System

> **Core metaphor:** The tower runs on energy. Your block needs to stay **Charged** to glow. You are a **keeper of the flame.**

"Charge" replaces the old "Entropy" concept. The shift is from negative framing ("fight decay") to positive framing ("power the tower").

### 3.1 Charge Levels

| Charge | Visual State | Name | Behavior |
|---|---|---|---|
| 80–100 | Brilliant glow + particles, hums audibly | **Blazing** 🔥 | Max visibility, Lighthouse effect active |
| 50–79 | Steady warm glow | **Thriving** ✨ | Healthy, visible on tower |
| 20–49 | Dim, occasional flicker | **Fading** 💫 | Still yours, losing visibility |
| 1–19 | Dark, sparking weakly | **Flickering** ⚡ | Danger zone — notifications fire |
| 0 | Black, cracked texture | **Dormant** 💤 | After 3+ days at 0: claimable by others |

### 3.2 Charge Mechanics

```
Charge starts at: 100 (when block is first claimed)
Charge decays at: ~1 per hour (configurable; faster for demo/testing)
```

**Ways to restore Charge:**

| Method | Charge Restored | Cost | Cooldown |
|---|---|---|---|
| **Daily Tap** | +20 (base, before streak multiplier) | Free | 1x per day per block |
| **Stake More USDC** | +1 per $1 USDC added | USDC | None |
| **Neighbor Boost** | +5 | Free (costs the booster nothing) | 1x per neighbor per day |
| **Boost Purchase** | Instant fill to 100 | Small USDC fee | None |

### 3.3 Streak System

Consecutive daily taps on the same block build a streak multiplier on the Daily Tap:

| Streak | Multiplier | Effective Charge |
|---|---|---|
| Day 1–2 | 1.0x | +20 |
| Day 3–4 | 1.5x | +30 |
| Day 5–6 | 1.75x | +35 |
| Day 7+ | 2.0x | +40 |
| Day 30+ | 3.0x | +60 |

> [!NOTE]
> Breaking a streak **only resets the multiplier**. You don't lose your block, your Charge, or your customization. This is critical: fear of losing the streak drives daily returns, but the punishment for breaking it is mild.

### 3.4 Charge Decay Rate (Configurable)

The base decay rate is a server-side config, allowing tuning:

| Context | Decay Rate | Why |
|---|---|---|
| **Production** | 1 Charge/hour | ~4 days from 100→0 without any taps |
| **Demo/Testing** | 1 Charge/minute | Visible decay during a 5-minute demo |
| **Hackathon Showcase** | 1 Charge/30 sec | Dramatic for live presentations |

---

## 4. The Gravity Tax

Owning adjacent blocks increases the Charge decay cost. This prevents whales from monopolizing the tower.

**Formula:**
```
effective_decay_rate = base_rate × (contiguous_block_count ^ 1.5)
```

**Examples:**

| Blocks Owned (Contiguous) | Decay Multiplier | Effective Decay |
|---|---|---|
| 1 | 1.0x | 1/hour |
| 2 | 2.8x | 2.8/hour |
| 3 | 5.2x | 5.2/hour |
| 5 | 11.2x | 11.2/hour |
| 10 | 31.6x | 31.6/hour |

> [!TIP]
> Non-contiguous blocks are independent. A player with 3 blocks scattered across the tower pays 1x on each. This encourages diversity in the skyline.

---

## 5. Tower Shape & Structure

### 5.1 The Shape

The Monolith is an **obelisk** — a tapered tower that narrows to a point at the top, inspired by the Washington Monument. It should feel ancient, monumental, and imposing.

```
        ╱╲            ← The Crown (smallest blocks, most exclusive)
       ╱  ╲
      ╱    ╲          ← Upper Floors (blocks ~1.5x size)
     ╱      ╲
    ╱        ╲        ← Mid Floors (blocks ~1.2x size)
   ╱          ╲
  ╱            ╲      ← Lower Floors (base size blocks)
 ╱              ╲
╱________________╲    ← The Foundation (most accessible)
```

### 5.2 Block Sizing

Blocks **scale up toward the top** of the tower to signify status:

| Floor Zone | Block Scale | Meaning |
|---|---|---|
| Foundation (bottom 30%) | 1.0x | Open to all, most accessible |
| Mid-Rise (30–60%) | 1.2x | Moderate commitment |
| High-Rise (60–85%) | 1.5x | High stakes, visible |
| Crown (top 15%) | 2.0x | Elite, ultra-visible from any camera angle |

> [!NOTE]
> Larger blocks at the top are more expensive to claim (higher minimum stake) AND more expensive to maintain (higher base Charge decay). This makes them naturally exclusive without artificial gatekeeping.

### 5.3 Block Grid

Target: **1,000+ blocks** across all floors.

Rough distribution:
- Foundation: ~400 blocks (40%)
- Mid-Rise: ~300 blocks (30%)
- High-Rise: ~200 blocks (20%)
- Crown: ~100 blocks (10%)

The exact grid layout (hexagonal, rectangular, or organic) is a technical decision. Key constraint: it must look visually stunning from any camera angle and render at 30+ FPS on the Seeker.

---

## 6. Two Modes: Zen & Compete

The game must be friendly to solo players AND exciting for competitive players. Same tower, different mindsets.

### 6.1 Zen Mode (Single Player / Casual)

- Claim a block, customize it, keep it Charged
- Enjoy the meditative experience of watching the tower breathe
- High stake = slow decay = minimal maintenance
- Express yourself: colors, emoji, images, name tags
- **Motivation:** *"This is my place in the tower. It's mine."*

### 6.2 Compete Mode (Leaderboards / Status)

Active leaderboards (visible in-app):

| Leaderboard | Metric |
|---|---|
| **Skyline Rank** | Tower position (higher = better) |
| **Brightest Block** | Highest sustained Charge |
| **Longest Streak** | Consecutive daily taps |
| **Territory King** | Most contiguous blocks (despite Gravity Tax) |
| **Lighthouse** | Highest single-block stake amount |

**Motivation:** *"I want to be seen. I want the crown."*

### 6.3 Coexistence

Neither mode is forced. A casual player sitting at Charge 60 in a quiet corner is perfectly valid. A competitive player managing 5 blocks at Charge 95+ near the crown is also valid. Leaderboards exist but don't gatekeep the fun.

---

## 7. The Lighthouse Effect

The most strategically interesting mechanic. Emphasize this in every pitch.

```
High-stake block ($100+)  →  Large glow radius  →  "Lighthouse"
         ↓
Nearby small blocks ($1-5) get illuminated  →  Increased visibility
         ↓
Small players WANT to be near big players  →  Creates "districts"
         ↓
Big players benefit from active neighbors  →  Social proof
         ↓
Emergent neighborhoods form organically  →  No programming needed
```

**Implementation:**
```
glow_radius = log2(staked_amount_usd) × (charge_pct / 100)
```

| Staked Amount | Charge | Glow Radius (blocks) |
|---|---|---|
| $1 | 100% | 0 (self only) |
| $10 | 100% | 3.3 |
| $100 | 100% | 6.6 |
| $1,000 | 100% | 10 |
| $100 | 50% | 3.3 |

Illuminated neighbors get a **visual brightness boost** (purely cosmetic for MVP, could influence Charge decay positively post-MVP).

---

## 8. Progression & Retention

### 8.1 Session 1 — "The Aha Moment" (~60 seconds)

```
1. See the tower (gorgeous, spinning, alive with light)
2. Guided: "Find your spot" → camera flies to open area
3. Stake $1 USDC → EPIC animation: block ignites, haptic double-pulse
4. Customize: pick color + emoji (10 seconds)
5. See block in context: neighbors, tower overview
6. Prompt: "Share your new block on X" → generates Blink
7. User feels: "I OWN something on this tower."
```

### 8.2 Session 2 — "The Pull-Back" (4–12 hours later)

Triggered by notification (any of):
- 🔥 "Your block dropped to Thriving. Tap to Charge it!"
- 👀 "Someone claimed the block next to yours!"
- 🏆 "You moved up 12 spots on the Skyline!"

```
1. Open app → camera goes directly to YOUR block
2. Tap to Charge → satisfying burst, Charge jumps back up
3. Check what changed: new neighbors, leaderboard shifts
4. Optional: explore, claim another block
5. Total time: ~15 seconds. User feels: "Glad I checked in."
```

### 8.3 Session 3+ — "The Streak" (Daily Ritual)

The streak multiplier is the long-term retention hook. Badges mark milestones:

| Milestone | Badge |
|---|---|
| Day 3 streak | ⚡ Charged Up |
| Day 7 streak | 🏅 Week Warrior |
| Day 14 streak | 🔥 Flame Keeper |
| Day 30 streak | 👑 Monument Keeper |

Badges display on your block, visible to all visitors.

### 8.4 The Tower Grows

As total staked capital increases, the tower literally grows taller:
- New floors unlock → new prime real estate opens
- Creates a **collective goal** — everyone wants the tower to grow
- Creates **FOMO** — new floors = new opportunities
- Organic content drip without developer intervention

---

## 9. Viral Growth & Sharing

### 9.1 Blinks (Solana Actions)

Every block generates a shareable Blink URL:
- `https://monolith.app/block/4291` → 3D preview of the block in context
- One-tap to claim an adjacent block → instant onboarding for the viewer
- Auto-generated X/Twitter preview card (block image + tower context)

### 9.2 Referral Chain

- Share block link → friend claims adjacent block → both get +10 bonus Charge + "Neighbor" badge
- Friend groups naturally cluster → emergent neighborhoods

### 9.3 The Skyline Screenshot

Auto-generated panoramic view of the tower with your block highlighted:
> *"This is my spot on The Monolith. Floor 7, Block 4291. Blazing at 95 Charge. 🔥"*

Designed for social sharing as a status flex.

---

## 10. Economy & Monetization

### 10.1 Token Flow (MVP)

```
User stakes USDC  →  On-chain vault (PDA)  →  Block is claimed
                                              Block visual state reflects stake + Charge
User withdraws    ←  On-chain vault          ← Block goes Dormant (if fully withdrawn)
```

No yield in MVP. The "yield" narrative is part of the pitch for the long-term vision.

### 10.2 Revenue Streams (Post-MVP)

| Stream | How | When |
|---|---|---|
| **Yield Spread** | Small % of DeFi yield (Drift, Kamino, Jupiter, Orca LP) | Post-hackathon |
| **Boost Purchases** | Pay USDC to instant-fill Charge to 100 | MVP-possible |
| **Premium Customization** | AI-generated 3D models, animated textures | Phase 2+ |
| **Name Reservations** | Vanity block names | Phase 2 |

### 10.3 Yield Integration Vision (Post-MVP)

> [!WARNING]
> **Open Design Question:** The long-term plan is to route staked USDC into yield-bearing protocols (Drift, Kamino, Orca, Jupiter LPs). This introduces smart contract risk, impermanent loss risk (for LP positions), and regulatory considerations. These need thorough analysis before implementation.

Possible approaches:
1. **Simple lending** (Drift/Kamino) — Deposit USDC into lending market, earn supply APY. Low risk.
2. **LP provision** (Orca/Jupiter) — Provide liquidity for token pairs (e.g., USDC/SOL, USDC/SKR). Higher yield, introduces impermanent loss risk.
3. **Hybrid** — Base layer in lending, opt-in for LP with clear risk warnings.

SKR integration would come through approach 2 or 3 — users could opt to provide USDC/SKR liquidity for bonus tower rewards.

---

## 11. Player Psychology

### 11.1 Motivation Types

| Player Type | What They Want | How Monolith Serves Them |
|---|---|---|
| **Achiever** | Completion, status | Leaderboards, streak badges, territory count |
| **Explorer** | Discovery | Flying around the tower, finding dying blocks, discovering neighborhoods |
| **Socializer** | Connection | Neighbor boosts, friend clusters, sharing blocks |
| **Competitor** | Dominance | Skyline rank, brightest block, claiming dormant blocks |

### 11.2 Reward Schedules

| Type | Implementation | Psychology |
|---|---|---|
| **Fixed** | Daily Charge tap, streak bonuses | Predictable → builds habit |
| **Variable** | Random "Charge Storm" events (tower-wide bonus) | Unpredictable → creates excitement |
| **Social** | Neighbor boosts, referral bonuses | Reciprocity → builds community |

### 11.3 Loss Aversion (The Retention Hook)

You don't want your block to fade. Not because something terrible happens, but because:
1. You invested time customizing it
2. Your friends can see it
3. Your streak resets
4. Someone else *might* claim your spot (after days of complete neglect)

This is the same psychology as Snapchat streaks or Wordle chains — mild, friendly FOMO.

---

## 12. Hackathon Judging Strategy

| Criterion (25%) | How We Win |
|---|---|
| **Stickiness & PMF** | Charge decay + daily tap ritual + streak system + push notifications. The "Snapchat streak" of DeFi. Articulate the retention loop clearly in the pitch. |
| **UX** | Gorgeous 3D tower, satisfying haptics, one-tap Charge, guided onboarding, < 60 sec to first claim. Polish the FEEL above all. |
| **Innovation / X-Factor** | 3D r/Place + DeFi. Emergent neighborhoods. Lighthouse effect. Agent-ready API. Nobody has done this before. |
| **Presentation & Demo** | Living tower with 100+ blocks (bots), real on-chain staking, real-time visual feedback. 2-minute narrated demo video. |

### Demo Script (2 minutes)

```
0:00 – Tower appears, spinning slowly, particles, ambient hum
0:10 – "This is The Monolith. A living tower powered by Solana."
0:15 – Camera dives into the tower, showing neighborhoods at different Charge levels
0:25 – "Every block is owned by a real person. They stake USDC to claim it."
0:30 – User opens app on Seeker, taps "Find My Spot"
0:35 – Camera flies to available block near a Lighthouse
0:40 – Stakes $1 USDC via MWA → Seed Vault signs
0:45 – BOOM — block ignites, haptic double-pulse, celebration SFX
0:55 – User picks color and emoji
1:05 – Camera pulls back: block glows in context of the tower
1:15 – "The tower is alive. Blocks need Charge to stay bright."
1:20 – Time-lapse: blocks fading and being re-Charged
1:30 – "Tap daily to keep your Charge alive. Build streaks. Climb the Skyline."
1:40 – Leaderboard flash, streak badges
1:50 – "Share your block. Bring your friends. Build your neighborhood."
2:00 – Blink posted to X, tower overview, end card with logo
```

---

## 13. Open Design Questions

> These need answers before or during implementation. They don't block MVP development.

### 13.1 Block Claiming Rules
- **First-come-first-served** for open blocks? Or some auction/pricing mechanism for premium positions?
- **Minimum stake:** Currently $0.10 USDC. Should this vary by floor (higher floors = higher minimum)?
- **Recommendation:** First-come-first-served with floor-based minimums. Foundation: $0.10, Mid: $1, High: $5, Crown: $25. Simple, clear, creates natural scarcity.

### 13.2 Multiple Blocks Per User
- How many blocks can one user own? Unlimited (with Gravity Tax)? Or capped?
- **Recommendation:** Unlimited, but Gravity Tax at 1.5 power makes it increasingly expensive. Natural cap via economics.

### 13.3 Content Moderation
- User-uploaded images on blocks: any filtering needed?
- **Recommendation:** For MVP/hackathon, allow anything. Post-hackathon, add basic image classification or community reporting.

### 13.4 Tower Growth Thresholds
- At what total staked amounts do new floors unlock?
- **Recommendation:** Define 3-5 milestone thresholds that feel achievable with the expected user base. E.g., $100 total = Floor 2, $500 = Floor 3, etc. Tune based on testing.

### 13.5 Sound Design Sourcing
- **Recommendation:** Source SFX progressively during development:
  - **Phase 1 (now):** Use free libraries like [Freesound.org](https://freesound.org), [Pixabay Audio](https://pixabay.com/sound-effects/), or [Mixkit](https://mixkit.co/free-sound-effects/)
  - **Phase 2 (polish):** Generate custom sounds with AI tools like [ElevenLabs SFX](https://elevenlabs.io) or [Soundraw](https://soundraw.io)
  - **Key sounds needed:** Block claim celebration, daily Charge tap, streak milestone, notification ping, ambient tower hum, Lighthouse pulse, camera transitions
  - Wire sounds into the existing haptics system (pair haptic events with audio events)

### 13.6 Camera & Navigation
- The current 3D camera skill (mobile-3d-ux) defines zoom tiers and navigation. How should the "Find My Spot" guided camera work?
- **Recommendation:** Smooth cubic Bézier camera path from overview → zoom into the target block area. Let user tap to interrupt and explore freely.
