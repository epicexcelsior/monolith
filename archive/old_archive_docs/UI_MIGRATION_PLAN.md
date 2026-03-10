# UI Migration Plan — Convert Existing Screens to Solarpunk Design System

> **Self-contained instructions for an AI agent.** Follow these steps in order to fully migrate the Monolith mobile app from the old cyberpunk theme to the new solarpunk design system.

---

## Prerequisites

Before starting the migration, install the Google Fonts packages and update the root layout.

### Step 0: Install Fonts

```bash
cd apps/mobile
npx expo install @expo-google-fonts/outfit @expo-google-fonts/inter @expo-google-fonts/jetbrains-mono expo-font
```

### Step 1: Update Root Layout (`app/_layout.tsx`)

Replace the entire file with this pattern:

```tsx
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useCallback } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_900Black,
} from "@expo-google-fonts/outfit";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import { useAuthorization } from "@/hooks/useAuthorization";
import { COLORS } from "@/constants/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { hydrateCachedAuth } = useAuthorization();

  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_900Black,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  const onLayoutReady = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    async function bootstrap() {
      try {
        await hydrateCachedAuth(true);
      } catch (err) {
        console.warn("Wallet hydration failed:", err);
      }
    }
    bootstrap();
  }, [hydrateCachedAuth]);

  useEffect(() => {
    onLayoutReady();
  }, [onLayoutReady]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.bg },
          animation: "fade",
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="connect"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="deposit"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="withdraw"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
});
```

Key changes:
- Loads all Google Fonts and holds splash until ready
- `StatusBar` changes from `"light"` to `"dark"` (light bg = dark text in status bar)
- `contentStyle` uses `COLORS.bg` instead of hardcoded `#0a0a0f`

---

## File-by-File Migration

### Priority: Critical — Do These First

---

### File 1: `app/(tabs)/_layout.tsx`

**Current state:** Tab bar uses cyberpunk colors (`#0d0d15` bg, `#00ffff` active, `#666680` inactive).

**Migration instructions:**

| What | Old | New |
|---|---|---|
| `tabBarStyle.backgroundColor` | `#0d0d15` | `COLORS.bgCard` |
| `tabBarStyle.borderTopColor` | `#1a1a2e` | `COLORS.border` |
| `tabBarActiveTintColor` | `#00ffff` | `COLORS.gold` |
| `tabBarInactiveTintColor` | `#666680` | `COLORS.textMuted` |
| `tabBarLabelStyle` | raw fontWeight | Add `fontFamily: FONT_FAMILY.bodySemibold` |

Update tab names and icons per GDD:
- Tab 1: `Tower` 🗼 (keep)
- Tab 2: Rename from `Vault` to `Board` 🏆 (leaderboard + stats)
- Tab 3: Rename from `Settings` to `Me` 👤 (profile, blocks, settings combined)

**Add import:** `import { COLORS, FONT_FAMILY } from "@/constants/theme";`

---

### File 2: `app/(tabs)/index.tsx` (Tower HUD)

**Current state:** 29 hardcoded hex values. Uses `Dimensions.get()`. Has persistent bottom Deposit/Withdraw buttons.

**Migration instructions:**

1. **Replace `Dimensions.get("window")`** with `useWindowDimensions()` from `react-native`
2. **Remove the bottom Deposit/Withdraw buttons** entirely (lines 114-136). Per GDD, interactions are contextual — users tap blocks to stake.
3. **Replace hint text** with a more informative prompt

Color mapping for remaining HUD elements:

| Element | Old | New |
|---|---|---|
| `container.backgroundColor` | `#0a0a0f` | `COLORS.bgTower` (tower scene keeps dark bg) |
| `title` color | `#00ffff` with textShadow | `COLORS.goldLight` with gold textShadow |
| `connectButton` bg/border | cyan rgba/`#00ffff` | gold rgba / `COLORS.gold` |
| `connectedButton` bg/border | green rgba/`#00ff64` | `COLORS.success` with success rgba |
| `connectText` color | `#00ffff` | `COLORS.gold` |
| `connectedText` color | `#00ff64` | `COLORS.success` |
| `statsBar.backgroundColor` | `rgba(13,13,21,0.85)` | `COLORS.bgOverlay` |
| `statsBar.borderColor` | `#1a1a2e` | `COLORS.border` |
| `statValue` color | `#ffffff` | `COLORS.textOnDark` |
| `statLabel` color | `#666680` | `COLORS.textMuted` |
| My Vault value color | hardcoded `#00ff64` | `COLORS.success` |
| Live indicator | `#00ff64` | `COLORS.success` |
| Hint text color | `#444466` | `COLORS.textMuted` |

**Add** typography from `TEXT` and `FONT_FAMILY`:
- Title → `FONT_FAMILY.headingBlack`, fontSize 18
- Stat values → `FONT_FAMILY.mono`
- Stat labels → `TEXT.overline`

> [!IMPORTANT]
> The Tower HUD overlays the 3D scene, which stays dark. Use `COLORS.textOnDark` and semi-transparent `COLORS.bgOverlay` for HUD elements — NOT the light cream theme colors.

---

### File 3: `app/(tabs)/blocks.tsx` (Vault Screen)

**Current state:** 30+ hardcoded hex values. Rebuild entirely using the component library.

**Migration instructions:**

Replace with this structure using reusable components:

```tsx
import { ScreenLayout, Card, Button } from "@/components/ui";
import { TEXT, COLORS, FONT_FAMILY } from "@/constants/theme";
```

1. **Wrap with `<ScreenLayout>`** instead of raw `<ScrollView>` — this gives you safe area, title, pull-to-refresh
2. **Replace balance card** with `<Card variant="accent">` containing the vault amount
3. **Replace Deposit/Withdraw buttons** with `<Button variant="primary">` and `<Button variant="secondary">`
4. **Replace detail cards** with `<Card>` containing themed rows
5. **Use `TEXT.mono`** for all USDC amounts and addresses
6. **Use `TEXT.overline`** for section labels ("VAULT BALANCE", "DETAILS", etc.)

Color mapping:

| Element | Old | New |
|---|---|---|
| `container.backgroundColor` | `#0a0a0f` | Handled by `ScreenLayout` → `COLORS.bg` |
| Balance card bg | `rgba(0,255,255,0.06)` | Use `<Card variant="accent">` |
| Balance card border | `rgba(0,255,255,0.15)` | Handled by Card |
| Balance label/text | `#666680` / `#ffffff` | `TEXT.overline` / `TEXT.displaySm` |
| Balance suffix | `#00ffff` | `COLORS.gold` |
| Deposit button | `#00ffff` bg | `<Button variant="primary">` |
| Withdraw button | `#ff9500` outline | `<Button variant="secondary">` |
| Detail card bg | `rgba(255,255,255,0.03)` | `<Card variant="muted">` |
| Detail labels | `#888899` | `TEXT.bodySm` (uses `COLORS.textSecondary`) |
| Detail values | `#ccccdd` | `TEXT.mono` |
| Dividers | `rgba(255,255,255,0.05)` | Add `borderBottomWidth: 1, borderBottomColor: COLORS.border` |

**Not-connected state:** Use `ScreenLayout` + `Card` + `Button` instead of raw `View`/`TouchableOpacity`.

---

### File 4: `app/connect.tsx`

**Current state:** 15+ hardcoded hex values. 

**Migration instructions:**

Replace using component library:

```tsx
import { Button, Card } from "@/components/ui";
import { TEXT, COLORS } from "@/constants/theme";
```

| Element | Old | New |
|---|---|---|
| `container.backgroundColor` | `#0a0a0f` | `COLORS.bg` |
| Title | `#ffffff`, raw fontWeight | `TEXT.displaySm` |
| Subtitle | `#888899` | `TEXT.bodySm` |
| Address text | `#00ffff`, monospace | `TEXT.mono` + `color: COLORS.gold` |
| Primary button | raw `TouchableOpacity` + `#00ffff` bg | `<Button variant="primary" title="Connect with MWA" />` |
| Error container | raw `View` + rgba red | `<Card variant="muted">` with `COLORS.error` text |
| Wallet info box | raw `View` + cyan rgba | `<Card variant="accent">` |
| Cancel button | raw `TouchableOpacity` | `<Button variant="ghost" title="Cancel" />` |
| Hint text | `#555566` | `TEXT.caption` |

---

### File 5: `app/deposit.tsx`

**Current state:** 40+ hardcoded hex values, raw `TextInput`, raw `TouchableOpacity` quick buttons.

**Migration instructions:**

```tsx
import { Button, Card, Input, Chip } from "@/components/ui";
import { TEXT, COLORS } from "@/constants/theme";
```

| Element | Replace With |
|---|---|
| Container bg `#0a0a0f` | `COLORS.bg` |
| Title/subtitle | `TEXT.displaySm` / `TEXT.bodySm` |
| Balance row (green-tinted) | `<Card variant="accent">` with `COLORS.success` text |
| Amount input (raw TextInput) | `<Input label="DEPOSIT AMOUNT" prefix="$" suffix="USDC" />` |
| Quick amount buttons | `<Chip label="$0.10" selected={...} onPress={...} />` for each |
| Summary card | `<Card variant="muted">` with `TEXT.bodySm` labels and `TEXT.mono` values |
| Error box | `<Card variant="muted">` with `COLORS.error` icon + text |
| Primary button | `<Button variant="primary" title="Deposit X USDC" loading={isLoading} />` |
| Cancel button | `<Button variant="ghost" title="Cancel" />` |
| Success state | Use `<Card variant="accent">` for the tx link |

---

### File 6: `app/withdraw.tsx`

**Current state:** 40+ hardcoded hex values. Nearly identical structure to `deposit.tsx`.

**Migration instructions:** Follow the exact same pattern as deposit.tsx, with these differences:

| Element | Change |
|---|---|
| Withdraw button | `<Button variant="primary" title="Withdraw X USDC" />` (same gold, not orange) |
| Quick amounts | `<Chip>` with percentage labels (`25%`, `50%`, `MAX`) |
| Balance card | `<Card variant="accent">` showing vault balance |
| Input label | `"WITHDRAW AMOUNT"` |

---

### File 7: `app/(tabs)/settings.tsx`

**Current state:** 20+ hardcoded hex values.

**Migration instructions:**

```tsx
import { ScreenLayout, Card, Button, Badge } from "@/components/ui";
import { TEXT, COLORS } from "@/constants/theme";
```

| Element | Replace With |
|---|---|
| Container + scroll | `<ScreenLayout title="Settings">` |
| Section titles (`WALLET`, `NETWORK`, `ABOUT`) | `<Text style={TEXT.overline}>` |
| Info cards | `<Card>` with `TEXT.bodySm` labels and `TEXT.mono` / `TEXT.bodySm` values |
| Status dot | `<Badge variant="dot" label="Connected" color={COLORS.success} />` |
| Connect button | `<Button variant="secondary" title="Connect Wallet" />` |
| Disconnect button | `<Button variant="danger" title="Disconnect Wallet" />` |

---

### Priority: Second Pass — Tower Overlay Components

---

### File 8: `components/ui/BlockInspector.tsx`

**Current state:** Already partially migrated (uses `COLORS` from theme). Still uses `Dimensions.get()` and custom slide animation.

**Migration instructions:**

1. **Replace `Dimensions.get("window")`** with `useWindowDimensions()`
2. **Replace custom slide animation** with `<BottomPanel>` wrapper component:
   ```tsx
   import { BottomPanel, Badge, ChargeBar } from "@/components/ui";
   ```
3. **Replace state badge** with `<Badge label={state.toUpperCase()} color={stateColor(state)} />`
4. **Replace energy bar** with `<ChargeBar charge={energyPct} showLabel showPercentage />`
5. **Use `TEXT`** for all typography:
   - Block title → `TEXT.headingLg`
   - Labels → `TEXT.caption`
   - Values → `TEXT.mono`
6. **Replace close button `"rgba(255,255,255,0.1)"` bg** → `COLORS.bgMuted`

---

### File 9: `components/ui/LayerIndicator.tsx`

**Current state:** Already migrated to `COLORS.gold`. No further color changes needed.

**Migration instructions:**

1. **Replace `FONT_FAMILY.mono`** reference for any monospace text (check if it uses raw `fontFamily`)
2. **Replace `COLORS.textMuted`** usages — verify they map correctly
3. **Replace `Dimensions.get()` if used** → `useWindowDimensions()`

---

## Global Search-and-Replace Checklist

After migrating each file, verify NO hardcoded values remain:

```bash
# These should return 0 results in app/ and components/ (excluding theme.ts and tower/ 3D files)
grep -rn '#0a0a0f' apps/mobile/app/ apps/mobile/components/ui/
grep -rn '#00ffff' apps/mobile/app/ apps/mobile/components/ui/
grep -rn '#ff9500' apps/mobile/app/ apps/mobile/components/ui/
grep -rn '#666680' apps/mobile/app/ apps/mobile/components/ui/
grep -rn '#888899' apps/mobile/app/ apps/mobile/components/ui/
grep -rn '#1a1a2e' apps/mobile/app/ apps/mobile/components/ui/
grep -rn '#0d0d15' apps/mobile/app/ apps/mobile/components/ui/
grep -rn 'Dimensions.get' apps/mobile/app/ apps/mobile/components/ui/
```

> [!NOTE]
> The `components/tower/` directory (R3F 3D components) is exempt — it uses its own rendering pipeline.

---

## Verification

After all files are migrated:

1. **TypeScript check:**
   ```bash
   cd apps/mobile && timeout 60 npx tsc --noEmit --skipLibCheck 2>&1; echo "EXIT=$?"
   ```
   Must exit with code 0.

2. **Build and run:**
   ```bash
   npx expo start
   ```
   Open on Android/Seeker emulator and verify:
   - All screens render with warm cream backgrounds (not black)
   - Gold accent color appears on all buttons and highlights
   - Tab bar uses gold active tint
   - Fonts render correctly (Outfit headings, Inter body, JetBrains Mono for data)
   - Tower scene still renders with dark background (only the HUD overlay changed)
   - Bottom safe area is respected (no overlap with gesture bar)
   - Pull-to-refresh uses gold spinner on ScreenLayout screens

3. **No regressions:** All buttons navigate correctly, modals open/close, wallet connect/deposit/withdraw flows work.

---

## Migration Order

For maximum safety, migrate in this order (each can be committed independently):

1. `app/_layout.tsx` + `app/(tabs)/_layout.tsx` (root + tab bar — establishes the theme app-wide)
2. `app/(tabs)/settings.tsx` (simplest screen, good first test)
3. `app/connect.tsx` (small modal)
4. `app/deposit.tsx` + `app/withdraw.tsx` (similar structure, do together)
5. `app/(tabs)/blocks.tsx` (medium complexity — Vault screen)
6. `app/(tabs)/index.tsx` (Tower HUD — most careful, don't break 3D)
7. `components/ui/BlockInspector.tsx` (switch to BottomPanel + ChargeBar)

---

## Reference Files

- **Design system spec:** [`docs/design/UI_SYSTEM.md`](file:///home/epic/Downloads/monolith/docs/design/UI_SYSTEM.md)
- **Theme tokens:** [`constants/theme.ts`](file:///home/epic/Downloads/monolith/apps/mobile/constants/theme.ts)
- **Component library:** [`components/ui/index.ts`](file:///home/epic/Downloads/monolith/apps/mobile/components/ui/index.ts)
- **Agent conventions:** [`AGENTS.md`](file:///home/epic/Downloads/monolith/apps/mobile/AGENTS.md)
- **Game design (for naming/features):** [`docs/game-design/GDD.md`](file:///home/epic/Downloads/monolith/docs/game-design/GDD.md)
