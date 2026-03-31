import { cookies } from 'next/headers'

const CSRF_COOKIE = '__csrf'
const CSRF_MAX_AGE = 60 * 60 // 1 hour

/**
 * Generate a new CSRF token, set it as an HttpOnly cookie, and return the token.
 * The token is set via the cookie store (works in route handlers and server components).
 */
export async function generateCsrfToken(): Promise<string> {
  const token = crypto.randomUUID()
  const jar = await cookies()
  jar.set(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: CSRF_MAX_AGE,
  })
  return token
}

/**
 * Validate a CSRF token from a form submission against the HttpOnly cookie.
 * Returns true if valid, false otherwise.
 */
export async function validateCsrfToken(formToken: string | null): Promise<boolean> {
  if (!formToken) return false
  const jar = await cookies()
  const cookieToken = jar.get(CSRF_COOKIE)?.value
  if (!cookieToken) return false
  return formToken === cookieToken
}
