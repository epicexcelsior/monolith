#!/usr/bin/env bash
# =============================================================================
# emulator.sh — Start the Monolith test emulator
#
# Usage:
#   ./emulator.sh           # Start emulator (background)
#   ./emulator.sh --wait    # Start and wait until booted + ADB connected
#   ./emulator.sh --kill    # Kill running emulator
#   ./emulator.sh --status  # Show emulator status
#
# The emulator runs android-36 / x86_64 with software rendering (no GPU needed).
# RAM: 3GB allocated. Disk snapshot saved after first boot for fast restarts.
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

EMULATOR="$HOME/Android/Sdk/emulator/emulator"
ADB="$HOME/Android/Sdk/platform-tools/adb"
AVD_NAME="Monolith_Test"

WAIT_MODE=false
KILL_MODE=false
STATUS_MODE=false
[[ "$1" == "--wait" ]] && WAIT_MODE=true
[[ "$1" == "--kill" ]] && KILL_MODE=true
[[ "$1" == "--status" ]] && STATUS_MODE=true

# ── Status ────────────────────────────────────────────────────────────────────
if $STATUS_MODE; then
  RUNNING=$("$ADB" devices | grep "emulator-" | head -1)
  if [[ -n "$RUNNING" ]]; then
    DEVICE=$(echo "$RUNNING" | awk '{print $1}')
    BOOT=$("$ADB" -s "$DEVICE" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
    if [[ "$BOOT" == "1" ]]; then
      echo -e "${GREEN}✓ Emulator running and booted: $DEVICE${NC}"
    else
      echo -e "${YELLOW}⏳ Emulator starting: $DEVICE${NC}"
    fi
  else
    echo -e "${YELLOW}○ No emulator running${NC}"
  fi
  exit 0
fi

# ── Kill ──────────────────────────────────────────────────────────────────────
if $KILL_MODE; then
  DEVICE=$("$ADB" devices | grep "emulator-" | awk '{print $1}' | head -1)
  if [[ -n "$DEVICE" ]]; then
    "$ADB" -s "$DEVICE" emu kill 2>/dev/null || true
    echo -e "${GREEN}✓ Emulator killed${NC}"
  else
    echo -e "${YELLOW}No emulator running${NC}"
  fi
  exit 0
fi

# ── Start ─────────────────────────────────────────────────────────────────────
echo -e "${BLUE}🤖 Starting Android emulator (${AVD_NAME})${NC}"
echo "   System image: android-36 / google_apis_playstore / x86_64"

# Check KVM for hardware acceleration
KVM_FLAGS=()
if [[ -r /dev/kvm ]]; then
  echo "   GPU: software (swiftshader) + KVM hardware acceleration"
  KVM_FLAGS=(-qemu -enable-kvm)
else
  echo "   GPU: software only (no KVM — slower boot)"
  echo -e "   ${YELLOW}Tip: sudo usermod -aG kvm \$USER && newgrp kvm  (then restart)${NC}"
fi
echo ""

# Check if already running
EXISTING=$("$ADB" devices | grep "emulator-" | head -1)
if [[ -n "$EXISTING" ]]; then
  DEVICE=$(echo "$EXISTING" | awk '{print $1}')
  BOOT=$("$ADB" -s "$DEVICE" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  if [[ "$BOOT" == "1" ]]; then
    echo -e "${GREEN}✓ Emulator already running: $DEVICE${NC}"
    # Set up port forwarding for Colyseus
    "$ADB" -s "$DEVICE" reverse tcp:2567 tcp:2567 2>/dev/null && \
      echo -e "${GREEN}✓ Port 2567 forwarded${NC}" || true
    exit 0
  fi
fi

# Launch emulator in background
"$EMULATOR" \
  -avd "$AVD_NAME" \
  -no-snapshot-save \
  -no-boot-anim \
  -gpu swiftshader_indirect \
  -no-audio \
  -memory 3072 \
  -cores 4 \
  "${KVM_FLAGS[@]}" \
  2>/tmp/emulator.log &

EMULATOR_PID=$!
echo -e "${GREEN}✓ Emulator process started (PID: $EMULATOR_PID)${NC}"
echo "   Log: /tmp/emulator.log"

if ! $WAIT_MODE; then
  echo ""
  echo -e "${YELLOW}→ Run with --wait to block until booted${NC}"
  echo -e "${YELLOW}→ Or check status: ./emulator.sh --status${NC}"
  exit 0
fi

# ── Wait for boot ─────────────────────────────────────────────────────────────
echo ""
echo -n "   Waiting for emulator to boot"

for i in {1..60}; do
  sleep 3

  # Find the emulator device
  EMU_DEVICE=$("$ADB" devices | grep "emulator-" | awk '{print $1}' | head -1)
  if [[ -z "$EMU_DEVICE" ]]; then
    echo -n "."
    continue
  fi

  BOOT=$("$ADB" -s "$EMU_DEVICE" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  if [[ "$BOOT" == "1" ]]; then
    echo -e " ${GREEN}✓${NC}"
    echo -e "${GREEN}✓ Booted: $EMU_DEVICE${NC}"

    # Set up Colyseus port forwarding
    "$ADB" -s "$EMU_DEVICE" reverse tcp:2567 tcp:2567 && \
      echo -e "${GREEN}✓ Port 2567 forwarded (emulator → localhost)${NC}"

    # Unlock screen
    "$ADB" -s "$EMU_DEVICE" shell input keyevent 82 2>/dev/null || true

    echo ""
    echo -e "${GREEN}Emulator ready! Install APK with:${NC}"
    echo "  adb -s $EMU_DEVICE install -r apps/mobile/build/*.apk"
    echo "  # Or via Expo: press 'a' in expo start"
    exit 0
  fi

  echo -n "."

  if [[ $i -eq 60 ]]; then
    echo -e " ${RED}timeout${NC}"
    echo "Emulator took too long. Check: tail /tmp/emulator.log"
    exit 1
  fi
done
