/**
 * NanoAuth - Client SDK 🚀
 * 
 * Reactive state management for the frontend using Nanostores.
 * This client is framework-agnostic and extremely lightweight.
 */

import { atom, map } from 'nanostores';
import type { User } from './types';
import { NanoAuthError } from './errors';

export interface AuthClientOptions {
    baseURL?: string;
}

export interface AuthSession {
    user: User | null;
    token: string | null;
}

/**
 * NanoAuth Client Class
 */
export class NanoAuthClient {
    // Reactive Atoms
    public $session = map<AuthSession>({ user: null, token: null });
    public $isLoading = atom<boolean>(false);
    public $error = atom<NanoAuthError | null>(null);

    private baseURL: string;

    constructor(options: AuthClientOptions = {}) {
        this.baseURL = options.baseURL || '';
    }

    /**
     * Internal helper to create textured errors from API responses
     */
    private async hydrateError(res: Response): Promise<NanoAuthError> {
        try {
            const data = await res.json();
            return new NanoAuthError(data.error || 'Request failed', {
                status: data.status || res.status,
                code: data.code
            });
        } catch {
            return new NanoAuthError(res.statusText || 'Unknown Error', {
                status: res.status
            });
        }
    }

    /**
     * Synchronize local state with server session
     */
    async sync() {
        this.$isLoading.set(true);
        try {
            const res = await fetch(`${this.baseURL}/api/auth/session`);
            if (!res.ok) throw await this.hydrateError(res);

            const data = await res.json();
            if (data.user) {
                this.$session.set({ user: data.user, token: data.token || null });
            } else {
                this.$session.set({ user: null, token: null });
            }
        } catch (e: any) {
            this.$error.set(e instanceof NanoAuthError ? e : new NanoAuthError(e.message));
        } finally {
            this.$isLoading.set(false);
        }
    }

    /**
     * Unified Sign In
     */
    signIn = async (strategy: string, data: any) => {
        this.$isLoading.set(true);
        this.$error.set(null);
        try {
            const res = await fetch(`${this.baseURL}/api/auth/signin/${strategy}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!res.ok) throw await this.hydrateError(res);

            const result = await res.json();
            this.$session.set({ user: result.user, token: result.token });
            return result;
        } catch (e: any) {
            const err = e instanceof NanoAuthError ? e : new NanoAuthError(e.message);
            this.$error.set(err);
            throw err;
        } finally {
            this.$isLoading.set(false);
        }
    }

    /**
     * Unified Sign Up
     */
    signUp = async (strategy: string, data: any) => {
        this.$isLoading.set(true);
        this.$error.set(null);
        try {
            const res = await fetch(`${this.baseURL}/api/auth/signup/${strategy}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!res.ok) throw await this.hydrateError(res);

            const result = await res.json();
            this.$session.set({ user: result.user, token: result.token });
            return result;
        } catch (e: any) {
            const err = e instanceof NanoAuthError ? e : new NanoAuthError(e.message);
            this.$error.set(err);
            throw err;
        } finally {
            this.$isLoading.set(false);
        }
    }

    /**
     * Sign Out
     */
    signOut = async () => {
        this.$isLoading.set(true);
        try {
            const res = await fetch(`${this.baseURL}/api/auth/signout/session`, { method: 'POST' });
            if (!res.ok) throw await this.hydrateError(res);
            this.$session.set({ user: null, token: null });
        } catch (e: any) {
            this.$error.set(e instanceof NanoAuthError ? e : new NanoAuthError(e.message));
        } finally {
            this.$isLoading.set(false);
        }
    }
}

/**
 * Factory to create a NanoAuth Client
 */
export function createAuthClient(options?: AuthClientOptions) {
    const client = new NanoAuthClient(options);
    return {
        session: client.$session,
        isLoading: client.$isLoading,
        error: client.$error,
        signIn: client.signIn,
        signUp: client.signUp,
        signOut: client.signOut,
    };
}
