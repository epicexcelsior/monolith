---
description: Verify UI code follows the Monolith solarpunk design system conventions
---

# UI Standards Check

Run this workflow after making UI changes to verify compliance with the design system.

**Important:** All commands use the repo root as CWD. If you're in a subdirectory, `cd` to the repo root first.

## 1. No hardcoded hex colors
// turbo
```bash
cd /home/epic/Downloads/monolith && grep -rn '#[0-9a-fA-F]\{6\}' apps/mobile/app/ apps/mobile/components/ --include='*.tsx' --include='*.ts' | grep -v 'node_modules' | grep -v 'theme.ts' | grep -v '.d.ts'
```
If any results appear, replace them with imports from `@/constants/theme` (COLORS, SPACING, etc.).

## 2. No Dimensions.get()
// turbo
```bash
cd /home/epic/Downloads/monolith && grep -rn 'Dimensions.get' apps/mobile/app/ apps/mobile/components/ --include='*.tsx' --include='*.ts'
```
Replace with `useWindowDimensions()` from `react-native`.

## 3. Component library usage
// turbo
```bash
cd /home/epic/Downloads/monolith && grep -rn 'TouchableOpacity' apps/mobile/app/ --include='*.tsx' | grep -v 'node_modules'
```
Any `TouchableOpacity` used as a button should be replaced with `<Button>` from `@/components/ui`.
Quick actions and tab selectors within cards are acceptable as `TouchableOpacity`.

## 4. Font family check
// turbo
```bash
cd /home/epic/Downloads/monolith && grep -rn "fontFamily:" apps/mobile/app/ apps/mobile/components/ --include='*.tsx' --include='*.ts' | grep -v 'FONT_FAMILY\.' | grep -v 'node_modules'
```
All fontFamily values must reference `FONT_FAMILY.*` constants from theme.

## 5. TypeScript compilation
// turbo
```bash
cd /home/epic/Downloads/monolith && timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json 2>&1 | head -30
```
Must compile without errors.
