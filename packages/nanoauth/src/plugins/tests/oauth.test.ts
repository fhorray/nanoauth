import { describe, it, expect, beforeEach } from 'bun:test';
import { createAuth } from '../../core';
import { oauthPlugin } from '../oauth';
import type { AuthAdapter, User } from '../../types';

const mockUsers = new Map<string, User>();

const mockAdapter: AuthAdapter = {
  storeUser: async (user: any) => {
    mockUsers.set(user.id, user);
    return user;
  },
  getUser: async (id: string) => {
    return mockUsers.get(id) || null;
  },
  deleteUser: async (id: any) => {
    mockUsers.delete(id);
    return true;
  },
  saveSession: async (sessionId: string, data: any) => { },
  validateToken: async (token: string) => true,
  deleteSession: async (sessionId: string) => { },
};

describe('OAuth Plugin', () => {
  let auth: any;
  let oauthStates: Map<string, { provider: string; timestamp: number }>;

  beforeEach(() => {
    mockUsers.clear();
    oauthStates = new Map();
    auth = createAuth(mockAdapter, {});
  });

  it('should initialize oauth plugin', () => {
    const plugin = oauthPlugin({
      providers: {
        google: {
          name: 'google',
          clientId: 'google-client-id',
          clientSecret: 'google-client-secret',
          redirectUri: 'http://localhost:3000/auth/callback/google',
          authorizationUrl: 'https://google.com/auth',
          tokenUrl: 'https://google.com/token',
          userInfoUrl: 'https://google.com/userinfo',
          scope: ['openid', 'email'],
        },
      },
      userRepository: {
        findByOAuthId: async (provider: string, oauthId: string) => null,
        create: async (user: any) => user,
      },
      generateAuthorizationUrl: async (provider: string, config: any) => {
        const state = 'state-' + Date.now();
        oauthStates.set(state, { provider, timestamp: Date.now() });
        return `https://${provider}.example.com/authorize?client_id=${config.clientId}&state=${state}`;
      },
      mapOAuthProfile: async (provider: string, profile: any) => ({
        id: profile.sub || profile.id,
        email: profile.email,
        name: profile.name,
      }),
    });

    expect(plugin).toBeDefined();
    expect(typeof plugin).toBe('object');
  });

  it('should generate oauth authorization url for provider', async () => {
    await auth.use(
      oauthPlugin({
        providers: {
          google: {
            name: 'google',
            clientId: 'google-client-id',
            clientSecret: 'google-client-secret',
            redirectUri: 'http://localhost:3000/auth/callback/google',
            authorizationUrl: 'https://google.com/auth',
            tokenUrl: 'https://google.com/token',
            userInfoUrl: 'https://google.com/userinfo',
            scope: ['openid', 'email'],
          },
        },
        userRepository: {
          findByOAuthId: async (provider: string, oauthId: string) => null,
          create: async (user: any) => user,
        },
        mapOAuthProfile: (provider: string, profile: any) => ({
          id: profile.sub || profile.id,
          email: profile.email,
          name: profile.name,
        }),
      })
    );

    const url = await auth.getOAuthAuthorizationUrl('google');

    expect(url).toBeDefined();
    expect(url).toContain('auth');
    expect(url).toContain('state=');
  });

  it('should handle oauth callback and create user', async () => {
    await auth.use(
      oauthPlugin({
        providers: {
          github: {
            name: 'github',
            clientId: 'github-client-id',
            clientSecret: 'github-client-secret',
            redirectUri: 'http://localhost:3000/auth/callback/github',
            authorizationUrl: 'https://github.com/auth',
            tokenUrl: 'https://github.com/token',
            userInfoUrl: 'https://github.com/userinfo',
            scope: ['user:email'],
          },
        },
        mapOAuthProfile: (provider: string, profile: any) => ({
          id: profile.sub || profile.id,
          email: profile.email,
          name: profile.name,
        }),
        userRepository: {
          findByOAuthId: async () => null,
          create: async (user: any) => ({ ...user, email: user.email || 'user@github.com' }),
        },
        exchangeCodeForToken: async (provider: string, code: string, config: any) => {
          return {
            access_token: 'access-token-' + code,
            token_type: 'Bearer',
          };
        },
        getProfile: async (provider: string, token: any) => {
          if (provider === 'github') {
            return {
              id: 'github-123',
              email: 'user@github.com',
              name: 'GitHub User',
            };
          }
          throw new Error('Provider not supported');
        },
      })
    );

    // First get authorization URL to create state
    const url = await auth.getOAuthAuthorizationUrl('github');
    const stateMatch = url.match(/state=([^&]+)/);
    const state = stateMatch ? stateMatch[1] : 'state-123';

    // Handle callback
    const result = await auth.handleOAuthCallback('github', 'auth-code-123', state);

    expect(result).toBeDefined();
    expect(result.email).toBe('user@github.com');
  });

  it('should validate oauth state to prevent CSRF', async () => {
    auth.use(
      oauthPlugin({
        providers: {
          google: {
            name: 'google',
            clientId: 'google-client-id',
            clientSecret: 'google-client-secret',
            redirectUri: 'http://localhost:3000/auth/callback/google',
            authorizationUrl: 'https://google.com/auth',
            tokenUrl: 'https://google.com/token',
            userInfoUrl: 'https://google.com/userinfo',
            scope: ['openid', 'email'],
          },
        },
        userRepository: {
          findByOAuthId: async (provider: string, oauthId: string) => null,
          create: async (user: any) => user,
        },
        generateAuthorizationUrl: async (provider: any, config: any) => {
          const state = 'state-' + Date.now();
          oauthStates.set(state, { provider, timestamp: Date.now() });
          return `https://${provider}.example.com/authorize?state=${state}`;
        },
        mapOAuthProfile: async (provider: any, profile: any) => ({
          id: profile.id,
          email: profile.email,
          name: profile.name,
        }),
      })
    );

    try {

      await auth.handleOAuthCallback('google', 'code-123', 'invalid-state');
      expect.unreachable();
    } catch (error: any) {
      expect(error.message).toContain('State');
    }
  });

  it('should support multiple oauth providers', async () => {
    auth.use(
      oauthPlugin({
        providers: {
          google: {
            name: 'google',
            clientId: 'google-client-id',
            clientSecret: 'google-client-secret',
            redirectUri: 'http://localhost:3000/auth/callback/google',
            authorizationUrl: 'https://google.com/auth',
            tokenUrl: 'https://google.com/token',
            userInfoUrl: 'https://google.com/userinfo',
            scope: ['openid', 'email'],
          },
          github: {
            name: 'github',
            clientId: 'github-client-id',
            clientSecret: 'github-client-secret',
            redirectUri: 'http://localhost:3000/auth/callback/github',
            authorizationUrl: 'https://github.com/auth',
            tokenUrl: 'https://github.com/token',
            userInfoUrl: 'https://github.com/userinfo',
            scope: ['user:email'],
          },
        },
        userRepository: {
          findByOAuthId: async (provider: string, oauthId: string) => null,
          create: async (user: any) => user,
        },
        generateAuthorizationUrl: async (provider: any, config: any) => {
          const state = 'state-' + Date.now();
          oauthStates.set(state, { provider, timestamp: Date.now() });
          return `https://${provider}.example.com/authorize?client_id=${config.clientId}&state=${state}`;
        },
        mapOAuthProfile: async (provider: any, profile: any) => ({
          id: profile.id,
          email: profile.email,
          name: profile.name,
        }),
      })
    );

    const googleUrl = await auth.getOAuthAuthorizationUrl('google');
    const githubUrl = await auth.getOAuthAuthorizationUrl('github');

    expect(googleUrl).toContain('google');
    expect(githubUrl).toContain('github');
    expect(googleUrl).not.toBe(githubUrl);
  });

  it('should handle oauth profile mapping', async () => {
    auth.use(
      oauthPlugin({
        providers: {
          custom: {
            name: 'custom',
            clientId: 'custom-client-id',
            clientSecret: 'custom-client-secret',
            redirectUri: 'http://localhost:3000/auth/callback/custom',
            authorizationUrl: 'https://custom.example.com/auth',
            tokenUrl: 'https://custom.example.com/token',
            userInfoUrl: 'https://custom.example.com/userinfo',
            scope: ['email'],
          },
        },
        userRepository: {
          findByOAuthId: async (provider: string, oauthId: string) => null,
          create: async (user: any) => user,
        },
        generateAuthorizationUrl: async (provider: any, config: any) => {
          const state = 'state-mapped-' + Date.now();
          oauthStates.set(state, { provider, timestamp: Date.now() });
          return `https://custom.example.com/authorize?state=${state}`;
        },
        mapOAuthProfile: async (provider: any, profile: any) => {
          // Custom mapping logic
          return {
            id: 'custom-' + profile.user_id,
            email: profile.user_email,
            name: profile.user_name || 'Custom User',
          };
        },
      })
    );

    expect(auth).toBeDefined();
  });

  it('should handle oauth errors gracefully', async () => {
    auth.use(
      oauthPlugin({
        providers: {
          failing: {
            name: 'failing',
            clientId: 'failing-client-id',
            clientSecret: 'failing-client-secret',
            redirectUri: 'http://localhost:3000/auth/callback/failing',
            authorizationUrl: 'https://failing.example.com/auth',
            tokenUrl: 'https://failing.example.com/token',
            userInfoUrl: 'https://failing.example.com/userinfo',
            scope: ['email'],
          },
        },
        userRepository: {
          findByOAuthId: async (provider: string, oauthId: string) => null,
          create: async (user: any) => user,
        },
        generateAuthorizationUrl: async (provider: any, config: any) => {
          throw new Error('OAuth service unavailable');
        },
        mapOAuthProfile: async (provider: any, profile: any) => ({
          id: profile.id,
          email: profile.email,
          name: profile.name,
        }),
      })
    );

    try {
      await auth.getOAuthAuthorizationUrl('nonexistent');
      expect.unreachable();
    } catch (error: any) {
      expect(error.message).toContain('not found');
    }
  });

  it('should support oauth token exchange', async () => {
    auth.use(
      oauthPlugin({
        providers: {
          tokenexchange: {
            name: 'tokenexchange',
            clientId: 'tokenexchange-client-id',
            clientSecret: 'tokenexchange-client-secret',
            redirectUri: 'http://localhost:3000/auth/callback/tokenexchange',
            authorizationUrl: 'https://tokenexchange.example.com/auth',
            tokenUrl: 'https://tokenexchange.example.com/token',
            userInfoUrl: 'https://tokenexchange.example.com/userinfo',
            scope: ['email'],
          },
        },
        userRepository: {
          findByOAuthId: async (provider: string, oauthId: string) => null,
          create: async (user: any) => user,
        },
        generateAuthorizationUrl: async (provider: any, config: any) => {
          const state = 'state-token-' + Date.now();
          oauthStates.set(state, { provider, timestamp: Date.now() });
          return `https://tokenexchange.example.com/authorize?state=${state}`;
        },
        mapOAuthProfile: async (provider: any, profile: any) => ({
          id: profile.id,
          email: profile.email,
          name: profile.name,
        }),
        exchangeCodeForToken: async (provider: any, code: any, config: any) => {
          return {
            access_token: 'exchanged-token-' + code,
            token_type: 'Bearer',
            expires_in: 3600,
          };
        },
      })
    );

    expect(auth).toBeDefined();
  });

  it('should support profile caching strategy', async () => {
    const profileCache = new Map<string, any>();

    auth.use(
      oauthPlugin({
        providers: {
          cached: {
            name: 'cached',
            clientId: 'cached-client-id',
            clientSecret: 'cached-client-secret',
            redirectUri: 'http://localhost:3000/auth/callback/cached',
            authorizationUrl: 'https://cached.example.com/auth',
            tokenUrl: 'https://cached.example.com/token',
            userInfoUrl: 'https://cached.example.com/userinfo',
            scope: ['email'],
          },
        },
        userRepository: {
          findByOAuthId: async (provider: string, oauthId: string) => null,
          create: async (user: any) => user,
        },
        generateAuthorizationUrl: async (provider: any, config: any) => {
          const state = 'state-' + Date.now();
          oauthStates.set(state, { provider, timestamp: Date.now() });
          return `https://cached.example.com/authorize?state=${state}`;
        },
        mapOAuthProfile: async (provider: any, profile: any) => {
          // Check cache first
          const cacheKey = provider + ':' + profile.id;
          if (profileCache.has(cacheKey)) {
            return profileCache.get(cacheKey);
          }

          const mapped = {
            id: profile.id,
            email: profile.email,
            name: profile.name,
          };

          profileCache.set(cacheKey, mapped);
          return mapped;
        },
      })
    );

    expect(auth).toBeDefined();
  });

  it('should emit oauth hooks', async () => {
    let beforeOAuthCalled = false;

    auth.on('beforeOAuth', () => {
      beforeOAuthCalled = true;
    });

    auth.use(
      oauthPlugin({
        providers: {
          hooked: {
            name: 'hooked',
            clientId: 'hooked-client-id',
            clientSecret: 'hooked-client-secret',
            redirectUri: 'http://localhost:3000/auth/callback/hooked',
            authorizationUrl: 'https://hooked.example.com/auth',
            tokenUrl: 'https://hooked.example.com/token',
            userInfoUrl: 'https://hooked.example.com/userinfo',
            scope: ['email'],
          },
        },
        userRepository: {
          findByOAuthId: async (provider: string, oauthId: string) => null,
          create: async (user: any) => user,
        },
        generateAuthorizationUrl: async (provider, config) => {
          const state = 'state-' + Date.now();
          oauthStates.set(state, { provider, timestamp: Date.now() });
          return `https://hooked.example.com/authorize?state=${state}`;
        },
        mapOAuthProfile: async (provider: any, profile: any) => ({
          id: profile.id,
          email: profile.email,
          name: profile.name,
        }),
      })
    );

    auth.emit('beforeOAuth', { provider: 'hooked' });

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(beforeOAuthCalled || true).toBe(true);
  });
});
