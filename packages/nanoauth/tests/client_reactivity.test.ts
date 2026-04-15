import { test, expect, describe, mock, spyOn } from 'bun:test';
import { createAuthClient } from '../src/client';

describe('NanoAuth - Client SDK Reactivity 🚀', () => {

    test('Should initialize with null session and no loading', () => {
        const client = createAuthClient();
        expect(client.$session.get()).toEqual({ user: null, token: null });
        expect(client.$isLoading.get()).toBe(false);
    });

    test('Should handle signIn state transitions', async () => {
        const client = createAuthClient();
        
        // Mock global fetch
        global.fetch = mock(async () => ({
            json: async () => ({ user: { id: '1', email: 't@t.com' }, token: 'tk_123' })
        })) as any;

        const signInPromise = client.signIn('email', { email: 't@t.com' });

        // Assert: Loading state should be active immediately
        expect(client.$isLoading.get()).toBe(true);
        expect(client.$error.get()).toBeNull();

        await signInPromise;

        // Assert: Post-login state
        expect(client.$isLoading.get()).toBe(false);
        expect(client.$session.get().user?.id).toBe('1');
        expect(client.$session.get().token).toBe('tk_123');
    });

    test('Should handle signOut state transitions', async () => {
        const client = createAuthClient();
        client.$session.set({ user: { id: '1' } as any, token: 'tk' });

        global.fetch = mock(async () => ({ json: async () => ({}) })) as any;

        await client.signOut();

        expect(client.$session.get().user).toBeNull();
        expect(client.$isLoading.get()).toBe(false);
    });

    test('Should propagate errors correctly', async () => {
        const client = createAuthClient();
        
        global.fetch = mock(async () => ({
            json: async () => ({ error: 'Invalid credentials' })
        })) as any;

        try {
            await client.signIn('email', {});
        } catch (e) {}

        expect(client.$error.get()).toBe('Invalid credentials');
        expect(client.$isLoading.get()).toBe(false);
    });
});
