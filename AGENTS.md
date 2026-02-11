# AGENTS.md — Developer Notes & Lessons Learned

## Recent Lessons Learned

- **2026-02-10**: pnpm's default symlinked `node_modules` layout creates deeply nested `.pnpm` paths that exceed Windows' 250-char `CMAKE_OBJECT_PATH_MAX`. Fix: add `node-linker=hoisted` and `shamefully-hoist=true` to `.npmrc`. This is also recommended by Expo for monorepo setups.

- **2026-02-10**: Expo Go cannot run native modules like MWA (Mobile Wallet Adapter). You MUST use a development build (`expo-dev-client`) for any Solana Mobile features. The `expo-dev-client` package must be both installed AND listed in `app.json` plugins.

- **2026-02-10**: The Solana Mobile MWA protocol works via Android intents (`solana-wallet://`). The dApp never touches private keys — it dispatches an intent, the wallet app signs, and returns the signed transaction. Seed Vault is wallet-level security, not something dApps integrate directly.

- **2026-02-10**: For Anchor integration on mobile, you need a custom wallet adapter that wraps MWA's `transact()` function. The adapter must implement `signTransaction`, `signAllTransactions`, and expose a `publicKey` getter. See `docs/SOLANA_MOBILE.md` for the exact pattern.

- **2026-02-10**: Auth token caching is critical for MWA UX. Without it, users must re-authorize with their wallet on every interaction. Use `expo-secure-store` (encrypted) instead of `AsyncStorage` for storing `auth_token` and `base64Address`.

- **2026-02-10**: `InstancedMesh` in R3F is the correct approach for rendering 1000+ blocks — it reduces draw calls from 1000 to 1, achieving 60 FPS vs ~5 FPS with individual meshes.

- **2026-02-10**: When using `adb exec-out screencap -p > file.png` in PowerShell, the `>` operator outputs in UTF-16LE encoding, corrupting the binary PNG. Use `adb shell screencap -p /sdcard/screen.png; adb pull /sdcard/screen.png output.png` instead.

- **2026-02-10**: `gh repo create --push` requires at least one commit to exist before it can push. Always `git commit` first, then create the repo with `--push`.
