# Lessons Learned

> **Living document.** Add new entries at the top. Review periodically and prune anything no longer relevant.

## 2026-02-18

- **Workflow improvement — Shader validation checklist**: After multiple coordinate space bugs during interior mapping implementation, added comprehensive shader validation to `/wrapup` workflow. Checklist covers: varying coordinate space labels, UV computation consistency, uniform updates, attribute counts, `needsUpdate` flags, debug color removal, LOD checks, and transparency pitfalls. Created `react-native-three` skill (`~/.agents/skills/react-native-three/`) with texture loading patterns and shader debugging references.

- **React Native texture loading — DataTexture workaround**: THREE.TextureLoader fails in React Native (no DOM Image). expo-three's `loadAsync` unreliable on device. **Solution**: Pre-encode atlas as base64 RGBA bytes (1.4MB string) → `THREE.DataTexture`. Bypasses all image loading. Include manual base64 decoder as fallback if `atob()` unavailable. Works 100% reliably.

- **Shader coordinate space confusion — local vs world**: When computing per-face UVs for all sides of a cube, using `vWorldNormal` (world-space, after rotation) to decide how to read `vLocalPos` (local-space, before rotation) causes mismatch after instance rotation. **Solution**: Compute face UVs in vertex shader using raw `normal` (local-space), before any transforms. Each face uses correct tangent axes (X-face: local Z,Y; Z-face: local X,Y).

- **Interior mapping for 3D depth illusion**: To make flat images feel 3D, cast ray from camera through fragment into a virtual room. Ray hits "back wall" at depth 0.55, creating parallax that shifts with camera movement. Apply on all 4 vertical faces (skip top/bottom). Adds depth darkening, window frame mask, scanlines, chromatic aberration for sci-fi feel.

- **Highlight visibility on image blocks**: Standard emissive highlight (additive glow + brightness multiply) washes out images on selected blocks. **Solution**: Branch by `vImageIndex` — image blocks get rim-only highlight (no flat emissive), non-image blocks get full highlight. Keeps images readable while still showing selection feedback.

- **Block pop-out direction for rectangular tower**: Using `mat3(instanceMatrix) * vec3(0,0,1)` (local +Z) for pop-out fails on corner blocks of rectangular tower — they push toward +Z instead of diagonally outward. **Solution**: Radial direction from tower center in XZ plane (`normalize(vec3(worldPos.x, 0, worldPos.z))`). Works correctly for all faces including corners.

## 2026-02-16

- **3D camera gesture design — avoid mode ambiguity**: Initial approach used single-finger behavior that changed based on zoom level (orbit at overview, vertical pan when zoomed in). This felt confusing — users couldn't predict what a gesture would do. **Solution**: Clear, mode-free gesture model — 1 finger always orbits, 2 fingers always pinch+pan. LayerIndicator scrubber handles precision vertical navigation. Predictability > fewest gestures.

- **Camera clipping issues in R3F**: ZOOM_MIN=6 caused blocks to disappear when camera got close because the tower extends ~7 units from center. At low elevation angles, horizontal distance shrinks (`r × sin(φ)`), letting camera clip inside geometry. **Fixes**: (1) ZOOM_MIN=12 keeps camera outside tower, (2) ELEVATION_MIN=0.3 prevents near-horizontal views, (3) Dynamic near plane `max(0.1, zoom * 0.03)` tightens frustum when zoomed in, (4) Camera Y floor at 0.5 prevents underground views.

- **Azimuth unwinding problem**: Azimuth grows unboundedly by design (to avoid wrap jumps during continuous drag), but resetting to a fixed `OVERVIEW_AZIMUTH` caused the camera to visually unwind multiple full rotations. **Solution**: `nearestAzimuth(current, target)` normalizes target to be within ±PI of current azimuth — always takes the shortest rotational path. Apply to all programmatic azimuth changes (reset, fly-to-block).

- **React Native PanResponder touch coordinate issues**: `locationY` (component-relative) is unreliable in PanResponder on Animated views — coordinate system shifts during animations. **Solution**: Use `pageY` (absolute screen coords) + `measureInWindow` to get container's absolute position once on layout. All touch math uses stable page coordinates.

- **Interactive UI stealing gestures from 3D scene**: LayerIndicator needed to prevent TowerScene's PanResponder from stealing touches mid-scrub. **Solution**: `onPanResponderTerminationRequest: () => false` in LayerIndicator's PanResponder — parent can't steal once child claims the gesture.

- **Camera angle psychology — "admire from outside"**: Initial camera elevations were too steep (looking down on the tower). Lower angles (overview: 0.45 rad/26°, inspect: 0.38 rad/22°) create a more dramatic, monumental feel that aligns with "tower is something you look AT, not live inside" design principle. Eye-level > bird's-eye for emotional impact.

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

## 2026-02-12: USDC Vault Rewrite

- **Anchor 0.31 SPL Token types**: Must use `InterfaceAccount<TokenAccount>`, `InterfaceAccount<Mint>`, and `Interface<TokenInterface>` — **not** plain `Account<TokenAccount>`. The old pattern causes silent IDL generation failures. Also add `idl-build` feature for `anchor-spl` in `Cargo.toml`.

- **`transfer_checked` required**: Anchor 0.31 best practice for SPL token ops. Requires passing the mint account and decimals to prevent amount/decimal mismatches.

- **ATA constraints**: All ATA accounts must include `associated_token::token_program = token_program` constraint. Anchor 0.31 requires this explicit constraint.

- **Program ID sync**: After `anchor build`, the deployed keypair in `target/deploy/` may differ from `declare_id!()`. Run `anchor keys sync` to update `lib.rs` and `Anchor.toml` automatically. Prevents `DeclaredProgramIdMismatch` errors.

- **Dynamic IDL TypeScript casts**: Anchor 0.31 TypeScript types don't expose account names from dynamically loaded IDLs. Use `(program.account as any).towerState` casts — works at runtime, just needs TS bypass.

- **Gitignore for Anchor workspace**: When Anchor workspace root is at monorepo root, `.gitignore` must cover `target/` and `.anchor/` at root level (not just `programs/monolith/`).

- **Expo Router typed routes**: New route files (e.g., `deposit.tsx`) cause TS errors until the generated type declarations regenerate. Use `pathname as any` cast or run `npx expo start` to regenerate types.

- **MWA transaction signing**: All signing happens inside `transact()` sessions. Always try `reauthorize()` first (with cached `authToken`), fall back to `authorize()`. Set fee payer from `authResult.accounts[0].address` (base64). Fetch `recentBlockhash` inside session, send raw tx after closing.

