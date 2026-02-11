# Installing the APK on a Physical Device

## Recommended: Debug APK (fastest pipeline)

```bash
# 1. Connect device via USB (USB debugging ON)
adb devices                          # verify device shows up

# 2. Build + install in one command (~3-5 min first time, cached after)
cd apps/mobile
npx expo run:android                 # builds debug APK + installs on device

# 3. For subsequent code changes — instant hot reload:
npx expo start --dev-client          # device auto-connects, changes appear instantly
```

**Debug APK location**: `android/app/build/outputs/apk/debug/app-debug.apk`

### Manual install (if device wasn't connected during build)

```bash
adb install apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

### If native deps change (new packages with native modules)

```bash
npx expo prebuild --platform android --clean
npx expo run:android
```

## Alternative: EAS Cloud Build (for distribution)

```bash
cd apps/mobile
eas build --profile preview --platform android
```

Download APK from expo.dev → install via browser on device or `adb install`.

> **Note**: EAS requires `packageManager` in root `package.json` and `.easignore`
> excluding `android/`, `ios/`, and `.agents/`. See `AGENTS.md` for details.

## Build Profiles

| Profile            | Purpose              | Hot Reload? | Use When              |
| ------------------ | -------------------- | ----------- | --------------------- |
| `debug` (local)    | Dev client + bundler | ✅ Yes      | Active development    |
| `preview` (EAS)    | Standalone APK       | ❌ No       | Sharing with testers  |
| `production` (EAS) | Store-ready AAB      | ❌ No       | dApp Store submission |
