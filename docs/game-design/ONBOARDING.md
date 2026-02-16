# Onboarding & UX Guide

> **Goal:** A first-time tester should understand the game loop within 30 seconds and know what to do next at every moment.

---

## Current State (MVP)

### What's Built

| Component | Purpose | Status |
|-----------|---------|--------|
| **OnboardingOverlay** | 3-step first-launch tutorial | Done |
| **ActionPrompt** | Contextual "what to do next" on tower HUD | Done |
| **TowerStats** | Live keeper/claimed/charge stats on HUD | Done |
| **BlockInspector hints** | Contextual tips in block detail panel | Done |
| **Bottom hint** | Gesture instructions (orbit/zoom/tap) | Done |

### The 30-Second Onboarding Flow

```
1. First launch → OnboardingOverlay (3 steps)
   "Welcome" → "The Daily Loop" → "Use It or Lose It"

2. Overlay dismissed → ActionPrompt appears
   Not connected: "Connect your wallet to claim a block" [Connect]
   Connected, no blocks: "Tap any dark block to claim your spot"
   Has blocks, fading: "Your block is fading! Tap to charge (23%)"
   Has blocks, streaking: "Day 2 streak — charge daily for 1.5x at Day 3!"

3. User taps a block → BlockInspector opens
   Unclaimed: "Stake USDC to make this block yours. Your money earns yield while it glows."
   Owned + low energy: "Your block is losing charge! Tap to recharge and protect your streak."
   Other's block (fading): "This block is fading... find an unclaimed one nearby to claim!"
   Other's block (blazing): "This keeper is active! Can you keep your block brighter?"

4. TowerStats bar shows:
   [21 Keepers] [69% Claimed] [54% Avg Charge] [2 Mine]
   → Instant social proof: "other people are playing this"
```

### Onboarding Steps (3 cards)

1. **Welcome to the Monolith** — A living tower where every block is someone's real stake. Bright = active. Dark = neglected. Your job: claim a block and keep it glowing.

2. **The Daily Loop** — 1. Stake USDC to claim a block. 2. Tap daily to charge it. 3. Build streaks for multipliers (Day 3 = 1.5x, Day 7 = 2x). 4. Don't let it fade!

3. **Use It or Lose It** — Blocks slowly lose charge over time. Miss a day and your streak resets. The tower punishes neglect and rewards consistency.

---

## Post-MVP Improvements (Planned)

### High Priority

| Feature | Description | Effort |
|---------|-------------|--------|
| **Guided camera flight** | After onboarding, camera auto-orbits to show tower zones (base → spire), then zooms to an unclaimed block | Medium |
| **First-claim celebration** | Full-screen confetti + haptic + sound when you claim your first block | Small |
| **Charge tutorial** | After first claim, auto-open inspector with pulsing "CHARGE" button + tooltip | Small |
| **Energy legend** | Tap-to-show overlay explaining the 5 glow states (blazing/thriving/fading/flickering/dormant) | Small |

### Medium Priority

| Feature | Description | Effort |
|---------|-------------|--------|
| **Push notifications** | "Your block is fading!" re-engagement (Expo Push) | Medium |
| **Streak reminder** | Notification before streak breaks: "Don't lose your Day 6 streak!" | Medium |
| **In-app announcements** | Banner for events like "Charge Storm: 2x charge for 1 hour!" | Small |
| **Tooltip system** | Reusable tooltip component for any UI element | Medium |

### Nice to Have

| Feature | Description | Effort |
|---------|-------------|--------|
| **Animated tutorials** | Short Lottie/Rive animations for each game concept | Large |
| **Progressive disclosure** | Unlock features over time (customize after Day 2, share after Day 3) | Medium |
| **Achievement toasts** | "First Charge!", "3-Day Streak!", "Top 10!" notifications | Small |
| **Competitor callouts** | "SolWhale.sol just charged past you!" competitive nudges | Medium |

---

## UX Principles

1. **Show, don't tell** — Visual indicators > text explanations. Glow states teach charge importance without words.

2. **Always answer "what next?"** — The ActionPrompt should never leave the user wondering what to do.

3. **Teach through play** — Don't front-load information. Reveal concepts as the player encounters them.

4. **Social proof everywhere** — Show keeper count, active players, streak leaders. "Other people are doing this."

5. **Urgency without anxiety** — Fading blocks create urgency. But charging is quick and free. The emotion should be "oh let me fix that!" not "ugh, another chore."
