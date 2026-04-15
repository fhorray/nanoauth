import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { verifyHS256JWT } from 'nanoauth/utils'
import { userRepository } from '../db/client'

// Secret (must match the one in auth.ts)
const JWT_SECRET = new TextEncoder().encode("playground-secret-key-12345")

/**
 * Hono Middleware to protect routes
 * Supports both Authorization Header and auth_token Cookie
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  const authCookie = getCookie(c, 'auth_token')

  let token: string | null = null

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1] || null;
  } else if (authCookie) {
    token = authCookie
  }

  if (!token) {
    return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401)
  }

  try {
    const payload = await verifyHS256JWT(token, JWT_SECRET)

    if (!payload.userId) {
      throw new Error('Invalid token payload')
    }

    const user = await userRepository.findById(payload.userId)
    if (!user) {
      return c.json({ error: 'User not found' }, 401)
    }

    // Store user in Hono context
    c.set('user', user)
    await next()
  } catch (error: any) {
    return c.json({ error: 'Unauthorized: ' + error.message }, 401)
  }
}
