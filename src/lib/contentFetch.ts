const CACHE_PREFIX = 'airlab_content_v1_'

export function readCachedCollection<T>(slug: string, fallback: T[] = []): T[] {
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${slug}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // ignore storage access/parse errors
  }
  return fallback
}

function writeCachedCollection<T>(slug: string, data: T[]): void {
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${slug}`, JSON.stringify(data))
  } catch {
    // ignore quota errors
  }
}

export async function fetchCollection<T>(
  slug: string,
  options?: { retries?: number; timeoutMs?: number },
): Promise<T[] | null> {
  const retries = options?.retries ?? 2
  const timeoutMs = options?.timeoutMs ?? 12000
  const apiBase = import.meta.env.VITE_API_URL || ''
  const url = `${apiBase}/api/content/${slug}`

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, { signal: controller.signal })
      window.clearTimeout(timer)

      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          writeCachedCollection(slug, data)
          return data
        }
        return null
      }

      // Retry on 5xx / cold-start errors; stop immediately on 4xx
      if (res.status < 500) {
        return null
      }
    } catch {
      window.clearTimeout(timer)
    }

    if (attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)))
    }
  }

  return null
}

const inflightPrefetches = new Set<string>()

export function prefetchCollection(slug: string): void {
  if (typeof window === 'undefined') return
  try {
    if (sessionStorage.getItem(`${CACHE_PREFIX}${slug}`)) return
  } catch {
    // ignore storage access error
  }
  if (inflightPrefetches.has(slug)) return
  inflightPrefetches.add(slug)

  fetchCollection(slug, { retries: 1, timeoutMs: 10000 })
    .catch(() => {
      // ignore prefetch errors
    })
    .finally(() => {
      inflightPrefetches.delete(slug)
    })
}

const CORE_COLLECTIONS = [
  'team',
  'previous-interns',
  'projects',
  'gallery',
  'performers',
  'grants',
  'publications',
  'blogs',
] as const

let corePrefetchTriggered = false

export function prefetchAllCoreCollections(): void {
  if (typeof window === 'undefined' || corePrefetchTriggered) return
  corePrefetchTriggered = true

  const scheduleIdle = (cb: () => void, delayMs = 250) => {
    const win = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
    }
    if (typeof win.requestIdleCallback === 'function') {
      win.requestIdleCallback(cb, { timeout: 2500 })
    } else {
      window.setTimeout(cb, delayMs)
    }
  }

  scheduleIdle(() => {
    CORE_COLLECTIONS.forEach((slug, idx) => {
      window.setTimeout(() => {
        prefetchCollection(slug)
      }, idx * 120)
    })
  }, 400)
}

