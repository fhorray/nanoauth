/**
 * NanoAuth - Session Plugin
 * 
 * Manages sessions and tokens
 */

import type { AuthCoreInstance, Plugin, User } from '../types'

export interface SessionConfig<TUser extends User = User> {
  storage?: 'localStorage' | 'sessionStorage' | 'memory' | { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; removeItem: (key: string) => void; }
  storageKey?: string
  refreshTokenKey?: string
  generateToken?: (user: TUser) => string | Promise<string>
  generateRefreshToken?: (user: TUser) => string | Promise<string>
  validateToken?: (token: string) => Promise<boolean>
  refreshTokenFn?: (refreshToken: string) => Promise<string>
  tokenExpirationTime?: number
  autoRefreshTokens?: boolean
  onTokenExpired?: () => void
  onBeforeLogin?: (credentials: any) => void | Promise<void>
}

/**
 * Session management plugin
 */
export function sessionPlugin<TUser extends User = User>(config: SessionConfig<TUser> = {}): Plugin<TUser> {
  const storageType = config.storage ?? 'localStorage'
  const storageKey = config.storageKey ?? 'auth:token'
  const refreshTokenKey = config.refreshTokenKey ?? 'auth:refresh'

  // Get storage implementation
  const getStorage = () => {
    if (typeof storageType === 'object') {
      return storageType
    }
    if (storageType === 'localStorage' && typeof localStorage !== 'undefined') {
      return localStorage
    }
    if (storageType === 'sessionStorage' && typeof sessionStorage !== 'undefined') {
      return sessionStorage
    }
    // Fallback to memory storage
    const map = new Map<string, string>()
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => map.set(key, value),
      removeItem: (key: string) => map.delete(key),
    }
  }

  const storage = getStorage()

  return {
    name: 'session',

    async setup(auth: AuthCoreInstance<TUser>) {
      // Save token when user logs in
      auth.on('afterSignin', async ({ token }: any) => {
        if (token) {
          saveToken(token)
        }
      })

        // Restore session on initialization
        ; auth.restoreSession = async () => {
          let token: string | null = null

          if (storage instanceof Map) {
            token = storage.getItem(storageKey)
          } else {
            token = storage.getItem(storageKey)
          }

          if (!token) return

          try {
            auth.setState('isLoading', true)

            // Validate token if validator function is provided
            if (config.validateToken) {
              const isValid = await config.validateToken(token)
              if (!isValid) {
                await auth.clearSession()
                if (config.onTokenExpired) config.onTokenExpired()
                return
              }
            }

            // Restore session state
            if (auth.adapter?.getUser) {
              auth.setState('token', token)
            }

            auth.setState('isLoading', false)
          } catch (error) {
            await auth.clearSession()
            auth.setState('error', error as Error)
          }
        }

        // Clear session data
        ; auth.clearSession = async () => {
          if (storage instanceof Map) {
            storage.removeItem(storageKey)
            storage.removeItem(refreshTokenKey)
          } else {
            storage.removeItem(storageKey)
            storage.removeItem(refreshTokenKey)
          }

          auth.setState('user', null)
          auth.setState('token', null)
        }

      // Refresh token logic
      if (config.refreshTokenFn) {
        ; auth.refreshToken = async () => {
          let refreshToken: string | null = null

          if (storage instanceof Map) {
            refreshToken = storage.getItem(refreshTokenKey)
          } else {
            refreshToken = storage.getItem(refreshTokenKey)
          }

          if (!refreshToken) {
            throw new Error('No refresh token available')
          }

          const newToken = await config.refreshTokenFn!(refreshToken)
          saveToken(newToken)
          auth.setState('token', newToken)

          return newToken
        }

        // Auto refresh if enabled
        if (config.autoRefreshTokens && config.tokenExpirationTime && process.env.NODE_ENV !== 'test') {
          setInterval(async () => {
            try {
              await auth.refreshToken()
            } catch (error) {
              console.error('Token refresh failed:', error)
            }
          }, (config.tokenExpirationTime ?? 3600000) - 60000)
        }
      }

      // Clear session on logout
      auth.on('afterLogout', async () => {
        await auth.clearSession()
      })

      // Helper function to persist token
      function saveToken(token: string) {
        if (storage instanceof Map) {
          storage.setItem(storageKey, token)
        } else {
          storage.setItem(storageKey, token)
        }
      }
    }
  }
}
