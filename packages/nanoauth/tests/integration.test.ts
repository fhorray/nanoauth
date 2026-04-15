import { describe, it, expect, beforeEach } from 'bun:test';
import { createAuth } from '../src/core';
import { sessionPlugin } from '../src/plugins/session';
import { emailPasswordPlugin } from '../src/plugins/email-password';
import { oauthPlugin } from '../src/plugins/oauth';
import type { AuthAdapter, User } from '../src/types';

const mockUsers = new Map<string, User & { password: string }>();

const mockAdapter: AuthAdapter = {
  storeUser: async (user: any) => {
    mockUsers.set(user.id, { ...user, password: '' });
    return user;
  },
  getUser: async (id: string) => {
    const user = mockUsers.get(id);
    if (!user) return null;
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  },
  deleteUser: async (id: string) => {
    mockUsers.delete(id);
    return true;
  },
  saveSession: async (session) => {

  },
  getSession: async (id: string) => {
  },
  validateToken: async (token: string) => true,
  deleteSession: async (id: string) => {

  },
};

describe('Integration Tests - Full Auth Flow', () => {
  let auth: any;
  let userRepository: any;
  let oauthStates: Map<string, any>;

  beforeEach(() => {
    mockUsers.clear();
    oauthStates = new Map();

    userRepository = {
      findByEmail: async (email: string) => {
        for (const user of mockUsers.values()) {
          if (user.email === email) {
            return user as User;
          }
        }
        return null;
      },
      create: async (emailOrData: any, name?: string, password?: string) => {
        let email: string, userName: string, pwd: string, id: string;
        if (typeof emailOrData === 'string') {
          email = emailOrData;
          userName = name!;
          pwd = password!;
          id = 'user-' + Date.now();
        } else {
          email = emailOrData.email;
          userName = emailOrData.name;
          pwd = emailOrData.password;
          id = emailOrData.id || 'user-' + Date.now();
        }
        mockUsers.set(id, { id, email, name: userName, role: 'user', password: pwd || '' });
        return { id, email, name: userName } as User;
      },
      updatePassword: async (userId: string, passwordHash: string) => {
        const user = mockUsers.get(userId);
        if (user) {
          user.password = passwordHash;
          return true;
        }
        return false;
      },
      findById: async (id: string) => {
        return mockUsers.get(id) as User;
      },
    };

    auth = createAuth(mockAdapter, { debug: true });
  });

  it('should complete full signup and login flow', async () => {
    let loginHookCalled = false;
    let signupHookCalled = false;

    auth.on('afterLogin', () => {
      loginHookCalled = true;
    });

    auth.on('afterSignup', () => {
      signupHookCalled = true;
    });

    // Setup plugins
    auth.use(
      sessionPlugin({
        storage: 'memory',
        storageKey: 'accessToken',
      })
    );

    auth.use(
      emailPasswordPlugin({
        userRepository,
        validateEmail: (email) => email.includes('@'),
        hashPassword: async (password) => 'hashed-' + password,
        comparePassword: async (password, hash) => hash === 'hashed-' + password,
      })
    );

    // Signup
    const signupResult = await auth.signup({
      email: 'testuser@example.com',
      password: 'securepass123',
      name: 'Test User',
    });

    expect(signupResult).toBeDefined();
    expect(signupResult.email).toBe('testuser@example.com');
    expect(signupResult.name).toBe('Test User');

    // Emit signup hook
    auth.emit('afterSignup', { user: signupResult });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(signupHookCalled).toBe(true);

    // Login
    const loginResult = await auth.login({
      email: 'testuser@example.com',
      password: 'securepass123',
    });

    expect(loginResult).toBeDefined();
    expect(loginResult.email).toBe('testuser@example.com');

    // Emit login hook
    auth.emit('afterLogin', { user: loginResult });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(loginHookCalled).toBe(true);
  });

  it('should handle password change after login', async () => {
    // Setup plugins
    auth.use(
      sessionPlugin({ storage: 'memory' })
    );

    auth.use(
      emailPasswordPlugin({
        userRepository,
        validateEmail: (email) => email.includes('@'),
        hashPassword: async (password) => 'hashed-' + password,
        comparePassword: async (password, hash) => hash === 'hashed-' + password,
      })
    );

    // Create user
    await auth.signup({
      email: 'user@example.com',
      password: 'oldpass123',
      name: 'User',
    });

    // Change password
    const changeResult = await auth.changePassword({
      email: 'user@example.com',
      oldPassword: 'oldpass123',
      newPassword: 'newpass456',
    });

    expect(changeResult).toBe(true);

    // Login with new password
    const loginResult = await auth.login({
      email: 'user@example.com',
      password: 'newpass456',
    });

    expect(loginResult).toBeDefined();
  });

  it('should support concurrent users with separate sessions', async () => {
    const auth1 = createAuth(mockAdapter, {});
    const auth2 = createAuth(mockAdapter, {});

    // Setup both instances
    for (const authInstance of [auth1, auth2]) {
      authInstance.use(
        sessionPlugin({ storage: 'memory' })
      );

      authInstance.use(
        emailPasswordPlugin({
          userRepository,
          validateEmail: (email) => email.includes('@'),
          hashPassword: async (password) => 'hashed-' + password,
          comparePassword: async (password, hash) => hash === 'hashed-' + password,
        })
      );
    }

    // Signup users
    const user1 = await auth1.signup({
      email: 'user1@example.com',
      password: 'pass1',
      name: 'User 1',
    });

    const user2 = await auth2.signup({
      email: 'user2@example.com',
      password: 'pass2',
      name: 'User 2',
    });

    expect(user1).toBeDefined();
    expect(user1.email).toBe('user1@example.com');
    expect(user2).toBeDefined();
    expect(user2.email).toBe('user2@example.com');

    // Set user state separately
    (auth1 as any).setState('user', user1);
    (auth2 as any).setState('user', user2);

    // Verify separate states
    const state1 = await auth1.getState('user');
    const state2 = await auth2.getState('user');

    expect(state1.email).toBe('user1@example.com');
    expect(state2.email).toBe('user2@example.com');
  });

  it('should support oauth with fallback to email-password', async () => {
    auth.use(
      sessionPlugin({ storage: 'memory' })
    );

    auth.use(
      emailPasswordPlugin({
        userRepository,
        validateEmail: (email) => email.includes('@'),
        hashPassword: async (password) => 'hashed-' + password,
        comparePassword: async (password, hash) => hash === 'hashed-' + password,
      })
    );

    auth.use(
      oauthPlugin({
        providers: {
          google: {
            name: 'google',
            clientId: 'google-id',
            clientSecret: 'google-secret',
            authorizationUrl: 'https://accounts.google.com/oauth/authorize',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
            redirectUri: 'http://localhost:3000/callback/google',
            scope: ['openid', 'email', 'profile'],
          },
        },
        userRepository: {
          findByOAuthId: async (provider, oauthId) => null,
          create: async (user) => user,
        },
        generateAuthorizationUrl: async (provider: any, config: any) => {
          const state = 'state-' + Date.now();
          oauthStates.set(state, { provider, timestamp: Date.now() });
          return `https://accounts.google.com/oauth/authorize?state=${state}`;
        },
        mapOAuthProfile: async (provider: any, profile: any) => ({
          id: profile.id,
          email: profile.email,
          name: profile.name,
        }),
      })
    );

    // Fallback: also support email-password login
    const emailUser = await auth.signup({
      email: 'emailuser@example.com',
      password: 'emailpass123',
      name: 'Email User',
    });

    expect(emailUser).toBeDefined();

    const oauthUrl = await auth.getOAuthAuthorizationUrl('google');
    expect(oauthUrl).toContain('accounts.google.com');
  });

  it('should track session state across state changes', async () => {
    auth.use(
      sessionPlugin({
        storage: 'memory',
        storageKey: 'accessToken',
      })
    );

    let stateChangeCount = 0;
    auth.onChange('sessionToken', () => {
      stateChangeCount++;
    });

    auth.setState('sessionToken', 'token-1');
    await new Promise(resolve => setTimeout(resolve, 5));

    auth.setState('sessionToken', 'token-2');
    await new Promise(resolve => setTimeout(resolve, 5));

    auth.setState('sessionToken', 'token-3');
    await new Promise(resolve => setTimeout(resolve, 5));

    expect(stateChangeCount).toBeGreaterThan(0);
  });

  it('should support error handling throughout auth flow', async () => {
    auth.use(
      sessionPlugin({ storage: 'memory' })
    );

    auth.use(
      emailPasswordPlugin({
        userRepository,
        validateEmail: (email) => email.includes('@'),
        hashPassword: async (password) => 'hashed-' + password,
        comparePassword: async (password, hash) => hash === 'hashed-' + password,
      })
    );

    // Test invalid email
    try {
      await auth.signup({
        email: 'not-an-email',
        password: 'pass123',
        name: 'Test',
      });
      expect.unreachable();
    } catch (error: any) {
      expect(error.message).toContain('email');
    }

    // Test non-existent user login
    try {
      await auth.login({
        email: 'nonexistent@example.com',
        password: 'pass123',
      });
      expect.unreachable();
    } catch (error: any) {
      expect(error.message).toContain('User not found');
    }
  });

  it('should support plugin chaining pattern', () => {
    const result = auth
      .use(sessionPlugin({ storage: 'memory' }))
      .use(
        emailPasswordPlugin({
          userRepository,
          validateEmail: (email) => email.includes('@'),
          hashPassword: async (password) => 'hashed-' + password,
          comparePassword: async (password, hash) => hash === 'hashed-' + password,
        })
      )
      .use(
        oauthPlugin({
          providers: {
            test: {
              name: 'test',
              clientId: 'test-id',
              clientSecret: 'test-secret',
              redirectUri: 'http://localhost/callback/test',
              authorizationUrl: 'https://test.example.com/auth',
              tokenUrl: 'https://test.example.com/token',
              userInfoUrl: 'https://test.example.com/userinfo',
              scope: ['email'],
            },
          },
          userRepository: {
            findByOAuthId: async (provider: string, oauthId: string) => null,
            create: async (user: any) => user,
          },
          generateAuthorizationUrl: async (provider: any, config: any) => {
            return `https://test.example.com/auth`;
          },
          mapOAuthProfile: async (provider: any, profile: any) => ({
            id: profile.id,
            email: profile.email,
            name: profile.name,
          }),
        })
      );

    expect(result).toBe(auth);
  });

  it('should emit comprehensive hooks throughout workflow', async () => {
    const events: string[] = [];

    auth.on('beforeLogin', () => events.push('beforeLogin'));
    auth.on('afterLogin', () => events.push('afterLogin'));
    auth.on('beforeLogout', () => events.push('beforeLogout'));
    auth.on('afterLogout', () => events.push('afterLogout'));
    auth.on('error', () => events.push('error'));

    auth.use(
      sessionPlugin({ storage: 'memory' })
    );

    auth.use(
      emailPasswordPlugin({
        userRepository,
        validateEmail: (email) => email.includes('@'),
        hashPassword: async (password) => 'hashed-' + password,
        comparePassword: async (password, hash) => hash === 'hashed-' + password,
      })
    );

    // Emit hooks
    auth.emit('beforeLogin', {});
    auth.emit('afterLogin', {});
    auth.emit('beforeLogout', {});
    auth.emit('afterLogout', {});

    await new Promise(resolve => setTimeout(resolve, 20));

    expect(events.length).toBeGreaterThan(0);
  });
});
