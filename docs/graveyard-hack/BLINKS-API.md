# Solana Actions/Blinks + OrbitFlare — Verified Reference

> Verified 2026-02-26 against solana.com/docs, @solana/actions@1.6.6, and docs.orbitflare.com.

## What Are Blinks?

**Solana Actions** = spec-compliant API endpoints that return metadata (GET) and signable transactions (POST).

**Blinks (Blockchain Links)** = URLs pointing to Action endpoints that wallet-aware clients (Phantom, Backpack, dial.to) render as interactive cards with buttons.

**For The Monolith:** Every block becomes a shareable URL. Anyone can poke or charge a block from the web without installing the app.

---

## Solana Actions Spec

### actions.json (Domain Root)

Must be served at `https://yourdomain.com/actions.json`. Tells clients which URL paths are Actions.

```json
{
  "rules": [
    { "pathPattern": "/api/actions/**", "apiPath": "/api/actions/**" }
  ]
}
```

- `*` matches one path segment, `**` matches multiple (must be last)
- Must return CORS headers (see below)

### CORS Headers (CRITICAL — Every Endpoint)

Every route including OPTIONS must return these exact headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,PUT,OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Accept-Action-Version, X-Accept-Blockchain-Ids
Access-Control-Expose-Headers: X-Action-Version, X-Blockchain-Ids
Content-Type: application/json
```

The `@solana/actions` package exports these as `ACTIONS_CORS_HEADERS`.

**Every route must also handle OPTIONS requests** (preflight). In Cloudflare Workers, add an OPTIONS handler that returns 200 with CORS headers.

### GET Response Shape (`ActionGetResponse`)

```typescript
interface ActionGetResponse {
  type: "action" | "completed";
  icon: string;          // Absolute URL to image (PNG/SVG/WebP)
  title: string;         // Card title
  description: string;   // Card description
  label: string;         // Default button text (<=5 words, verb-first)
  disabled?: boolean;    // Grey out the action
  error?: { message: string };
  links?: {
    actions: Array<{
      type?: string;     // "transaction" (default) or "external-link"
      href: string;      // Relative or absolute URL for POST
      label: string;     // Button text
      parameters?: TypedActionParameter[];  // For input fields
    }>;
  };
}
```

**Icon must be an absolute URL** — `https://...`, not a relative path.

### POST Request Body

```json
{ "account": "base58-encoded-public-key" }
```

The client sends the user's wallet public key. Your server builds a transaction for that user.

### POST Response Shape (`ActionPostResponse`)

```typescript
interface ActionPostResponse {
  type: "transaction";
  transaction: string;   // Base64-encoded serialized transaction
  message?: string;      // Shown to user after signing
  links?: {
    next: {
      type: "inline" | "post";
      action: ActionGetResponse;  // For "inline" type — shows completion card
    };
  };
}
```

### Transaction Rules

- `transaction.feePayer` MUST be the user's pubkey (they pay gas)
- `transaction.recentBlockhash` MUST be set (fetch fresh from RPC)
- If transaction is unsigned: client sets feePayer + recentBlockhash, then signs
- If partially signed: client must NOT modify feePayer/recentBlockhash (would invalidate existing sigs)

### Action Chaining

POST response can include `links.next` to chain to another action:
- `type: "inline"` — embed the next action directly (e.g., completion screen)
- `type: "post"` — redirect to another Action URL

Terminal state: `ActionGetResponse` with `type: "completed"`.

---

## Devnet Support

**Blinks work on devnet.** Confirmed:
- `@solana/actions` exports `BLOCKCHAIN_IDS.devnet = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"`
- The `X-Blockchain-Ids` response header declares which network the action targets
- dial.to may show "not confirmed" for devnet txs — this is a **display bug**, the tx actually succeeds on-chain

Use devnet RPC for all transaction construction.

---

## Memo-Based Actions (Our Approach)

Instead of USDC transfers or program calls, our Blinks return **Memo transactions**. This is the simplest approach — no program changes, no token transfers, near-zero cost.

### Memo Program

- **Program ID:** `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`
- **Usage:** Single instruction, no accounts needed, data = UTF-8 string
- **Cost:** ~0.000005 SOL (just base tx fee)

### Memo Format

```
monolith:poke:{blockId}
monolith:charge:{blockId}
```

### Building a Memo Transaction

```typescript
import { Transaction, TransactionInstruction, PublicKey, Connection } from "@solana/web3.js";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

async function createMemoTransaction(
  connection: Connection,
  account: string,
  memo: string
): Promise<Transaction> {
  const tx = new Transaction();
  tx.add(new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo),
  }));
  tx.feePayer = new PublicKey(account);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  return tx;
}
```

### Server-Side Detection

The game server polls for memo transactions using OrbitFlare RPC:

```typescript
// Poll every 30s for new memo txs
const sigs = await connection.getSignaturesForAddress(
  MEMO_PROGRAM_ID, // or a dedicated "receiver" address
  { limit: 20 }
);
// For each signature, fetch the tx and parse the memo data
// Match "monolith:poke:{blockId}" or "monolith:charge:{blockId}"
// Process via existing TowerRoom poke/charge logic
```

**Gotcha:** `getSignaturesForAddress` on MEMO_PROGRAM_ID would return ALL memo txs on Solana, not just ours. Better approach: include the user's pubkey as a signer (it already is — they sign the tx) and have a dedicated Monolith wallet as a read-only non-signer account in the instruction. Then poll by that Monolith address.

**Revised instruction:**
```typescript
tx.add(new TransactionInstruction({
  keys: [
    { pubkey: new PublicKey(account), isSigner: true, isWritable: false },
    { pubkey: MONOLITH_ADDRESS, isSigner: false, isWritable: false },  // our marker
  ],
  programId: MEMO_PROGRAM_ID,
  data: Buffer.from(`monolith:poke:${blockId}`),
}));
```

Then poll: `getSignaturesForAddress(MONOLITH_ADDRESS)` — only returns txs that reference our marker address.

---

## OrbitFlare RPC

### What It Is

Standard Solana JSON-RPC 2.0 provider. No proprietary SDK — drop-in replacement for any RPC URL.

### Endpoint Format

```
https://{region}.rpc.orbitflare.com?api_key=YOUR_API_KEY
```

Regions: `fra` (Frankfurt), others available. API key as query param.

### Pricing

| Tier | Price | RPS |
|------|-------|-----|
| Free | $0 | 10 RPS |
| Paid tiers | up to $999/mo | up to 600 RPS |

Free tier is sufficient for hackathon (10 requests/second).

### Integration (One-Line Change)

```typescript
// Before (public devnet):
const connection = new Connection("https://api.devnet.solana.com");

// After (OrbitFlare devnet):
const connection = new Connection("https://fra.rpc.orbitflare.com?api_key=YOUR_KEY");
```

### Where to Use OrbitFlare

1. **Cloudflare Worker** — for building Blink transactions (`getLatestBlockhash`)
2. **Game Server** — for polling memo transactions (`getSignaturesForAddress`)
3. **Mobile App** — optionally swap existing RPC connection (bonus)

### Satisfying the Bounty

The OrbitFlare bounty says "using OrbitFlare's infra and trading APIs." Minimum requirement:
- Use OrbitFlare RPC for ALL Solana connections in the Blinks server
- Mention OrbitFlare in submission description
- Sign up at https://orbitflare.com/ for free credits

---

## @solana/actions Package

**Version:** 1.6.6

### Key Exports

```typescript
import {
  ACTIONS_CORS_HEADERS,              // CORS header object
  ACTIONS_CORS_HEADERS_MIDDLEWARE,    // For middleware frameworks
  BLOCKCHAIN_IDS,                     // { mainnet, devnet, testnet } CAIP-2 IDs
  createPostResponse,                // Serializes tx to base64 response
} from "@solana/actions";
```

### `createPostResponse`

```typescript
const payload = await createPostResponse({
  fields: {
    type: "transaction",
    transaction: tx,          // Transaction or VersionedTransaction
    message: "Poked Block #42!",
    links: {                  // Optional action chaining
      next: {
        type: "inline",
        action: {
          type: "completed",
          icon: "https://...",
          title: "Poke Sent!",
          description: "The block owner will feel that.",
          label: "Done",
        },
      },
    },
  },
});
```

Handles serialization + base64 encoding. Throws `CreatePostResponseError` if tx has no instructions.

### Dependencies

```bash
npm install @solana/actions @solana/web3.js
```

---

## Testing

### dial.to

URL: https://dial.to/

1. Enter your Action URL: `https://your-worker.workers.dev/api/actions/block/42`
2. It renders the Blink card with buttons
3. Click a button → connects wallet → prompts transaction signing
4. Devnet txs may show "not confirmed" (display bug) — tx actually succeeds

### blinks.xyz Inspector

URL: https://www.blinks.xyz/inspector

Alternative testing tool. Same functionality.

### Registration

For Blinks to auto-unfurl on X/Twitter, you need to register at https://dial.to/register. **Not needed for hackathon demo** — testing on dial.to directly is sufficient.

---

## OrbitFlare Template Reference

**Source:** https://github.com/orbitflare/templates/tree/main/solana-blinks-axum

This is the ONLY official OrbitFlare template. It's Rust/Axum backend + Next.js 15 frontend. No TypeScript/Cloudflare Worker template exists — we adapt their patterns.

### Key Files to Reference

- `src/spec.rs` → TypeScript equivalent in `frontend/src/lib/types.ts` — all Action/Blink type definitions
- `src/cors.rs` → CORS setup (we use `ACTIONS_CORS_HEADERS` from `@solana/actions` instead)
- `src/actions/utils.rs` → `build_memo_tx()` function — memo transaction builder pattern
- `src/actions/donate.rs` → Chained action pattern: Step 1 (SOL transfer) → Step 2 (memo). Uses `ChainState` (base64 JSON in `_chain` query param) for stateless multi-step flows
- `frontend/src/lib/actions.ts` → `fetchAction()`, `executeAction()`, `buildActionUrl()` — client-side helpers

### TypeScript Types (from their frontend/src/lib/types.ts)

```typescript
export interface ActionGetResponse {
  icon: string; title: string; description: string; label: string;
  disabled?: boolean; error?: ActionError; links?: ActionLinks;
}
export interface ActionLinks { actions: LinkedAction[]; }
export interface LinkedAction { href: string; label: string; parameters?: ActionParameter[]; }
export interface ActionPostRequest { account: string; }
export interface ActionPostResponse { transaction: string; message?: string; links?: NextActionLinks; }
export interface NextActionLinks { next: NextAction; }
export type NextAction = ({ type: "inline" } & ActionGetResponse) | { type: "post"; href: string };
```

### Memo Transaction Pattern (from their donate.rs/utils.rs)

Their `build_memo_tx` creates a Memo instruction with the payer as a signer account:
```rust
let ix = Instruction {
    program_id: *MEMO_PROGRAM_ID,
    accounts: vec![AccountMeta::new_readonly(*payer, true)],
    data: memo.as_bytes().to_vec(),
};
```

We adapt this to TypeScript and add our MONOLITH_MARKER as a second read-only account for transaction detection.

---

## Gotcha Summary

| # | Gotcha |
|---|--------|
| 1 | CORS headers on EVERY endpoint including OPTIONS — missing CORS = Blink won't render |
| 2 | Icon URLs must be absolute (`https://...`) |
| 3 | `actions.json` must be at domain root |
| 4 | `transaction.feePayer` must be the user's pubkey |
| 5 | Always fetch fresh `recentBlockhash` — stale = tx rejected |
| 6 | devnet works but dial.to may show false "not confirmed" |
| 7 | `createPostResponse` throws if tx has no instructions |
| 8 | For memo detection, use a marker address (don't poll MEMO_PROGRAM_ID globally) |
| 9 | OrbitFlare free tier = 10 RPS — sufficient for hackathon |
| 10 | `@solana/actions` is v1.6.6 — stable, no breaking changes expected |
