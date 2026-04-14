import { describe, it, expect, beforeEach } from 'bun:test';
import { createAuth, AuthCore } from '../src/core';
import { AuthState, AuthAdapter } from '../src/types';

const mockAdapter: AuthAdapter = {
  storeUser: async (user) => user,
  getUser: async (id) => null,
  deleteUser: async (id) => true,
};

describe('AuthCore - Core functionality', () => {
  let auth: AuthCore;

  beforeEach(() => {
    auth = createAuth(mockAdapter, {});
  });

  it('should create an auth instance with createAuth factory', () => {
    expect(auth).toBeDefined();
    expect(auth).toBeInstanceOf(AuthCore);
  });

  it('should initialize with default state', async () => {
    const state = await auth.getState('user');
    expect(state).toBeNull();

    const isAuthenticated = await auth.getState('isAuthenticated');
    expect(isAuthenticated).toBe(false);
  });

  it('should update state via setState', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };

    // @ts-expect-error - protected method
    auth.setState('user', mockUser);

    const user = await auth.getState('user');
    expect(user).toEqual(mockUser);
  });

  it('should notify observers on state change via onChange', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    let notified = false;
    let notifiedValue: any = null;

    auth.onChange('user', (newValue) => {
      notified = true;
      notifiedValue = newValue;
    });

    // @ts-expect-error - protected method
    auth.setState('user', mockUser);

    // Add small delay for observer callback
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(notified).toBe(true);
    expect(notifiedValue).toEqual(mockUser);
  });

  it('should handle multiple onChange listeners', async () => {
    let callback1Called = false;
    let callback2Called = false;

    auth.onChange('user', () => {
      callback1Called = true;
    });

    auth.onChange('user', () => {
      callback2Called = true;
    });

    // @ts-expect-error - protected method
    auth.setState('user', { id: '1', email: 'test@example.com' });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(callback1Called).toBe(true);
    expect(callback2Called).toBe(true);
  });

  it('should support event hooks with on/emit', async () => {
    let hookCalled = false;
    let hookData: any = null;

    auth.on('login', (data) => {
      hookCalled = true;
      hookData = data;
    });

    // @ts-expect-error - protected method
    auth.emit('login', { userId: '123' });

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(hookCalled).toBe(true);
    expect(hookData).toEqual({ userId: '123' });
  });

  it('should support multiple hooks for same event', async () => {
    let hook1Called = false;
    let hook2Called = false;

    auth.on('login', () => {
      hook1Called = true;
    });

    auth.on('login', () => {
      hook2Called = true;
    });

    // @ts-expect-error - protected method
    auth.emit('login', {});

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(hook1Called).toBe(true);
    expect(hook2Called).toBe(true);
  });

  it('should chain plugins with use method', () => {
    const mockPlugin1 = {
      name: 'mock1',
      setup: (auth: AuthCore) => {
        // Plugin setup - just verify it gets called
        auth.setState('plugin1Loaded', true);
      }
    };

    const mockPlugin2 = {
      name: 'mock2',
      setup: (auth: AuthCore) => {
        // Plugin setup - just verify it gets called
        auth.setState('plugin2Loaded', true);
      }
    };

    const result = auth.use(mockPlugin1).use(mockPlugin2);
    expect(result).toBe(auth);
  });

  it('should throw when calling unimplemented methods', async () => {
    try {
      await auth.login({} as any);
      expect.unreachable();
    } catch (error: any) {
      expect(error.message).toContain('not implemented');
    }
  });

  it('should throw when calling unimplemented signup', async () => {
    try {
      await auth.signup({} as any);
      expect.unreachable();
    } catch (error: any) {
      expect(error.message).toContain('not implemented');
    }
  });

  it('should throw when calling unimplemented logout', async () => {
    try {
      await auth.logout();
      expect.unreachable();
    } catch (error: any) {
      expect(error.message).toContain('not implemented');
    }
  });

  it('should store adapter instance', () => {
    expect(auth['adapter']).toEqual(mockAdapter);
  });

  it('should store config', () => {
    const config = { debug: true };
    const authWithConfig = createAuth(mockAdapter, config);
    expect(authWithConfig['config']).toEqual(config);
  });

  it('should support multiple independent auth instances', async () => {
    const auth1 = createAuth(mockAdapter, {});
    const auth2 = createAuth(mockAdapter, {});

    // @ts-expect-error - protected method
    auth1.setState('user', { id: '1', email: 'user1@example.com' });
    // @ts-expect-error - protected method
    auth2.setState('user', { id: '2', email: 'user2@example.com' });

    const user1 = await auth1.getState('user');
    const user2 = await auth2.getState('user');

    expect(user1?.email).toBe('user1@example.com');
    expect(user2?.email).toBe('user2@example.com');
  });
});
