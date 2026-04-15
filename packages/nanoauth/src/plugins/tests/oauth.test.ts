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
    auth = createAuth(mockAdapter, { secret: 'test-secret' });
  });

  const createMockArcticProvider = (name: string) => ({
    createAuthorizationURL: async (state: string, scopes: string[]) => {
      oauthStates.set(state, { provider: name, timestamp: Date.now() });
      return new URL(`https://${name}.example.com/authorize?state=${state}`);
    },
    validateAuthorizationCode: async (code: string) => {
      return {
        accessToken: () => `mock-access-token-${code}`
      };
    }
  });

  it('should initialize oauth plugin', () => {
    const plugin = oauthPlugin({
      providers: {
        google: createMockArcticProvider('google'),
      },
      userRepository: {
        findByOAuthId: async (provider: string, oauthId: string) => null,
        findByEmail: async (email: string) => null,
        create: async (user: any) => user,
      },
      getProfile: async (provider, token) => ({ id: '123', email: 'test@example.com' }),
      mapOAuthProfile: (provider: string, profile: any) => ({
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
          google: createMockArcticProvider('google'),
        },
        userRepository: {
          findByOAuthId: async (provider: string, oauthId: string) => null,
          findByEmail: async (email: string) => null,
          create: async (user: any) => user,
        },
        getProfile: async (provider, token) => ({ id: '123', email: 'test@example.com' }),
        mapOAuthProfile: (provider: string, profile: any) => ({
          id: profile.sub || profile.id,
          email: profile.email,
          name: profile.name,
        }),
      })
    );

    const { url } = await auth.signin.provider('google');

    expect(url).toBeDefined();
    expect(url).toContain('authorize');
    expect(url).toContain('state=');
  });

  it('should handle oauth callback and create user', async () => {
    await auth.use(
      oauthPlugin({
        providers: {
          github: createMockArcticProvider('github'),
        },
        mapOAuthProfile: (provider: string, profile: any) => ({
          id: profile.sub || profile.id,
          email: profile.email,
          name: profile.name,
        }),
        userRepository: {
          findByOAuthId: async (provider: string, oauthId: string) => null,
          findByEmail: async (email: string) => null,
          create: async (user: any) => {
            mockUsers.set(user.id, user);
            return user;
          },
        },
        getProfile: async (provider, token) => ({ id: '123', email: 'github@example.com', name: 'Github User' }),
      })
    );

    const { url, state } = await auth.signin.provider('github');
    const { user, token } = await auth.signin.providerCallback('github', 'auth-code-123', state, state);

    expect(user).toBeDefined();
    expect(token).toBeDefined();
    expect(user.email).toBe('github@example.com');
    expect(user.name).toBe('Github User');
  });

  it('should validate oauth state to prevent CSRF', async () => {
    auth.use(
      oauthPlugin({
        providers: {
          google: createMockArcticProvider('google'),
        },
        userRepository: {
          findByOAuthId: async (provider: string, oauthId: string) => null,
          findByEmail: async (email: string) => null,
          create: async (user: any) => user,
        },
        getProfile: async () => ({ id: '123', email: 'test@example.com' }),
        mapOAuthProfile: async (provider: any, profile: any) => ({
          id: profile.id,
          email: profile.email,
          name: profile.name,
        }),
      })
    );

    try {
      await auth.signin.providerCallback('google', 'code-123', 'invalid-state', 'saved-state');
      expect.unreachable();
    } catch (error: any) {
      expect(error.message).toContain('State mismatch');
    }
  });

  it('should support multiple oauth providers', async () => {
    auth.use(
      oauthPlugin({
        providers: {
          google: createMockArcticProvider('google'),
          github: createMockArcticProvider('github'),
        },
        userRepository: {
          findByOAuthId: async (provider: string, oauthId: string) => null,
          findByEmail: async (email: string) => null,
          create: async (user: any) => user,
        },
        getProfile: async () => ({ id: '123', email: 'test@example.com' }),
        mapOAuthProfile: async (provider: any, profile: any) => ({
          id: profile.id,
          email: profile.email,
          name: profile.name,
        }),
      })
    );

    const { url: googleUrl } = await auth.signin.provider('google');
    const { url: githubUrl } = await auth.signin.provider('github');

    expect(googleUrl).toContain('google');
    expect(githubUrl).toContain('github');
    expect(googleUrl).not.toBe(githubUrl);
  });

  it('should handle oauth errors gracefully', async () => {
    auth.use(
      oauthPlugin({
        providers: {
          failing: createMockArcticProvider('failing'),
        },
        userRepository: {
          findByOAuthId: async (provider: string, oauthId: string) => null,
          findByEmail: async (email: string) => null,
          create: async (user: any) => user,
        },
        getProfile: async () => ({ id: '123', email: 'test@example.com' }),
        mapOAuthProfile: async (provider: any, profile: any) => ({
          id: profile.id,
          email: profile.email,
          name: profile.name,
        }),
      })
    );

    try {
      await auth.signin.provider('nonexistent');
      expect.unreachable();
    } catch (error: any) {
      expect(error.message).toContain('not found');
    }
  });

  it('should emit oauth hooks', async () => {
    let beforeOAuthCalled = false;

    auth.on('beforeOAuthCallback', () => {
      beforeOAuthCalled = true;
    });

    auth.use(
      oauthPlugin({
        providers: {
          hooked: createMockArcticProvider('hooked'),
        },
        userRepository: {
          findByOAuthId: async (provider: string, oauthId: string) => null,
          findByEmail: async (email: string) => null,
          create: async (user: any) => user,
        },
        getProfile: async () => ({ id: '123', email: 'test@example.com' }),
        mapOAuthProfile: async (provider: any, profile: any) => ({
          id: profile.id,
          email: profile.email,
          name: profile.name,
        }),
      })
    );

    const { state } = await auth.signin.provider('hooked');
    await auth.signin.providerCallback('hooked', 'auth-code-123', state, state);

    expect(beforeOAuthCalled).toBe(true);
  });

  it('should merge accounts if email already exists', async () => {
    // 1. Create existing user with email
    const existingUser = await auth.adapter.storeUser({
      id: 'existing-123',
      email: 'merge@example.com',
      name: 'Existing User',
      role: 'user'
    });

    await auth.use(
      oauthPlugin({
        providers: { google: createMockArcticProvider('google') },
        userRepository: {
          findByOAuthId: async () => null, // Not linked yet
          findByEmail: async (email: string) => email === 'merge@example.com' ? existingUser : null,
          findById: async (id: string) => id === 'existing-123' ? existingUser : null,
          linkAccount: async (userId: string, provider: string, oauthId: string) => {
            // Mock link capture
          },
          create: async (user: any) => { throw new Error('Should not create new user!') }
        },
        getProfile: async () => ({ id: 'google-999', email: 'merge@example.com' }),
        mapOAuthProfile: (provider: string, profile: any) => ({
          email: profile.email,
          name: 'Merged Name'
        })
      })
    );

    const { state } = await auth.signin.provider('google');
    const { user, token } = await auth.signin.providerCallback('google', 'code', state, state);

    expect(user.id).toBe('existing-123'); // Should be the same user ID
    expect(user.email).toBe('merge@example.com');
    expect(token).toBeDefined();
  });
});
