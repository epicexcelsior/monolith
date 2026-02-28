# The Monolith — MVP Roadmap

> **Last updated:** 2026-02-28
> **Solo developer** | Solana Seeker native | Expo 54 + R3F + Anchor

---

## Current State (Feb 14, 2026)

### What ACTUALLY works end-to-end:
- ✅ Wallet connection via MWA (Seed Vault / Phantom)
- ✅ On-chain USDC deposit → Anchor vault (devnet)
- ✅ On-chain USDC withdraw → back to wallet
- ✅ 3D tower rendering (650+ blocks, gesture controls, orbit, zoom)
- ✅ Block claiming with color picker + emoji + name tag
- ✅ Energy decay loop (local, 60s ticks)
- ✅ Streak tracking with multiplier (1x → 3x)
- ✅ Block inspector panel (swipe-dismiss, charge, customize)
- ✅ Solarpunk UI design system (gold/cream aesthetic)
- ✅ Golden procedural skybox (GLSL shader, stars)
- ✅ Profile screen with owned blocks grid

### What's stub/mock:
- ⚠️ Leaderboard tabs exist but show `generateMockLeaderboard()` data
- ⚠️ Activity feed is hardcoded `MOCK_ACTIVITY`
- ⚠️ Blocks are LOCAL ONLY — not shared between devices
- ⚠️ Game server is an empty Express app (Colyseus commented out)
- ⚠️ Supabase client imported but unused
- ⚠️ No push notifications
- ⚠️ No Blink/share integration (native Share API exists but just shares text)

### What's been built since Feb 14:
- ✅ Bot simulation engine (21 personas, 6 archetypes, ~450 seeded blocks, live simulation)
- ✅ Improved onboarding (3-step tutorial, contextual action prompts, tower stats HUD)
- ✅ BlockInspector contextual hints
- ✅ Tower versioning + Reset Tower dev tool

### What's NOT started:
- ❌ Multiplayer state sync (WebSocket / real-time)
- ❌ Lighthouse glow effect
- ❌ Push notifications
- ❌ Poke system (social re-engagement)
- ❌ Guided onboarding camera flight
- ❌ Sound effects wired to interactions
- ❌ Demo video / pitch deck
- ❌ Dormant block reclaim mechanic (blocks at 0 charge for 3+ days become claimable)

---

## Priority Tiers

### 🔴 TIER 1: Ship or Die (Required for any demo)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | 3D Tower — 1000+ blocks, 30+ FPS | ✅ Done | 650 blocks, gesture controls work |
| 2 | On-chain staking — USDC vault | ✅ Done | Anchor program deployed to devnet |
| 3 | MWA wallet connect | ✅ Done | Auth token caching, Seed Vault tested |
| 4 | Charge system — decay + daily tap | ✅ Done (local) | 60s decay ticks, streak multiplier |
| 5 | Block customization — color, emoji, name | ✅ Done (local) | Color picker, emoji selector, name tag |
| 6 | Bot simulation — 450+ seeded blocks | ✅ Done | 21 personas, live simulation, 36 tests |
| 7 | Onboarding + UX hints | ✅ Done | 3-step tutorial, ActionPrompt, TowerStats, inspector hints |
| 8 | Pitch deck | ❌ Not started | |
| 9 | Demo video (2 min narrated) | ❌ Not started | |

### 🟡 TIER 2: Wins Major Points (High-impact polish)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 10 | Lighthouse effect — glow spillover | ❌ | Visual wow factor for demos |
| 11 | Leaderboards — real data from local state | ⚠️ Mock | Wire to actual tower store |
| 12 | Streak badges — visible on blocks | ⚠️ Partial | Tracked locally, badges mostly locked |
| 13 | Haptic feedback — all interactions | ✅ Layer crossing | Wire to claim, charge, customize |
| 14 | Sound effects — claim, charge, ambient | ❌ | Specs exist, not wired |
| 15 | Push notifications — "Your block is Fading!" | ❌ | Expo Push |
| 16 | Blink/X share — shareable block URL | ❌ | Social preview card |
| 17 | Neighbor boost — tap friend's block | ❌ | +5 Charge, social mechanic |

### 🟢 TIER 3: Nice to Have (Impressive if present)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 18 | Real-time multiplayer — WebSocket sync | ❌ | Colyseus room stub exists |
| 19 | Poke system — send energy + notification | ❌ | See §Poke below |
| 20 | Seeker Action Button — Sonar pulse | ❌ | Hardware integration |
| 21 | Agent REST API | ❌ | SKILL.md for AI agents |
| 22 | Gravity Tax | ❌ | Anti-monopoly mechanic |
| 23 | Tower growth — new floors at TVL milestones | ❌ | Collective goal |

### 🔵 TIER 4: Post-MVP

| # | Feature | Notes |
|---|---------|-------|
| 24 | Real DeFi yield routing (Drift/Kamino) | Core value prop for production |
| 25 | SKR token integration | Governance + premium features |
| 26 | AI-generated block textures | Meshy/Tripo3D |
| 27 | AR tabletop mode | Tower on your desk |
| 28 | Content moderation | Community reporting |
| 29 | NFT display on blocks | Show your PFP |

---

## 🤝 Poke System (Planned — Tier 3)

> **Goal:** Get users to come back. Drive social re-engagement without being annoying.

### How it works:
1. **Any player can "poke" another player** from the block inspector
2. The poke sends a **push notification**: *"⚡ [PlayerName] poked you! Free energy waiting."*
3. The poked player receives a **free +10 Charge boost** on their block — but only when they open the app to claim it
4. The poker gets a small **+2 Charge bonus** for being social (giving feels good)
5. **Cooldown:** 1 poke per player-pair per 24 hours (prevents spam)
6. **Visual:** Poked blocks show a brief lightning animation when the recipient opens the app

### Why this works:
- **Zero cost** to the poker — no USDC, just a tap
- **Guaranteed value** for the recipient — free energy + reason to open the app
- **Social proof** — someone cares about your block
- **Reciprocity loop** — "they poked me, I should poke them back"
- **Re-engagement trigger** — the notification is the REASON to come back
- **Streak protection** — a friend can poke you to remind you before your streak breaks

### UX flow:
```
1. View someone's block → "Poke ⚡" button in inspector
2. Tap → haptic buzz + lightning animation on their block
3. Recipient gets push notification
4. Recipient opens app → "+10 Charge from [name]!" toast
5. Both players feel good
```

### Implementation notes (when built):
- Requires: push notification infrastructure (Expo Push)
- Requires: user identity system (wallet → display name mapping)
- Requires: server-side poke tracking (cooldowns, delivery)
- Could be built on Supabase (pokes table + Edge Function for push)
- Consider: "Poke back" quick action in the notification itself

---

## Weekend Demo Sprint (Feb 15-16)

**Goal:** Make the solo experience so satisfying that crypto friends go *"whoa, let me try."*

### What to focus on:

#### Saturday (Feb 15) — Make It Feel Alive
1. **Bot seeding** — Pre-populate 50-100 blocks at varied energy levels
   - Mix of Blazing (10%), Thriving (30%), Fading (40%), Flickering (15%), Dormant (5%)
   - Random colors, emoji, fake names ("whale.sol", "degen_42", "sol_maxi")
   - Scattered across all tower layers
2. **Wire leaderboard to real tower store data** instead of mock
3. **Make the claim moment EPIC** — ensure haptic + animation + color burst all fire together

#### Sunday (Feb 16) — Polish & Practice
4. **Practice the demo flow** — know exactly what to show
5. **Test on-chain staking end-to-end** on devnet with real Phantom/Seed Vault
6. **Prepare talking points** (see PITCH.md)
7. **Screenshot / screen-record the best moments**

### Demo script for friends (casual, 2 min):
```
"Check this out. It's a game I'm building on Solana."
→ Show the tower spinning, point out different energy states
"See these blocks? Each one is owned by someone who staked USDC."
→ Tap on a bright block, show the inspector
"Watch — I'm gonna claim my own spot."
→ Connect wallet, stake $1, BOOM — block ignites
"Now I have to keep it charged. If I stop playing, it fades."
→ Show a fading block vs a blazing one
"You can customize it, build streaks, climb the leaderboard."
→ Quick flash of customization + streak
"The vision: poke your friends to bring them back, compete for
the skyline, and eventually earn real DeFi yield on your stake."
→ Show the tower overview, all the blocks glowing
```

---

## Build Order

| Phase | Focus | Checkpoint |
|-------|-------|------------|
| **Foundation** | Core polish | Tower alive with bots, claim flow feels amazing, charge loop tight |
| **Retention** | Retention hooks | Streaks + real leaderboard + lighthouse + sounds + haptics wired |
| **Social** | Social + multiplayer | Neighbor boost, poke, Blink sharing, bot diversity |
| **Ship** | Final polish | Demo video, pitch deck, final testing, APK build |

---

## The Fun Problem: Why Does This Game Need to Exist?

### The problem we solve:
**DeFi is a spreadsheet.** People stake $10,000 and stare at a number going up 0.003% per day. There's no emotion, no social layer, no reason to come back except greed. And when yields drop, everyone leaves.

### Why people ACTUALLY come back to apps:
1. **Social obligation** — "My friend will notice if I stop" (Snapchat streaks)
2. **Visual progress** — "I can SEE my thing growing" (city builders)
3. **Status & competition** — "I'm ranked higher than you" (any leaderboard)
4. **Self-expression** — "This represents ME" (character customization)
5. **Loss aversion** — "I don't want to lose what I built" (streaks, territories)
6. **Reciprocity** — "They helped me, I should help them" (social games)

### How Monolith delivers ALL of these:
| Human need | Monolith mechanic |
|-----------|-------------------|
| Social obligation | Poke system, neighbor boosts, visible block status |
| Visual progress | Charge glow states, tower growth, badge collection |
| Status & competition | Leaderboards (5 types), tower position hierarchy |
| Self-expression | Color, emoji, name tag — your block IS you |
| Loss aversion | Streaks reset, blocks fade, dormant blocks get claimed |
| Reciprocity | Poke sends free energy — "they helped me, I poke back" |

### The thesis:
> **If DeFi felt like a game you played with friends, people would actually stay.**
> Monolith makes staking feel like owning a piece of a living city.
> The daily tap is your "check-in." The streak is your commitment.
> The poke is your friend saying "hey, don't forget about your spot."

---

## Key Metrics to Track (Post-Launch)

| Metric | Target | Why |
|--------|--------|-----|
| D1 retention | >60% | Come back the next day to charge |
| D7 retention | >30% | Streak habit forming |
| D30 retention | >15% | Monument Keeper territory |
| DAU/MAU | >50% | Daily engagement, not just monthly |
| Avg session length | 30-60 sec | Quick ritual, not a time sink |
| Avg sessions/day | 1-2 | Daily tap + occasional explore |
| Viral coefficient | >0.5 | Each user brings half a friend |
| Organic acquisition | >60% | Word of mouth, not paid ads |
| Poke → return rate | >60% | Poke notification → app open |

---

## CHARGE Token (Post-MVP — Planned)

> Full token design in `docs/INVESTOR_STRATEGY.md` §Part 4

**TL;DR:** CHARGE (CHG) is an engagement reward token earned through gameplay (daily taps, streaks, pokes, events), spent on in-game upgrades (cosmetics, boosts, challenges, naming rights), and **burned on use** (100% deflationary sinks). Fixed supply of 1B. No pre-mine. No VC allocation. Revenue comes from USDC yield spread — NOT token emissions. The game works even if CHG goes to zero.

**Why it's different from STEPN/Axie:**
- USDC is the real asset (external value, no death spiral)
- CHG is earned, not bought — non-extractive
- 100% burn sinks ensure deflation at scale
- Game is free to play (daily charge costs nothing)
- Revenue model is yield spread, not token inflation

---

## Related Docs

| Doc | Purpose |
|-----|---------|
| `docs/PITCH.md` | One-liners, demo script, brand voice, FAQ |
| `docs/WHY_PLAYERS_PLAY.md` | Deep player motivation analysis (dopamine + money + status) |
| `docs/INVESTOR_STRATEGY.md` | VC pitch, psychology playbook, viral engine, token design |
| `docs/BOT_SIMULATION.md` | Bot system configuration and documentation |
| `docs/game-design/GDD.md` | Full Game Design Document |
| `docs/vision/VISION_CONSTITUTION.md` | Project north star |
| `docs/ARCHITECTURE_ROADMAP.md` | Technical architecture evolution |
