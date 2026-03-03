/**
 * LRU Texture Cache for user-uploaded block images.
 *
 * Caches THREE.Texture objects keyed by URL so switching between blocks
 * with images doesn't re-download textures. Evicts least-recently-used
 * entries when the cache exceeds MAX_ENTRIES.
 */

import * as THREE from "three";

const MAX_ENTRIES = 50;

interface CacheEntry {
  texture: THREE.Texture;
  lastAccess: number;
}

const cache = new Map<string, CacheEntry>();
const loading = new Set<string>();
const loader = new THREE.TextureLoader();

/**
 * Get a cached texture or start loading it.
 * Returns the texture immediately if cached, null if still loading.
 * Calls `onLoaded` when a newly loaded texture becomes available.
 */
export function getCachedTexture(
  url: string,
  onLoaded?: (texture: THREE.Texture) => void,
): THREE.Texture | null {
  // Cache hit — update access time and return
  const entry = cache.get(url);
  if (entry) {
    entry.lastAccess = Date.now();
    return entry.texture;
  }

  // Already loading — skip duplicate request
  if (loading.has(url)) return null;

  // Start async load
  loading.add(url);
  loader.load(
    url,
    (tex) => {
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;

      // Evict if at capacity
      if (cache.size >= MAX_ENTRIES) {
        evictLRU();
      }

      cache.set(url, { texture: tex, lastAccess: Date.now() });
      loading.delete(url);

      onLoaded?.(tex);
    },
    undefined,
    () => {
      // Load failed — just clear loading state
      loading.delete(url);
    },
  );

  return null;
}

/** Evict the least-recently-used cache entry. */
function evictLRU(): void {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, entry] of cache) {
    if (entry.lastAccess < oldestTime) {
      oldestTime = entry.lastAccess;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    const entry = cache.get(oldestKey);
    entry?.texture.dispose();
    cache.delete(oldestKey);
  }
}

/** Clear all cached textures (e.g., on unmount). */
export function clearTextureCache(): void {
  for (const [, entry] of cache) {
    entry.texture.dispose();
  }
  cache.clear();
  loading.clear();
}
