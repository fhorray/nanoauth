import { serializeCookie } from './utils/cookie'
import type { AuthCoreInstance, User, NanoAuthHandlerOptions } from './types'

export async function handleRequest<TUser extends User = User>(
  request: Request,
  auth: AuthCoreInstance<TUser>,
  config: NanoAuthHandlerOptions = {}
): Promise<Response> {
  const url = new URL(request.url)
  const pathname = url.pathname
  const method = request.method

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

  // Route matching based on the end of the pathname
  // This allows it to work under any prefix (e.g., /api/auth/login or /auth/login)
  
  if (method === 'POST' && pathname.endsWith('/signup')) {
    try {
      const body = await request.json()
      const user = await auth.signup(body)
      const token = await auth.getState<string>('token')

      const response = new Response(JSON.stringify({ user, token }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      if (token) {
        response.headers.append('Set-Cookie', serializeCookie(cookieName, token, cookieOptions))
      }

      return response
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  if (method === 'POST' && pathname.endsWith('/login')) {
    try {
      const body = await request.json()
      const user = await auth.login(body)
      const token = await auth.getState<string>('token')

      const response = new Response(JSON.stringify({ user, token, message: 'Welcome back!' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      if (token) {
        response.headers.append('Set-Cookie', serializeCookie(cookieName, token, cookieOptions))
      }

      return response
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  if (method === 'POST' && pathname.endsWith('/logout')) {
    try {
      await auth.logout()
      
      const response = new Response(JSON.stringify({ message: 'Logged out' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      // Delete cookie
      response.headers.append(
        'Set-Cookie', 
        serializeCookie(cookieName, '', { ...cookieOptions, maxAge: 0 })
      )

      return response
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  // --- NATIVE OAUTH ROUTES ---
  if (method === 'GET' && pathname.match(/\/signin\/([^/]+)$/)) {
    const match = pathname.match(/\/signin\/([^/]+)$/)
    const provider = match ? match[1] : null
    const oauthAuth = auth as any

    if (!provider) {
      return new Response('Provider not specified', { status: 400 })
    }

    if (typeof oauthAuth.getOAuthAuthorizationUrl !== 'function') {
      return new Response(JSON.stringify({ error: 'OAuth plugin not installed or misconfigured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const authUrl = oauthAuth.getOAuthAuthorizationUrl(provider)
      return Response.redirect(authUrl, 302)
    } catch (error: any) {
      return Response.redirect(`${errorRedirect}?error=${encodeURIComponent(error.message)}`, 302)
    }
  }

  if (method === 'GET' && pathname.match(/\/callback\/([^/]+)$/)) {
    const match = pathname.match(/\/callback\/([^/]+)$/)
    const provider = match ? match[1] : null
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const oauthAuth = auth as any

    if (!provider) {
      return new Response('Provider not specified', { status: 400 })
    }

    if (!code) {
      return Response.redirect(`${errorRedirect}?error=missing_code`, 302)
    }

    try {
      // The plugin handles the exchange, user creation/finding, and state updates
      await oauthAuth.handleOAuthCallback(provider, code, state!)
      
      // Get the generated token from state (set by the plugin)
      const token = await auth.getState<string>('token')
      
      const response = Response.redirect(successRedirect, 302)

      if (token) {
        response.headers.append('Set-Cookie', serializeCookie(cookieName, token, cookieOptions))
      }

      return response
    } catch (error: any) {
      return Response.redirect(`${errorRedirect}?error=${encodeURIComponent(error.message)}`, 302)
    }
  }

  if (method === 'GET' && pathname.endsWith('/session')) {
    const user = await auth.getState<TUser>('user')
    const token = await auth.getState<string>('token')
    return new Response(JSON.stringify({ user, token }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Not Found
  return new Response(JSON.stringify({ error: 'Not Found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  })
}
