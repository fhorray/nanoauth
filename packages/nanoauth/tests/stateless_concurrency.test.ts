import { test, expect, describe, mock } from 'bun:test';
import { nanoauth } from '../src/core';
import type { AuthAdapter, User } from '../src/types';

describe('NanoAuth - Stateless Concurrency Protection 🛡️', () => {
    
    // 1. Mock Adapter
    const mockAdapter: AuthAdapter<User> = {
        getUser: async (id) => ({ id, email: `${id}@example.com` } as User),
        saveSession: mock(async () => {}),
        validateToken: mock(async () => true),
        deleteSession: mock(async () => {}),
    };

    const auth = nanoauth({
        adapter: mockAdapter,
        secret: 'test-secret-123'
    });

    /**
     * TEST: Data Leakage Prevention 
     * We simulate 100 simultaneous requests. 
     * If there was any global state, Request A might return Request B's user.
     */
    test('Should handle 100 concurrent requests without cross-contamination', async () => {
        const totalRequests = 100;
        
        // Function to simulate a request with a specific user
        const simulateRequest = async (index: number) => {
            const userId = `user_${index}`;
            // Mock a JWT with this userId
            const payload = Buffer.from(JSON.stringify({ userId })).toString('base64');
            const mockToken = `header.${payload}.signature`;
            
            const headers = new Headers();
            headers.set('Cookie', `auth_token=${mockToken}`);
            
            // Artificial delay to increase overlap risk
            await new Promise(r => setTimeout(r, Math.random() * 50));
            
            const { user } = await auth.getSession(headers);
            return { index, resultUser: user?.id };
        };

        // Fire all 100 requests in parallel
        const results = await Promise.all(
            Array.from({ length: totalRequests }).map((_, i) => simulateRequest(i))
        );

        // Assert: Every result must match its own index exactly
        for (const res of results) {
            expect(res.resultUser).toBe(`user_${res.index}`);
        }
        
        console.log(`✅ Passed concurrency test with ${totalRequests} isolated requests.`);
    });

    test('Should return user: null if no cookie is present', async () => {
        const { user } = await auth.getSession(new Headers());
        expect(user).toBeNull();
    });

    test('Should return user: null on malformed token', async () => {
        const headers = new Headers({ 'Cookie': 'auth_token=invalid.token' });
        const { user } = await auth.getSession(headers);
        expect(user).toBeNull();
    });
});
