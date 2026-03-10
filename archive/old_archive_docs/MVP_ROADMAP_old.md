# MVP Roadmap — The Monolith

> **Goal:** A working, demo-able, submit-ready Android APK by March 9, 2026.
>
> **Constraint:** Solo developer. ~25 days. Must be impressive to judges.

---

## Priority Tiers

### 🔴 Must Have (Ship or Die)

These are non-negotiable. Without every one of these, the submission is incomplete.

| # | Feature | Description | Depends On |
|---|---|---|---|
| 1 | **3D Tower Renderer** | Obelisk shape, 1000+ blocks, InstancedMesh + LOD, 30+ FPS on Seeker | — |
| 2 | **On-Chain Staking** | USDC vault program → block claim. Already deployed to devnet. | — |
| 3 | **MWA Wallet Connect** | Connect via Seed Vault / Phantom. Already scaffolded. | — |
| 4 | **Charge System** | Real-time Charge decay + daily tap to recharge. Visual states (Blazing → Dormant). Server-side config for decay rate. | Tower renderer |
| 5 | **Block Customization** | Color picker (16 neon presets) + emoji overlay + name tag. | Tower renderer |
| 6 | **Bot Simulation** | 50-100 pre-seeded blocks with varied Charge levels. Makes tower feel alive. | Charge system |
| 7 | **Guided Onboarding** | First-time tutorial: "Find your spot" → stake → claim → customize. Camera-guided. | All of the above |
| 8 | **Pitch Deck** | Clear, beautiful slides. Pitch the vision + demo. | — |
| 9 | **Demo Video** | 2-minute narrated walkthrough (see GDD Section 12). Screen-recorded from Seeker. | Working app |

### 🟡 Should Have (Wins Major Points)

These differentiate a good submission from a winning one.

| # | Feature | Description | Depends On |
|---|---|---|---|
| 10 | **Lighthouse Effect** | High-stake blocks visually illuminate neighbors. Bloom/glow spillover. | Tower renderer |
| 11 | **Leaderboards** | Skyline rank, brightest block, longest streak. Visible in-app. | Charge system |
| 12 | **Streak System** | Consecutive daily taps → multiplier + badges. | Charge system |
| 13 | **Haptic Feedback** | Already designed (see HAPTICS.md). Wire into all interactions. | — |
| 14 | **Push Notifications** | "Your block is Fading!" Pull users back. | Charge system |
| 15 | **Blink / X Share** | Share block as Solana Blink + X intent. Auto-generated preview. | Block data |
| 16 | **Neighbor Boost** | Tap a friend's block to give +5 Charge. | Charge system |
| 17 | **Sound Effects** | Block claim SFX, Charge tap, ambient tower hum, streaks. | — |

### 🟢 Nice to Have (Impressive If Present)

| # | Feature | Description |
|---|---|---|
| 18 | **Real-time Multiplayer** | WebSocket sync so users see each other's actions live |
| 19 | **Action Button** | Seeker hardware button — short press = Sonar pulse |
| 20 | **Agent REST API** | Read-only tower state + SKILL.md published |
| 21 | **Gravity Tax** | Contiguous block penalty (1.5 power scaling) |
| 22 | **Tower Growth** | New floors unlock as total stake increases |
| 23 | **SKR Integration** | Accept SKR as stakeable token alongside USDC |

### 🔵 Post-MVP

| Feature | Description |
|---|---|
| AI-generated block textures | Meshy/Tripo3D integration |
| AR Tabletop mode | Anchor tower to physical surface |
| Real DeFi yield | Route vault through Drift/Kamino/Orca |
| Agent write API + webhooks | Full agent CRUD + event system |
| NFT display on blocks | Pull from user's Solana wallet |
| Content moderation | Image classification for user uploads |

---

## Suggested Build Order

> [!TIP]
> Build features in the order that creates the most convincing demo soonest. Front-load visual impact.

### Week 1 (Days 1–7): Core Foundation
- [ ] Day 1–2: Tower renderer overhaul (obelisk shape, variable block sizes, LOD)
- [ ] Day 3: Charge system backend (decay tick, daily tap endpoint, Supabase state)
- [ ] Day 4: Connect Charge system to visuals (Blazing → Dormant states)
- [ ] Day 5: MWA → on-chain stake → block claim → tower updates
- [ ] Day 6: Block customization UI (color picker, emoji, name)
- [ ] Day 7: Bot pre-seeder script (50-100 blocks at varied states)

**Checkpoint:** You can stake $1, claim a block, see it glow on a tower full of bot blocks.

### Week 2 (Days 8–14): Polish & Retention
- [ ] Day 8: Guided onboarding tutorial flow
- [ ] Day 9: Lighthouse effect (glow spillover shader)
- [ ] Day 10: Streak system + badges
- [ ] Day 11: Leaderboard UI
- [ ] Day 12: Haptic integration (already designed, just wire up)
- [ ] Day 13: Sound effects pass (source + integrate key SFX)
- [ ] Day 14: Push notifications ("Your block is Fading!")

**Checkpoint:** The app feels polished. Retention hooks are in place.

### Week 3 (Days 15–21): Differentiation
- [ ] Day 15: Blink / X sharing
- [ ] Day 16: Neighbor boost mechanic
- [ ] Day 17: Agent REST API (read-only tower state)
- [ ] Day 18: Agent SKILL.md + documentation
- [ ] Day 19: Action Button integration (if time)
- [ ] Day 20–21: Bug fixes, performance optimization, edge cases

**Checkpoint:** Feature-complete MVP.

### Week 4 (Days 22–25): Ship It
- [ ] Day 22: Demo video recording + editing
- [ ] Day 23: Pitch deck creation
- [ ] Day 24: APK build, final testing on Seeker
- [ ] Day 25: Submit final build

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| R3F performance on Seeker | Test Day 1. If blockers, simplify geometry aggressively. |
| Scope creep | If behind schedule, cut from bottom of priority tiers. Never cut 🔴. |
| Anchor program changes | Keep program minimal. Add features via off-chain logic. |
| No real users for demo | Bot simulation fills the tower convincingly. |
| Sound/audio sourcing | Use free libraries (Freesound, Pixabay, Mixkit). AI-generate if needed. |
| Solo dev burnout | Build in priority order. A polished 🔴-only submission beats a buggy 🟡+🟢. |
