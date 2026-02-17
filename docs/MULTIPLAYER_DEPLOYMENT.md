# Multiplayer Server Deployment

This doc covers deploying the Colyseus game server to production and configuring the mobile client.

## Architecture

```
Mobile Client (React Native)
    ↓ WebSocket
Game Server (Node.js + Colyseus)
    ↓ Read/Write
Solana Devnet (on-chain state)
```

**Key principle**: Client compiles **once** with a server URL. Server can be redeployed independently.

---

## Server Deployment Options

### Option 1: Railway (Recommended for MVP)

**Pros**: Dead simple, free tier, auto-deploys from GitHub, built-in HTTPS/WSS
**Cons**: Cold starts on free tier, paid plans start at $5/mo

**Steps**:
1. Push your code to GitHub
2. Visit [railway.app](https://railway.app)
3. "New Project" → "Deploy from GitHub repo" → select `monolith`
4. Add a service → select `apps/server`
5. Environment variables:
   - `PORT`: Railway auto-sets this
   - `NODE_ENV`: `production`
6. Railway gives you a URL like `monolith-server.up.railway.app`
7. Update `eas.json` production env:
   ```json
   "EXPO_PUBLIC_GAME_SERVER_URL": "wss://monolith-server.up.railway.app"
   ```
8. Build client: `eas build --profile production --platform android`

**Note**: Railway auto-handles WebSocket upgrades. Use `wss://` (secure WebSocket).

---

### Option 2: Fly.io

**Pros**: Better free tier (persistent, no cold starts), closer to Solana nodes
**Cons**: Slightly more config

**Steps**:
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. `cd apps/server && fly launch`
3. Choose region close to your users (or Solana clusters for low latency)
4. Add `fly.toml`:
   ```toml
   app = "monolith-server"

   [build]
     dockerfile = "Dockerfile"

   [[services]]
     internal_port = 2567
     protocol = "tcp"

     [[services.ports]]
       port = 443
       handlers = ["tls"]

     [[services.tcp_checks]]
       interval = 10000
       timeout = 2000
   ```
5. Deploy: `fly deploy`
6. Get URL: `fly info` → use the hostname
7. Update `eas.json`: `wss://<your-app>.fly.dev`

---

### Option 3: Render

**Pros**: Free tier with persistent containers, easy setup
**Cons**: Slower than Fly, more limited free tier

**Steps**:
1. Connect GitHub at [render.com](https://render.com)
2. "New Web Service" → select repo
3. Build command: `cd apps/server && pnpm install && pnpm build`
4. Start command: `cd apps/server && pnpm start`
5. Environment: Node
6. Plan: Free (or Starter $7/mo for always-on)
7. Render gives you `https://monolith-server.onrender.com`
8. Update `eas.json`: `wss://monolith-server.onrender.com`

---

### Option 4: Self-hosted VPS (DigitalOcean, Hetzner, etc.)

**Pros**: Full control, cheapest for always-on ($5-10/mo)
**Cons**: You manage everything (nginx, SSL, process management)

**Quick setup**:
```bash
# On your VPS (Ubuntu):
curl -fsSL https://get.pnpm.io/install.sh | sh -
git clone <your-repo>
cd monolith/apps/server
pnpm install
pnpm build

# Install PM2 for process management
npm install -g pm2
pm2 start dist/index.js --name monolith-server
pm2 startup  # Auto-restart on boot
pm2 save

# Install Caddy for reverse proxy + auto SSL
sudo apt install caddy
```

Caddyfile:
```
monolith.yourdomain.com {
    reverse_proxy localhost:2567
}
```

Then: `sudo systemctl reload caddy`

Update `eas.json`: `wss://monolith.yourdomain.com`

---

### ❌ NOT Cloudflare Workers

Cloudflare Workers **don't support WebSockets** (they have Durable Objects with WebSocket *clients*, but you can't run a WebSocket *server*).

Alternative: Deploy to Railway/Fly and put Cloudflare in front for DDoS protection (but adds latency).

---

## Client Build Workflow

### Local dev (LAN)
```bash
# .env.local (gitignored)
EXPO_PUBLIC_GAME_SERVER_URL=ws://192.168.1.84:2567

# Run metro
pnpm start
```

### Testing with ngrok
```bash
# Terminal 1: Start server
cd apps/server && pnpm dev

# Terminal 2: Start ngrok
ngrok tcp 2567
# Copy the URL, e.g. tcp://0.tcp.us-cal-1.ngrok.io:16355

# Update .env.local
EXPO_PUBLIC_GAME_SERVER_URL=ws://0.tcp.us-cal-1.ngrok.io:16355

# Restart metro (Ctrl+C and `pnpm start`)
```

### Production build
```bash
# One-time: Set production server URL in eas.json
# (Already done — see eas.json production.env)

# Build for Android
eas build --profile production --platform android

# Build for iOS (when ready)
eas build --profile production --platform ios
```

**Key**: Once the client is built with a production URL, it's locked in. Server can redeploy freely without rebuilding the client.

---

## Recommended Stack for Hackathon

**Server**: Railway (free tier, auto-deploy)
**Client**: EAS Build (production profile)
**Why**: Zero config, deploys in <5 min, stable URLs

**Post-hackathon**: Migrate to Fly.io for better performance and closer proximity to Solana nodes.

---

## Monitoring

### Railway
- Built-in metrics dashboard
- View logs: `railway logs --service server`

### Fly.io
- Metrics: `fly dashboard`
- Logs: `fly logs`

### Self-hosted
- PM2: `pm2 monit`
- Logs: `pm2 logs monolith-server`

---

## Troubleshooting

### Client can't connect
1. Check server is running: `curl https://your-server.com/health`
2. Check WebSocket upgrade: `wscat -c wss://your-server.com`
3. Check `EXPO_PUBLIC_GAME_SERVER_URL` in build: metro logs on startup
4. Verify no firewall blocking port 443/2567

### Server crashes
1. Check memory usage (Colyseus state can grow large)
2. Add error handling in TowerRoom.onError
3. Monitor with `pm2 monit` or platform dashboards

### ngrok URL keeps changing
- Upgrade to ngrok Pro ($8/mo) for stable TCP addresses
- Or: Use Railway for stable URLs even during dev
