import { generateId as createID, timingSafeEqual, createHS256JWT } from '../utils'
import type { AuthCoreInstance, User } from '../types'
import { NanoAuthError, SecurityError } from '../errors'
import { definePlugin } from '../utils'

/**
 * Interface compatible with Arctic providers
 */
export interface OAuthProvider {
  createAuthorizationURL(state: string, scopes?: string[]): URL | Promise<URL>;
  validateAuthorizationCode(code: string): Promise<{ accessToken(): string; [key: string]: any }>;
}

export interface OAuthConfig<TUser extends User = User> {
  providers: Record<string, OAuthProvider>
  userRepository: {
    findByOAuthId(provider: string, oauthId: string): Promise<TUser | null>
    findByEmail(email: string): Promise<TUser | null>
    findById(id: string): Promise<TUser | null>
    create(user: TUser): Promise<TUser>
    linkAccount?(userId: string, provider: string, oauthId: string): Promise<void>
    [key: string]: any
  }
  mapOAuthProfile?: (provider: string, profile: any) => Partial<TUser>
  generateToken?: (user: TUser) => string | Promise<string>
  getProfile?: (provider: string, token: any) => Promise<any>
}

/**
 * OAuth Authentication Plugin
 * 
 * Supports professional account merging and strict Arctic typing.
 */
export const oauthPlugin = definePlugin((config: OAuthConfig) => {
  return {
    name: 'oauth',

    exports: (auth: AuthCoreInstance<User>) => {
      return {
        signin: {
          provider: async (provider: string, options?: { scopes?: string[] }) => {
            const providerInstance = config.providers[provider]
            if (!providerInstance) {
              throw new Error(`Provider "${provider}" not found. Ensure it is registered in the oauthPlugin config.`)
            }

            const state = createID(32)
            const scopes = options?.scopes || []
            const url = await providerInstance.createAuthorizationURL(state, scopes)

            return {
              url: url.toString(),
              state
            }
          },

          providerCallback: async (provider: string, code: string, state: string, savedState?: string): Promise<{ user: User, token: string }> => {
            try {
              const providerInstance = config.providers[provider]
              if (!providerInstance) {
                throw new Error(`Provider "${provider}" not found`)
              }

              // Anti-CSRF Validation
              if (!state || !savedState || !timingSafeEqual(new TextEncoder().encode(state), new TextEncoder().encode(savedState))) {
                throw new SecurityError('State mismatch - possible CSRF or replay attack attempt')
              }

              auth.emit('beforeOAuthCallback', { provider, code })

              // Exchange code for tokens
              let tokens;
              try {
                tokens = await providerInstance.validateAuthorizationCode(code)
              } catch (err) {
                throw new Error('Failed to obtain access token: ' + (err as Error).message)
              }

              const accessToken = tokens.accessToken()

              // Fetch raw profile
              if (!config.getProfile) {
                throw new Error(`getProfile method must be implemented in OAuthConfig for provider ${provider} to fetch user data.`)
              }
              const profile = await config.getProfile(provider, accessToken)
              const oauthId = String(profile.id ?? profile.sub)

              // 1. STRATEGY: Find by Social Link
              let user = await config.userRepository.findByOAuthId(provider, oauthId)
              let isNewLink = false

              if (!user) {
                // 2. STRATEGY: Find by Email (Account Merging)
                const userData = config.mapOAuthProfile?.(provider, profile) ?? {
                  email: profile.email,
                  name: profile.name ?? profile.login,
                  avatar: profile.picture ?? profile.avatar_url
                }

                if (userData.email) {
                  user = await config.userRepository.findByEmail(userData.email)
                }

                if (!user) {
                  // 3. STRATEGY: Create New User
                  user = await config.userRepository.create({
                    id: createID(),
                    ...userData,
                    createdAt: new Date()
                  } as any)
                  auth.emit('afterSignup', { user })
                }
                
                isNewLink = true
              }

              // 4. LINKING: Ensure account is linked to the social provider
              if (isNewLink && config.userRepository.linkAccount) {
                await config.userRepository.linkAccount(user!.id, provider, oauthId)
              }

              // Token Generation
              const secretStr = (auth as any).config?.secret;
              const secretBytes = secretStr ? new TextEncoder().encode(secretStr) : new Uint8Array();

              const generateTokenFn = config.generateToken ? config.generateToken : async (user: User) => {
                if (!secretStr) {
                  throw new NanoAuthError('A "secret" is required in nanoauth options to use the default token generation.');
                }
                return createHS256JWT(
                  { userId: user.id, email: user.email },
                  secretBytes,
                  { expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) }
                );
              };

              const token = await generateTokenFn(user!)

              auth.emit('afterSignin', { user, token, provider })

              return { user: user!, token }
            } catch (error) {
              auth.emit('onError', error)
              throw error
            }
          }
        }
      }
    }
  }
})
