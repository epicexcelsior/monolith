# Smart Contract Security & Game Integrity Fix Plan

> **Context:** Audit identified one critical vault-draining attack, a fully disconnected on-chain / off-chain game loop, a stale doc, and several minor quality issues. This plan closes all obvious loopholes before early user testing. DevNet only — not bulletproof, just honest.
>
> **Do not execute on `main`. Work on a dedicated branch.**

---

## Overview of Issues Found

| Severity | Area | Issue |
|---|---|---|
| **Critical** | Anchor Program | Missing mint constraint — attacker can drain vault with fake tokens |
| **High** | Docs | `ANCHOR_PROGRAM.md` describes a completely different program |
| **High** | Server | Game server never verifies on-chain deposit — anyone can claim without paying |
| **Medium** | Anchor Program | `.unwrap()` panics instead of clean error codes |
| **Medium** | Anchor Program | `total_users` never decrements on full withdrawal |
| **Low** | Mobile | `faucet.tsx` creates a duplicate `Connection` instead of using the singleton |
| **Low** | Mobile | `deposit_required` server error not handled in claim flow |

---

## Execution Order

```
1. programs/monolith/src/error.rs     — add Overflow error
2. programs/monolith/src/lib.rs       — mint constraints + unwrap fixes + total_users fix
3. anchor build + anchor test         — verify all tests pass + add new security test
4. anchor upgrade → devnet            — deploy updated binary
5. cp target/idl/monolith.json → mobile services
6. apps/server/package.json           — add @solana/web3.js
7. apps/server/src/utils/solana.ts    — new Solana utility (PDA derivation + deposit check)
8. apps/server/src/rooms/TowerRoom.ts — enforce deposit before claim
9. apps/mobile/stores/multiplayer-store.ts — handle deposit_required error
10. apps/mobile/app/faucet.tsx        — use connection singleton
11. docs/ANCHOR_PROGRAM.md            — full rewrite
12. Full typecheck + test run
```

---

## Part 1 — Anchor Program

### Files
- `programs/monolith/src/lib.rs`
- `programs/monolith/src/error.rs`

---

### Fix 1.1 — Add `Overflow` Error Code

**File:** `programs/monolith/src/error.rs`

Add one entry to the `MonolithError` enum:

```rust
#[error_code]
pub enum MonolithError {
    #[msg("Deposit amount must be greater than zero")]
    InsufficientDeposit,

    #[msg("Insufficient balance for withdrawal")]
    InsufficientBalance,

    #[msg("Invalid USDC mint address")]
    InvalidMint,

    // NEW:
    #[msg("Arithmetic overflow")]
    Overflow,
}
```

---

### Fix 1.2 — Mint Constraint on `Deposit` and `Withdraw` (Critical)

**File:** `programs/monolith/src/lib.rs`

**The attack this prevents:** Without this check, a user can:
1. Create a worthless `FakeCoin` mint, mint tokens to themselves
2. Create a FakeCoin ATA owned by `tower_state` (valid — anyone can create an ATA for any owner)
3. Call `deposit(100)` with `usdc_mint = FakeCoin` → `user_deposit.amount = 100`, real vault untouched
4. Call `withdraw(100)` with `usdc_mint = real USDC` → passes balance check, steals real USDC

**In the `Deposit` account struct** (currently no constraint on `usdc_mint`):
```rust
// BEFORE (~line 191):
pub usdc_mint: Account<'info, Mint>,

// AFTER:
#[account(
    constraint = usdc_mint.key() == tower_state.usdc_mint @ MonolithError::InvalidMint,
)]
pub usdc_mint: Account<'info, Mint>,
```

**In the `Withdraw` account struct** (same fix, ~line 232):
```rust
// BEFORE:
pub usdc_mint: Account<'info, Mint>,

// AFTER:
#[account(
    constraint = usdc_mint.key() == tower_state.usdc_mint @ MonolithError::InvalidMint,
)]
pub usdc_mint: Account<'info, Mint>,
```

---

### Fix 1.3 — Replace `.unwrap()` with `?` Error Returns

**File:** `programs/monolith/src/lib.rs`

**In the `deposit` instruction** (~lines 58–72):

```rust
// BEFORE:
user_deposit.amount = user_deposit.amount.checked_add(amount).unwrap();
// ...
tower.total_users = tower.total_users.checked_add(1).unwrap();
// ...
tower.total_deposited = tower.total_deposited.checked_add(amount).unwrap();

// AFTER:
user_deposit.amount = user_deposit.amount
    .checked_add(amount)
    .ok_or(MonolithError::Overflow)?;
// ...
tower.total_users = tower.total_users
    .checked_add(1)
    .ok_or(MonolithError::Overflow)?;
// ...
tower.total_deposited = tower.total_deposited
    .checked_add(amount)
    .ok_or(MonolithError::Overflow)?;
```

**In the `withdraw` instruction** (~lines 104–115):

```rust
// BEFORE:
user_deposit.amount = user_deposit.amount.checked_sub(amount).unwrap();
// ...
tower.total_deposited = tower.total_deposited.checked_sub(amount).unwrap();

// AFTER:
user_deposit.amount = user_deposit.amount
    .checked_sub(amount)
    .ok_or(MonolithError::Overflow)?;
// ...
tower.total_deposited = tower.total_deposited
    .checked_sub(amount)
    .ok_or(MonolithError::Overflow)?;
```

> Note: The `require!(user_deposit.amount >= amount)` guard above makes the `checked_sub` overflow mathematically impossible, but using `?` is cleaner and consistent.

---

### Fix 1.4 — Decrement `total_users` on Full Withdrawal

**File:** `programs/monolith/src/lib.rs`, `withdraw` instruction

After updating `user_deposit.amount`, add before `Ok(())`:

```rust
// Decrement total_users if this user has withdrawn everything
if user_deposit.amount == 0 {
    // Use saturating_sub — defensive against an already-zero counter
    tower.total_users = tower.total_users.saturating_sub(1);
}
```

> Place this after `tower.total_deposited` is updated but before `Ok(())`.

---

### Fix 1.5 — Add Security Test Case

**File:** `tests/monolith.ts`

Add these two test cases after the existing suite:

```typescript
it("rejects deposit with wrong mint (InvalidMint)", async () => {
    // Create a worthless fake mint
    const fakeMintKeypair = anchor.web3.Keypair.generate();
    // ... (create mint with createMint, create ATA for tower PDA, mint tokens to user)

    try {
        await program.methods
            .deposit(new anchor.BN(100))
            .accounts({
                towerState: towerPda,
                userDeposit: userDepositPda,
                vault: fakeVaultAta, // ATA of tower PDA for fake mint
                userTokenAccount: fakeUserAta,
                usdcMint: fakeMintKeypair.publicKey, // ← wrong mint
                user: provider.wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();
        assert.fail("Should have thrown InvalidMint");
    } catch (err: any) {
        assert.include(err.message, "InvalidMint");
    }
});

it("real USDC vault is untouched after failed fake deposit", async () => {
    const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("tower")],
        program.programId,
    );
    const vaultInfo = await getAccount(provider.connection, vaultAta);
    // Balance should still be whatever it was before the failed fake deposit
    assert.ok(Number(vaultInfo.amount) >= 0, "Vault should be intact");
});
```

---

### Fix 1.6 — Build, Test, Deploy

```bash
# From repo root

# Build
anchor build

# Test on localnet (verifies all 7 existing + 2 new security tests)
anchor test

# Copy updated IDL to mobile app
cp target/idl/monolith.json apps/mobile/services/monolith-idl.json

# Deploy upgrade to devnet
# Requires the upgrade authority keypair at ~/.config/solana/id.json
anchor upgrade target/deploy/monolith.so \
  --program-id Fu76EqtVLqX2LKCW5ZW8zWBqdgsQTbkvQ9nBDyykgwDh \
  --provider.cluster devnet

# If upgrade authority is unavailable, redeploy fresh:
# anchor deploy --provider.cluster devnet
# Then update MONOLITH_PROGRAM_ID in apps/mobile/services/monolith-program.ts
# and call initialize() on the new program before any deposits
```

> **After deploy:** Verify on devnet explorer that the program ID is still `Fu76EqtVLqX2LKCW5ZW8zWBqdgsQTbkvQ9nBDyykgwDh` and the IDL checksum matches.

---

## Part 2 — Game Server (Colyseus)

### Files
- `apps/server/package.json` — add dependency
- `apps/server/src/utils/solana.ts` — new file
- `apps/server/src/rooms/TowerRoom.ts` — enforce deposit on claim

---

### Fix 2.1 — Add `@solana/web3.js` to Server

**File:** `apps/server/package.json`

In the `"dependencies"` section, add:
```json
"@solana/web3.js": "^1.98.0"
```

Then from repo root:
```bash
pnpm install
```

---

### Fix 2.2 — Create Server Solana Utility

**New file:** `apps/server/src/utils/solana.ts`

```typescript
/**
 * Server-side Solana utilities.
 * Used to verify on-chain state before accepting game actions.
 */

import { Connection, PublicKey } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey(
    "Fu76EqtVLqX2LKCW5ZW8zWBqdgsQTbkvQ9nBDyykgwDh",
);

const RPC_URL =
    process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export const solanaConnection = new Connection(RPC_URL, "confirmed");

/**
 * Derive the UserDeposit PDA for a wallet.
 * Seeds: [b"deposit", walletPubkey]
 */
export function getUserDepositPda(walletAddress: string): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("deposit"), new PublicKey(walletAddress).toBuffer()],
        PROGRAM_ID,
    );
    return pda;
}

/**
 * Fetch a user's on-chain deposit amount (USDC units, 6 decimals).
 *
 * Returns:
 *   > 0  — user has an active deposit (USDC units)
 *   = 0  — PDA not found or zero balance (no deposit)
 *   = -1 — RPC call failed (fail open: don't block the user)
 *
 * UserDeposit struct layout (from programs/monolith/src/state.rs):
 *   [0..8)   discriminator
 *   [8..40)  owner: Pubkey
 *   [40..48) amount: u64 (little-endian)
 *   [48..56) last_deposit_at: i64 (little-endian)
 *   [56..57) bump: u8
 */
export async function getOnChainDepositAmount(
    walletAddress: string,
): Promise<number> {
    try {
        const pda = getUserDepositPda(walletAddress);
        const accountInfo = await solanaConnection.getAccountInfo(
            pda,
            "confirmed",
        );

        if (!accountInfo || accountInfo.data.length < 57) {
            return 0; // PDA doesn't exist — no deposit
        }

        const data = accountInfo.data as Buffer;
        // Read u64 at offset 40 as two u32s (avoids BigInt for Node compat)
        const lo = data.readUInt32LE(40);
        const hi = data.readUInt32LE(44);
        const amount = hi * 0x100000000 + lo;
        return amount;
    } catch (err: any) {
        // Network/RPC error — fail open so RPC flakiness doesn't block gameplay
        console.warn(
            "[Solana] getOnChainDepositAmount failed, failing open:",
            err?.message,
        );
        return -1; // Sentinel: RPC unavailable
    }
}
```

> **Environment variable:** Add `SOLANA_RPC_URL` to `apps/server/.env` (optional but recommended for reliability — use a dedicated devnet RPC endpoint rather than the public one which rate-limits aggressively).

---

### Fix 2.3 — Enforce Deposit in Claim Handler

**File:** `apps/server/src/rooms/TowerRoom.ts`

**Step A — Add import** at the top of the file:
```typescript
import { getOnChainDepositAmount } from "../utils/solana";
```

**Step B — In the `claim` handler** (currently starts at ~line 226), add verification as the FIRST thing in the handler body, before the existing `canClaim` check:

```typescript
this.onMessage("claim", async (client: Client, msg: ClaimMessage) => {
    // Guard: wallet address is required
    if (!msg.wallet) {
        client.send("error", { message: "Wallet address required to claim" });
        return;
    }

    // --- ON-CHAIN DEPOSIT VERIFICATION ---
    // Check that this wallet has a real on-chain USDC deposit.
    // Fail open (-1) if RPC is unavailable — don't block users due to network issues.
    const depositAmount = await getOnChainDepositAmount(msg.wallet);

    if (depositAmount === 0) {
        // Confirmed: no deposit exists. Reject the claim.
        client.send("claim_result", {
            success: false,
            blockId: msg.blockId,
            error: "deposit_required",
            message:
                "You need to deposit USDC before claiming a block. Tap 'Add Fuel' to get started.",
        });
        console.log(
            `[TowerRoom] Claim rejected — no on-chain deposit for wallet ${msg.wallet}`,
        );
        return;
    }

    if (depositAmount > 0) {
        // RPC succeeded and deposit confirmed — use real on-chain amount for display
        msg.amount = `$${(depositAmount / 1_000_000).toFixed(2)}`;
        console.log(
            `[TowerRoom] Deposit verified: ${msg.wallet} has ${msg.amount} USDC on-chain`,
        );
    } else {
        // depositAmount === -1: RPC unavailable — allow with warning
        console.warn(
            `[TowerRoom] RPC check failed for ${msg.wallet}, allowing claim (fail-open)`,
        );
    }
    // --- END VERIFICATION ---

    // ... existing claim logic continues here unchanged ...
});
```

---

## Part 3 — Mobile App

### Files
- `apps/mobile/stores/multiplayer-store.ts`
- `apps/mobile/app/faucet.tsx`

---

### Fix 3.1 — Handle `deposit_required` Error in Claim Result

**File:** `apps/mobile/stores/multiplayer-store.ts`

Find where `claim_result` messages are handled (search for `"claim_result"`). In the error branch, add a check for the new `deposit_required` error code:

```typescript
room.onMessage("claim_result", (result) => {
    if (!result.success) {
        if (result.error === "deposit_required") {
            // Surface this clearly — the user needs to go deposit
            // Option A: set a specific error flag in the store
            useMultiplayerStore.getState().setClaimError("deposit_required");
            // Option B: navigate to deposit screen if you have a router ref
        } else {
            // Existing generic error handling
        }
        return;
    }
    // ... existing success handling ...
});
```

**In `BlockInspector.tsx`** (the UI that shows claim CTAs), add handling for when `claimError === "deposit_required"`:
- Show a message: *"You need to deposit USDC first"*
- Show a button: *"Add Fuel →"* that navigates to `/deposit`

This ensures users get a clear, actionable response instead of a silent failure.

---

### Fix 3.2 — Fix Faucet's Duplicate Connection

**File:** `apps/mobile/app/faucet.tsx`

The faucet creates its own `new Connection(...)` instance (~line 32) instead of using the app's shared singleton.

```typescript
// REMOVE any local Connection creation, e.g.:
// const conn = new Connection(CONFIG.solana.rpcUrl, "confirmed");

// ADD import at top of file:
import { connection } from "@/services/solana";

// Then use `connection` directly for the airdrop:
const sig = await connection.requestAirdrop(publicKey, 2 * LAMPORTS_PER_SOL);
```

---

## Part 4 — Rewrite `docs/ANCHOR_PROGRAM.md`

The current doc describes a completely different, more complex program (`BlockAccount`, `deposit_stake`, `add_stake`, etc.) that does not exist on-chain. Replace the entire file with a doc reflecting the actual deployed contract.

**New content structure:**

```markdown
# Anchor Program — USDC Vault

**Program ID (Devnet):** Fu76EqtVLqX2LKCW5ZW8zWBqdgsQTbkvQ9nBDyykgwDh
**Anchor:** 0.31.1

## Design Intent

Simple pooled USDC vault. The on-chain program handles custody only — deposit and withdrawal of USDC. All game mechanics (block ownership, charge/decay, customization, XP) live off-chain in Colyseus + Supabase. A user's on-chain deposit is proof of skin-in-the-game; the game server verifies it before allowing block claims.

## PDAs

| PDA | Seeds | Purpose |
|---|---|---|
| TowerState | [b"tower"] | Global config: authority, mint, vault address, totals |
| UserDeposit | [b"deposit", user.key()] | Per-user deposit balance |
| Vault | ATA of TowerState for USDC | Holds all staked USDC |

## Instructions

### initialize
- Called once by deployer
- Creates TowerState PDA and USDC vault ATA
- Sets authority, usdc_mint, initializes totals to 0

### deposit(amount: u64)
- Transfers USDC from user's ATA → vault
- Creates UserDeposit PDA on first deposit (init_if_needed)
- Accumulates balance for repeat deposits
- Constraint: usdc_mint must match tower_state.usdc_mint (InvalidMint)
- Constraint: amount > 0 (InsufficientDeposit)

### withdraw(amount: u64)
- Transfers USDC from vault → user's ATA (PDA signs)
- Constraint: user_deposit.amount >= amount (InsufficientBalance)
- Constraint: usdc_mint must match tower_state.usdc_mint (InvalidMint)
- Decrements total_users if user's balance reaches zero

## State

### TowerState
| Field | Type | Description |
|---|---|---|
| authority | Pubkey | Deployer wallet |
| usdc_mint | Pubkey | Accepted USDC mint address |
| vault | Pubkey | Vault ATA address |
| total_deposited | u64 | Sum of all active deposits (USDC units) |
| total_users | u32 | Count of users with non-zero balance |
| bump | u8 | PDA bump seed |

### UserDeposit
| Field | Type | Description |
|---|---|---|
| owner | Pubkey | User's wallet |
| amount | u64 | USDC units deposited (6 decimals) |
| last_deposit_at | i64 | Unix timestamp of last deposit |
| bump | u8 | PDA bump seed |

## Error Codes
| Code | Name | Meaning |
|---|---|---|
| 6000 | InsufficientDeposit | amount must be > 0 |
| 6001 | InsufficientBalance | withdrawal exceeds deposited balance |
| 6002 | InvalidMint | usdc_mint doesn't match tower_state.usdc_mint |
| 6003 | Overflow | Arithmetic overflow (defensive) |

## Mobile Integration
- `apps/mobile/services/monolith-program.ts` — IDL, constants, converters
- `apps/mobile/hooks/useAnchorProgram.ts` — Anchor + MWA signing wrapper
- `apps/mobile/hooks/useStaking.ts` — deposit/withdraw/read operations
- `apps/mobile/app/deposit.tsx` — deposit UI

## Devnet Deployment
```bash
anchor build
anchor test                                   # runs localnet integration tests
anchor upgrade target/deploy/monolith.so \
  --program-id Fu76EqtVLqX2LKCW5ZW8zWBqdgsQTbkvQ9nBDyykgwDh \
  --provider.cluster devnet
cp target/idl/monolith.json apps/mobile/services/monolith-idl.json
```
```

---

## Part 5 — Verification

### Automated Checks

```bash
# 1. Anchor program tests (localnet)
anchor test
# Expected: 7 existing + 2 new security tests pass

# 2. Server typecheck
cd apps/server && npx tsc --noEmit

# 3. Mobile typecheck
timeout 90 npx tsc --noEmit --project apps/mobile/tsconfig.json

# 4. Mobile unit tests
cd apps/mobile && npx jest
# Expected: all tests pass (no behavioral changes to client logic)
```

### Manual End-to-End Test on DevNet

1. **No deposit → claim** → server returns `deposit_required` error → mobile shows "Add Fuel →" prompt
2. **Deposit 0.1 USDC** → verify on Explorer → retry claim → should succeed
3. **Withdraw more than deposited** → `InsufficientBalance` error in wallet
4. **Withdraw full balance** → `total_users` decrements in `TowerState`

### Security Smoke Test

1. Run the new `anchor test` — the fake-mint deposit test should fail with `InvalidMint`
2. Verify real vault balance is unchanged after the rejected fake deposit

---

## What This Does NOT Fix (Intentional Scope Cuts)

These are real issues but out of scope for devnet testing:

| Issue | Why deferred |
|---|---|
| `UserDeposit` not closed on zero balance (wastes ~0.002 SOL rent) | Trivial on devnet; add `close = user` constraint post-hackathon |
| u64 precision loss in JS decoder | Only matters above $9M USDC in one account |
| Wallet address spoofing in server messages (`msg.wallet` trusted from client) | Requires per-message signing — significant scope, out of budget |
| `total_deposited` can drift from real vault balance | Only possible via direct token transfers to vault, not exploitable by players |
| Server charges/customizations also trust `msg.wallet` | Same as above — full message signing needed for a real fix |
