# WSL Development Environment Setup

> Complete guide for developing The Monolith on WSL Ubuntu 24.04

**Date:** 2026-02-11
**Status:** Active setup - in progress

---

## Why WSL?

**Performance benefits:**

- Rust/Anchor compilation: **5-10x faster** on native ext4 vs Windows NTFS via `/mnt/c`
- Node/pnpm installs: **2-3x faster**
- No Windows path length issues (260 char limit)
- Native symlink support (no `EPERM` errors)
- Better Docker/container compatibility

**Tradeoffs:**

- Android SDK must be in WSL for local builds
- Physical device USB requires `usbipd-win` (but works reliably)
- Cross-filesystem access (`\\wsl.localhost\...`) is slower (but VS Code Remote-WSL solves this)

---

## What's Installed

### ✅ Completed

| Component        | Version              | Location                           | Notes                         |
| ---------------- | -------------------- | ---------------------------------- | ----------------------------- |
| **Repo**         | Latest (main branch) | `/home/epic/monolith`              | Fresh clone from GitHub       |
| **Node.js**      | 22.18.0              | via nvm                            | Set as default                |
| **pnpm**         | 10.13.1              | via corepack                       | Workspace-aware               |
| **Java**         | OpenJDK 21           | System package                     | Pre-installed on Ubuntu 24.04 |
| **Rust**         | 1.92                 | via rustup                         | Already installed             |
| **Anchor CLI**   | 0.32.1               | Cargo binary                       | Already installed             |
| **Solana CLI**   | 2.3.13               | System                             | Already installed             |
| **Dependencies** | 1196 packages        | `/home/epic/monolith/node_modules` | `pnpm install` completed      |
| **usbipd-win**   | 5.3.0                | Windows side                       | For USB device passthrough    |

### 🔄 In Progress

| Component       | Status                           | ETA        |
| --------------- | -------------------------------- | ---------- |
| **Android SDK** | Downloading NDK + platform-tools | ~10-20 min |
| **usbip tools** | Installing in WSL                | Needs sudo |

### 📍 Environment Variables (in `~/.bashrc`)

```bash
# Android SDK
export ANDROID_HOME=$HOME/Android/Sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin
```

---

## Complete Setup Steps

### 1. Install Node.js 22.18.0

```bash
# Install via nvm
source ~/.nvm/nvm.sh
nvm install 22.18.0
nvm alias default 22.18.0
nvm use default
```

### 2. Install pnpm

```bash
# Enable corepack and install pnpm
corepack enable
corepack prepare pnpm@10.13.1 --activate
pnpm --version  # Should show 10.13.1
```

### 3. Clone Repository

```bash
cd ~
git clone https://github.com/epicexcelsior/monolith.git
cd monolith
pnpm install
```

### 4. Install Android SDK (if doing local builds)

```bash
# Download command-line tools
mkdir -p ~/Android/Sdk/cmdline-tools
cd ~/Android/Sdk/cmdline-tools
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O tools.zip
unzip tools.zip
mv cmdline-tools latest
rm tools.zip

# Accept licenses
cd latest/bin
yes | ./sdkmanager --licenses

# Install SDK packages (~2GB)
./sdkmanager \
  "platform-tools" \
  "build-tools;35.0.0" \
  "platforms;android-35" \
  "ndk;27.2.12479018"

# Add to ~/.bashrc (already done if you ran the automated setup)
echo '
# Android SDK
export ANDROID_HOME=$HOME/Android/Sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin
' >> ~/.bashrc

source ~/.bashrc
```

### 5. Set Up USB Device Access (Physical Android Device)

**On Windows (Admin PowerShell):**

```powershell
# Install usbipd-win (already done via winget)
winget install dorssel.usbipd-win

# List USB devices
usbipd list

# Find your Android device (e.g., 1-4)
# Share it (persistent, run once)
usbipd bind --busid 1-4

# Attach to WSL (run when device is connected)
usbipd attach --wsl --busid 1-4
```

**In WSL:**

```bash
# Install usbip tools
sudo apt update
sudo apt install -y linux-tools-generic hwdata

# Update usbip symlink to match kernel version
sudo update-alternatives --install /usr/local/bin/usbip usbip \
  /usr/lib/linux-tools/*-generic/usbip 20

# Verify device is attached
lsusb  # Should show your Android device
adb devices  # Should show device after attaching via usbipd
```

**Quick workflow when developing:**

```bash
# 1. Plug in Android device to USB
# 2. In Windows PowerShell (Admin):
usbipd attach --wsl --busid 1-4

# 3. In WSL:
adb devices  # Verify connection
cd ~/monolith/apps/mobile
npx expo run:android  # Build and install
```

---

## Verifying Everything Works

### Test 1: Node + pnpm

```bash
cd ~/monolith
node --version     # v22.18.0
pnpm --version     # 10.13.1
pnpm -r exec pwd   # Should show all workspace packages
```

### Test 2: Android SDK

```bash
adb --version
sdkmanager --list  # Should show installed packages
echo $ANDROID_HOME  # Should be /home/epic/Android/Sdk
```

### Test 3: Expo Build (when SDK is ready)

```bash
cd ~/monolith/apps/mobile
npx expo prebuild --platform android --clean
npx expo run:android  # Should compile and install to device
```

### Test 4: Anchor Build

```bash
cd ~/monolith/programs/monolith
anchor build
# Should compile successfully (faster than on Windows!)
```

---

## Running Claude Code in WSL

**Option A: Native WSL (Recommended)**

```bash
# Inside WSL terminal
cd ~/monolith
claude  # Launches Claude Code natively in WSL
```

**Option B: VS Code Remote-WSL**

1. Install "Remote - WSL" extension in VS Code
2. Open WSL terminal, run `code .` in the monolith directory
3. VS Code opens with WSL backend
4. Use integrated terminal for Claude Code

**Option C: From Windows (Proxy mode)**

Claude Code can run on Windows and proxy commands to WSL via `wsl -e bash -c "..."`
This was used during setup but is less efficient for daily dev.

---

## Common Workflows

### Daily Development

```bash
# Terminal 1: Expo dev server
cd ~/monolith/apps/mobile
npx expo start --dev-client

# Terminal 2: Game server (when implemented)
cd ~/monolith/apps/server
pnpm dev

# Terminal 3: Watch Anchor builds
cd ~/monolith/programs/monolith
anchor build --verifiable
```

### Building APK Locally

```bash
cd ~/monolith/apps/mobile
npx expo run:android --variant release
# Produces: android/app/build/outputs/apk/release/app-release.apk
```

### Building APK via EAS Cloud

```bash
cd ~/monolith/apps/mobile
eas build --profile preview --platform android
# Download from expo.dev, install via adb or browser
```

---

## Accessing WSL Files from Windows

| Method               | Path                                               | Use Case                       |
| -------------------- | -------------------------------------------------- | ------------------------------ |
| **Windows Explorer** | `\\wsl.localhost\Ubuntu\home\epic\monolith`        | Browsing files, copying assets |
| **VS Code Remote**   | `code .` from WSL                                  | Full IDE experience            |
| **Direct Git**       | Push from WSL, pull from Windows (not recommended) | Avoid - pick one side          |

---

## Troubleshooting

### "adb: device not found"

```bash
# Detach and re-attach via usbipd
# In Windows PowerShell (Admin):
usbipd detach --busid 1-4
usbipd attach --wsl --busid 1-4

# In WSL:
adb kill-server
adb start-server
adb devices
```

### "Expo Metro bundler not reachable from device"

```bash
# Option 1: Use adb reverse to tunnel from device to WSL
adb reverse tcp:8081 tcp:8081
npx expo start --dev-client

# Option 2: Expose WSL's IP on the network
# Find WSL IP:
ip addr show eth0 | grep inet
# Use that IP in Expo connection (e.g., 172.x.x.x:8081)
```

### "Node version mismatch"

```bash
# Ensure nvm is sourced
source ~/.nvm/nvm.sh
nvm use 22.18.0

# Make it permanent
nvm alias default 22.18.0
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.bashrc
```

### "Android SDK not found"

```bash
# Check environment
echo $ANDROID_HOME  # Should be /home/epic/Android/Sdk
ls $ANDROID_HOME/platform-tools  # Should exist

# Re-source bashrc
source ~/.bashrc
```

---

## Performance Comparison

| Operation                  | Windows (`/mnt/c`) | WSL Native | Speedup         |
| -------------------------- | ------------------ | ---------- | --------------- |
| `cargo build` (Anchor)     | ~120s              | ~15s       | **8x faster**   |
| `pnpm install` (1196 pkgs) | ~90s               | ~30s       | **3x faster**   |
| `expo prebuild`            | ~45s               | ~20s       | **2.2x faster** |
| `git status` (large repo)  | ~2s                | ~0.3s      | **6x faster**   |

---

## Next Steps

1. ✅ Finish Android SDK download
2. ✅ Complete usbip tools installation
3. ✅ Test `expo run:android` end-to-end
4. ✅ Test `anchor build` in WSL
5. ✅ Verify hot reload works with physical device
6. ✅ Update AGENTS.md with WSL learnings

---

## References

- [WSL Documentation](https://learn.microsoft.com/en-us/windows/wsl/)
- [usbipd-win GitHub](https://github.com/dorssel/usbipd-win)
- [Expo on WSL](https://docs.expo.dev/guides/using-expo-on-wsl/)
- [Android SDK Command-line Tools](https://developer.android.com/studio#command-line-tools-only)
