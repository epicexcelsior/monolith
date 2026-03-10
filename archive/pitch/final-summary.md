# Final Summary -- Pitch Deck Evolution (Rounds 1-7)

## Score Trajectory
60 -> 66 -> 76 -> 79 -> 82 -> 83 -> (final)

## Round-by-Round Changes

### Round 1 (60 -> 66): Foundation
- Rewrote hook from competitive ("650 blocks. Fight for yours.") to emotional ("What if your money had a face?")
- Added animated Spark state faces (Charged / Fading / Stolen) to hook slide
- Added stat strips with hard data (73% DeFi churn, Dune Analytics sourced)
- Added tech pill cloud to traction slide (scannable in 2 seconds)
- Replaced generic headings with punchy one-liners
- Script trimmed from ~2:40 to ~2:37

### Round 2 (66 -> 76): Step Change
- Real screenshot loaded into phone frame via JS fetch
- Fixed all "we/our" to "I/my" (solo dev consistency)
- Sourced all data, removed unsourced claims
- Replaced Venn diagram with funnel visualization (3B -> 10M -> 380K -> THE MONOLITH)
- Canvas-rendered QR code for APK download
- Promoted "r/Place meets DeFi -- in 3D" to H1 headline
- Removed DAO governance from roadmap (red flag)
- Script trimmed to ~2:23

### Round 3 (76 -> 79): Polish
- Animated Spark state faces on hook slide (pulse, dim, flicker keyframes)
- Screenshot caption: "Real screenshot from Solana Seeker"
- Agent API expanded: "AI agents claim & manage blocks on-chain"
- Avatar loading hardened with XHR fallback for file:// protocol
- Speaker script rewritten for guided tour style ("You are looking at...")
- Alaska story expanded: "Fairbanks, Alaska -- no tech hub, no team, just a dorm room and six weeks"
- Script at ~2:27

### Round 4 (79 -> 82): Visual Differentiation
- 2-screenshot slideshow with 4s crossfade (living demo without video)
- Floating Spark motifs on slides 2, 4, 8 (28px animated faces in corners)
- Dark cinematic CTA slide (dark gradient, ghost tower at 8% opacity, gold glow-text)
- Unified `loadDataUri()` helper for all asset loading
- Bio updated to match script: "No tech hub. No team."
- Created "the pitch with the faces" visual identity

### Round 5 (82 -> 83): Refinement
(Round 5 was evaluated but produced no pitcher changes -- it was a judge-only round between Round 4 and Round 6 pitcher work.)

### Round 6 (83): Script Tightening
- Removed dead CSS (`#s-close` warm gradient overridden by dark CTA)
- CTA tower lazy-init via IntersectionObserver (eliminated second rAF loop)
- 3-screenshot slideshow (added `screenshot3-data-uri.txt`, 3.5s intervals)
- Full speaker script rewrite for punchiness: every slide trimmed
- Slide 5 script fixed to acknowledge cycling screenshots
- "Charged. Fading. Stolen. Three states. The whole product." -- punchier hook close
- Script cut from 2:27 to 2:11 (16 seconds of filler removed)

### Round 7 (FINAL): Fix What Is Broken
- **Real QR code**: replaced fake pseudo-random QR with pre-computed 33x33 matrix from npm `qrcode` library. Verified scannable. Encodes `https://expo.dev/artifacts/eas/qN92LCNGBf9pNz25ar3fN.apk`.
- **Phone caption layout**: wrapped phone + caption in flex-column container so caption sits under the phone, not below the entire row.
- **CTA subtitle**: "Solo dev . 6 weeks . Full stack . Ship-ready" replaced with "650 blocks . 320+ tests . 0 tokens . 1 builder" -- eliminates redundancy with slides 8/10.
- Zero new features. Three surgical fixes.

## Key Design Decisions Across All Rounds

1. **Emotional hook over competitive hook.** "What if your money had a face?" beats "Fight for yours." Curiosity > aggression.
2. **Solo dev as strength, not weakness.** "No tech hub. No team. Imagine what happens with a team." turns isolation into a selling point.
3. **Show, do not tell.** Canvas-rendered rotating tower in the deck itself. Screenshot slideshow. Animated Spark faces. The deck demonstrates the product's innovation by being innovative.
4. **Spark faces as visual identity.** Hero face on hook, state faces below, floating motifs on data slides. "The pitch with the faces" -- memorable among 100 decks.
5. **Dark CTA as pattern break.** 10 warm slides, then dark cinematic finale. Signals "this is serious."
6. **Honest business model.** "No token needed. Break-even at 5K users." Transparent about what matters at early scale.
7. **Real QR, real screenshot, real GitHub.** Every external reference in the deck is verifiable. Zero broken promises.

## What Remained Unfixed

- **Demo video.** The single largest scoring gap. A 15-20 second screen recording of the claim celebration would replace the slideshow and close the gap to 90+. The slideshow (8.5/10 workaround) is the best available substitute.
- **User validation data.** Zero tester feedback, zero retention numbers. The pitch proves technical depth but not product-market fit.
- **Business model validation.** Revenue streams are theoretical. "Break-even at 5K" is a projection, not evidence.

## Files Modified
- `pitch/deck.html` -- the complete slide deck (HTML + CSS + JS)
- `pitch/speaker-script.md` -- presenter script (~2:11 total)
- `pitch/pitcher-notes.md` -- round-by-round changelog
- `pitch/final-summary.md` -- this file
