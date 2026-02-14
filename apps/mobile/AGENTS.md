# Monolith Mobile App — Agent Instructions

> **Read this before making any UI changes.** This file instructs AI coding agents on the conventions and tools available in this project.

## Design System

**The canonical reference** is [`/docs/design/UI_SYSTEM.md`](../docs/design/UI_SYSTEM.md). It covers colors, typography, spacing, component catalog, screen wireframes, animations, and Seeker compatibility.

## Rules for UI Code

### 1. Always Use Theme Tokens

```typescript
// ✅ CORRECT
import { COLORS, SPACING, TEXT, RADIUS } from '@/constants/theme';

// ❌ WRONG — never hardcode hex values
style={{ backgroundColor: '#0a0a0f', padding: 16 }}
```

### 2. Always Use Reusable Components

All UI components live in `components/ui/` and are exported via the barrel index:

```typescript
import { Button, Card, Badge, ChargeBar, BottomPanel, Input, Chip, ScreenLayout } from '@/components/ui';
```

| Component | Use For |
|---|---|
| `Button` | All interactive buttons (primary, secondary, ghost, danger variants) |
| `Card` | Content containers (default, accent, muted variants) |
| `Badge` | Status indicators, block states, streak badges |
| `ChargeBar` | Animated charge/progress display |
| `BottomPanel` | Slide-up panels over the tower view |
| `Input` | Text/number inputs with labels and error states |
| `Chip` | Quick-select pills (amounts, filters) |
| `ScreenLayout` | Standard screen wrapper (safe area, scroll, title) |

### 3. Never Build Ad-Hoc Equivalents

If you need a button, use `<Button>`. Don't create a new `<TouchableOpacity>` with inline styles.
If you need a card container, use `<Card>`. Don't create a new `<View>` with shadow styles.
If you need a text input, use `<Input>`. Don't create a raw `<TextInput>` with custom styling.

### 4. Typography Rules

- **Headings** → Use `TEXT.displayLg`, `TEXT.displaySm`, `TEXT.headingLg`, `TEXT.headingSm` (Outfit font)
- **Body text** → Use `TEXT.bodyLg`, `TEXT.bodySm` (Inter font)
- **Labels** → Use `TEXT.caption` or `TEXT.overline` (Inter font)
- **Addresses, amounts, code** → Use `TEXT.mono`, `TEXT.monoSm` (JetBrains Mono)
- **Buttons** → Use `TEXT.button`, `TEXT.buttonSm` (Inter Bold)

### 5. New Screen Pattern

Every new standard screen (not the tower view) should use `ScreenLayout`:

```tsx
import { ScreenLayout, Card, Button } from '@/components/ui';
import { TEXT, COLORS } from '@/constants/theme';

export default function NewScreen() {
  return (
    <ScreenLayout title="Screen Title" subtitle="Optional subtitle">
      <Card>
        {/* Content */}
      </Card>
      <Button title="Action" variant="primary" onPress={handleAction} />
    </ScreenLayout>
  );
}
```

### 6. Seeker Compatibility

- Use `useWindowDimensions()` — never `Dimensions.get()`
- Use `useSafeAreaInsets()` — never hardcode status bar heights
- Minimum touch targets: 44×44pt
- Test bottom elements don't overlap the gesture bar

### 7. Tower View Overlay Pattern

For UI that overlays the 3D tower, use `COLORS.bgOverlay` for translucent backgrounds and `COLORS.textOnDark` for text, since the tower has its own dark atmospheric background.

### 8. Haptics

Every user-facing interaction should include tactile feedback. Use the named events from `utils/haptics.ts`:

```typescript
import { hapticButtonPress, hapticBlockClaimed, hapticError, hapticBlockDeselect } from '@/utils/haptics';

// Button taps
hapticButtonPress();      // Light impact
// Success moments
hapticBlockClaimed();     // Heavy success + notification
// Errors / denied actions
hapticError();            // Warning notification
```

See [`/docs/design/HAPTICS.md`](/docs/design/HAPTICS.md) for the full spec.

## Project Structure

```
apps/mobile/
├── app/               # Expo Router screens
│   ├── (tabs)/        # Tab screens (tower, board, me)
│   ├── connect.tsx    # Wallet connect modal
│   ├── deposit.tsx    # Deposit modal
│   └── withdraw.tsx   # Withdraw modal
├── components/
│   ├── ui/            # ← REUSABLE COMPONENTS (always use these)
│   │   ├── index.ts   # Barrel export
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── ChargeBar.tsx
│   │   ├── BottomPanel.tsx
│   │   ├── Input.tsx
│   │   ├── Chip.tsx
│   │   └── ScreenLayout.tsx
│   └── tower/         # Tower-specific 3D components (R3F)
├── constants/
│   ├── theme.ts       # ← DESIGN TOKENS (always import from here)
│   └── config.ts      # App configuration
├── hooks/             # Custom React hooks
├── services/          # API / blockchain services
├── stores/            # Zustand stores
└── utils/
    └── haptics.ts     # ← HAPTIC EVENTS (always use named functions)
```

## Self-Check Before Committing

Before finishing any UI work, verify:
1. `grep -rn '#[0-9a-fA-F]\{6\}' apps/mobile/app/ apps/mobile/components/` — no hardcoded hex
2. `grep -rn 'Dimensions.get' apps/mobile/app/ apps/mobile/components/` — use `useWindowDimensions` instead
3. Every `TouchableOpacity` that acts like a button should be `<Button>` or have haptics
4. Every text element uses `TEXT.*` or `FONT_FAMILY.*` — not raw font names

