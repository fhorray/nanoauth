import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { createAuth, nanoauth } from '../src/core'
import { oauthPlugin } from '../src/plugins/oauth'
import { SecurityError, ValidationError, AuthenticationError } from '../src/errors'
import { handleRequest } from '../src/handler'

describe('Security & Hacker Tests', () => {
  describe('OAuth Replay & CSRF Protection', () => {
    let auth: any
    let mockUserRepository: any

    beforeEach(() => {
      mockUserRepository = {
        findByOAuthId: mock(() => Promise.resolve(null)),
        create: mock((data) => Promise.resolve(data))
      }

      auth = createAuth({
        getUser: mock(() => Promise.resolve(null)),
        saveSession: mock(() => Promise.resolve()),
        validateToken: mock(() => Promise.resolve(true)),
        deleteSession: mock(() => Promise.resolve())
      })
      auth.use(
        oauthPlugin({
          providers: {
            test_provider: {
              name: 'Test',
              clientId: 'test-client',
              clientSecret: 'test-secret',
              authorizationUrl: 'https://test.com/auth',
              tokenUrl: 'https://test.com/token',
              userInfoUrl: 'https://test.com/userinfo',
              redirectUri: 'https://app.com/callback',
              scope: ['email']
            }
          },
          userRepository: mockUserRepository,
          exchangeCodeForToken: mock(() => Promise.resolve({ access_token: 'fake-token' })),
          getProfile: mock(() => Promise.resolve({ id: '123', email: 'test@example.com' }))
        })
      )
    })

    it('should throw SecurityError on CSRF attempt (mismatched state)', async () => {
      // 1. Generate legitimate state
      const authUrl = await auth.getOAuthAuthorizationUrl('test_provider')
      const url = new URL(authUrl)
      const legitimateState = url.searchParams.get('state')

      // 2. Hacker attempts callback with different state
      const hackerState = 'fake-hacker-state'

      let error: any
      try {
        await auth.handleOAuthCallback('test_provider', 'some-code', hackerState)
      } catch (e) {
        error = e
      }

      expect(error).toBeInstanceOf(SecurityError)
      expect(error.message).toContain('State mismatch')
    })

    it('should throw SecurityError on Replay Attack attempt (reusing state)', async () => {
      // 1. Generate legitimate state
      const authUrl = await auth.getOAuthAuthorizationUrl('test_provider')
      const url = new URL(authUrl)
      const state = url.searchParams.get('state') as string

      // 2. Legitimate callback (first use)
      await auth.handleOAuthCallback('test_provider', 'valid-code', state)

      // 3. Hacker attempts to reuse the same state (Replay Attack)
      let error: any
      try {
        await auth.handleOAuthCallback('test_provider', 'hacked-code', state)
      } catch (e) {
        error = e
      }

      expect(error).toBeInstanceOf(SecurityError)
      expect(error.message).toContain('State mismatch')
    })
  })

  describe('Custom Logger Integration', () => {
    it('should use custom logger for internal errors without crashing', () => {
      const mockLogger = {
        warn: mock(),
        error: mock(),
        info: mock(),
        debug: mock()
      }

      const auth = nanoauth({
        logger: mockLogger,
        adapter: {
          getUser: mock(() => Promise.resolve(null)),
          saveSession: mock(() => Promise.resolve()),
          validateToken: mock(() => Promise.resolve(true)),
          deleteSession: mock(() => Promise.resolve())
        }
      })

      // Register a faulty observer to trigger the catch block in setState
      auth.onChange('test_key', () => {
        throw new Error('Observer failure')
      })

      // Use the protected method indirectly if necessary, or just force an error
      // @ts-ignore
      auth.setState('test_key', 'value')

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockLogger.error.mock.calls[0]?.[0]).toContain('Error in observer')
    })
  })

  describe('Handler HTTP Status Mapping', () => {
    it('should map ValidationError to 400 Bad Request', async () => {
      const auth = nanoauth({
        adapter: {
          getUser: mock(),
          saveSession: mock(),
          validateToken: mock(),
          deleteSession: mock()
        }
      })

      auth.signup = mock(() => {
        throw new ValidationError('Invalid email format')
      })

      const req = new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email: 'bad' })
      })

      const res = await handleRequest(req, auth)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Invalid email format')
    })

    it('should map SecurityError to 403 Forbidden', async () => {
      const auth = nanoauth({
        adapter: {
          getUser: mock(),
          saveSession: mock(),
          validateToken: mock(),
          deleteSession: mock()
        }
      })

      auth.login = mock(() => {
        throw new SecurityError('Suspicious activity detected')
      })

      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'hacker@hacker.com' })
      })

      const res = await handleRequest(req, auth)
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('Suspicious activity detected')
    })

    it('should map AuthenticationError to 401 Unauthorized', async () => {
      const auth = nanoauth({
        adapter: {
          getUser: mock(),
          saveSession: mock(),
          validateToken: mock(),
          deleteSession: mock()
        }
      })

      auth.login = mock(() => {
        throw new AuthenticationError('Invalid credentials')
      })

      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'user@user.com' })
      })

      const res = await handleRequest(req, auth)
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Invalid credentials')
    })
  })
})