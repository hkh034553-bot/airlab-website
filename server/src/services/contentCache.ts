interface CacheEntry {
  data: unknown
  expiresAt: number
}

const CACHE_TTL_MS = 60_000
const store = new Map<string, CacheEntry>()

export function getCachedContent<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.data as T
}

export function setCachedContent(key: string, data: unknown, ttlMs = CACHE_TTL_MS): void {
  store.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  })
}

export function invalidateContentCache(slug?: string): void {
  if (!slug) {
    store.clear()
    return
  }
  store.delete(slug)
  // Team & previous-interns changes also affect enriched performers
  if (slug === 'team' || slug === 'previous-interns') {
    store.delete('performers')
  }
}
