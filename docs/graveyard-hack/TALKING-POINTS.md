# Graveyard Hack — Talking Points & Presenter Notes

> Notes for presenting the deck. Fill in [YOUR WORDS] sections with your own voice.

---

## Slide 1: Title

- Open strong: "This is The Monolith — r/Place meets DeFi in 3D"
- [YOUR HOOK — what's your 10-second elevator pitch when speaking?]

---

## Slide 2: The Problem

- DeFi retention is terrible — people deposit, check once, leave
- The insight: Snapchat streaks, Wordle, Duolingo — people come back for *feelings*, not yields
- [YOUR TAKE — any personal DeFi experience to share? "I built this because..."]

---

## Slide 3: The Solution

- Your block is YOUR spot on a shared tower. It glows when you play, fades when you don't.
- The Tamagotchi angle — your block *needs* you
- "Someone else can take your spot" — that's the competitive hook

---

## Slide 4: How It Works

- Walk through the flow fast: Stake $1 → Claim → Charge daily → Compete
- Mention streaks: "Day 7 = 2x, Day 30 = 3x. Miss 3 days and someone steals your block."
- Show the energy states — blazing to dormant. The tower is alive.

---

## Slide 5: Tapestry (Bounty Track)

**Key selling point:** Social pressure drives retention better than anything else.

- On-chain profiles via Tapestry — your block IS your social identity
- Every action (claim, charge, poke) writes on-chain content
- "When your followers can see your block going dark, you come back."
- [DETAIL — mention any specific Tapestry API calls or integration depth?]

---

## Slide 6: Blinks / OrbitFlare (Bounty Track)

**Key selling point:** Viral distribution without app installs.

- Every block becomes a shareable Blink URL
- Share on Twitter/Discord → rich card preview → one-click poke → push notification
- "Blinks are the viral transport layer. The tower spreads through socials."
- [DEMO NOTE — can you show a live Blink URL during the presentation?]

---

## Slide 7: MagicBlock / SOAR (Bounty Track)

**Key selling point:** Trustless, verifiable competition.

- Every XP score → on-chain leaderboard via SOAR
- 7 on-chain achievements (First Claim, streaks, Empire Builder, Top 10)
- Architecture: Player action → Server validates → SOAR fire-and-forget write → Explorer-verifiable
- "Not a database entry. Verifiable on Solana Explorer."
- Zero gameplay disruption — if the network is slow, the game doesn't care
- [DEMO NOTE — can you pull up a SOAR tx on Explorer during the demo?]

---

## Slide 8: Exchange Art (Bounty Track)

**Key selling point:** This isn't an NFT gimmick — it's collaborative art.

- Frame it as: "The first community-built 3D artwork on Solana"
- 650 blocks, each customized by a different player — like r/Place but persistent and 3D
- Real GLSL shaders (SSS, interior mapping, aurora sky) — same code running in the live game
- BONK Tower: same tower, different soul — proves the tower is a canvas
- Future: NFT snapshots of the tower at season endings
- [YOUR ART ANGLE — what's your personal take on generative/collaborative art? Why Exchange Art?]

---

## Slide 9: Roadmap

- "This is not a plan — it's a working product with 4 bounty integrations."
- Phase 2: Real yield, SKR staking
- Phase 3: Keeper Score (composable on-chain reputation), challenges
- Phase 4: Multi-tower SDK, seasons, NFT snapshots
- Phase 5: Tower-as-a-Service for protocols (Drift Tower, Kamino Tower)
- [YOUR VISION — the "engagement layer for DeFi" pitch. How big can this get?]

---

## Slide 10: Solo Builder

- "Built solo in three weeks"
- Tech stack flex: Anchor/Rust + R3F + Colyseus + MWA + Expo 54
- [YOUR STORY — CS student in Alaska, 3D enthusiast, Solana native. Make it human.]

---

## Slide 11: Closing

- End with conviction: "Your stake has never been this alive."
- 4 bounty tracks, all integrated. Live demo. 320+ tests. 60 FPS on mobile.
- [YOUR CLOSE — what do you want judges to remember?]

---

## General Strategy Notes

### What wins hackathons:
1. **Show, don't tell** — live demo > slides. If you can show a block glowing on a phone, DO IT.
2. **Integration depth** — judges care that you *actually used* their tech, not just checked a box
3. **Solo builder narrative** — this is a massive advantage. "One person, three weeks, four bounties."
4. **Conviction** — speak like you're building this for real (because you are). Not "we could" but "we did"
5. **The r/Place analogy** — instant understanding. Everyone knows r/Place. "But in 3D, and your pixel costs $1."

### Per-bounty judge angles:
- **Tapestry judges**: Emphasize that social pressure IS the retention mechanic. Not a bolt-on.
- **Blinks judges**: Emphasize the viral loop. Share → Preview → Poke → Push → Return.
- **MagicBlock judges**: Emphasize clean architecture. Fire-and-forget. Feature-flagged. Production-ready pattern.
- **Exchange Art judges**: Emphasize this is COLLABORATIVE art — not AI-generated slop. Real players, real shaders, real code.

### Numbers to mention:
- 650 blocks
- 320+ tests (222 mobile + 84 server + 14 Anchor)
- 60 FPS on mobile
- 4 bounty tracks
- 514-line GLSL shader (6 styles, 6 textures, SSS, AO, GGX specular)
- 3 weeks, 1 person
- [ADD — lines of code? commits? any other flex numbers?]

### Questions judges might ask:
- "How do you prevent botting?" → Colyseus validates all actions server-side. SOAR uses authority signing.
- "What happens at scale?" → Tower is instanced mesh (1 draw call). Colyseus rooms scale horizontally.
- "Revenue model?" → Tower-as-a-Service for protocols. See roadmap Phase 5.
- "Why Solana?" → MWA + Seed Vault native. Sub-second finality for real-time game.
- [ADD — any other questions you've gotten?]
