#!/usr/bin/env bash
# =============================================================================
# test.sh — Run Monolith test suite
#
# Usage:
#   ./test.sh           # Run all unit tests + typecheck
#   ./test.sh --unit    # Unit tests only (jest)
#   ./test.sh --types   # TypeScript typecheck only
#   ./test.sh --e2e     # Maestro E2E flows (requires running app + device)
#   ./test.sh --watch   # Unit tests in watch mode
#   ./test.sh --server  # Server unit tests only
#
# For E2E tests:
#   1. Start emulator:  ./emulator.sh --wait
#   2. Start dev server: ./dev.sh  (in another terminal)
#   3. Run E2E:         ./test.sh --e2e
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

UNIT_ONLY=false
TYPES_ONLY=false
E2E_ONLY=false
WATCH_MODE=false
SERVER_ONLY=false

[[ "$1" == "--unit" ]] && UNIT_ONLY=true
[[ "$1" == "--types" ]] && TYPES_ONLY=true
[[ "$1" == "--e2e" ]] && E2E_ONLY=true
[[ "$1" == "--watch" ]] && WATCH_MODE=true
[[ "$1" == "--server" ]] && SERVER_ONLY=true

PASS=0
FAIL=0

ROOT="/home/epic/Downloads/monolith"

run_step() {
  local label="$1"
  shift
  echo -e "${BLUE}→ $label${NC}"
  if "$@"; then
    echo -e "${GREEN}✓ $label${NC}"
    ((PASS++)) || true
  else
    echo -e "${RED}✗ $label${NC}"
    ((FAIL++)) || true
  fi
  echo ""
}

print_summary() {
  echo "================================"
  echo -e "  ${GREEN}Passed: $PASS${NC}   ${RED}Failed: $FAIL${NC}"
  echo ""
  if [[ $FAIL -gt 0 ]]; then
    echo -e "${RED}✗ $FAIL check(s) failed${NC}"
    exit 1
  else
    echo -e "${GREEN}✓ All checks passed${NC}"
  fi
}

# ── Watch mode ────────────────────────────────────────────────────────────────
if $WATCH_MODE; then
  echo -e "${BLUE}🔍 Running tests in watch mode${NC}"
  cd "$ROOT/apps/mobile" && npx jest --watch
  exit 0
fi

# ── E2E mode ─────────────────────────────────────────────────────────────────
if $E2E_ONLY; then
  echo -e "${BLUE}🤖 Running Maestro E2E flows${NC}"
  echo ""

  export PATH="$PATH:$HOME/.maestro/bin"

  # Check for device
  ADB="$HOME/Android/Sdk/platform-tools/adb"
  DEVICES=$("$ADB" devices | grep -v "List of" | grep "device$" | wc -l)
  if [[ "$DEVICES" -eq 0 ]]; then
    echo -e "${RED}✗ No devices found. Start emulator or connect physical device.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ $DEVICES device(s) connected${NC}"
  echo ""

  # Run all Maestro flows
  maestro test "$ROOT/.maestro/" --format junit --output "$ROOT/.maestro/results.xml" || {
    echo -e "${RED}✗ Some E2E flows failed — check screenshots in .maestro/${NC}"
    exit 1
  }
  echo -e "${GREEN}✓ All E2E flows passed${NC}"
  exit 0
fi

echo -e "${BLUE}🧪 Monolith Test Suite${NC}"
echo "================================"
echo ""

# ── Server only ───────────────────────────────────────────────────────────────
if $SERVER_ONLY; then
  run_step "Server: Jest" bash -c "cd '$ROOT/apps/server' && npx jest --passWithNoTests 2>&1 | tail -10"
  run_step "Server: TypeScript" bash -c "cd '$ROOT/apps/server' && npx tsc --noEmit 2>&1 | tail -10"
  print_summary
  exit 0
fi

# ── Types only ────────────────────────────────────────────────────────────────
if $TYPES_ONLY; then
  run_step "Mobile: TypeScript" bash -c "cd '$ROOT' && timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json 2>&1 | tail -20"
  run_step "Server: TypeScript" bash -c "cd '$ROOT/apps/server' && npx tsc --noEmit 2>&1 | tail -10"
  print_summary
  exit 0
fi

# ── Unit only ─────────────────────────────────────────────────────────────────
if $UNIT_ONLY; then
  run_step "Mobile: Jest" bash -c "cd '$ROOT/apps/mobile' && npx jest --passWithNoTests 2>&1 | tail -20"
  run_step "Server: Jest" bash -c "cd '$ROOT/apps/server' && npx jest --passWithNoTests 2>&1 | tail -10"
  print_summary
  exit 0
fi

# ── Full suite ────────────────────────────────────────────────────────────────
run_step "Mobile: Jest (unit + integration)" \
  bash -c "cd '$ROOT/apps/mobile' && npx jest --passWithNoTests 2>&1 | tail -20"

run_step "Server: Jest" \
  bash -c "cd '$ROOT/apps/server' && npx jest --passWithNoTests 2>&1 | tail -10"

run_step "Mobile: TypeScript" \
  bash -c "cd '$ROOT' && timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json 2>&1 | tail -20"

run_step "Server: TypeScript" \
  bash -c "cd '$ROOT/apps/server' && npx tsc --noEmit 2>&1 | tail -10"

print_summary
