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