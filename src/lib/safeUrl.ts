/**
 * Validates a URL string for safe use in anchor `href` attributes.
 * Returns the trimmed URL only if it parses as `http:` or `https:`,
 * or is a same-origin relative path starting with `/` (and not `//`).
 * Returns `undefined` for `javascript:`, `data:`, `vbscript:`, or malformed URLs.
 */
export function safeHref(url: string | undefined | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined
  const trimmed = url.trim()
  if (!trimmed || trimmed === '#') return undefined

  // Allow same-origin relative paths starting with a single '/'
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed
    }
  } catch {
    // Not a valid absolute URL
  }

  return undefined
}
