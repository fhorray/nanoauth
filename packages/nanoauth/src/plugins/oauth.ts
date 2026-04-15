import { generateId as createID, timingSafeEqual, encodeBase64 } from '../utils'
import type { AuthCoreInstance, Plugin, User } from '../types'
import { SecurityError } from '../errors'

const oauthStateMap = new Map<string, string>()

export interface OAuthProvider {
  name: string
  clientId: string
  clientSecret: string
  authorizationUrl: string
  tokenUrl: string
  userInfoUrl: string
  redirectUri: string
  scope: string[]
  [key: string]: any
}

export interface OAuthConfig<TUser extends User = User> {
  providers: Record<string, OAuthProvider>
  userRepository: {
    findByOAuthId(provider: string, oauthId: string): Promise<TUser | null>
    create(user: TUser): Promise<TUser>
    linkAccount?(userId: string, provider: string, oauthId: string): Promise<void>
    [key: string]: any
  }
  mapOAuthProfile?: (provider: string, profile: any) => Partial<TUser>
  generateToken?: (user: TUser) => string | Promise<string>
  exchangeCodeForToken?: (provider: string, code: string, config: any) => Promise<any>
  getProfile?: (provider: string, token: any) => Promise<any>
  generateAuthorizationUrl?: (provider: string, config: OAuthProvider) => string | Promise<string>
}

/**
 * OAuth Authentication Plugin
 */
export function oauthPlugin<TUser extends User = User>(config: OAuthConfig<TUser>): Plugin<TUser> {
  return {
    name: 'oauth',

    async setup(auth: AuthCoreInstance<TUser>) {
      // Get authorization URL
      ; auth.getOAuthAuthorizationUrl = async (provider: string) => {
        const providerConfig = config.providers[provider]
        if (!providerConfig) {
          throw new Error(`Provider "${provider}" not found`)
        }

        if (config.generateAuthorizationUrl) {
          return await config.generateAuthorizationUrl(provider, providerConfig)
        }

        // Generate random state
        const state = createID(32)

        // Save state in memory/localStorage
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(`oauth_state_${provider}`, state)
        } else {
          oauthStateMap.set(`oauth_state_${provider}`, state)
        }


        const params = new URLSearchParams({
          client_id: providerConfig.clientId,
          redirect_uri: providerConfig.redirectUri,
          response_type: 'code',
          scope: (providerConfig.scope || []).join(' '),
          state
        })

        return `${providerConfig.authorizationUrl || 'https://auth.example.com/authorize'}?${params.toString()}`
      }

        // OAuth Callback handler
        ; auth.handleOAuthCallback = async (provider: string, code: string, state: string) => {
          try {
            const providerConfig = config.providers[provider]
            if (!providerConfig) {
              throw new Error(`Provider "${provider}" not found`)
            }

            // Validate state
            let savedState: string | null = null
            if (typeof sessionStorage !== 'undefined') {
              savedState = sessionStorage.getItem(`oauth_state_${provider}`)
              sessionStorage.removeItem(`oauth_state_${provider}`) // Immediate invalidation to prevent replay attacks
            } else {
              savedState = oauthStateMap.get(`oauth_state_${provider}`) || null
              oauthStateMap.delete(`oauth_state_${provider}`) // Immediate invalidation
            }

            if (!state || !savedState || !timingSafeEqual(new TextEncoder().encode(state), new TextEncoder().encode(savedState))) {
              throw new SecurityError('State mismatch - possible CSRF or replay attack attempt')
            }

            auth.setState('isLoading', true)
            auth.emit('beforeOAuthCallback', { provider, code })

            // Exchange code for token
            let tokenResponse: any;
            if (config.exchangeCodeForToken) {
              tokenResponse = await config.exchangeCodeForToken(provider, code, providerConfig)
            } else {
              tokenResponse = await fetch(providerConfig.tokenUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  client_id: providerConfig.clientId,
                  client_secret: providerConfig.clientSecret,
                  code,
                  redirect_uri: providerConfig.redirectUri,
                  grant_type: 'authorization_code'
                })
              }).then((r) => r.json())
            }

            const accessToken = tokenResponse.access_token
            if (!accessToken) {
              throw new Error('Failed to obtain access token')
            }

            // Fetch user data
            let profile: any;
            if (config.getProfile) {
              profile = await config.getProfile(provider, accessToken)
            } else {
              profile = await fetch(providerConfig.userInfoUrl, {
                headers: { Authorization: `Bearer ${accessToken}` }
              }).then((r) => r.json())
            }

            // Map user profile (customizable)
            const userData = config.mapOAuthProfile?.(provider, profile) ?? {
              email: profile.email,
              name: profile.name ?? profile.login,
              avatar: profile.picture ?? profile.avatar_url
            }

            // Find or create user
            let user = await config.userRepository.findByOAuthId(provider, profile.id ?? profile.sub)

            if (!user) {
              // Create new user
              user = await config.userRepository.create({
                id: createID(),
                ...userData,
                createdAt: new Date()
              } as any)
            }

            // Link account (create provider connection)
            if (config.userRepository.linkAccount) {
              await config.userRepository.linkAccount(user!.id, provider, profile.id ?? profile.sub)
            }

            // Generate token
            const token = await (config.generateToken?.(user) ?? generateSimpleToken(user))

            // Update state
            auth.setState('user', user)
            auth.setState('token', token)
            auth.setState('error', null)
            auth.setState('isLoading', false)

            auth.emit('afterLogin', { user, token, provider })

            return user
          } catch (error) {
            auth.setState('error', error as Error)
            auth.setState('isLoading', false)
            auth.emit('onError', error)
            throw error
          }
        }

        // Logout
        ; auth.logout = async () => {
          try {
            auth.setState('isLoading', true)
            auth.emit('beforeLogout', {})

            // Clear state
            auth.setState('user', null)
            auth.setState('token', null)
            auth.setState('error', null)
            auth.setState('isLoading', false)

            auth.emit('afterLogout', {})
          } catch (error) {
            auth.setState('error', error as Error)
            auth.setState('isLoading', false)
          }
        }
    }
  }
}

/**
 * Generate simple token
 */
function generateSimpleToken(user: User): string {
  const payload = JSON.stringify({ userId: user.id, timestamp: Date.now() });
  return encodeBase64(new TextEncoder().encode(payload));
}
