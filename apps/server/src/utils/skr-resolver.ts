/**
 * SKR (.skr) domain resolver for Solana Seeker usernames.
 *
 * Uses @onsol/tldparser (AllDomains protocol) to resolve wallet addresses
 * to .skr names via on-chain PDA lookups on Solana mainnet.
 *
 * Results are cached in-memory — .skr names rarely change.
 */

import { TldParser } from "@onsol/tldparser";
import { Connection } from "@solana/web3.js";

const cache = new Map<string, string | null>();
let parser: TldParser | null = null;

function getParser(): TldParser | null {
  if (parser) return parser;

  const rpcUrl = process.env.MAINNET_RPC_URL;
  if (!rpcUrl) {
    console.warn("[SKR] MAINNET_RPC_URL not set — .skr resolution disabled");
    return null;
  }

  const connection = new Connection(rpcUrl);
  parser = new TldParser(connection);
  console.log("[SKR] Parser initialized");
  return parser;
}

/**
 * Resolve a wallet address to its .skr domain name.
 * Returns "name.skr" or null if no .skr domain found.
 * Results are cached in-memory.
 */
export async function resolveSkrName(wallet: string): Promise<string | null> {
  if (cache.has(wallet)) return cache.get(wallet)!;

  const p = getParser();
  if (!p) {
    cache.set(wallet, null);
    return null;
  }

  try {
    const results = await p.getParsedAllUserDomainsFromTld(wallet, "skr");
    // results is NameAccountAndDomain[] → { nameAccount, domain }
    const domains = results as { nameAccount: unknown; domain: string }[];
    const name = domains.length > 0 ? `${domains[0].domain}.skr` : null;
    cache.set(wallet, name);
    if (name) {
      console.log(`[SKR] ${wallet.slice(0, 8)}... → ${name}`);
    }
    return name;
  } catch (err) {
    console.error(`[SKR] Resolution error for ${wallet.slice(0, 8)}...:`, err);
    cache.set(wallet, null);
    return null;
  }
}

/** Clear cached entry (e.g., if you want to force re-resolve). */
export function clearSkrCache(wallet?: string): void {
  if (wallet) {
    cache.delete(wallet);
  } else {
    cache.clear();
  }
}
