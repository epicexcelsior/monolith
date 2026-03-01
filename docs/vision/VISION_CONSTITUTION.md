# THE MONOLITH: Vision Constitution & Project North Star

> **"A living digital monument, built by humans, powered by agents, and immortalized on Solana."**

---

## 1. The Core Identity

**The Monolith** is a massively multiplayer mobile game built for the **Solana Seeker**. It is a massive, collaborative, 3D obelisk tower where every block represents a player's staked capital and digital presence.

* **Genre:** Massively Multiplayer Idle Economy / Spatial Status Game
* **Platform:** Android (Solana Seeker native) + Agent REST API
* **Aesthetic:** Cyber-Industrial, Solarpunk, Glowing Neon — a "Cathedral of Code" that feels ancient yet futuristic
* **Key Emotion:** **Ownership & Status.** Players are the keepers of a living digital tower. Their blocks are their mark on the skyline.
* **The Promise:** *"I stake capital to claim my place on the tower. I keep it Charged to stay bright. I customize it to stand out. I am part of the skyline."*

### What It's NOT
- It's NOT a DeFi dashboard with a 3D skin
- It's NOT a passive investment tool
- It's a **game first** — fun, satisfying, and sticky. The DeFi mechanics are the engine under the hood.

---

## 2. The One-Sentence Pitch

> **r/Place meets DeFi — in 3D.** Stake crypto to claim a glowing block on a massive shared tower. Keep it charged, make it yours, compete for the skyline.

---

## 3. The Tower

### Shape: The Obelisk
A tapered tower that narrows to a point at the top, inspired by the Washington Monument. Monumental, imposing, beautiful.

### Hierarchy
* **The Foundation (bottom 30%):** Accessible, vibrant, populated. Blocks at 1.0x size. Low minimum stake. Everyone starts here.
* **The Mid-Rise (30–60%):** Moderate commitment. Blocks at 1.2x size. Neighborhoods start forming.
* **The High-Rise (60–85%):** High stakes, highly visible. Blocks at 1.5x size. Status territory.
* **The Crown (top 15%):** Elite. Blocks at 2.0x size. Ultra-visible from any camera angle. Only the most committed players survive here.

### The Living World
* The tower **pulses** with the heartbeat of activity (real-time Charge states)
* It **evolves:** Neighborhoods form organically around Lighthouses (high-value blocks)
* It **remembers:** Long-held blocks develop visual patina and badges showing their age
* It **grows:** New floors unlock as total staked capital increases

---

## 4. The Charge System (Core Mechanic)

> **Metaphor:** The tower runs on energy. Your block needs to stay **Charged** to glow. You are a keeper of the flame.

### How It Works
- Every block starts at **100 Charge** when claimed
- Charge **decays** at ~1/hour (configurable)
- Players **restore Charge** by tapping daily (free), staking more USDC, or receiving neighbor boosts
- Blocks at 0 Charge go **Dormant** — after 3+ days, they become claimable by others

### Visual States
| Charge | State | Look |
|---|---|---|
| 80–100 | **Blazing** 🔥 | Brilliant glow + particles |
| 50–79 | **Thriving** ✨ | Steady warm glow |
| 20–49 | **Fading** 💫 | Dim, flickering |
| 1–19 | **Flickering** ⚡ | Dark, sparking weakly |
| 0 | **Dormant** 💤 | Black, cracked texture |

### Why This Works
The daily Charge tap is the "Snapchat streak" of DeFi — a tiny, habitual action that builds loyalty. Breaking a streak only resets your multiplier. You never lose your block from one missed day.

---

## 5. The Two User Types (Symbiosis)

### A. The Player (Human)
* **Role:** The Architect, Keeper, and Competitor
* **Experience:** Tactile, visual, mobile-first
* **Motivation:** Ownership, status, self-expression, friendly competition

### B. The Agent (AI)
* **Role:** The Automated Participant
* **Experience:** API-first (REST endpoints, no 3D rendering needed)
* **Motivation:** Visibility, proof-of-liveness, resource allocation
* **Integration:** Agents discover The Monolith via a published SKILL.md, authenticate via Solana keypair, and interact through the same API the game server uses

---

## 6. Key Mechanics

### A. The Gravity Tax (Anti-Monopoly)
- Owning contiguous blocks increases Charge decay at `block_count ^ 1.5`
- Prevents whales from buying the entire tower
- Encourages diversity in the skyline

### B. The Lighthouse Effect (Neighborhood Value)
- High-stake blocks emit a glow radius that illuminates neighbors
- Small players are drawn to Lighthouses for free visibility
- Creates natural "districts" without any programming

### C. Streaks & Badges
- Consecutive daily Charge taps build a multiplier (up to 3x at Day 30)
- Milestone badges display on your block (visible to all)
- Creates long-term daily engagement

### D. Sharing & Virality
- Every block is a shareable Solana Blink URL
- Auto-generated skyline screenshots for social posting
- Referral bonuses when friends claim blocks near yours

---

## 7. Seeker Hardware Integration

| Feature | Implementation | Priority |
|---|---|---|
| **Seed Vault** | MWA handles transparently — "turning a key" feel | MVP |
| **Action Button (short)** | Sonar Pulse — visual ripple revealing low-Charge blocks | Post-MVP |
| **Action Button (long)** | Block info overlay — Charge, owner, stake amount | Post-MVP |
| **Camera/AR** | Tabletop AR — tower anchored to desk | Post-MVP |

---

## 8. The Ecosystem Future (Post-MVP)

* **Real DeFi Yield:** Route staked USDC through Drift/Kamino for real yield. The Charge system becomes partially self-sustaining.
* **LP Integration:** Users can opt to provide liquidity (Orca, Jupiter) for token pairs including SKR. Higher yield, higher risk, explicit opt-in.
* **SKR Token:** SKR staking for bonus Charge, premium customization, or enhanced Lighthouse effects.
* **Project HQs:** NFT communities rent entire floor sections as "headquarters."
* **AI-Generated Content:** Users type a prompt → AI generates a 3D texture/model for their block.
* **Blinks as Transport:** Every block is a shareable Blink. "Check out my spot on the tower" becomes a viral loop.

---

## 9. PvP Vision (Post-MVP)

> Competitive mechanics that create urgency and rivalry without being pay-to-win. All PvP advantages come from TIME invested (evolution tier, streak), not money staked.

### 9.1 Energy Raids

Players can raid a rival's block to siphon energy. Risk/reward mechanic — you spend energy to attempt it.

**Rules:**
* Target: any block that's NOT adjacent to yours (neighbors are allies, not enemies)
* Cost: 5 energy from YOUR block (risk)
* Reward on success: +10 energy to you, -10 from target
* Success chance: based on evolution tier differential
  * Lower tier attacking higher: 10-30% success
  * Equal tier: 50%
  * Higher attacking lower: 70-90%
* **Cooldown:** 1 raid per target per 24 hours
* **Shield:** Blocks charged in the last 2 hours are immune to raids — creates another reason to stay charged

**Why it's not pay-to-win:** Evolution tier comes from cumulative charges (time), not stake amount. A $1 block with 150 charges (Beacon tier) is better defended than a $100 block with 5 charges (Spark tier). Shield comes from being active, which is free.

### 9.2 Charge Duels

Voluntary 24-hour competitions between nearby players:
* Both blocks start at current energy
* Natural decay + charges determine the winner
* Winner: +20 bonus energy
* Loser: -10 energy
* Creates micro-competitions and "who's more dedicated" moments

### 9.3 Territory Control (Guilds-lite)

Groups of adjacent blocks owned by allies form a **District**:
* Districts have a collective energy score
* Weekly: highest-energy district gets a visual crown effect on the tower
* Creates guild-like coordination without formal guild infrastructure
* Encourages friends to claim blocks near each other

### 9.4 Design Principles for PvP

1. **Time > Money** — Every competitive advantage comes from activity (charges, streaks, evolution), not capital
2. **Opt-in conflict** — Raids have risk, duels are voluntary. Casual players can ignore PvP entirely
3. **Social not toxic** — Poking helps neighbors. Raids have shields. Losses are recoverable (energy, not blocks)
4. **Visible consequences** — Successful raids show a flash on the tower. Duels have a live scoreboard. Territory wins get a visual crown.
5. **Low floor, high ceiling** — A new player can poke and be social immediately. PvP depth emerges over weeks.