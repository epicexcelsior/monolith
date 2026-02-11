---
description: Build and install the mobile app on a device or emulator
---

# Build Mobile App

// turbo-all

## Debug Build (recommended for development)

1. Ensure a device or emulator is connected:

```bash
adb devices
```

2. If no device is connected, start the emulator:

```bash
emulator -avd Medium_Phone_API_36.0 &
```

3. Build and install the debug APK:

```bash
cd apps/mobile
npx expo run:android
```

4. For subsequent code changes, use hot reload (no rebuild needed):

```bash
cd apps/mobile
npx expo start --dev-client
```

## Fresh Native Rebuild (after adding native dependencies)

1. Clean and regenerate the native project:

```bash
cd apps/mobile
npx expo prebuild --platform android --clean
```

2. Build and install:

```bash
npx expo run:android
```

## Install Existing APK on Physical Device

1. Connect device via USB (USB debugging must be enabled)
2. Install:

```bash
adb install apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```
