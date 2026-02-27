# Graveyard Hackathon — Integration Docs

> **Deadline:** March 9, 2026
> **Hackathon:** [Solana Graveyard Hack](https://solana.com/graveyard-hack)

## Doc Index

| Doc | Status | Purpose |
|-----|--------|---------|
| [USER-STORIES.md](./USER-STORIES.md) | DONE | All user stories, acceptance criteria, UI mockups |
| [TAPESTRY-API.md](./TAPESTRY-API.md) | DONE | Verified Tapestry API reference (endpoints, request/response shapes, gotchas) |
| [TAPESTRY-PRD.md](./TAPESTRY-PRD.md) | DONE | Tapestry product requirements |
| [BLINKS-API.md](./BLINKS-API.md) | DONE | Verified Solana Actions/Blinks spec + RPC reference |
| [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) | DONE | Tapestry + Blinks step-by-step build order (agent-executable) |
| [SOAR-INTEGRATION.md](./SOAR-INTEGRATION.md) | READY | MagicBlock SOAR on-chain leaderboard + achievements (agent-executable) |
| [EXCHANGE-ART-SUBMISSION.md](./EXCHANGE-ART-SUBMISSION.md) | READY | Exchange Art creator + BONK track Remotion compositions (agent-executable) |

## Bounties

| Bounty | Prize Pool | Status |
|--------|-----------|--------|
| **Tapestry — On-Chain Social** | $2,500 / $1,500 / $1,000 | Integrated |
| **Solana Blinks** | $750 / $450 | Integrated |
| **MagicBlock — SOAR** | $2,500 / $1,500 / $1,000 | Plan ready, needs implementation |
| **Exchange Art — Creator** | ~$5K split | Plan ready, needs Remotion compositions + mint |
| **Exchange Art — BONK** | ~$5K split | Plan ready, needs Remotion compositions + mint |

## Execution Order

1. ~~Tapestry~~ (done) — on-chain social, plugs into existing app
2. ~~Blinks~~ (done) — shareable poke URLs via memo transactions
3. **SOAR** (next) — on-chain leaderboard via MagicBlock SDK, ~2h, new branch
4. **Exchange Art** (next) — Remotion compositions + mint on exchange.art, ~1h
5. Video + final submission
