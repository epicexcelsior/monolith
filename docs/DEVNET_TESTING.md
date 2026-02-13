# Devnet Testing Guide — USDC Vault

## Deployment Status ✅

| Item | Address |
|------|---------|
| **Program** | `Fu76EqtVLqX2LKCW5ZW8zWBqdgsQTbkvQ9nBDyykgwDh` |
| **Tower PDA** | `HFLZT5ofDeNyYkEcaUr6gM3LjsE6Z3pwGrEHA7TrkcH5` |
| **Vault ATA** | `6EK3HiKMwTPcTW27nt6rxthgP1vBCcVvq4tUFG6cNQHe` |
| **USDC Mint** | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| **RPC** | Alchemy devnet (configured in `services/solana.ts`) |

## Prerequisites

1. **Devnet USDC** in your Seeker wallet  
   - The mint is `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
   - If you need more, use [Circle's devnet faucet](https://faucet.circle.com/)

2. **Devnet SOL** for transaction fees (~0.001 SOL per tx)
   - Faucet: `solana airdrop 1 <YOUR_WALLET_ADDRESS> --url devnet`

3. **Dev client build** installed on Seeker
   - Run `npx expo start --dev-client` from `apps/mobile/`

## Testing Flow on Seeker

### Step 1: Connect Wallet
1. Open the app on Seeker
2. Tap **Connect Wallet**  
3. Your Solana wallet app opens → approve the connection
4. You should see your wallet address displayed in the app

### Step 2: Deposit USDC
1. The `useStaking` hook provides `deposit(amountUsdc)`
2. Enter an amount (minimum 0.10 USDC)
3. The app builds a `deposit` instruction:
   - Transfers USDC from your ATA → program vault ATA
   - Creates your `UserDeposit` PDA (first time only)
4. MWA opens → approve the transaction in your wallet
5. After confirmation, your deposit balance updates

### Step 3: Check Balance
- `fetchUserDeposit()` reads your `UserDeposit` PDA
- `fetchTowerState()` reads global vault stats (total deposited, user count)

### Step 4: Withdraw USDC
1. Call `withdraw(amountUsdc)` with the amount to withdraw
2. You can withdraw any amount up to your balance
3. MWA opens → approve the transaction
4. USDC returns from vault ATA → your wallet ATA

## How It Works Under the Hood

```
Your Wallet (USDC ATA)
    │
    │ deposit(amount)
    ▼
┌─────────────────────────────┐
│  Monolith Program (on-chain) │
│                              │
│  TowerState PDA              │
│  ├── total_deposited: u64    │
│  ├── total_users: u32        │
│  └── vault: ATA address      │
│                              │
│  UserDeposit PDA (per user)  │
│  ├── amount: u64             │
│  └── last_deposit_at: i64    │
│                              │
│  Vault ATA (holds all USDC)  │
└─────────────────────────────┘
    │
    │ withdraw(amount)
    ▼
Your Wallet (USDC ATA)
```

## Verify on Solana Explorer

- **Program:** [Explorer Link](https://explorer.solana.com/address/Fu76EqtVLqX2LKCW5ZW8zWBqdgsQTbkvQ9nBDyykgwDh?cluster=devnet)
- **Vault ATA:** [Explorer Link](https://explorer.solana.com/address/6EK3HiKMwTPcTW27nt6rxthgP1vBCcVvq4tUFG6cNQHe?cluster=devnet)
- **Tower PDA:** [Explorer Link](https://explorer.solana.com/address/HFLZT5ofDeNyYkEcaUr6gM3LjsE6Z3pwGrEHA7TrkcH5?cluster=devnet)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Network mismatch" | Ensure wallet is set to **devnet** in settings |
| "Insufficient balance" | Get more devnet USDC from Circle faucet |
| "Account not found" | Tower may not be initialized — run `scripts/initialize-devnet.ts` |
| Transaction fails silently | Check Solana Explorer for the tx signature |
| MWA won't connect | Clear auth cache: Settings → Disconnect → Reconnect |
