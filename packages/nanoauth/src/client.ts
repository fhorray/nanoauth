/**
 * NanoAuth - Client SDK 🚀
 * 
 * Reactive state management for the frontend using Nanostores.
 * This client is framework-agnostic and extremely lightweight.
 */

import { atom, map } from 'nanostores';
import type { User } from './types';

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
    public $error = atom<string | null>(null);

    private baseURL: string;

    constructor(options: AuthClientOptions = {}) {
        this.baseURL = options.baseURL || '';
    }

    /**
     * Synchronize local state with server session
     */
    async sync() {
        this.$isLoading.set(true);
        try {
            const res = await fetch(`${this.baseURL}/api/auth/session`);
            const data = await res.json();
            if (data.user) {
                this.$session.set({ user: data.user, token: data.token || null });
            } else {
                this.$session.set({ user: null, token: null });
            }
        } catch (e: any) {
            this.$error.set(e.message);
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
            const result = await res.json();

            if (result.error) throw new Error(result.error);

            this.$session.set({ user: result.user, token: result.token });
            return result;
        } catch (e: any) {
            this.$error.set(e.message);
            throw e;
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
            const result = await res.json();

            if (result.error) throw new Error(result.error);

            this.$session.set({ user: result.user, token: result.token });
            return result;
        } catch (e: any) {
            this.$error.set(e.message);
            throw e;
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
            await fetch(`${this.baseURL}/api/auth/signout/session`, { method: 'POST' });
            this.$session.set({ user: null, token: null });
        } catch (e: any) {
            this.$error.set(e.message);
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
