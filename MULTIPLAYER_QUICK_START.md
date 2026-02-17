# Multiplayer Quick Start

**Goal**: Compile the client **once**, deploy the server anywhere, test on LAN or remote.

---

## Setup (One-time)

### 1. Install dependencies
Already done — `colyseus.js@0.15.0` installed, shims in place.

### 2. Configure server URL

**For local dev** (LAN or ngrok):
```bash
cd apps/mobile
cp .env.local.example .env.local
# Edit .env.local with your server URL
```

**For production builds**:
Server URL is baked into `eas.json` per profile:
- `development` → LAN IP
- `preview` → ngrok (update when tunnel restarts)
- `production` → Railway/Fly/Render URL

---

## Local Development Workflow

### Option A: LAN (same WiFi)
```bash
# Terminal 1: Start server
cd apps/server && pnpm dev
# Listening on 0.0.0.0:2567

# Terminal 2: Start mobile dev
cd apps/mobile && pnpm start
# Metro bundles with ws://192.168.1.84:2567
```

### Option B: ngrok (test from anywhere)
```bash
# Terminal 1: Start server
cd apps/server && pnpm dev

# Terminal 2: Start ngrok
ngrok tcp 2567
# Copy URL: tcp://0.tcp.us-cal-1.ngrok.io:16355

# Terminal 3: Update client
cd apps/mobile
# Edit .env.local:
# EXPO_PUBLIC_GAME_SERVER_URL=ws://0.tcp.us-cal-1.ngrok.io:16355

# Restart metro (Ctrl+C and rerun)
pnpm start
```

**Tip**: Create a shell alias to auto-update from ngrok:
```bash
alias update-ngrok='curl -s http://127.0.0.1:4040/api/tunnels | jq -r ".tunnels[0].public_url" | sed "s/tcp:/ws:/" > apps/mobile/.env.local'
```

---

## Production Deployment

### 1. Deploy server to Railway (5 minutes)

```bash
# Push to GitHub
git push origin main

# Visit railway.app
# New Project → Deploy from GitHub → monolith
# Add service → apps/server
# Railway auto-assigns a URL: monolith-server.up.railway.app
```

### 2. Update client config
```bash
cd apps/mobile
# Edit eas.json production.env:
"EXPO_PUBLIC_GAME_SERVER_URL": "wss://monolith-server.up.railway.app"
```

### 3. Build client
```bash
eas build --profile production --platform android
# Download APK, distribute via TestFlight/internal testing
```

**Done!** Server can redeploy without rebuilding client.

---

## Testing Checklist

- [ ] Server starts: `cd apps/server && pnpm dev`
- [ ] Health check: `curl http://localhost:2567/health`
- [ ] Client bundle: `cd apps/mobile && npx expo export --platform android`
- [ ] Tests pass: `npx jest --testPathPatterns=multiplayer`
- [ ] LAN connect: Open app on phone (same WiFi)
- [ ] Claim a block → other clients see it update
- [ ] Charge a block → energy increases everywhere
- [ ] Server logs show "Client joined"

---

## Troubleshooting

**Bundle error: "Cannot assign to property 'default'"**
→ Clear metro cache: `npx expo start --clear`

**Client can't connect**
→ Check `.env.local` is set and metro restarted
→ Verify server is running: `curl http://localhost:2567/health`

**ngrok URL changes**
→ Update `.env.local` and restart metro
→ Or upgrade to ngrok Pro for stable URLs

**State not syncing**
→ Check metro logs for `[Network] Game server: ws://...`
→ Check server logs for `[TowerRoom] Client joined`
→ Open server's ngrok web interface (http://127.0.0.1:4040) to inspect traffic

---

## Architecture Summary

```
┌─────────────────┐
│  Mobile Client  │  Built once with server URL
│  (React Native) │  (from EXPO_PUBLIC_GAME_SERVER_URL)
└────────┬────────┘
         │ WebSocket (colyseus.js)
         ↓
┌─────────────────┐
│  Game Server    │  Deployed to Railway/Fly/etc
│  (Colyseus)     │  Binds 0.0.0.0:2567 (or Railway PORT)
└────────┬────────┘
         │ Reads/writes
         ↓
┌─────────────────┐
│  Solana Devnet  │  On-chain USDC vault + state
└─────────────────┘
```

**Key insight**: Client → Server is just WebSocket. Server → Solana is RPC. They're independent — server can restart/redeploy without touching the client build.

---

## Next Steps

- [ ] Deploy to Railway (see `docs/MULTIPLAYER_DEPLOYMENT.md`)
- [ ] Build production APK with Railway URL
- [ ] Test with 2+ devices on LAN
- [ ] Share ngrok link for remote testing
- [ ] Monitor server logs during testing
