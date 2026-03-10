# Test The Monolith

> Claim a living block on a shared 3D tower. Your block has a face — a **Spark** — that reacts to how you take care of it. Stake USDC, charge daily, watch it evolve. Neglect it and someone else can take it. Android required.

---

## 1. Install the App

<p align="center">
  <img src="docs/install-qr.png" alt="Scan to install" width="280" />
</p>

<p align="center">
  <strong>Scan this QR code on your Android phone</strong><br/>
  or tap the link below
</p>

<p align="center">
  <a href="https://expo.dev/artifacts/eas/4k3G64YyQ8NCJ7RgxA4RT6.apk">
    Download APK from Expo
  </a>
</p>

Your phone will ask to allow installs from your browser — tap **Allow**, then **Install**.

**Important:** This is a new build — uninstall any older version before installing.

**Updates are automatic.** After this install, the app checks for OTA updates every time you open it.

---

## 2. Set Up a Wallet

You need a Solana wallet on your phone. Two options:

| Wallet | Best for |
|--------|----------|
| **Phantom** | Any Android phone — [Get it on Google Play](https://play.google.com/store/apps/details?id=app.phantom) |
| **Seed Vault** | Solana Seeker (built in, just unlock it) |

**Important:** Switch your wallet to **Devnet** before connecting.

- **Phantom**: Settings > Developer Settings > Testnet Mode > **Devnet**
- **Seed Vault**: Already on devnet if your Seeker is in dev mode

---

## 3. Get Test Tokens (Free)

Once in the app:

1. Connect your wallet (tap **Connect** on the tower screen)
2. Go to the **Me** tab
3. Tap **Get Test Tokens**
4. Tap **"Get Test SOL"** — you'll receive 2 SOL for transaction fees
5. Tap **"Open USDC Faucet"** — paste your wallet address to get test USDC for staking

These are devnet tokens with no real value.

---

## 4. Play

| Action | How | What to expect |
|--------|-----|----------------|
| **Claim a Spark** | Tap any unclaimed block > pick a color > confirm tx | Gold celebration, your Spark face appears |
| **Charge daily** | Tap your block > **CHARGE** | Bounce animation, energy fills, face reacts |
| **Build streaks** | Charge on consecutive days | Streak counter grows, bonus XP |
| **Pick a personality** | Choose your Spark's face during onboarding | Happy, Cool, Sleepy, Fierce, or Derp |
| **Customize** | Tap your block > change color, emoji, style, name | All options unlocked for testing |
| **Watch it evolve** | Keep charging — Spark > Ember > Flame > Blaze > Beacon | Glow, face detail, and aura increase per tier |
| **Compete** | Check the **Board** tab | Leaderboards, activity feed |
| **Poke rivals** | Tap someone else's block > **POKE** | Their block shakes, they get a notification |

---

## 5. What to Focus On

We want feedback on these specifically:

1. **First 60 seconds** — Did the onboarding make sense? Did you understand what to do?
2. **Claiming + celebration** — Was the camera animation smooth? Did it feel rewarding?
3. **Spark faces** — Can you see the faces on blocks? Do they react to energy changes? Do the personalities feel distinct?
4. **Charging loop** — Is tapping CHARGE satisfying? Does the bounce/energy feedback feel good?
5. **Evolution** — Did evolving your Spark feel like a milestone? Could you see the visual difference between tiers?
6. **Crashes or freezes** — Especially during wallet connect, claiming, or navigating between tabs
7. **Performance** — Does the 3D tower feel smooth? Any lag or jank?

Don't worry about:
- Wallet/token setup issues (devnet can be flaky)
- Visual polish details

---

## 6. Report Bugs

If something breaks, please note:

1. What you tapped / were doing
2. What happened vs. what you expected
3. Screenshot or screen recording if possible

Send to [GitHub Issues](https://github.com/epicexcelsior/monolith/issues) or message [@exce1s](https://t.me/exce1s) on TG directly.

---

## FAQ

**Q: Is this real money?**
No. Everything runs on Solana devnet. Tokens are free and have no value.

**Q: What phones work?**
Any Android phone or Solana Seeker. No iOS or web support yet.

**Q: How do I get the latest version?**
Just close and reopen the app. It auto-updates on launch.

**Q: The app crashed / won't open.**
Make sure you have Android 10+ and enough storage. Try uninstalling and reinstalling from the link above.

**Q: My transaction failed.**
You might be out of devnet SOL. Go to Me > Get Test Tokens to get more.

**Q: What are Sparks?**
The living faces on your blocks. They react to energy — happy when charged, drowsy when fading, asleep when dead. They evolve as you keep charging.

**Q: Can I play without a wallet?**
Yes! The onboarding lets you claim and play in demo mode. Connect a wallet later to stake real (devnet) USDC.
