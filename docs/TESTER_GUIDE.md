# Monolith Tester Guide

> The complete reference for testers. For install instructions and a quick overview, see [TESTING.md](../TESTING.md) in the project root.

---

## What You're Testing

The Monolith is a shared 3D tower where each block has a living face — a **Spark**. You claim a block, charge it daily, and watch your Spark grow from a newborn face into a radiant Beacon. The tower is social: other players can see your block, poke it, and compete for leaderboard spots. If you neglect your Spark for 3+ days, someone else can reclaim it.

Everything runs on Solana devnet (no real money). All customization tiers are unlocked for testing.

---

## Install & Setup

1. Download the APK from the link in [TESTING.md](../TESTING.md) (or scan the QR code)
2. Install on your Android device (allow "Install from unknown sources")
3. **If upgrading**: Uninstall the old version first (native config changed between builds)
4. Open "The Monolith"

**Auto-updates:** After this install, the app checks for OTA updates every launch. No reinstall needed for JS-level patches.

---

## Wallet & Tokens

### Connect a Wallet
- **Phantom**: [Install from Google Play](https://play.google.com/store/apps/details?id=app.phantom), then Settings > Developer Settings > Testnet Mode > **Devnet**
- **Seed Vault**: Built into Solana Seeker, already on devnet in dev mode
- Tap the wallet pill at the top of the screen to connect

### Get Test Tokens
1. Go to **Me** tab (bottom nav)
2. Tap **Get Test Tokens**
3. **SOL**: Tap "Get Test SOL" — 2 SOL airdropped instantly (for transaction fees)
4. **USDC**: Tap "Open USDC Faucet" — copy your wallet address, paste on Circle's site

### Playing Without a Wallet
You can skip the wallet entirely. The onboarding lets you claim and play in demo mode. Wallet features (on-chain staking, USDC deposit) activate when you connect later.

---

## Core Gameplay

### Claiming a Block
1. Tap any **unclaimed block** on the tower (they pulse with a warm golden shimmer)
2. The inspector opens — tap **CLAIM THIS BLOCK**
3. Pick a color and stake amount (layer-based pricing: bottom = $0.10, top = $1.00)
4. Confirm the transaction in your wallet
5. A cinematic celebration plays: camera sweeps, gold flash, particles burst
6. Your Spark face appears on the block

### Charging
1. Tap your block to open the inspector
2. Tap **CHARGE**
3. Your block bounces with a squash-and-stretch animation
4. Energy fills by 15-35 points (variable roll)
5. **Quality brackets**: Each charge rolls normal / good / great
   - Normal: standard flash and haptic
   - Good: bigger flash, stronger haptic, more XP
   - Great: dramatic flash, intense haptic, max XP
6. Watch the floating text: "+25 XP" (or "+50 XP GREAT!")

### Energy & Decay
- Energy starts at 100 when claimed, decays over time
- **Blazing** (80-100): Happy face, warm gold aura
- **Thriving** (50-80): Content face, amber glow
- **Fading** (20-50): Worried face, flickering aura
- **Dying** (1-20): Sad face, cold blue sparks
- **Dead** (0): Asleep face (X_X eyes), dark — reclaimable after 3 days

### Streaks
- Charge on consecutive calendar days to build a streak
- **Milestones**: 3 days (1.5x), 7 days (2x), 14 days (2.5x), 30 days (3x multiplier)
- Streak resets if you skip a day
- The multiplier boosts XP earned from charges

### Spark Evolution
Every charge adds to permanent cumulative progress. Evolution never regresses.

| Tier | Name | Charges Needed | Visual Changes |
|---|---|---|---|
| 1 | **Spark** | 0 | Basic face, minimal glow |
| 2 | **Ember** | ~5 | Blush marks appear, warmer glow |
| 3 | **Flame** | ~15 | Eyebrows + sparkle effect |
| 4 | **Blaze** | ~30 | Full expression, strong glow |
| 5 | **Beacon** | ~50 | Halo effect, visible from furthest distance |

- Progress bar in the inspector shows "3 more to Ember" etc.
- A celebration fires when you reach each new tier (exactly once per tier)
- Best streak also contributes: higher streak = faster evolution

### Loot Drops
When you charge, there's a **~30% chance** of getting a cosmetic drop:

| Rarity | Examples | Drop Rate |
|---|---|---|
| **Common** | New colors | ~60% of drops |
| **Rare** | Special emojis, particle effects | ~25% of drops |
| **Epic** | Animated styles | ~12% of drops |
| **Legendary** | Rarest styles | ~3% of drops |

- A full-screen gacha reveal plays with rarity-colored flash
- You can equip the item immediately or find it later in your inventory
- Higher streaks slightly boost drop rates
- Loot is stored locally on your device

---

## Customization

All options are unlocked for testing (normally some are tier-gated).

### Available Options
- **16 colors**: Full palette
- **48 emojis**: Set your block's icon
- **11 styles**: Including 4 animated GLSL styles (Lava, Aurora, Crystal, Nature)
- **7 textures**: Surface patterns
- **Display name**: Shows on your block and the leaderboard

### Face Personality
During onboarding, you choose your Spark's personality:
- **Happy** (^_^) — cheerful default
- **Cool** (B-)) — laid back
- **Sleepy** (-_-) — chill vibes
- **Fierce** (>_<) — competitive
- **Derp** (:P) — playful

Each personality has a unique eye/mouth combo. On top of that, each block position on the tower generates a unique variation (5 eye shapes x 4 mouth styles = 20 combos).

### Inspector
- Tap any block to open the compact inspector (~280px)
- Swipe up or tap to expand to full view (~540px)
- Your block stays visible behind the panel
- Swipe down to dismiss

---

## XP & Levels

| Action | XP |
|---|---|
| Claim a block | 100 XP |
| First block ever | +200 bonus |
| Charge | 25 XP (modified by quality) |
| Combo (acts within 30s) | Up to 3x multiplier |
| Streak milestones | Bonus XP at 3/7/14/30 days |

- XP bar shows at the top of the screen
- Level up triggers a full-screen celebration with haptic
- 10 levels total in this build

---

## Social & Competition

### Board Tab
- **4 leaderboards**: Skyline (most blocks), Brightest (highest energy), Streaks (longest), XP (total)
- Tap any leaderboard entry to fly the camera to that block on the tower
- Activity feed shows real-time claims, charges, and pokes from all players

### Poke
- Tap someone else's block > **POKE** (30-second cooldown between pokes)
- Their block shakes and flashes orange
- They receive a push notification
- You can also be poked via **Solana Blinks** (shareable URLs)

### Reclaim Dormant Blocks
- Any block at 0 energy for 3+ consecutive days becomes reclaimable
- An orange **RECLAIM** button appears in the inspector
- Reclaiming takes ownership away from the previous keeper

### My Blocks
- Tap the floating button (bottom-left) to see all your blocks
- Sorted by urgency (lowest energy first)
- **Charge All** button for quick mass-charge
- Tap any entry to fly the camera to that block

### Hot Block Ticker
- Bottom-right corner shows notable blocks: dying, fading, claimable, or on a streak
- Per-type color coding
- Tap to inspect

---

## Onboarding Flow

The app has a 9-phase guided onboarding:

1. **Cinematic orbit** — camera sweeps around the tower
2. **Title reveal** — "THE MONOLITH" with staggered text
3. **Claim** — tap an unclaimed block, pick your Spark's personality + color
4. **Celebration** — camera cinematic, gold flash, particles
5. **Customize** — change emoji, style, name
6. **Charge** — learn the charge mechanic
7. **Poke** — try poking a bot's block
8. **Wallet** — option to connect (can skip)
9. **Done** — free exploration

You can replay onboarding from **Me** tab > **Replay Onboarding**.

---

## Navigation

| Element | Where | What it does |
|---|---|---|
| **FloatingNav** | Bottom center | Three pills: Tower / Board / Me |
| **TopHUD** | Top center | "MONOLITH" + wallet connection pill |
| **My Blocks FAB** | Bottom left | Quick access to your owned blocks |
| **Hot Block Ticker** | Bottom right | Notable block alerts (dying, streaks, claimable) |
| **Layer Scrubber** | Right edge | Scroll through tower floors |

---

## Achievements

7 achievements, unlocked by actions:

| Achievement | Trigger |
|---|---|
| First Keeper | Claim your first block |
| First Charge | Charge for the first time |
| Streak Starter | Reach a 3-day streak |
| Empire Builder | Own 3+ blocks |
| Bright Flame | Evolve to Flame tier |
| Poke Champion | Poke 10 different blocks |
| Tower Veteran | Reach level 5 |

Each one shows a slide-in toast with a share button.

---

## Known Limitations

- **Devnet only** — no real money, devnet RPC can be flaky
- **Activity feed** on Board tab may show generated placeholder data when server has no recent events
- **Wallet connection** can occasionally drop (devnet RPC instability)
- **.skr domain names** only resolve on Seeker devices with mainnet RPC
- **Server** runs on Railway free tier — may cold-start after inactivity (30s delay on first connect)

---

## Testing Checklist

Use this to systematically test the major flows. Check off what works, note what doesn't.

### Setup
- [ ] APK installs cleanly on Android 10+
- [ ] App opens to the tower (or onboarding on first launch)
- [ ] Wallet connects (Phantom or Seed Vault on devnet)
- [ ] Test SOL airdrop works (2 SOL)
- [ ] USDC faucet link opens and works

### Onboarding
- [ ] Cinematic orbit plays smoothly
- [ ] Title reveal animates properly
- [ ] Face personality picker appears and all 5 options work
- [ ] Claim flow completes with celebration
- [ ] Customize step works (color, emoji, style, name)
- [ ] Charge tutorial works
- [ ] Poke tutorial works
- [ ] Wallet step can be skipped
- [ ] After onboarding, free exploration begins

### Core Loop
- [ ] Claim an unclaimed block (gold pulse) — celebration plays
- [ ] Charge own block — bounce animation, energy increases, floating XP text
- [ ] Charge quality visible (normal vs good vs great: different flash intensity)
- [ ] Energy bar updates in inspector
- [ ] Streak counter increments on consecutive-day charges
- [ ] Loot drops appear (~30% of charges) with reveal overlay
- [ ] Can equip loot from reveal screen
- [ ] Evolution progress bar shows "X more to [tier]"
- [ ] Evolution celebration fires at tier boundary (once per tier)
- [ ] Can see visual difference between evolution tiers on tower

### Inspector & Customization
- [ ] Tap block → compact inspector opens (~280px)
- [ ] Swipe up → inspector expands to full (~540px)
- [ ] Block visible behind inspector panel
- [ ] Can change: color, emoji, style, texture, name
- [ ] Animated styles work: Lava, Aurora, Crystal, Nature
- [ ] Swipe down → inspector dismisses smoothly
- [ ] Can't charge/customize someone else's block (ownership enforced)

### Social
- [ ] Board tab: 4 leaderboard tabs work
- [ ] Tap leaderboard entry → camera flies to that block
- [ ] Poke another player's block → shake animation + orange flash
- [ ] Poke cooldown enforced (30s)
- [ ] Activity feed shows recent events
- [ ] Hot Block Ticker (bottom-right) shows notable blocks

### My Blocks
- [ ] FAB button (bottom-left) opens My Blocks panel
- [ ] Blocks sorted by urgency (lowest energy first)
- [ ] "Charge All" button works
- [ ] Tap entry → camera flies to block

### Reclaim
- [ ] Find a dead block (0 energy, 3+ days old)
- [ ] Orange RECLAIM button appears
- [ ] Reclaim takes ownership

### XP & Levels
- [ ] XP bar visible and updating
- [ ] Level-up celebration fires (full screen + haptic)
- [ ] Combo multiplier works (rapid actions within 30s)

### Tower & Performance
- [ ] Orbit/pan/zoom feel smooth (target: 60 FPS)
- [ ] Layer scrubber navigates floors
- [ ] Spark faces visible and expressive
- [ ] Faces react to energy changes
- [ ] Unclaimed blocks show warm golden pulse (not dark)
- [ ] Particles and aurora wisps animate

### Sounds & Haptics
- [ ] Claim sound + haptic plays
- [ ] Charge sound + haptic plays (intensity varies by quality)
- [ ] Poke sound plays
- [ ] Level-up sound plays
- [ ] Can toggle haptics in Settings (Me tab)

### Edge Cases
- [ ] Close and reopen app → state preserved
- [ ] Disconnect and reconnect → "Reconnecting" banner, then recovers
- [ ] Switch tabs rapidly → no crashes
- [ ] Rotate device → layout handles it
- [ ] Back button behavior on Android → sensible

---

## Bug Reports

If something breaks:

1. **What you were doing** (e.g., "I tapped CHARGE on my block")
2. **What happened** (e.g., "The app froze for 3 seconds, then the block didn't bounce")
3. **What you expected** (e.g., "Bounce animation + energy increase")
4. **Screenshot or screen recording** if possible

Send to [GitHub Issues](https://github.com/epicexcelsior/monolith/issues) or message [@exce1s](https://t.me/exce1s) on Telegram.

---

*Thank you for testing! Every piece of feedback helps make the Sparks come alive.*
