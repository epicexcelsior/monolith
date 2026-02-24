#!/usr/bin/env bash
# =============================================================================
# dev.sh — Start the full Monolith dev environment in one command
#
# Usage:
#   ./dev.sh          # Auto-detects USB device, starts server + mobile
#   ./dev.sh --prod   # Mobile connects to prod server (no local server)
#   ./dev.sh --check  # Just verify setup, don't start anything
#
# Prerequisites:
#   - Android device connected via USB with USB debugging enabled
#   - pnpm installed
#   - (Optional) SUPABASE_SERVICE_KEY in apps/server/.env for persistence
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROD_MODE=false
CHECK_ONLY=false
[[ "$1" == "--prod" ]] && PROD_MODE=true
[[ "$1" == "--check" ]] && CHECK_ONLY=true

echo -e "${BLUE}🗼 Monolith Dev Environment${NC}"
echo "================================"

# ── 1. Check adb + device ─────────────────────────────────────────
DEVICE=$(adb devices 2>/dev/null | grep -v "List of" | grep "device$" | awk '{print $1}' | head -1)

if [[ -z "$DEVICE" ]]; then
  echo -e "${YELLOW}⚠️  No Android device detected via USB${NC}"
  echo "   Connect your phone via USB and enable USB debugging"
  echo "   Or run: ./dev.sh --prod  (to use prod server instead)"
  if $PROD_MODE; then
    echo -e "${GREEN}   Continuing in --prod mode${NC}"
  else
    exit 1
  fi
else
  echo -e "${GREEN}✓  Device: $DEVICE${NC}"
fi

# ── 2. adb reverse (localhost forwarding) ─────────────────────────
if ! $PROD_MODE && [[ -n "$DEVICE" ]]; then
  echo -e "${BLUE}→  Forwarding device port 2567 → localhost:2567${NC}"
  adb -s "$DEVICE" reverse tcp:2567 tcp:2567
  echo -e "${GREEN}✓  adb reverse active (stable until USB disconnect)${NC}"
fi

# ── 3. Set .env.local ─────────────────────────────────────────────
ENV_FILE="apps/mobile/.env.local"
if $PROD_MODE; then
  GAME_URL="wss://monolith-server-production.up.railway.app"
  echo -e "${YELLOW}→  Using prod server: $GAME_URL${NC}"
else
  GAME_URL="ws://localhost:2567"
  echo -e "${GREEN}→  Using local server: $GAME_URL${NC}"
fi

# Update .env.local in-place (keep Supabase keys)
if [[ -f "$ENV_FILE" ]]; then
  # Replace the GAME_SERVER_URL line, keep everything else
  TMPFILE=$(mktemp)
  grep -v "EXPO_PUBLIC_GAME_SERVER_URL" "$ENV_FILE" > "$TMPFILE"
  echo "EXPO_PUBLIC_GAME_SERVER_URL=$GAME_URL" >> "$TMPFILE"
  mv "$TMPFILE" "$ENV_FILE"
else
  echo "EXPO_PUBLIC_GAME_SERVER_URL=$GAME_URL" > "$ENV_FILE"
fi
echo -e "${GREEN}✓  .env.local updated${NC}"

# ── 4. Check Supabase config ──────────────────────────────────────
SERVER_ENV="apps/server/.env"
if [[ -f "$SERVER_ENV" ]] && grep -q "SUPABASE_SERVICE_KEY=eyJ" "$SERVER_ENV" 2>/dev/null; then
  echo -e "${GREEN}✓  Supabase service key configured${NC}"
else
  echo -e "${YELLOW}⚠️  Supabase service key not set (persistence disabled)${NC}"
  echo "   Add SUPABASE_SERVICE_KEY=eyJ... to apps/server/.env"
  echo "   Get key from: https://supabase.com/dashboard/project/pscgsbdznfitscxflxrm/settings/api"
fi

$CHECK_ONLY && echo -e "${GREEN}\nSetup looks good!${NC}" && exit 0

# ── 5. Start local server (unless --prod) ─────────────────────────
if ! $PROD_MODE; then
  echo ""
  echo -e "${BLUE}→  Starting game server (apps/server)...${NC}"
  cd apps/server && pnpm dev &
  SERVER_PID=$!
  cd ../..

  # Wait for server to be ready
  echo -n "   Waiting for server"
  for i in {1..15}; do
    sleep 1
    if curl -s http://localhost:2567/health > /dev/null 2>&1; then
      echo -e " ${GREEN}✓${NC}"
      break
    fi
    echo -n "."
    if [[ $i -eq 15 ]]; then
      echo -e " ${RED}timeout${NC}"
      echo "Server didn't start in 15s. Check apps/server logs above."
    fi
  done
fi

# ── 6. Start mobile ───────────────────────────────────────────────
echo ""
echo -e "${BLUE}→  Starting Expo (apps/mobile)...${NC}"
echo "   Press 'a' to open on Android device"
echo ""
cd apps/mobile && npx expo start --dev-client

# ── Cleanup ───────────────────────────────────────────────────────
if ! $PROD_MODE && [[ -n "$SERVER_PID" ]]; then
  kill "$SERVER_PID" 2>/dev/null || true
fi
