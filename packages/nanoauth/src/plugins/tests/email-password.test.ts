import { describe, it, expect, beforeEach } from 'bun:test';
import { createAuth } from '../../core';
import { emailPasswordPlugin } from '../email-password';
import type { AuthAdapter, User } from '../../types';

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
  deleteUser: async (id: any) => {
    mockUsers.delete(id);
    return true;
  },
  saveSession: async (sessionId: string, data: any) => { },
  validateToken: async (token: string) => true,
  deleteSession: async (sessionId: string) => { },
};

describe('Email-Password Plugin', () => {
  let auth: any;
  let userRepository: any;

  beforeEach(() => {
    mockUsers.clear();
    auth = createAuth(mockAdapter, { secret: 'test-secret' });

    userRepository = {
      findByEmail: async (email: string) => {
        for (const user of mockUsers.values()) {
          if (user.email === email) {
            return user as User;
          }
        }
        return null;
      },
      findById: async (id: string) => {
        return mockUsers.get(id) as User;
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
        const user: User & { password: string } = { id, email, name: userName, role: 'user', password: pwd || '' };
        mockUsers.set(id, user);
        return { id, email, name: userName, role: 'user' } as User;
      },
      updatePassword: async (userId: string, passwordHash: string) => {
        const user = mockUsers.get(userId);
        if (user) {
          user.password = passwordHash;
          return true;
        }
        return false;
      },
      delete: async (email: string) => {
        for (const [id, user] of mockUsers.entries()) {
          if (user.email === email) {
            mockUsers.delete(id);
            return true;
          }
        }
        return false;
      },
    };
  });

  it('should initialize email-password plugin', () => {
    const plugin = emailPasswordPlugin({
      userRepository,
      validateEmail: (email: string) => email.includes('@'),
      hashPassword: async (password: string) => 'hashed-' + password,
      comparePassword: async (password: string, hash: string) => hash === 'hashed-' + password,
    });

    expect(plugin).toBeDefined();
    expect(typeof plugin).toBe('object');
  });

  it('should signup new user with email and password', async () => {
    auth.use(
      emailPasswordPlugin({
        userRepository,
        validateEmail: (email: string) => email.includes('@'),
        hashPassword: async (password: string) => 'hashed-' + password,
        comparePassword: async (password: string, hash: string) => hash === 'hashed-' + password,
      })
    );

    const { user, token } = await auth.signup.email({
      email: 'newuser@example.com',
      password: 'password123',
      name: 'New User',
    });

    expect(user).toBeDefined();
    expect(token).toBeDefined();
    expect(user.email).toBe('newuser@example.com');
    expect(user.name).toBe('New User');

    // Verify user was stored
    const storedUser = await userRepository.findByEmail('newuser@example.com');
    expect(storedUser).toBeDefined();
    expect(storedUser.email).toBe('newuser@example.com');
  });

  it('should prevent signup with invalid email', async () => {
    auth.use(
      emailPasswordPlugin({
        userRepository,
        validateEmail: (email: string) => email.includes('@'),
        hashPassword: async (password: string) => 'hashed-' + password,
        comparePassword: async (password: string, hash: string) => hash === 'hashed-' + password,
      })
    );

    try {
      await auth.signup.email({
        email: 'invalid-email',
        password: 'password123',
        name: 'Invalid',
      });
      expect.unreachable();
    } catch (error: any) {
      expect(error.message).toContain('Invalid email');
    }
  });

  it('should prevent duplicate email signup', async () => {
    // Create initial user
    await userRepository.create('existing@example.com', 'Existing User', 'hashed-pass123');

    auth.use(
      emailPasswordPlugin({
        userRepository,
        validateEmail: (email: string) => email.includes('@'),
        hashPassword: async (password: string) => 'hashed-' + password,
        comparePassword: async (password: string, hash: string) => hash === 'hashed-' + password,
      })
    );

    try {
      await auth.signup.email({
        email: 'existing@example.com',
        password: 'password123',
        name: 'Duplicate',
      });
      expect.unreachable();
    } catch (error: any) {
      expect(error.message).toContain('already exists');
    }
  });

  it('should login with correct credentials', async () => {
    // Create user
    await userRepository.create('user@example.com', 'Test User', 'hashed-password123');

    auth.use(
      emailPasswordPlugin({
        userRepository,
        validateEmail: (email: string) => email.includes('@'),
        hashPassword: async (password: string) => 'hashed-' + password,
        comparePassword: async (password: string, hash: string) => hash === 'hashed-' + password,
      })
    );

    const { user, token } = await auth.signin.email({
      email: 'user@example.com',
      password: 'password123',
    });

    expect(user).toBeDefined();
    expect(token).toBeDefined();
    expect(user.email).toBe('user@example.com');
    expect(user.name).toBe('Test User');
  });

  it('should reject login with wrong password', async () => {
    // Create user
    await userRepository.create('user@example.com', 'Test User', 'hashed-correct-password');

    auth.use(
      emailPasswordPlugin({
        userRepository,
        validateEmail: (email: string) => email.includes('@'),
        hashPassword: async (password: string) => 'hashed-' + password,
        comparePassword: async (password: string, hash: string) => hash === 'hashed-' + password,
      })
    );

    try {
      await auth.signin.email({
        email: 'user@example.com',
        password: 'wrong-password',
      });
      expect.unreachable();
    } catch (error: any) {
      expect(error.message).toContain('Invalid credentials');
    }
  });

  it('should reject login with non-existent user', async () => {
    auth.use(
      emailPasswordPlugin({
        userRepository,
        validateEmail: (email: string) => email.includes('@'),
        hashPassword: async (password: string) => 'hashed-' + password,
        comparePassword: async (password: string, hash: string) => hash === 'hashed-' + password,
      })
    );

    try {
      await auth.signin.email({
        email: 'nonexistent@example.com',
        password: 'password123',
      });
      expect.unreachable();
    } catch (error: any) {
      expect(error.message).toContain('not found');
    }
  });

  it('should change password for authenticated user', async () => {
    // Create user
    await userRepository.create('user@example.com', 'Test User', 'hashed-oldpassword');

    auth.use(
      emailPasswordPlugin({
        userRepository,
        validateEmail: (email: string) => email.includes('@'),
        hashPassword: async (password: string) => 'hashed-' + password,
        comparePassword: async (password: string, hash: string) => hash === 'hashed-' + password,
      })
    );

    const result = await auth.changePassword({
      email: 'user@example.com',
      oldPassword: 'oldpassword',
      newPassword: 'newpassword',
    });

    expect(result).toBe(true);

    // Verify new password works
    const { user } = await auth.signin.email({
      email: 'user@example.com',
      password: 'newpassword',
    });

    expect(user).toBeDefined();
  });

  it('should reject password change with wrong old password', async () => {
    // Create user
    await userRepository.create('user@example.com', 'Test User', 'hashed-oldpassword');

    auth.use(
      emailPasswordPlugin({
        userRepository,
        validateEmail: (email: string) => email.includes('@'),
        hashPassword: async (password: string) => 'hashed-' + password,
        comparePassword: async (password: string, hash: string) => hash === 'hashed-' + password,
      })
    );

    try {
      await auth.changePassword({
        email: 'user@example.com',
        oldPassword: 'wrongpassword',
        newPassword: 'newpassword',
      });
      expect.unreachable();
    } catch (error: any) {
      expect(error.message).toContain('Invalid password');
    }
  });

  it('should reset password for user', async () => {
    // Create user
    await userRepository.create('user@example.com', 'Test User', 'hashed-oldpassword');

    auth.use(
      emailPasswordPlugin({
        userRepository,
        validateEmail: (email: string) => email.includes('@'),
        hashPassword: async (password: string) => 'hashed-' + password,
        comparePassword: async (password: string, hash: string) => hash === 'hashed-' + password,
      })
    );

    const result = await auth.resetPassword({
      email: 'user@example.com',
      newPassword: 'resetpassword',
    });

    expect(result).toBe(true);

    // Verify new password works
    const { user } = await auth.signin.email({
      email: 'user@example.com',
      password: 'resetpassword',
    });

    expect(user).toBeDefined();
  });

  it('should support custom password validation', async () => {
    await auth.use(
      emailPasswordPlugin({
        userRepository,
        validateEmail: (email: string) => email.includes('@'),
        validatePassword: (password: string) => password.length >= 8,
        hashPassword: async (password: string) => 'hashed-' + password,
        comparePassword: async (password: string, hash: string) => hash === 'hashed-' + password,
      })
    );

    try {
      await auth.signup.email({
        email: 'user@example.com',
        password: 'short', // Only 5 characters
        name: 'Test',
      });
      expect.unreachable();
    } catch (error: any) {
      expect(error.message).toContain('Password');
    }
  });

  it('should emit hooks on signup', async () => {
    let signupHookCalled = false;

    auth.on('afterSignup', () => {
      signupHookCalled = true;
    });

    auth.use(
      emailPasswordPlugin({
        userRepository,
        validateEmail: (email: string) => email.includes('@'),
        hashPassword: async (password: string) => 'hashed-' + password,
        comparePassword: async (password: string, hash: string) => hash === 'hashed-' + password,
      })
    );

    await auth.signup.email({
      email: 'user@example.com',
      password: 'password123',
      name: 'Test User',
    });

    expect(signupHookCalled).toBe(true);
  });
});
