/**
 * NanoAuth - Session Plugin (Stateless Server)
 * 
 * Manages server-side session lifecycle hooks.
 * Client-side persistence is now handled by @nanoauth/client.
 */

import type { AuthCoreInstance, Plugin, User } from '../types'
import { definePlugin } from '../utils'

export interface SessionConfig<TUser extends User = User> {
  /** Custom token validation logic */
  validateToken?: (token: string) => Promise<boolean>
}

/**
 * Session management plugin (Server Side)
 */
export const sessionPlugin = definePlugin(<TUser extends User = User>(config: SessionConfig<TUser> = {}) => {
  return {
    name: 'session',

    hooks: (auth: AuthCoreInstance<TUser>) => ({
      afterSignin: async ({ token, user }: any) => {
        if (token && user && auth.adapter.saveSession) {
          const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h default
          await auth.adapter.saveSession(token, { userId: user.id, ...user, expiresAt });
        }
      },
      afterLogout: async () => {
        // Stateless core doesn't track current token globally.
        // Logout cleanup is handled in the handler via cookie clearing.
      }
    }),

    exports: (auth: AuthCoreInstance<TUser>) => ({
      session: {
        validate: async (token: string) => {
          if (config.validateToken) return config.validateToken(token);
          return auth.adapter.validateToken ? auth.adapter.validateToken(token) : true;
        }
      }
    })
  };
});
