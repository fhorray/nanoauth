import { serializeCookie, parseCookies } from './utils/cookie'
import type { AuthCoreInstance, User, NanoAuthHandlerOptions } from './types'
import { AuthenticationError, NanoAuthError, SecurityError, ValidationError } from './errors'

/**
 * Helper to append query parameters securely to a URL
 */
function appendQueryParam(url: string, key: string, value: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${key}=${encodeURIComponent(value)}`;
}

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

  // --- PLUGIN CUSTOM ENDPOINTS ---
  if (auth.endpoints) {
    for (const endpoint of Object.values(auth.endpoints)) {
      if (pathname.endsWith(endpoint.path)) {
        if (endpoint.method === 'ALL' || endpoint.method === method) {
          return endpoint.handler(request, auth, config);
        }
      }
    }
  }

  const matchActionAndStrategy = pathname.match(/\/(signin|signup|signout)(?:\/([^/]+))?$/)

  if (method === 'POST' && matchActionAndStrategy) {
    const action = matchActionAndStrategy[1] as 'signin' | 'signup' | 'signout'
    let strategy = matchActionAndStrategy[2]

    try {
      const body = action !== 'signout' ? await request.json() : {}

      if (!strategy) {
        strategy = body.strategy || 'email'
      }

      const currentStrategy = strategy!
      let user: TUser | undefined;
      let token: string | undefined;

      if (action === 'signout') {
        if (auth.signout.session) {
          await auth.signout.session()
        } else if (auth.signout[currentStrategy]) {
          await auth.signout[currentStrategy]()
        }
      } else {
        const methodToCall = auth[action]?.[currentStrategy]
        if (typeof methodToCall !== 'function') {
          throw new Error(`Strategy "${currentStrategy}" is not supported for ${action}.`);
        }

        // Strategy methods should now return { user, token }
        const result = await methodToCall(body)
        user = result.user || result;
        token = result.token;
      }

      let responsePayload: any = { message: action === 'signout' ? 'Logged out' : 'Success' }
      if (user) responsePayload.user = user
      if (token) responsePayload.token = token

      const response = new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      if (action === 'signout') {
        response.headers.append('Set-Cookie', serializeCookie(cookieName, '', { ...cookieOptions, maxAge: 0 }))
      } else if (token) {
        response.headers.append('Set-Cookie', serializeCookie(cookieName, token, cookieOptions))
      }

      return response
    } catch (error: any) {
      let status = 400;
      let code = 'INTERNAL_ERROR';

      if (error instanceof NanoAuthError) {
        status = error.status;
        code = error.code || 'NANOAUTH_ERROR';
      } else if (error instanceof AuthenticationError) status = 401; // Fallback
      else if (error instanceof ValidationError) status = 400;
      else if (error instanceof SecurityError) status = 403;

      return new Response(JSON.stringify({
        error: error.message,
        code,
        status
      }), {
        status,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  // --- NATIVE OAUTH ROUTES (GET) ---
  if (method === 'GET' && pathname.match(/\/signin\/([^/]+)$/)) {
    const match = pathname.match(/\/signin\/([^/]+)$/)
    const provider = match ? match[1] : null

    if (!provider) {
      return new Response('Provider not specified', { status: 400 })
    }

    if (!auth.signin.provider) {
      return new Response(JSON.stringify({ error: 'OAuth plugin not installed or misconfigured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    try {
      const { url: authUrl, state } = await auth.signin.provider(provider)

      const response = Response.redirect(authUrl, 302)

      if (state) {
        response.headers.append('Set-Cookie', serializeCookie(`oauth_state_${provider}`, state, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Lax',
          maxAge: 60 * 10
        }))
      }

      return response
    } catch (error: any) {
      return Response.redirect(appendQueryParam(errorRedirect, 'error', error.message), 302)
    }
  }

  if (method === 'GET' && pathname.match(/\/callback\/([^/]+)$/)) {
    const match = pathname.match(/\/callback\/([^/]+)$/)
    const provider = match ? match[1] : null
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    if (!provider) {
      return new Response('Provider not specified', { status: 400 })
    }

    if (!code) {
      return Response.redirect(appendQueryParam(errorRedirect, 'error', 'missing_code'), 302)
    }

    try {
      if (!auth.signin.providerCallback) {
        throw new Error('OAuth plugin not installed or misconfigured (missing providerCallback)')
      }

      const cookies = parseCookies(request.headers.get('Cookie'))
      const savedState = cookies[`oauth_state_${provider}`]

      const { user, token } = await auth.signin.providerCallback(provider, code, state!, savedState)

      const response = Response.redirect(successRedirect, 302)

      response.headers.append('Set-Cookie', serializeCookie(`oauth_state_${provider}`, '', { path: '/', maxAge: 0 }))

      if (token) {
        response.headers.append('Set-Cookie', serializeCookie(cookieName, token, cookieOptions))
      }

      return response
    } catch (error: any) {
      return Response.redirect(appendQueryParam(errorRedirect, 'error', error.message), 302)
    }
  }

  if (method === 'GET' && pathname.endsWith('/session')) {
    const { user, token } = await auth.getSession(request);
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
