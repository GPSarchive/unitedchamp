/**
 * Validates a redirect URL to prevent open redirect attacks.
 * Only allows relative paths that don't escape to external domains.
 * Blocks: protocol-relative URLs (//evil.com), backslash tricks (\/evil.com),
 * and any URL that resolves to a non-local host.
 */
export function safeNextUrl(raw: string, fallback = '/home'): string {
  if (!raw) return fallback
  try {
    const decoded = decodeURIComponent(raw)
    // Must start with exactly one slash followed by a non-slash, non-backslash char
    // OR be exactly "/"
    if (/^\/[^/\\]/.test(decoded) || decoded === '/') {
      const parsed = new URL(decoded, 'http://localhost')
      if (parsed.host === 'localhost') return decoded
    }
  } catch {
    // malformed URL — fall through to fallback
  }
  return fallback
}
