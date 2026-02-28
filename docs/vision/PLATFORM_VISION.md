# Platform Vision — From Game to Engagement Infrastructure

> These are **future directions** to pursue post-MVP. None are required for the initial launch.
> They exist to shape the investor narrative and long-term product strategy.
>
> **Status:** Ideation — not scoped, not committed, not started.

---

## The Thesis

The Monolith starts as a game. It becomes infrastructure.

Every DeFi protocol has the same problem: users deposit, check once, leave. Retention is abysmal. Monolith solves this with proven engagement mechanics (streaks, visual decay, social pressure). The pivot is making those mechanics available to the entire ecosystem — not just our tower.

**One sentence:** We're building the engagement layer for DeFi.

---

## Five Platform Extensions (Post-MVP)

### 1. Keeper Score — On-Chain Engagement Reputation

A composable reputation score stored on-chain (PDA per wallet) that reflects a user's engagement history: streak length, charge consistency, social activity, tenure. Any protocol can read it.

**Why it matters:**
- Protocols can identify engaged users vs. mercenary yield farmers
- Users earn tangible financial benefits from engagement (yield boosts, whitelist access)
- Creates a portable DeFi identity that accrues value over time

**Technical sketch:** PDA `[b"keeper", wallet]` → `{ score: u32, streak: u16, last_active: i64, tenure_days: u16 }`. Read-only via CPI for external programs.

**Investor narrative:** "Composable on-chain reputation for DeFi. Protocols query us to identify their best users."

---

### 2. Tower-as-a-Service — Protocol Towers

Any DeFi protocol deploys their own branded tower using our SDK. Drift Tower, Kamino Tower, Jupiter Tower. Each protocol's depositors see their positions as blocks. All towers share the CHG token economy and Keeper Score.

**Why it matters:**
- Transforms revenue model from "one game" to "B2B platform"
- Protocols get instant retention improvement without building game infrastructure
- Each new tower is a new distribution channel for CHG

**Technical sketch:** Tower config JSON + open-source renderer SDK (React component). Protocol provides a webhook for position data. Monolith handles game logic, rendering, and token rewards.

**Investor narrative:** "Every DeFi protocol wants better retention. We sell them the engagement layer. Shopify model."

---

### 3. Dynamic Block NFTs — Composable DeFi Identity

Each player's block is a compressed NFT on Solana that evolves visually based on engagement. Metadata auto-updates: streak, energy, rank, customization. Other apps can read it to verify engagement.

**Why it matters:**
- Portable proof of engagement (DeFi resume)
- Other protocols offer perks to NFT holders (trustless engagement verification)
- Users share/flex their block as a social identity

**Technical sketch:** Metaplex Bubblegum cNFT (sub-cent mint). Dynamic metadata URI → API returning current block state. On-chain merkle proof for verification.

**Investor narrative:** "Your DeFi identity as a living NFT. Protocols use it for targeting. Users use it as a flex."

---

### 4. Engagement Hooks — Programmable Token via Transfer Hooks

CHG minted as Token-2022 with transfer hook extension. Every token transfer triggers custom logic: auto-update Keeper Score, enforce burn-on-spend, enable cross-protocol reward distribution.

**Why it matters:**
- Technical moat (transfer hooks are cutting-edge, few projects use them)
- Every CHG interaction is an on-chain engagement proof
- External protocols can trigger CHG rewards via the hook without custom integration

**Technical sketch:** CHG mint with `TransferHook` extension → hook program updates Keeper Score PDA on every transfer. `ExtraAccountMetaList` stores PDA lookups.

**Investor narrative:** "The token itself is programmable infrastructure. Every transfer is an engagement event."

---

### 5. UGC Accelerator — User-Created Towers & Templates

Users and communities create their own micro-towers (squad towers, DAO towers, event towers). Artists create block templates sold for CHG. Each user creation is a new viral surface.

**Why it matters:**
- UGC scales content without engineering effort (Roblox/Minecraft model)
- Every community tower is a new onboarding funnel
- Template marketplace creates CHG demand (artist economy)

**Technical sketch:** Tower config as JSON (blocks, shape, theme, access rules). Block templates as metadata + shader params on Arweave. CHG marketplace for trading.

**Investor narrative:** "Users create content. Content attracts users. Exponential growth without proportional engineering."

---

## How They Stack

```
UGC Accelerator (user/community-created towers)
    ↕
Engagement Hooks (programmable CHG via transfer hooks)
    ↕
Dynamic Block NFTs (composable DeFi identity)
    ↕
Tower-as-a-Service (protocol-specific towers)
    ↕
Keeper Score (universal on-chain engagement reputation)
```

Each layer reinforces the others. Keeper Score is the foundation — everything contributes to it, everything reads from it.

---

## Timeline (Rough)

| Phase | Focus | Platform Extension |
|-------|-------|-------------------|
| Now → Month 1 | Ship MVP game | — |
| Month 2-3 | Growth + CHG token | Keeper Score (v1) |
| Month 4-6 | Protocol partnerships | Tower-as-a-Service pilot |
| Month 6-9 | Economy maturity | Block NFTs + Transfer Hooks |
| Month 9-12 | Scale | UGC platform |

---

## What to Say in Pitches

> "We're live as a game today. But the architecture is designed to become the engagement layer for all of DeFi. Any protocol can deploy a tower, any wallet earns a composable reputation score, and the token is programmable infrastructure via Solana's transfer hooks. We're not building one product — we're building the primitive that makes DeFi sticky."

This frames current execution (the game) as the wedge, and the platform vision as the investment thesis. VCs invest in infrastructure, not games.
