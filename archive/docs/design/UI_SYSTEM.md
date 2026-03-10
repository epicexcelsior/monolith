# The Monolith — UI Design System

> **Canonical reference for all 2D UI in the app.** Every component, screen, and animation follows this system.
>
> Tower 3D rendering has its own visual scene. This doc covers everything OUTSIDE the R3F canvas.

---

## 1. Design Philosophy

### Identity: Solarpunk

Warm, organic, golden. The Monolith's UI should feel like **golden hour light hitting ancient stone** — premium, calm, confident. Not cold crypto-neon. Not sterile fintech gray. Think:

- **Phantom Wallet's** cleanliness + **Robinhood's** simplicity + **golden warmth**
- Dark text on light cream backgrounds
- Gold as the primary accent (not blue, not green)
- Rounded, continuous corners (iOS-native feel)
- Generous whitespace
- Quiet confidence — the tower is the spectacle, the UI is the frame

### Two Visual Layers

| Layer | Background | Aesthetic | Where |
|---|---|---|---|
| **Tower Scene** | Atmospheric (dark sky / gradient) | Dramatic, glowing, alive | R3F Canvas fullscreen |
| **2D UI** | Warm cream / white | Clean, solarpunk, premium | Overlays, tabs, modals, screens |

The tower keeps its own immersive atmosphere. The 2D UI wraps around it with warmth and clarity.

---

## 2. Color Palette

### Backgrounds

| Token | Hex | Usage |
|---|---|---|
| `bg` | `#FAF7F2` | Primary screen background |
| `bgCard` | `#FFFFFF` | Card surfaces |
| `bgMuted` | `#F0EBE3` | Secondary/muted surfaces |
| `bgOverlay` | `rgba(250, 247, 242, 0.92)` | Translucent overlays on tower |
| `bgTower` | `#0A0F0A` | Tower scene only (canvas bg) |

### Accent — Gold

| Token | Hex | Usage |
|---|---|---|
| `gold` | `#C8993E` | Primary actions, links, highlights |
| `goldLight` | `#E8A94D` | Hover/active states, chart fills |
| `goldDark` | `#A67C2E` | Pressed states, text on gold bg |
| `goldSubtle` | `rgba(200, 153, 62, 0.10)` | Tinted card backgrounds |

### Text

| Token | Hex | Usage |
|---|---|---|
| `text` | `#1A1612` | Primary text (headings, body) |
| `textSecondary` | `#5C554B` | Secondary text (labels, captions) |
| `textMuted` | `#9E9690` | Placeholder, hint, disabled text |
| `textOnGold` | `#FFFFFF` | Text on gold-filled buttons |
| `textOnDark` | `#FAF7F2` | Text on dark/tower backgrounds |

### Borders & Dividers

| Token | Hex | Usage |
|---|---|---|
| `border` | `#E8E2D9` | Light dividers, card borders |
| `borderStrong` | `#D4CEC4` | Emphasized dividers |
| `borderAccent` | `#C8993E` | Active/selected borders |

### Block States (Charge System)

| State | Token | Hex | Visual |
|---|---|---|---|
| **Blazing** 🔥 | `blazing` | `#FFB800` | Brilliant gold |
| **Thriving** ✨ | `thriving` | `#5C9E31` | Healthy green |
| **Fading** 💫 | `fading` | `#E07A2F` | Warm orange |
| **Flickering** ⚡ | `flickering` | `#C4402A` | Warning red |
| **Dormant** 💤 | `dormant` | `#9E9189` | Muted stone |

### Semantic

| Token | Hex | Usage |
|---|---|---|
| `success` | `#2E8B57` | Confirmations, positive states |
| `warning` | `#E8A94D` | Caution, attention needed |
| `error` | `#C4402A` | Errors, destructive actions |
| `info` | `#5B8FB9` | Informational highlights |

---

## 3. Typography

### Font Families

| Role | Font | Weight Range | Loaded Via |
|---|---|---|---|
| **Headings** | Outfit | 400, 600, 700, 900 | `@expo-google-fonts/outfit` |
| **Body** | Inter | 400, 500, 600, 700 | `@expo-google-fonts/inter` |
| **Monospace** | JetBrains Mono | 400, 700 | `@expo-google-fonts/jetbrains-mono` |

### Type Scale

| Name | Font | Size | Weight | Letter Spacing | Usage |
|---|---|---|---|---|---|
| `displayLg` | Outfit | 32 | 900 | 0.5 | Screen titles (rare) |
| `displaySm` | Outfit | 24 | 700 | 0.5 | Section headings |
| `headingLg` | Outfit | 20 | 700 | 0.3 | Card titles, modal titles |
| `headingSm` | Outfit | 16 | 600 | 0.3 | Subsection titles |
| `bodyLg` | Inter | 16 | 400 | 0 | Primary body text |
| `bodySm` | Inter | 14 | 400 | 0 | Secondary body text, descriptions |
| `caption` | Inter | 12 | 500 | 0.5 | Labels, hints, metadata |
| `overline` | Inter | 11 | 700 | 2 | Section headers (uppercase) |
| `mono` | JetBrains Mono | 14 | 400 | 0 | Addresses, amounts, code |
| `monoSm` | JetBrains Mono | 12 | 400 | 0 | Small data, hashes |
| `button` | Inter | 16 | 700 | 0.5 | Button labels |
| `buttonSm` | Inter | 14 | 600 | 0.5 | Small button labels |

### Typography Rules

1. **Headings** always use **Outfit**
2. **Body text** always uses **Inter**
3. **Addresses, amounts, and numeric data** always use **JetBrains Mono**
4. Use `fontVariant: ['tabular-nums']` on any column of numbers for alignment
5. Add `selectable` prop to addresses and transaction hashes
6. Never use system default fonts in new code

---

## 4. Spacing & Layout

### Spacing Scale

| Token | Value | Usage |
|---|---|---|
| `xs` | 4 | Tight gaps, icon padding |
| `sm` | 8 | Chip padding, tight row gaps |
| `md` | 16 | Card padding, section gaps |
| `lg` | 24 | Between sections |
| `xl` | 32 | Major section breaks |
| `xxl` | 48 | Screen top/bottom padding |

### Border Radius

| Token | Value | Usage |
|---|---|---|
| `radiusSm` | 8 | Chips, badges, small elements |
| `radiusMd` | 12 | Buttons, inputs |
| `radiusLg` | 16 | Cards |
| `radiusXl` | 24 | Bottom panels, modals |
| `radiusFull` | 9999 | Pills, circular elements |

> All rounded corners MUST use `borderCurve: 'continuous'` to get the smoother iOS-style curves.

### Shadows

```typescript
// Elevation levels (use boxShadow, never legacy shadow/elevation styles)
shadow: {
  sm: '0 1px 3px rgba(26, 22, 18, 0.06)',
  md: '0 4px 12px rgba(26, 22, 18, 0.08)',
  lg: '0 8px 24px rgba(26, 22, 18, 0.12)',
  gold: '0 4px 16px rgba(200, 153, 62, 0.20)',  // Gold glow for primary actions
}
```

---

## 5. Component Library

All reusable components live in `apps/mobile/components/ui/`. Import via `@/components/ui`.

### 5.1 Button

Variants: `primary` (gold filled), `secondary` (gold outline), `ghost` (text only), `danger` (red)
Sizes: `sm`, `md`, `lg`

```tsx
import { Button } from '@/components/ui';

<Button title="Claim Block" variant="primary" onPress={handleClaim} />
<Button title="Cancel" variant="ghost" onPress={handleCancel} />
<Button title="Deposit 1.00 USDC" variant="primary" loading={isLoading} />
<Button title="Disconnect" variant="danger" onPress={handleDisconnect} />
```

### 5.2 Card

Variants: `default` (white), `accent` (gold-tinted), `muted` (subtle bg)

```tsx
import { Card } from '@/components/ui';

<Card>
  <Text>Basic content card</Text>
</Card>

<Card variant="accent">
  <Text>Gold-highlighted card for important info</Text>
</Card>
```

### 5.3 Badge

For block states, streaks, and status indicators.

```tsx
import { Badge } from '@/components/ui';

<Badge label="BLAZING" color={COLORS.blazing} />
<Badge label="Day 7 🏅" variant="outline" color={COLORS.gold} />
<Badge label="Connected" variant="dot" color={COLORS.success} />
```

### 5.4 ChargeBar

Animated progress bar that auto-colors based on Charge level.

```tsx
import { ChargeBar } from '@/components/ui';

<ChargeBar charge={85} />           // Gold bar, "BLAZING" label
<ChargeBar charge={30} size="sm" /> // Orange bar, compact
<ChargeBar charge={5} showLabel />  // Red bar, "FLICKERING" label
```

### 5.5 BottomPanel

Animated slide-up panel. Safe area aware. Replaces custom BlockInspector animation.

```tsx
import { BottomPanel } from '@/components/ui';

<BottomPanel visible={showPanel} onClose={() => setShowPanel(false)}>
  <Text>Panel content here</Text>
</BottomPanel>
```

### 5.6 Input

Styled text input with label, prefix/suffix, and error state.

```tsx
import { Input } from '@/components/ui';

<Input
  label="DEPOSIT AMOUNT"
  value={amount}
  onChangeText={setAmount}
  prefix="$"
  suffix="USDC"
  keyboardType="decimal-pad"
  error={amount < 0.10 ? "Minimum 0.10 USDC" : undefined}
/>
```

### 5.7 Chip

Selectable pill for quick actions and filters.

```tsx
import { Chip } from '@/components/ui';

<View style={{ flexDirection: 'row', gap: 8 }}>
  {[0.10, 0.50, 1.00, 5.00].map((amt) => (
    <Chip
      key={amt}
      label={`$${amt}`}
      selected={amount === amt}
      onPress={() => setAmount(amt)}
    />
  ))}
</View>
```

### 5.8 ScreenLayout

Standard screen wrapper. Handles safe area, scroll, refresh.

```tsx
import { ScreenLayout } from '@/components/ui';

export default function MyBlocksScreen() {
  return (
    <ScreenLayout title="My Blocks" subtitle="3 blocks • Day 7 streak">
      {/* Screen content */}
    </ScreenLayout>
  );
}
```

---

## 6. Screen Architecture

### Tower View (Main Tab)

```
┌─────────────────────────────────┐
│  "THE MONOLITH"    [wallet btn] │  ← Minimal top bar (translucent)
│                                 │
│        ┌─────────────┐          │
│        │             │          │
│        │   3D Tower   │          │
│        │   (R3F)     │          │
│        │             │          │
│        │             │          │
│        └─────────────┘          │
│                            [L5] │  ← Layer indicator (right edge)
│                                 │
│  [tap block → BottomPanel]      │  ← Contextual, not persistent
└─────────────────────────────────┘
│  🗼 Tower  │  🏆 Board  │  👤 Me │  ← Tab bar
└─────────────────────────────────┘
```

**Key rule:** No persistent action buttons on the tower screen. All interactions are **contextual** — tap a block to see options.

### Standard Screens (Vault, Settings, Leaderboard)

```
┌─────────────────────────────────┐
│  ← Back                        │  ← Stack header (or tab title)
│                                 │
│  Screen Title                   │  ← displayLg / Outfit 900
│  Subtitle                       │  ← bodySm / Inter 400
│                                 │
│  ┌─ Card ─────────────────────┐ │
│  │  Content                   │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌─ Card ─────────────────────┐ │
│  │  Content                   │ │
│  └────────────────────────────┘ │
│                                 │
│  [Primary Button]               │
│                                 │
└─────────────────────────────────┘
```

Use `ScreenLayout` for all standard screens.

### Modals

```
┌─────────────────────────────────┐
│         [backdrop dim]          │
│                                 │
│  ┌────────────────────────────┐ │
│  │  ── handle bar ──          │ │
│  │                            │ │
│  │  Modal Title               │ │
│  │  Description               │ │
│  │                            │ │
│  │  [Content]                 │ │
│  │                            │ │
│  │  [Primary Button]          │ │
│  │  Cancel                    │ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘
```

Use Expo Router `presentation: "modal"` or `presentation: "formSheet"`.

---

## 7. Navigation Structure

### Tabs (3)

| Tab | Icon | Screen | Purpose |
|---|---|---|---|
| **Tower** | 🗼 | Full-screen 3D + HUD | The game. Primary experience. |
| **Board** | 🏆 | Leaderboard + stats | Rankings, global tower stats |
| **Me** | 👤 | Profile, blocks, settings | Portfolio, streaks, customization, settings |

### Modal Routes (Slide Up)

| Route | When Triggered |
|---|---|
| `/connect` | "Connect Wallet" button |
| `/deposit` | Tap unclaimed block → "Claim" → deposit flow |
| `/withdraw` | Manage own block → "Withdraw" |
| `/block-config` | After claiming → full-screen block configurator |

### Block Configurator (Full Screen)

Special screen: shows a rotating 3D block preview (small R3F canvas) with configuration controls below:

```
┌─────────────────────────────────┐
│  ← Done             Block #42  │
│                                 │
│        ┌─────────────┐          │
│        │  Rotating    │          │
│        │  3D Block    │          │
│        │  Preview     │          │
│        └─────────────┘          │
│                                 │
│  COLOR                          │
│  [■][■][■][■][■][■][■][■]      │
│                                 │
│  EMOJI                          │
│  [🔥][⚡][🌟][💎][🎯][🏆]      │
│                                 │
│  NAME                           │
│  [  My Block  ]                 │
│                                 │
│  [Save Changes]                 │
└─────────────────────────────────┘
```

---

## 8. Animations & Transitions

### Screen Transitions

| Transition | Animation | Duration |
|---|---|---|
| Tab switch | Cross-fade | 200ms |
| Push screen | Slide from right (iOS default) | 350ms |
| Modal open | Slide from bottom | 350ms |
| Modal close | Slide down + fade | 250ms |

### Micro-Interactions

| Element | Animation | Timing |
|---|---|---|
| Button press | Scale to 0.96 → spring back | 100ms + spring |
| Card press | Scale to 0.98, slight shadow change | 100ms |
| Chip select | Background color transition | 150ms |
| ChargeBar fill | Animated width with spring physics | 600ms spring |
| Badge appear | Scale from 0 → 1 with overshoot | 300ms spring |
| BottomPanel open | Slide up with spring | tension: 65, friction: 11 |
| BottomPanel close | Slide down with timing | 250ms ease-out |
| Toast notification | Slide in from top + fade | 300ms |

### Haptic Pairing

Every animation should consider whether a haptic is appropriate:

| Action | Haptic | Sound |
|---|---|---|
| Button press | `impactLight` | Soft click |
| Block claimed | `notificationSuccess` | Rising shimmer |
| Charge tap | `impactMedium` | Electric zap |
| Streak milestone | `notificationSuccess` | Ascending chime |
| Error | `notificationError` | Muted buzz |
| Panel open/close | `impactLight` | Subtle whoosh |

---

## 9. Seeker Hardware Compatibility

### Screen Size Rules

- **Never use `Dimensions.get()`** — always `useWindowDimensions()` for reactive sizing
- **Use flexbox** for all layouts — never absolute pixel offsets for responsive elements
- **Safe area insets** — always wrap with `contentInsetAdjustmentBehavior="automatic"` on ScrollView/FlatList, or use `react-native-safe-area-context` for custom positioning
- **Bottom safe area** — Critical: the Seeker has a gesture bar. Always account for bottom insets on floating buttons and bottom panels
- **Touch targets** — Minimum 44x44pt for all interactive elements (following Apple HIG, which Android also respects)

### Performance Budget

| Metric | Target |
|---|---|
| UI interaction latency | < 16ms (60 FPS) |
| Screen transition | < 350ms |
| Font load | < 500ms (held by splash screen) |
| Component re-render | Avoid wasted renders (React.memo where appropriate) |

---

## 10. Onboarding Tutorial (Plan — Not Built Yet)

> [!NOTE]
> This is the planned flow. Build it when core gameplay is working.

### Flow

```
Screen 1: "Welcome to The Monolith"
  → Beautiful tower illustration or short looping video
  → "The tower is alive. Every block is owned by a real person."
  → [Next]

Screen 2: "Claim Your Block"
  → Show annotated tower with arrows pointing to blocks
  → "Stake USDC to claim a block. Make it yours."
  → [Next]

Screen 3: "Keep It Charged"
  → ChargeBar animation showing decay + daily tap
  → "Tap daily to keep your block bright. Build streaks."
  → [Next]

Screen 4: "Join the Skyline"
  → Leaderboard preview
  → "Climb the rankings. Build your neighborhood."
  → [Connect Wallet] or [Explore First]
```

### Design Notes

- Each screen: single focused message + visual + one button
- Progress dots at bottom (4 screens)
- "Skip" option in top-right
- Uses full solarpunk theme (warm cream bg, gold accents)
- Onboarding only shows on first app open (flag in AsyncStorage)
