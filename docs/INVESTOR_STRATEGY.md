# The Monolith — Investor Strategy & Growth Playbook

> What would make a VC write a check? How do we go viral? How do we design a token that doesn't die?
>
> This doc synthesizes research on behavioral psychology, viral growth mechanics, sustainable tokenomics, and investor psychology into an actionable strategy for The Monolith.
>
> **Last updated:** 2026-02-14

---

## Part 1: The VC Lens — What Makes This Investable?

### What VCs Actually Fund in 2025-2026

The crypto VC landscape has shifted dramatically. Investors are [moving away from hype-driven gaming projects](https://www.theblock.co/post/331586/crypto-vc-funding-outlook-2025) toward those demonstrating **concrete adoption metrics, sustainable economics, and genuine utility**. Galaxy Ventures and Hashed have explicitly reduced allocations to speculative GameFi.

What [they look for](https://andrewchen.com/investor-metrics-deck/) now:

| Metric | Threshold | Why It Matters |
|--------|-----------|----------------|
| **D1 retention** | >60% | Proves the product delivers value on first use |
| **D7 retention** | >30% | Proves habit formation |
| **D30 retention** | >15% | Proves long-term stickiness |
| **DAU/MAU** | >50% | Proves daily engagement (not just monthly check-ins) |
| **Organic acquisition** | >60% | Proves word-of-mouth / viral growth |
| **Viral coefficient (K)** | >0.5 | Each user brings half a user — compounding growth |
| **Revenue sustainability** | Real unit economics | Not dependent on token emissions or new user deposits |

### The 10-Second Investor Pitch

> "The Monolith is Duolingo's streak mechanic applied to DeFi staking. Users deposit USDC into a Solana vault, claim a visible 3D block on a shared tower, and return daily to keep it charged. We've proven the core loop: 30-second sessions, streak-driven retention, and real on-chain staking. Revenue comes from yield spread on staked USDC — not from token inflation. We're building the habit layer for DeFi."

### Why This Is Fundable (The Narrative)

**1. Massive TAM with a clear wedge**
- ~$50B TVL across Solana DeFi protocols, all competing on yield basis points
- Zero protocols compete on *engagement and retention*
- If Monolith captures even 0.1% of Solana DeFi TVL ($50M), that's meaningful
- The wedge: "same yield, 10x the engagement" — we're not asking users to take more risk, we're wrapping their existing behavior in a game

**2. Novel retention mechanics with proven psychology**
- Streak-based daily engagement (proven by [Duolingo: 113M DAU](https://andrewchen.com/more-retention-more-viral-growth/), Snapchat, Wordle)
- Visual loss aversion (block fading is more motivating than yield percentage dropping)
- Social pressure + competition (leaderboards, neighborhoods, poke system)
- These aren't new ideas — they're **proven in Web2, never applied to DeFi**

**3. Real revenue model (not token-dependent)**
- Revenue = yield spread on staked USDC (Drift/Kamino at ~5-8% APY, platform keeps 10-20%)
- At $10M TVL: ~$50K-$160K/year passive revenue
- At $100M TVL: ~$500K-$1.6M/year passive revenue
- Additional revenue from boost purchases, premium customization, token economy
- **This works even if the game token goes to zero** — the business model doesn't depend on token price

**4. Seeker-native (platform play)**
- Built for Solana's consumer hardware push
- MWA + Seed Vault integration = seamless wallet UX
- Solana Mobile is actively seeking killer apps — distribution advantage
- The "Seeker launch title" narrative is powerful for Solana ecosystem investors

**5. Agent-first architecture (AI narrative)**
- AI agents as first-class tower participants (REST API, Solana keypair auth)
- Agents drive demand, fill the tower, create proof-of-liveness
- Unique angle: "What if your AI agent managed your DeFi position as a game?"
- Plays into the hottest VC narrative of 2025-2026

### What Would Make a VC Write a BIG Check

| Signal | How We Demonstrate It |
|--------|----------------------|
| **Product-market fit** | D1 >60%, D7 >30%, users voluntarily sharing on X |
| **Retention moat** | Streak data showing 30-day+ users, flattening retention curves |
| **Growth engine** | Viral coefficient >0.5, organic >60% of new users |
| **Revenue clarity** | TVL growing, yield spread generating real revenue |
| **Team execution** | Shipped a working product solo in <4 weeks |
| **Market timing** | Seeker launch window, post-meme-coin VC sentiment shift toward utility |
| **Token design** | Sustainable model that survived simulated stress-tests (see Part 4) |

---

## Part 2: The Psychology Playbook — Making It Addictive (Ethically)

### The Hooked Model Applied to Monolith

[Nir Eyal's Hook Model](https://www.nirandfar.com/hooked/) describes four steps that create habit-forming products. Here's how Monolith maps to each:

```
┌──────────────────────────────────────────────────────┐
│                  THE HOOK CYCLE                       │
│                                                       │
│  1. TRIGGER ──→ 2. ACTION ──→ 3. REWARD ──→ 4. INVEST│
│       ↑                                          │    │
│       └──────────────────────────────────────────┘    │
│                  (cycle repeats)                       │
└──────────────────────────────────────────────────────┘
```

**1. TRIGGER** — What prompts the user to open the app?

| Type | Current | Upgraded |
|------|---------|----------|
| **External** | Push notification: "Your block is Fading!" | Poke from friend: "⚡ Alex poked you! Free energy waiting." |
| **Internal** | Mild anxiety about streak breaking | FOMO: "Did someone take my spot?" Identity: "This is MY block, I need to check on it" |

The internal trigger is the holy grail. When users **feel** like checking without being prompted, you've won. The key: make the block feel like a pet, a plant, a living thing they're responsible for. Not a financial position — a **digital creature that needs them.**

**2. ACTION** — What's the simplest behavior?

Current: Open app → tap your block → done (30 seconds). This is good. Keep it this simple. Never add friction to the core loop.

**3. VARIABLE REWARD** — The dopamine engine

This is where Monolith needs the most work. Research shows [variable ratio reinforcement](https://pmc.ncbi.nlm.nih.gov/articles/PMC4883455/) produces the most consistent behavior and is the hardest to extinguish. Currently, the daily charge is a flat +20. That's a **fixed ratio** — predictable, less exciting.

**Concrete changes for variable rewards:**

| Mechanic | Implementation | Psychology |
|----------|---------------|------------|
| **Variable charge** | Daily tap gives +15 to +35 (weighted random, avg 22) | Unpredictability → dopamine spike → "What will I get today?" |
| **Charge Storms** | 2-3x daily, 60-second window, all taps give 3x | Scarcity + urgency → "I need to be online for the storm!" |
| **Lucky blocks** | 1% chance your daily tap triggers a "Golden Charge" (+100, full restore) | Lottery psychology → "Maybe today's my lucky day" |
| **Neighbor events** | Random: "A whale just claimed next to you! +5 bonus Charge" | Social variable reward → things happen AROUND you unpredictably |
| **Streak surprise rewards** | At streak milestones, random bonus: "Day 7 bonus: Lucky draw — you got a rare badge!" | Combines fixed progression with variable surprise |

**4. INVESTMENT** — What makes the user put something in that makes them more likely to return?

| Investment Type | How It Works | Why It Creates Lock-in |
|-----------------|-------------|----------------------|
| **Customization** | Spend time choosing color, emoji, name | Sunk cost: "I made this mine" |
| **Streak** | Each day adds to the streak counter | Loss aversion: "I can't break a 14-day streak" |
| **Social connections** | Neighbors, poke history, community | Switching cost: "My friends are here" |
| **Token balance** | Earned CHARGE tokens in wallet | Financial lock-in: "I have tokens I haven't used yet" |
| **Tower position** | Earned through sustained play | Status lock-in: "I worked to get to Floor 12" |

### The Reinforcement Schedule Matrix

Based on [behavioral research](https://pmc.ncbi.nlm.nih.gov/articles/PMC10998180/), the optimal game uses **multiple reinforcement schedules simultaneously**:

| Schedule | Monolith Implementation | Effect |
|----------|------------------------|--------|
| **Fixed interval** | Daily charge cooldown (1x/24h) | Creates routine, habit formation |
| **Variable ratio** | Lucky blocks, variable charge amount | Highest engagement, hardest to extinguish |
| **Fixed ratio** | Streak milestones (Day 3, 7, 14, 30) | Clear progress, goal-setting |
| **Variable interval** | Charge Storms (random 2-3x/day) | Checking behavior, "is a storm happening?" |

### Social Psychology: Why People Share

[Research shows](https://superscale.ai/learn/what-is-viral-marketing-psychology-strategy-guide/) sharing activates the brain's reward system similar to food and money. People share for five reasons:

1. **Identity signaling** — "This says something about who I am"
2. **Social currency** — "This makes me look good/interesting"
3. **Practical value** — "This helps my friends"
4. **Emotion** — "This made me feel something"
5. **Narrative** — "This is a good story"

**How Monolith triggers each:**

| Reason | Mechanic |
|--------|----------|
| **Identity** | "I own Block 427 on The Monolith. 23-day streak. Floor 12." → share screenshot |
| **Social currency** | "I'm #47 on the Skyline" → flex |
| **Practical value** | Poke a friend → "You should play this, I just sent you free energy" |
| **Emotion** | Claiming a block feels EPIC → "You have to see this animation" |
| **Narrative** | "Someone tried to claim my dormant block but I came back just in time" → drama |

---

## Part 3: The Viral Growth Engine

### The Viral Loop

[Andrew Chen](https://andrewchen.com/more-retention-more-viral-growth/) argues that the best way to drive viral growth is to increase retention and engagement first. If a user retains for 30 days, you have 30 opportunities to prompt them to invite a friend.

**Monolith's viral loop:**

```
┌─────────────────────────────────────────────────────────┐
│                  THE VIRAL LOOP                          │
│                                                          │
│  Player claims block                                     │
│       │                                                  │
│       ▼                                                  │
│  Player customizes + gets emotionally invested            │
│       │                                                  │
│       ▼                                                  │
│  Player shares screenshot on X ("My spot on the tower")  │
│       │                                                  │
│       ▼                                                  │
│  Friend sees post → clicks Blink link                    │
│       │                                                  │
│       ▼                                                  │
│  Friend claims block NEXT TO original player             │
│       │                                                  │
│       ▼                                                  │
│  Both get neighbor bonus (+10 Charge)                    │
│       │                                                  │
│       ▼                                                  │
│  Original player pokes friend when they're fading        │
│       │                                                  │
│       ▼                                                  │
│  Friend returns → pokes back → loop continues            │
│       │                                                  │
│       ▼                                                  │
│  Friend shares THEIR block → NEW friend joins            │
│       └───────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### Viral Coefficient Target: K > 0.5

[Research shows](https://viral-loops.com/viral-loops) the median K-factor for apps with measurable virality is 0.45. We need to exceed this.

**How we get there:**

| Mechanic | Estimated K Contribution | Notes |
|----------|------------------------|-------|
| Poke system (friend re-engagement) | +0.15 | Every poke is a re-engagement + potential share |
| Blink sharing (block URL on X) | +0.10 | Low friction share with auto-preview card |
| Neighbor bonus (claim adjacent) | +0.10 | Direct incentive to bring friends to YOUR area |
| Skyline screenshots | +0.05 | Status flex content for social media |
| Referral chain (3-deep) | +0.15 | If friend's friend claims, original gets bonus too |
| **Total estimated K** | **~0.55** | Above median, compounding growth |

### Reducing Friction in the Viral Loop

[Frictionless onboarding is critical](https://wezom.com/blog/how-to-make-a-mobile-app-go-viral-in-2025-proven-growth-strategies) — virality dies when users hit barriers. Every step of the loop must be optimized:

| Step | Current Friction | Optimization |
|------|-----------------|--------------|
| See friend's post | None (X/Twitter) | Auto-generate beautiful social preview card |
| Click Blink link | Opens web view | Deeplink directly to the block's location on the tower |
| Install app | App Store download | Eventually: PWA instant-play (no install needed) |
| Connect wallet | MWA authorization | One-tap Seed Vault (Seeker native advantage) |
| Stake + claim | Deposit flow | Pre-fill $1, one-button claim |
| First reward | Charge bar fills | Instant gratification — block ignites in <3 seconds |
| **Total time to "aha"** | **~60 seconds** | Must stay under 90 seconds |

---

## Part 4: Token Design — The CHARGE Token

### The Problem with Every GameFi Token So Far

[STEPN's collapse](https://defivader.medium.com/why-stepns-collapse-is-inevitable-5259a6584a98) is the canonical cautionary tale. GST had infinite supply, constant sell pressure from users cashing out daily earnings, and the entire economy depended on new user deposits to sustain. When growth slowed, the [death spiral](https://cryptoslate.com/is-move-to-earn-dead-stepns-gst-token-tumbles-98-in-2-months/) took GST down 98% in 2 months.

**The root cause:** the game's revenue model WAS the token. No token demand = no revenue = game dies.

### Monolith's Fundamental Advantage

> **Our revenue model is yield spread on staked USDC — not token emissions.**
> The game works profitably even if the token goes to zero.
> The token ENHANCES the game. It doesn't FUND it.

This is the single most important thing to communicate to investors.

### Token Design: CHARGE (CHG)

**Philosophy:** CHARGE is an engagement reward token, not an investment vehicle. It's earned by playing, spent inside the game, and burned through usage. It should feel like an in-game currency that happens to be on-chain — not a speculative asset.

#### Core Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Name** | CHARGE (CHG) | Maps to core game mechanic — intuitive |
| **Standard** | SPL Token (Solana) | Native to the ecosystem, sub-cent tx fees |
| **Max supply** | 1,000,000,000 (1B) | Fixed cap — deflationary by design |
| **Initial circulating** | 0 | No pre-mine, no VC allocation of CHG itself |
| **Emission method** | Earned through gameplay only | Non-extractive — you can't buy your way in |

#### Faucets (How Tokens Enter Circulation)

| Faucet | CHG Earned | Frequency | Notes |
|--------|-----------|-----------|-------|
| Daily charge tap | 1-3 CHG | 1x/day/block | Variable amount (reinforcement psychology) |
| Streak milestone | 5-50 CHG | Day 3, 7, 14, 30 | One-time bonus per milestone |
| Poke a friend | 0.5 CHG | Per poke (cooldown) | Rewards social behavior |
| Receive a poke | 1 CHG | Per poke received | Rewards being poke-worthy |
| Charge Storm participation | 2-5 CHG | 2-3x/day | Rewards being online during events |
| Challenge winner | Wager amount | Per challenge | PvP redistribution (not emission) |
| Referral bonus | 10 CHG | One-time per referral | Growth incentive |

**Total daily emission per active user:** ~3-8 CHG
**At 10K DAU:** ~30K-80K CHG/day emission
**Time to emit 50% of supply at 10K DAU:** ~17-46 years

This is intentionally slow. Scarcity is a feature.

#### Sinks (How Tokens Leave Circulation)

This is where [most GameFi projects fail](https://blacktokenomics.com/designing-tokenomics-for-crypto-games/). Sinks must be **desirable** — players burn tokens because they WANT to, not because they're forced to.

| Sink | CHG Cost | Burn Rate | Why Players Want This |
|------|---------|-----------|----------------------|
| **Instant Charge Boost** | 10 CHG | 100% burned | Emergency recharge when about to lose streak |
| **Premium color unlocks** | 25 CHG | 100% burned | Exclusive colors not in the free 16 |
| **Animated block effects** | 50 CHG | 100% burned | Particle effects, glow trails — visible flex |
| **Name tag upgrade** | 15 CHG | 100% burned | Custom font, colored name, longer text |
| **Challenge wager** | Variable | 10% burned | Fee on PvP challenges (90% to winner) |
| **Block relocation** | 100 CHG | 100% burned | Move your block to a better tower position |
| **Neighborhood naming** | 500 CHG | 100% burned | Name a cluster of 5+ blocks — permanent |
| **Tower floor sponsorship** | 1000 CHG | 100% burned | Display name on an entire floor — ultimate flex |

**Why 100% burn?** Because it's the only way to guarantee deflation. Any token that enters a treasury or reward pool eventually re-enters circulation. Burning is permanent.

#### The Sink/Faucet Balance

```
Daily emission (10K DAU):     ~50K CHG/day
Daily burn estimate (10K DAU): ~30K-60K CHG/day
  - Charge boosts:        ~10K (20% of users boost 1x)
  - Premium cosmetics:    ~5K  (2% of users buy monthly, amortized daily)
  - Challenge fees:       ~5K  (10% of users challenge daily)
  - Relocations/naming:   ~10K (long-tail high-value sinks)

Net: roughly balanced or slightly deflationary
```

At scale, sinks should outpace faucets because:
1. More engaged users → more cosmetic demand
2. More competition → more challenge wagers
3. More social activity → more poke-driven engagement
4. Fixed cap means scarcity increases → each CHG is more valuable → sinks feel "worth it"

#### What CHG is NOT

| Anti-pattern | Why We Avoid It | What STEPN Did Wrong |
|-------------|-----------------|---------------------|
| Infinite supply | Guarantees inflation → death spiral | GST had unlimited supply |
| Cash-out as primary use | Creates constant sell pressure | Users earned GST just to sell it |
| Required to play | Pay-to-play kills growth | Sneakers cost $$$$ to start |
| Governance voting (for CHG) | Speculation > utility | Attracts traders, not players |
| VC pre-allocation | Dump at unlock → price crater | Most GameFi tokens dump post-cliff |

**CHG is earned by playing, spent by playing, and burned by playing.** If someone wants to buy CHG on a DEX to skip the grind, that's fine — it creates buy pressure that benefits all holders. But the game never requires it.

### The Dual-Token Architecture

| | USDC (Staking Asset) | CHG (Engagement Token) |
|---|---|---|
| **Purpose** | Real money, real yield | In-game currency |
| **Supply** | External (stablecoin) | Fixed cap (1B) |
| **How acquired** | Deposit from wallet | Earned through gameplay |
| **Primary use** | Claim blocks, stake for yield | Cosmetics, boosts, challenges, flex |
| **Revenue for protocol** | Yield spread (10-20% of DeFi yield) | Burn (deflationary, no protocol revenue) |
| **Risk to user** | Smart contract risk only | Could go to zero — game still works |
| **Can withdraw?** | Yes, anytime | Yes, tradeable on DEX |

**The critical insight:** USDC is the business model. CHG is the engagement accelerant. They serve completely different functions. If CHG goes to zero, the game still works and the company still earns revenue. This is what makes us un-killable compared to STEPN.

### Token Launch Strategy

**Phase 1: Earn only (Hackathon → Month 3)**
- No token trading. CHG is earned and displayed as a balance.
- Users accumulate CHG through gameplay.
- This builds a base of holders who earned tokens through effort (not money).
- Creates anticipation: "When can I use/trade my CHG?"

**Phase 2: Sinks activate (Month 3-6)**
- Premium cosmetics, boosts, challenges go live.
- Players can now SPEND CHG inside the game.
- Token has utility before it has a market. This is backwards from most projects (and better).

**Phase 3: DEX listing (Month 6+)**
- List CHG on Raydium/Orca.
- By now, CHG has real utility, proven sinks, and a user base of holders.
- Launch with established demand, not speculation.
- **No pre-mine dump.** Every CHG in circulation was earned.

---

## Part 5: Making It Wildly Viral — The Content Machine

### User-Generated Content (UGC) Loops

The tower IS the content. Every block is a potential social media post.

| Content Type | Trigger | Format | Platform |
|-------------|---------|--------|----------|
| **Claim celebration** | Player claims block | Auto-generated animated card | X, Instagram Stories |
| **Streak milestone** | Day 7, 14, 30 | Badge unlock + tower panorama | X |
| **Rivalry update** | Overtake a competitor | Side-by-side comparison | X |
| **Neighborhood photo** | Player's block + neighbors | "My corner of the tower" screenshot | X, TikTok |
| **Charge Storm recap** | After a Charge Storm event | "I scored +45 in the storm!" | X |
| **Block takeover** | Player claims a dormant block | Dramatic before/after animation | X, TikTok |
| **Tower milestone** | New floor unlocked (TVL) | Tower growth animation | X, community |

### The "One Block" Campaign

Pre-launch marketing concept:

> **"One block. One dollar. Your spot on the skyline."**
>
> A single tweet/video showing:
> 1. Empty spot on a massive glowing tower (2 seconds)
> 2. Someone stakes $1 (2 seconds)
> 3. Block IGNITES — golden burst, particles, haptic (3 seconds)
> 4. Camera pulls back to show the block in context (3 seconds)
> 5. Text: "The Monolith. Stake to glow."
>
> Total: 10 seconds. Optimized for X autoplay.

This is designed for the **"What is THAT?"** reaction. No explanation needed. Pure visual spectacle + curiosity gap.

### Influencer Strategy

Don't pay for shilling. Instead:

1. **Give influencers premium tower positions** — "Hey [name], we reserved Block 1 on the Crown for you. Stake $1 to claim it." The block is visible to EVERYONE. Social proof built in.
2. **Create rivalry narratives** — "Can [Influencer A] maintain a longer streak than [Influencer B]?" Let them compete publicly.
3. **Tower naming rights** — Let the first major influencer name a floor. It's permanent. It's their legacy.

---

## Part 6: The Roadmap Investors Want to See

### Phase 1: Foundation (Now → Hackathon)
- Working 3D tower with real on-chain staking ✅
- Bot simulation for lively demo ✅
- Streak + charge core loop ✅
- Pitch deck + demo video

### Phase 2: Growth (Month 1-3)
- Multiplayer state sync (Supabase real-time)
- Poke system + push notifications
- Blink sharing + social preview cards
- CHG token earning (no spending yet)
- Target: 1K monthly active users

### Phase 3: Economy (Month 3-6)
- CHG sinks activate (cosmetics, boosts, challenges)
- Real DeFi yield (Drift/Kamino integration)
- Head-to-head challenge system
- Charge Storms (variable reward events)
- Target: 10K MAU, $500K TVL

### Phase 4: Scale (Month 6-12)
- CHG token DEX listing
- Multi-platform (any Android wallet, PWA)
- Tower seasons + limited-time events
- Agent economy (AI agents as first-class participants)
- Target: 50K MAU, $5M TVL

### Phase 5: Platform (Year 2+)
- Multiple towers (themed, community-owned)
- DAO governance (using a separate governance token, NOT CHG)
- AR mode (tower on your desk)
- SDK for custom tower experiences
- Target: 500K MAU, $50M TVL

---

## Part 7: Competitive Moat Analysis

### What Competitors Would Need to Beat Us

| Moat | Why It's Hard to Copy |
|------|----------------------|
| **Network effect** | Your friends' blocks are on THIS tower. Moving means losing neighbors. |
| **Sunk cost** | Your 30-day streak, your customization, your tower position |
| **Content/UGC** | Every block is unique user-generated content |
| **Yield integration** | Deep DeFi protocol integrations take months to build + audit |
| **Agent ecosystem** | AI agents accumulate on our tower — they don't migrate easily |
| **Brand/culture** | "The Monolith" becomes a cultural reference, not just an app |

### The Endgame Vision (For VC Decks)

> The Monolith starts as a game. It becomes a financial primitive.
>
> Every DeFi protocol needs depositors. We create the most engaged depositors in crypto. Protocols will PAY to be the yield source behind our tower — because our users are 10x more sticky than any dashboard.
>
> Eventually, "stake on The Monolith" becomes the default way normies interact with DeFi. Not through a dashboard. Not through a DEX. Through a beautiful, social, habit-forming game that happens to make them money.
>
> **We're not building a game. We're building the engagement layer for DeFi.**

---

## Research Sources

- [Andrew Chen: Retention drives viral growth](https://andrewchen.com/more-retention-more-viral-growth/)
- [Andrew Chen: Red flags and magic numbers for investor metrics](https://andrewchen.com/investor-metrics-deck/)
- [Nir Eyal: Hooked — How to Build Habit-Forming Products](https://www.nirandfar.com/hooked/)
- [PMC: Gamification as behavioral psychology](https://pmc.ncbi.nlm.nih.gov/articles/PMC4883455/)
- [PMC: Optimized gamification of behavior change](https://pmc.ncbi.nlm.nih.gov/articles/PMC10998180/)
- [Storyly: Gamification strategies for app engagement](https://www.storyly.io/post/gamification-strategies-to-increase-app-engagement)
- [Pocket App: Psychology of gamification & retention](https://www.pocketapp.co.uk/mobile-games-the-psychology-of-gamification-and-user-retention/)
- [Kumar & Manohar (2025): Dopamine loops & F2P retention](https://jcoma.com/index.php/JCM/article/download/352/192)
- [The Block: Crypto VC funding outlook 2025](https://www.theblock.co/post/331586/crypto-vc-funding-outlook-2025)
- [Viral Loops: What is a viral loop?](https://viral-loops.com/viral-loops)
- [Wezom: How to make apps go viral in 2026](https://wezom.com/blog/how-to-make-a-mobile-app-go-viral-in-2025-proven-growth-strategies)
- [SuperScale: Viral marketing psychology](https://superscale.ai/learn/what-is-viral-marketing-psychology-strategy-guide/)
- [Gate.io: GameFi 2.0 token economics](https://dex.gate.com/crypto-wiki/article/gamefi-2-0-why-token-economics-will-decide-the-future-of-blockchain-gaming-20251231)
- [Black Tokenomics: Designing tokenomics for crypto games](https://blacktokenomics.com/designing-tokenomics-for-crypto-games/)
- [Quecko: Tokenomics design in 2025](https://quecko.com/tokenomics-design-in-2025-building-sustainable-crypto-economies)
- [Vader Research: Why STEPN's collapse was inevitable](https://defivader.medium.com/why-stepns-collapse-is-inevitable-5259a6584a98)
- [CryptoSlate: STEPN GST tumbles 98%](https://cryptoslate.com/is-move-to-earn-dead-stepns-gst-token-tumbles-98-in-2-months/)
- [AMBCrypto: STEPN failure tokenomics assessment](https://ambcrypto.com/is-stepn-gmts-failure-a-result-of-the-tokenomics-strategy-heres-assessing/)
- [OSL: Single vs dual token models in crypto games](https://www.osl.com/hk-en/academy/article/comparing-the-utility-of-single-token-and-dual-token-models-in-crypto-games)
- [TechnoLoader: Tokenomics models — single vs dual tokens](https://www.technoloader.com/blog/tokenomics-models-in-blockchain-gaming-single-vs-dual-tokens/)
- [1kx: Sinks & faucets in virtual game economies](https://medium.com/1kxnetwork/sinks-faucets-lessons-on-designing-effective-virtual-game-economies-c8daf6b88d05)
- [a16z: Basics of growth — engagement & retention](https://a16z.com/podcast/a16z-podcast-the-basics-of-growth-engagement-retention/)
