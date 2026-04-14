import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import type { AuthCoreInstance, User } from '../types'

export interface NanoAuthHonoConfig {
  cookieName?: string
  cookieOptions?: {
    path?: string
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'Lax' | 'Strict' | 'None'
    maxAge?: number
  }
  successRedirect?: string
  errorRedirect?: string
}

/**
 * NanoAuth Hono Integration
 * 
 * Automatically generates authentication routes for Hono applications.
 * Usage: app.route('/api/auth', nanoauthHono(auth))
 */
export function nanoauthHono<TUser extends User = User>(
  auth: AuthCoreInstance<TUser>,
  config: NanoAuthHonoConfig = {}
): Hono {
  const api = new Hono()
  
  const cookieName = config.cookieName ?? 'auth_token'
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    ...config.cookieOptions
  }

  const successRedirect = config.successRedirect ?? '/'
  const errorRedirect = config.errorRedirect ?? '/auth/error'

  // POST /signup
  api.post('/signup', async (c) => {
    try {
      const body = await c.req.json()
      const user = await auth.signup(body)
      const token = await auth.getState<string>('token')

      if (token) {
        setCookie(c, cookieName, token, cookieOptions)
      }

      return c.json({ user, token })
    } catch (error: any) {
      return c.json({ error: error.message }, 400)
    }
  })

  // POST /login
  api.post('/login', async (c) => {
    try {
      const body = await c.req.json()
      const user = await auth.login(body)
      const token = await auth.getState<string>('token')

      if (token) {
        setCookie(c, cookieName, token, cookieOptions)
      }

      return c.json({ user, token, message: 'Welcome back!' })
    } catch (error: any) {
      return c.json({ error: error.message }, 401)
    }
  })

  // POST /logout
  api.post('/logout', async (c) => {
    try {
      await auth.logout()
      deleteCookie(c, cookieName, { path: cookieOptions.path })
      return c.json({ message: 'Logged out' })
    } catch (error: any) {
      return c.json({ error: error.message }, 500)
    }
  })

  // --- NATIVE OAUTH ROUTES ---

  // GET /signin/:provider
  api.get('/signin/:provider', async (c) => {
    const provider = c.req.param('provider')
    const oauthAuth = auth as any
    
    if (typeof oauthAuth.getOAuthAuthorizationUrl !== 'function') {
      return c.json({ error: 'OAuth plugin not installed or misconfigured' }, 500)
    }

    try {
      const url = oauthAuth.getOAuthAuthorizationUrl(provider)
      return c.redirect(url)
    } catch (error: any) {
      return c.redirect(`${errorRedirect}?error=${encodeURIComponent(error.message)}`)
    }
  })

  // GET /callback/:provider
  api.get('/callback/:provider', async (c) => {
    const provider = c.req.param('provider')
    const code = c.req.query('code')
    const state = c.req.query('state')
    const oauthAuth = auth as any

    if (!code) {
      return c.redirect(`${errorRedirect}?error=missing_code`)
    }

    try {
      // The plugin handles the exchange, user creation/finding, and state updates
      await oauthAuth.handleOAuthCallback(provider, code, state)
      
      // Get the generated token from state (set by the plugin)
      const token = await auth.getState<string>('token')
      
      if (token) {
        setCookie(c, cookieName, token, cookieOptions)
      }

      // Redirect to success page (e.g., Dashboard)
      return c.redirect(successRedirect)
    } catch (error: any) {
      return c.redirect(`${errorRedirect}?error=${encodeURIComponent(error.message)}`)
    }
  })

  // GET /session (Helper to check current user)
  api.get('/session', async (c) => {
    const user = await auth.getState<TUser>('user')
    const token = await auth.getState<string>('token')
    return c.json({ user, token })
  })

  return api
}
