/**
 * NanoAuth - Cookie Utils
 */

export interface CookieOptions {
  path?: string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Lax' | 'Strict' | 'None'
  maxAge?: number
  domain?: string
}

/**
 * Serialize cookie into a string for Set-Cookie header
 */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  let cookie = `${name}=${encodeURIComponent(value)}`

  if (options.maxAge !== undefined) {
    cookie += `; Max-Age=${options.maxAge}`
  }

  if (options.domain) {
    cookie += `; Domain=${options.domain}`
  }

  if (options.path) {
    cookie += `; Path=${options.path}`
  }

  if (options.httpOnly) {
    cookie += '; HttpOnly'
  }

  if (options.secure) {
    cookie += '; Secure'
  }

  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite}`
  }

  return cookie
}
/**
 * Parse cookie header string into an object
 */
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!cookieHeader) return cookies

  cookieHeader.split(';').forEach((item) => {
    const parts = item.split('=')
    const key = parts[0]?.trim()
    const value = parts[1]?.trim()
    if (key && value) {
      cookies[key] = decodeURIComponent(value)
    }
  })

  return cookies
}
