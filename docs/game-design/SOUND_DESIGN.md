# Sound Design Brief — The Monolith

> **Goal:** The tower should SOUND alive. Audio is 50% of the "feel" and is cheap to implement.

---

## 1. Audio Philosophy

- **Ambient immersion:** The tower hums. Different floors sound different.
- **Satisfying feedback:** Every tap, claim, and Charge burst has a rich SFX response.
- **Minimal but impactful:** Don't fill every silence. Let the tower breathe.
- **Pair with haptics:** Every haptic event (see [HAPTICS.md](file:///home/epic/Downloads/monolith/docs/design/HAPTICS.md)) should have an audio counterpart.

---

## 2. Sound Event Map

### Critical (Build First)

| Event | Sound Description | Pair With |
|---|---|---|
| **Block claimed** | Rising tone → impact → shimmer (2-beat, like the haptic) | `hapticBlockClaimed()` |
| **Daily Charge tap** | Satisfying "zap" or electric pulse | `hapticBlockSelect()` |
| **Streak milestone** | Ascending chime sequence (more notes = higher streak) | `hapticReset()` |
| **Notification received** | Gentle ping (not annoying — iOS-style subtle) | Push notification |

### Important (Build Second)

| Event | Sound Description | Pair With |
|---|---|---|
| **Tower ambient** | Low, resonant hum. Pitch rises with total tower Charge. | Always playing |
| **Block selected** | Soft "click" or glass tap | `hapticBlockSelect()` |
| **Block deselected** | Softer release tone | `hapticBlockDeselect()` |
| **Layer boundary crossed** | Subtle tone shift (higher floors = higher pitch) | `hapticLayerCross()` |
| **Camera zoom snap** | Mechanical "detent" click | `hapticZoomSnap()` |
| **Lighthouse pulse** | Deep bass throb that radiates outward | Lighthouse glow effect |

### Nice to Have

| Event | Sound Description |
|---|---|
| **Block going Dormant** | Fade-out tone, like a candle being extinguished |
| **New floor unlocked** | Epic horn/chime like a level-up |
| **Neighbor boosts you** | Warm ping (like receiving a gift) |
| **Error / failed action** | Muted buzz | `hapticError()` |
| **Charge Storm event** | Thunder + electric crackle ambient |

---

## 3. Sourcing Strategy

### Phase 1: Free Libraries (Now)

Get functional fast with stock SFX. These are good enough for MVP:

| Source | License | URL |
|---|---|---|
| **Freesound.org** | CC0/Attribution | [freesound.org](https://freesound.org) |
| **Pixabay Audio** | Free commercial | [pixabay.com/sound-effects](https://pixabay.com/sound-effects/) |
| **Mixkit** | Free commercial | [mixkit.co/free-sound-effects](https://mixkit.co/free-sound-effects/) |
| **Kenney.nl** | CC0 | [kenney.nl/assets?q=audio](https://kenney.nl/assets?q=audio) |

**Search terms:**
- Block claim: "power up", "energy burst", "crystal charge", "electric whoosh"
- Charge tap: "zap", "electric pulse", "spark", "sci-fi click"
- Streaks: "achievement chime", "level up", "ascending tone"
- Ambient: "space station hum", "electric atmosphere", "deep drone"

### Phase 2: AI-Generated (Polish)

For custom, unique sounds that match the aesthetic:

| Tool | Use Case | Cost |
|---|---|---|
| **ElevenLabs Sound Effects** | Generate SFX from text description | Free tier available |
| **Soundraw** | Generate background music/ambient | Free tier for 1 track |
| **Suno** | Generate full music tracks | Free credits daily |

### Phase 3: Custom Composition (Post-MVP)

Commission a composer for:
- Custom ambient soundtrack per floor zone
- Adaptive music that responds to tower activity
- Signature "Monolith" sound identity

---

## 4. Implementation Notes

### Audio System Architecture

Use `expo-av` (already available in Expo) for audio playback:

```typescript
// utils/audio.ts — mirrors the haptics.ts pattern
import { Audio } from 'expo-av';

const sounds: Record<string, Audio.Sound> = {};

export async function loadSounds() {
  sounds.claim = (await Audio.Sound.createAsync(
    require('../assets/sfx/block-claim.wav')
  )).sound;
  sounds.charge = (await Audio.Sound.createAsync(
    require('../assets/sfx/charge-tap.wav')
  )).sound;
  // ... etc
}

export async function playBlockClaim() {
  await sounds.claim?.replayAsync();
}

export async function playChargeTap() {
  await sounds.charge?.replayAsync();
}
```

### Rules
1. **Pre-load all sounds** on app start (small files, <100KB each)
2. **Fire-and-forget** — same pattern as haptics, never block on audio
3. **User settings** — provide a mute toggle and volume slider
4. **Pair with haptics** — call both `hapticBlockClaimed()` + `playBlockClaim()` together
5. **Format:** Use `.wav` for short SFX (instant start), `.mp3`/`.m4a` for ambient loops
