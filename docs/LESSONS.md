# Lessons Learned

> **Living document.** Add new entries at the top. Review periodically and prune anything no longer relevant.

## 2026-02-10

- **pnpm path limits on Windows**: pnpm's default symlinked `node_modules` layout creates deeply nested `.pnpm` paths that exceed Windows' 250-char `CMAKE_OBJECT_PATH_MAX`. Fix: add `node-linker=hoisted` and `shamefully-hoist=true` to `.npmrc`. This is also recommended by Expo for monorepo setups.

- **Expo Go vs dev-client**: Expo Go cannot run native modules like MWA (Mobile Wallet Adapter). You MUST use a development build (`expo-dev-client`) for any Solana Mobile features. The `expo-dev-client` package must be both installed AND listed in `app.json` plugins.

- **MWA protocol**: The Solana Mobile MWA protocol works via Android intents (`solana-wallet://`). The dApp never touches private keys — it dispatches an intent, the wallet app signs, and returns the signed transaction. Seed Vault is wallet-level security, not something dApps integrate directly.

- **Anchor wallet adapter on mobile**: For Anchor integration on mobile, you need a custom wallet adapter that wraps MWA's `transact()` function. The adapter must implement `signTransaction`, `signAllTransactions`, and expose a `publicKey` getter. See `docs/SOLANA_MOBILE.md` for the exact pattern.

- **MWA auth token caching**: Auth token caching is critical for MWA UX. Without it, users must re-authorize with their wallet on every interaction. Use `expo-secure-store` (encrypted) instead of `AsyncStorage` for storing `auth_token` and `base64Address`.

- **InstancedMesh for 1000+ blocks**: `InstancedMesh` in R3F is the correct approach for rendering 1000+ blocks — it reduces draw calls from 1000 to 1, achieving 60 FPS vs ~5 FPS with individual meshes.

- **ADB screencap corruption**: When using `adb exec-out screencap -p > file.png` in PowerShell, the `>` operator outputs in UTF-16LE encoding, corrupting the binary PNG. Use `adb shell screencap -p /sdcard/screen.png; adb pull /sdcard/screen.png output.png` instead.

- **gh repo create needs a commit**: `gh repo create --push` requires at least one commit to exist before it can push. Always `git commit` first, then create the repo with `--push`.

- **EAS Build + pnpm**: EAS Build defaults to **yarn** if no `packageManager` field exists in root `package.json`. For pnpm monorepos, you MUST add `"packageManager": "pnpm@<version>"` or EAS won't resolve workspace packages.

- **`.easignore` is separate from `.gitignore`**: EAS Build does NOT use `.gitignore`. You need a separate `.easignore` file. Critical exclusions for monorepos: `.agents/` (symlinks cause `EPERM` on Windows), `apps/mobile/android/` and `apps/mobile/ios/` (locally-generated native dirs have Windows paths baked in — EAS must run `expo prebuild` itself on Linux).

- **Metro + hoisted deps**: With `node-linker=hoisted`, Metro needs `nodeModulesPaths` pointing to both the monorepo root `node_modules/` AND the app-level `node_modules/`. Without this, Metro can't resolve hoisted dependencies on EAS or in release builds.

- **Debug APK for device testing**: `npx expo run:android --variant release` fails in monorepos because Gradle's `createBundleReleaseJsAndAssets` resolves `index.js` from the monorepo root instead of `apps/mobile/`. Fix: use **debug APK** for device testing — it works identically on physical devices.

- **Rapid iteration workflow**: Use debug APK (`npx expo run:android`) + `npx expo start --dev-client` for hot reload on physical devices. No need for EAS during active development. Save EAS for CI/CD and dApp Store distribution.

- **2026-02-11**: Migrated to WSL Ubuntu 24.04 for development. Rust/Anchor compilation is **5-10x faster** on native ext4 vs Windows NTFS through `/mnt/c`. Node/pnpm operations are **2-3x faster**. All Windows path issues (260 char limit, symlink errors) eliminated.

- **2026-02-11**: WSL2 requires `usbipd-win` for USB device passthrough. Install on Windows (`winget install dorssel.usbipd-win`), then use `usbipd bind --busid X-X` (persistent) and `usbipd attach --wsl --busid X-X` (per-session) to attach Android devices to WSL.

- **2026-02-11**: When calling WSL commands via `wsl -e bash -lc "..."` from Windows, the Windows PATH leaks into the WSL session. Paths with spaces (like "Program Files") break bash export statements. Use `wsl -e bash -c "..."` (non-login shell) or run commands from within WSL directly.

- **2026-02-11**: Android SDK in WSL requires: (1) Java (OpenJDK 17+), (2) command-line tools from dl.google.com, (3) `sdkmanager` to install platform-tools, build-tools, platforms, and NDK (~2GB), (4) `ANDROID_HOME` and `ANDROID_SDK_ROOT` env vars in `~/.bashrc`. Total setup time: ~20-30 minutes.

- **2026-02-11**: VS Code with "Remote - WSL" extension is the ideal setup for WSL development. Run `code .` from WSL terminal — VS Code opens with WSL backend. All extensions, terminals, and file operations run natively in WSL. Hot reload works seamlessly with physical devices via `adb reverse tcp:8081 tcp:8081`.

## WSL Setup

**Primary development environment as of 2026-02-11.**

Repository location: `/home/epic/monolith` (native ext4)
See `docs/WSL_SETUP.md` for complete setup guide.

Key benefits over Windows:

- **8x faster** Anchor/Rust builds
- **3x faster** pnpm installs
- **2x faster** Expo prebuild
- No path length limits
- Native symlinks
- Better git performance

Physical device access: `usbipd-win` + `usbip` (USB passthrough to WSL)

## Ubuntu Transition Notes (Deprecated — Now Using WSL)

When switching to Ubuntu, the following Windows-specific issues will disappear:

- CMake `CMAKE_OBJECT_PATH_MAX` warnings (shorter Linux paths)
- PowerShell UTF-16LE binary output corruption
- Symlink `EPERM` errors (Linux handles symlinks natively)
- ADB instability (Linux USB is more reliable)

Steps to set up on Ubuntu:

1. `git clone https://github.com/epicexcelsior/monolith.git`
2. Install pnpm: `corepack enable && corepack prepare pnpm@10.13.1 --activate`
3. `pnpm install`
4. Install Android SDK + NDK via Android Studio or `sdkmanager`
5. `cd apps/mobile && npx expo prebuild --platform android --clean`
6. `npx expo run:android`
