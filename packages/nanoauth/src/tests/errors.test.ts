import { describe, it, expect, mock } from 'bun:test';
import { 
  NanoAuthError, 
  AuthenticationError, 
  ValidationError, 
  SecurityError, 
  NanoAuthErrorFactory 
} from '../errors';
import { handleRequest } from '../handler';
import { NanoAuthClient } from '../client';

describe('NanoAuth Errors Architecture', () => {
    
    describe('Error Classes & Factory', () => {
        it('should have correct default metadata for built-in errors', () => {
            const authErr = new AuthenticationError();
            expect(authErr.status).toBe(401);
            expect(authErr.code).toBe('AUTH_FAILED');

            const valErr = new ValidationError('Invalid data');
            expect(valErr.status).toBe(400);
            expect(valErr.message).toBe('Invalid data');
        });

        it('should create custom error classes via factory', () => {
            const MyError = NanoAuthErrorFactory('MyError', 418, 'TEAPOT');
            const err = new MyError('I am a teapot');
            
            expect(err).toBeInstanceOf(NanoAuthError);
            expect(err.name).toBe('MyError');
            expect(err.status).toBe(418);
            expect(err.code).toBe('TEAPOT');
        });
    });

    describe('Server-Side Handler Serialization', () => {
        it('should serialize NanoAuthErrors with status and code', async () => {
            const mockAuth: any = {
                endpoints: {},
                signin: {
                    email: async () => {
                        throw new AuthenticationError('Invalid credentials');
                    }
                }
            };

            const request = new Request('http://localhost/api/auth/signin/email', {
                method: 'POST',
                body: JSON.stringify({ email: 'test@test.com' })
            });

            const response = await handleRequest(request, mockAuth);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('Invalid credentials');
            expect(data.code).toBe('AUTH_FAILED');
            expect(data.status).toBe(401);
        });

        it('should handle custom factorial errors', async () => {
            const CustomErr = NanoAuthErrorFactory('BannedUser', 403, 'USER_BANNED');
            const mockAuth: any = {
                endpoints: {},
                signin: {
                    email: async () => {
                        throw new CustomErr('Your account is suspended');
                    }
                }
            };

            const request = new Request('http://localhost/api/auth/signin/email', {
                method: 'POST',
                body: JSON.stringify({ email: 'banned@test.com' })
            });

            const response = await handleRequest(request, mockAuth);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.code).toBe('USER_BANNED');
        });
    });

    describe('Client-Side SDK Hydration', () => {
        it('should hydrate Error instances from API responses', async () => {
            // Mock global fetch
            const originalFetch = global.fetch;
            global.fetch = mock(async () => {
                return new Response(JSON.stringify({
                    error: 'Database timeout',
                    code: 'DB_ERROR',
                    status: 503
                }), { status: 503 });
            }) as any;

            const client = new NanoAuthClient({ baseURL: 'http://test' });
            
            try {
                await client.signIn('email', {});
            } catch (e: any) {
                expect(e).toBeInstanceOf(NanoAuthError);
                expect(e.message).toBe('Database timeout');
                expect(e.status).toBe(503);
                expect(e.code).toBe('DB_ERROR');
                
                // Verify sync with reactive state
                expect(client.$error.get()?.code).toBe('DB_ERROR');
            }

            global.fetch = originalFetch;
        });
    });
});
