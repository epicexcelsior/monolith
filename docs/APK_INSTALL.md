# Installing the APK on a Physical Device

## From EAS Cloud Build

1. **Build** (already running):

   ```bash
   cd apps/mobile
   eas build --profile preview --platform android
   ```

2. **Download**: Once build completes (~10 min), download the `.apk` from the
   link printed in terminal, or from [expo.dev/accounts](https://expo.dev/accounts)
   → your project → Builds.

3. **Transfer to Seeker** (choose one):

   | Method       | Steps                                                      |
   | ------------ | ---------------------------------------------------------- |
   | **USB**      | Connect Seeker via USB → `adb install path/to/app.apk`     |
   | **Browser**  | Open the EAS download URL directly on the Seeker's browser |
   | **QR Code**  | Scan the QR code from expo.dev on the Seeker               |
   | **ADB WiFi** | `adb connect <seeker-ip>:5555` → `adb install app.apk`     |

4. **Run**: Open "The Monolith" app → it connects to your dev server automatically.
   If running the dev server locally, ensure Seeker is on the same network and
   update the bundler URL.

## From Local Build

```bash
cd apps/mobile
npx expo run:android    # builds + installs on connected device
```

For a connected Seeker, ensure USB debugging is enabled:
**Settings → Developer Options → USB Debugging → ON**

> **Tip**: If `adb devices` shows the Seeker, `expo run:android` will install directly.

## Development Build vs Preview Build

| Profile       | Purpose                            | Hot Reload? |
| ------------- | ---------------------------------- | ----------- |
| `development` | Dev client with bundler connection | ✅ Yes      |
| `preview`     | Standalone APK for testing         | ❌ No       |

For hardware testing of `expo-gl`, the **preview** build is sufficient.
For active development, use the **development** build + `npx expo start --dev-client`.
