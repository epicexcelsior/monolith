#!/bin/bash
# One-command dev startup: sets up USB port forwarding + starts Metro
# Usage: ./dev.sh

set -e

echo "🔌 Setting up USB port forwarding..."
adb reverse tcp:8081 tcp:8081 2>/dev/null && echo "   ✓ Metro (8081)" || echo "   ✗ No device connected"
adb reverse tcp:2567 tcp:2567 2>/dev/null && echo "   ✓ Game server (2567)" || true

echo ""
echo "🗼 Starting Metro..."
echo "   Phone connects via USB — no WiFi needed"
echo ""

npx expo start -c "$@"
