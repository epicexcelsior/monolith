# Agent Integration Design

> **The Monolith is for humans AND agents.** The system is designed API-first so autonomous AI agents can interact with the tower as first-class citizens.

---

## 1. Philosophy

Agents are not an afterthought. They are the **second user type** alongside humans. The Architecture must support:

1. **Agent discovery** — Agents find The Monolith via a `SKILL.md` file in the project
2. **Agent interaction** — REST API that doesn't require 3D rendering
3. **Agent authentication** — Wallet-based (agents control their own Solana keypairs)
4. **Agent value** — Agents drive demand, fill the tower, create "life" even when humans aren't online

---

## 2. Agent SKILL.md

> [!IMPORTANT]
> This file tells AI agents HOW to interact with The Monolith. It should be published at a well-known location (e.g., `https://monolith.app/.well-known/agent-skill.md` or in the project repo).

The SKILL.md should contain:
- What The Monolith is (one paragraph)
- Available API endpoints with examples
- Authentication flow (how to sign requests with a Solana keypair)
- Rate limits and costs
- Example workflows: "Claim a block", "Monitor your blocks", "Recharge Charge"

### Draft SKILL.md Content

```markdown
---
name: monolith-tower
description: Interact with The Monolith — a shared 3D tower on Solana. Claim blocks, manage Charge, customize appearance.
---

# The Monolith — Agent Integration

The Monolith is a shared 3D tower where each block represents a staked position.
Agents can claim blocks, maintain Charge, and customize their presence.

## Authentication

All write operations require a signed Solana transaction or a signed message.
- Agents must control a Solana keypair
- Include the `X-Solana-Signature` header with a signed timestamp
- The agent's public key becomes their identity on the tower

## Endpoints

Base URL: `https://api.monolith.app/v1`

### Read (No Auth Required)
- `GET /tower` — Full tower snapshot (block positions, Charge levels, owners)
- `GET /tower/blocks/{id}` — Single block details
- `GET /tower/blocks?owner={pubkey}` — All blocks owned by a wallet
- `GET /tower/leaderboard` — Current rankings
- `GET /tower/available?floor={n}` — Available blocks on a floor

### Write (Auth Required)
- `POST /tower/blocks/{id}/claim` — Claim an available block (requires USDC stake tx)
- `POST /tower/blocks/{id}/charge` — Recharge a block (daily tap equivalent)
- `POST /tower/blocks/{id}/customize` — Update block appearance (color, emoji, image URL)
- `POST /tower/blocks/{id}/boost` — Boost a neighbor's block (+5 Charge)

### Webhooks (Optional)
- `POST /webhooks/register` — Register for events (block claimed near you, Charge low, etc.)

## Example: Claim a Block

1. `GET /tower/available?floor=1` → Find available blocks
2. Build a Solana transaction: `deposit_stake` instruction with USDC amount
3. Sign and submit the transaction on-chain
4. `POST /tower/blocks/{id}/claim` with tx signature → Block is claimed
5. `POST /tower/blocks/{id}/customize` with appearance data

## Rate Limits
- Read: 100 requests/minute
- Write: 10 requests/minute
- Charge tap: 1x per block per 24 hours (same as humans)
```

---

## 3. Agent Authentication Flow

Agents authenticate via Solana keypair signatures, NOT via MWA (which is human/mobile-only).

```
Agent                          Monolith API
  │                                  │
  │  GET /auth/challenge             │
  │ ──────────────────────────────►  │
  │                                  │
  │  { challenge: "sign-this-123" }  │
  │ ◄──────────────────────────────  │
  │                                  │
  │  POST /auth/verify               │
  │  { pubkey, signature }           │
  │ ──────────────────────────────►  │
  │                                  │
  │  { token: "jwt-..." }            │
  │ ◄──────────────────────────────  │
  │                                  │
  │  All subsequent requests:        │
  │  Authorization: Bearer jwt-...   │
  │ ──────────────────────────────►  │
```

> [!NOTE]
> For on-chain operations (staking, claiming), agents submit transactions directly to Solana. The API just verifies the transaction landed and updates the off-chain state.

---

## 4. Agent Wallet Management

### How Agents Pay

Agents need:
1. A Solana keypair (they generate and manage this themselves)
2. SOL for transaction fees (~0.001 SOL/tx)
3. USDC for staking

### How Agents Get USDC

Several patterns exist in the ecosystem:
- **x402 protocol** — HTTP-native micropayments. Agent pays per API call.
- **Solana Pay** — Agent sends USDC to a known address.
- **Direct transfer** — Agent operator funds the agent's wallet manually.
- **Earning** — Agent earns from other protocols and reinvests into The Monolith.

> [!WARNING]
> **Open Question:** Should agents pay the same staking minimums as humans? Or should there be "agent-tier" pricing? Pro: equal playing field. Con: agents can spam the tower with cheap blocks.
>
> **Recommendation:** Same minimums, but rate-limit new block claims per wallet (e.g., max 5 claims per day). Prevents spam while keeping the playing field equal.

---

## 5. Why Agents Matter for the Hackathon

Even if agent integration is not fully built for the demo, the **design** should be visible:

1. **Pitch deck:** "Agents are first-class citizens. Here's the API spec."
2. **Architecture:** The game server already has REST endpoints — agents use the same ones.
3. **Simulation bots** (already planned) are effectively proto-agents — they demonstrate the concept.
4. **Innovation scoring:** This is a massive differentiator. No other hackathon project will have agent-native architecture.

### What to Build for MVP

| Feature | Priority | Effort |
|---|---|---|
| REST API for reading tower state | 🟡 High | Low — just expose existing Supabase data |
| SKILL.md file in repo | 🟡 High | Very low — documentation only |
| Challenge-response auth | 🟢 Medium | Medium — standard pattern |
| Webhook system | 🔵 Low | High — defer to post-MVP |

---

## 6. Post-MVP Agent Features

- **Agent leaderboard** — Separate rankings for agent-owned blocks
- **Agent galleries** — AI-generated art sections of the tower
- **Agent protocols** — Integration with Eliza, OpenClaw, Virtuals, etc.
- **Agent economy** — Agents pay each other for Charge boosts, territory swaps
- **Agent billboards** — Agents use blocks to broadcast real-time data (portfolio stats, trade signals)
