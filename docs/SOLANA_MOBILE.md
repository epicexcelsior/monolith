# Solana Mobile Stack Reference

> This doc captures everything from the official [Solana Mobile Docs](https://docs.solanamobile.com)
> relevant to The Monolith. It serves as a quick reference so we don't
> have to re-read the docs every time.

---

## ✅ Alignment Check: Are We Following Best Practices?

| Requirement                                       | Source                                                                                                                           | Our Status                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Use Expo with **development build** (not Expo Go) | [RN Overview](https://docs.solanamobile.com/react-native/overview#expo)                                                          | ✅ `expo-dev-client` installed                                      |
| MWA protocol libs installed                       | [MWA Usage](https://docs.solanamobile.com/react-native/using_mobile_wallet_adapter#add-dependencies)                             | ✅ Both `@solana-mobile/mobile-wallet-adapter-protocol` + `-web3js` |
| Anchor SDK installed                              | [Anchor Guide](https://docs.solanamobile.com/react-native/anchor_integration#installation)                                       | ✅ `@coral-xyz/anchor ^0.30.1`                                      |
| `minSdkVersion` ≥ 23 (MWA needs Android 6+)       | [MWA Spec](https://solana-mobile.github.io/mobile-wallet-adapter/spec/spec.html)                                                 | ✅ Set to 26 in `app.json`                                          |
| Buffer + crypto polyfills first                   | [RN Setup](https://docs.solanamobile.com/react-native/setup)                                                                     | ✅ `index.js` boot order correct                                    |
| dApp Store: Android APK                           | [dApp Store](https://docs.solanamobile.com/dapp-publishing/intro)                                                                | ✅ `eas.json` has APK profile                                       |
| Use `transact()` from `-web3js` pkg               | [MWA Usage](https://docs.solanamobile.com/react-native/using_mobile_wallet_adapter#establishing-an-mwa-session)                  | 🔲 Not yet implemented (next phase)                                 |
| Cache auth token w/ AsyncStorage                  | [Auth Caching](https://docs.solanamobile.com/react-native/storing_mwa_auth)                                                      | 🔲 Not yet implemented (next phase)                                 |
| Anchor wallet adapter via `transact()`            | [Anchor Guide](https://docs.solanamobile.com/react-native/anchor_integration#create-an-anchor-wallet-with-mobile-wallet-adapter) | 🔲 Not yet implemented (next phase)                                 |

---

## Architecture: How MWA Works

```
┌─────────────┐         solana-wallet://           ┌──────────────┐
│  Our dApp   │ ──── Android Intent ──────────────▶│ Wallet App   │
│ (Monolith)  │                                    │ (Phantom,    │
│             │ ◀──── WebSocket Session ──────────│  Solflare,   │
│             │       authorize()                  │  Seed Vault) │
│             │       signTransactions()           │              │
│             │       signAndSendTransactions()    │              │
└─────────────┘                                    └──────────────┘
        │                                                  │
        │   Connection.sendRawTransaction()                │
        ▼                                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Solana Network (Devnet/Mainnet)               │
└──────────────────────────────────────────────────────────────────┘
```

**Key insight**: Our dApp never touches private keys. MWA dispatches an Android
intent (`solana-wallet://`), user approves in wallet app, wallet signs and
returns. Seed Vault is wallet-level security — we don't integrate directly.

---

## MWA Code Patterns We Need

### 1. App Identity (Required)

```typescript
// services/solana.ts
export const APP_IDENTITY = {
  name: "The Monolith",
  uri: "https://themonolith.app",
  icon: "favicon.ico", // relative to uri
};
```

### 2. Connect / Authorize

```typescript
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";

const connect = async () => {
  const result = await transact(async (wallet: Web3MobileWallet) => {
    return await wallet.authorize({
      cluster: "solana:devnet",
      identity: APP_IDENTITY,
    });
  });
  // result.accounts[0].address — base64-encoded public key
  // result.auth_token — cache this for re-authorization
};
```

### 3. Sign and Send Transaction

```typescript
const sendTx = async (transaction: VersionedTransaction) => {
  const signatures = await transact(async (wallet: Web3MobileWallet) => {
    await wallet.authorize({
      cluster: "solana:devnet",
      identity: APP_IDENTITY,
    });
    return await wallet.signAndSendTransactions({
      transactions: [transaction],
    });
  });
  return signatures[0];
};
```

### 4. Anchor Wallet Adapter

```typescript
// hooks/useAnchorWallet.ts
const anchorWallet = useMemo(
  () =>
    ({
      signTransaction: async (tx: Transaction) => {
        return transact(async (wallet: Web3MobileWallet) => {
          await wallet.authorize({
            cluster: "solana:devnet",
            identity: APP_IDENTITY,
          });
          const signed = await wallet.signTransactions({ transactions: [tx] });
          return signed[0];
        });
      },
      signAllTransactions: async (txs: Transaction[]) => {
        return transact(async (wallet: Web3MobileWallet) => {
          await wallet.authorize({
            cluster: "solana:devnet",
            identity: APP_IDENTITY,
          });
          return await wallet.signTransactions({ transactions: txs });
        });
      },
      get publicKey() {
        return userPubKey;
      },
    }) as anchor.Wallet,
  [userPubKey],
);
```

### 5. Auth Token Caching (UX Critical)

```typescript
// Use expo-secure-store (already in our deps) instead of AsyncStorage
import * as SecureStore from "expo-secure-store";

// On authorize:
await SecureStore.setItemAsync("mwa_auth_token", auth_token);
await SecureStore.setItemAsync("mwa_address", accounts[0].address);

// On app boot:
const cachedToken = await SecureStore.getItemAsync("mwa_auth_token");
const cachedAddr = await SecureStore.getItemAsync("mwa_address");
// If both exist → wallet.reauthorize({ auth_token: cachedToken })
```

> **Our improvement**: We use `expo-secure-store` instead of the docs'
> `AsyncStorage` — auth tokens should be encrypted at rest.

---

## Seeker-Specific Capabilities to Leverage

| Feature             | What It Does                   | How We'll Use It                                                 |
| ------------------- | ------------------------------ | ---------------------------------------------------------------- |
| **Seed Vault**      | Hardware-backed key storage    | Wallet apps handle this; our dApp benefits automatically via MWA |
| **dApp Store**      | Crypto-native app distribution | Publish APK directly (no Google Play needed)                     |
| **Seeker hardware** | Snapdragon 6 Gen 3, 8GB RAM    | Enough for R3F + 1000 InstancedMesh blocks                       |
| **NFC**             | Contactless interactions       | Future: tap-to-claim block via NFC                               |
| **Camera**          | AR/visual features             | Future: AR tower overlay                                         |

---

## dApp Store Publishing Checklist

When ready to publish:

1. `eas build --profile production --platform android` → produces AAB
2. Sign with release keystore
3. Comply with [publisher policy](https://docs.solanamobile.com/dapp-publishing/publisher-policy)
4. Submit via [dApp Store CLI](https://docs.solanamobile.com/dapp-publishing/submit-new-app)
5. Ensure `minSdkVersion` ≥ 23 (we use 26 ✅)

---

## Reference Apps (Official)

| App                      | What It Demonstrates         | Link                                                                                                         |
| ------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| AnchorCounterDapp        | Anchor + MWA integration     | [GitHub](https://github.com/solana-mobile/tutorial-apps/tree/main/AnchorCounterDapp)                         |
| SimpleStorageDapp        | Auth caching pattern         | [GitHub](https://github.com/solana-mobile/tutorial-apps/tree/main/SimpleStorageDapp)                         |
| example-react-native-app | Full MWA flow                | [GitHub](https://github.com/solana-mobile/mobile-wallet-adapter/tree/main/examples/example-react-native-app) |
| Cause Pots               | Modern Expo + Anchor example | Referenced in Anchor guide                                                                                   |

---

## Next Implementation Steps

1. **`useAuthorization` hook** — Connect/disconnect with auth caching
2. **`useAnchorWallet` hook** — MWA-backed Anchor wallet adapter
3. **Connect screen** — Wire MWA `transact()` to the existing Connect tab
4. **Anchor IDL** — Build program, import IDL, instantiate `Program`
5. **Stake/Claim transactions** — Build, sign, submit via MWA
