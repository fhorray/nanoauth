/**
 * Playground - Auth Configuration (Drizzle & Social Login)
 */

import { nanoauth, emailPasswordPlugin, sessionPlugin, oauthPlugin, magicLinkPlugin } from 'nanoauth';
import { hashSHA256, encodeHex, createHS256JWT, verifyHS256JWT } from 'nanoauth/utils';
import type { User, AuthAdapter } from 'nanoauth';
import { userRepository, sessionRepository } from '../db/client';

import { stripePlugin } from './stripe';
import { plans } from './plans';
import Stripe from 'stripe';

// JWT Secret
const JWT_SECRET = new TextEncoder().encode("playground-secret-key-12345");

/**
 * Modern Adapter connecting to SQLite/Drizzle
 */
const authAdapter: AuthAdapter = {
  async getUser(userId: string) {
    return userRepository.findById(userId);
  },

  async saveSession(sessionId: string, data: any) {
    // Session expires in 24 hours
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await sessionRepository.save(sessionId, data.userId, data, expiresAt);
  },

  async validateToken(token: string) {
    try {
      await verifyHS256JWT(token, JWT_SECRET);
      return true;
    } catch {
      return false;
    }
  },

  async deleteSession(sessionId: string) {
    await sessionRepository.delete(sessionId);
  }
};

/**
 * NanoAuth Instance
 */
export const auth = nanoauth({
  adapter: authAdapter,

  plugins: [
    magicLinkPlugin({
      generateToken: () => { return "test" },
      sendEmail: async (email: string, link: string) => {
        console.log(`[MAGIC LINK] Sending email to ${email} with link: ${link}`);
      }
    }),

    // 1. Session Management
    sessionPlugin({
      validateToken: async (token: string) => authAdapter.validateToken!(token)
    }),

    // 2. Email & Password
    emailPasswordPlugin({
      validateEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      hashPassword: async (password: string) => encodeHex(hashSHA256(new TextEncoder().encode(password))),
      comparePassword: async (password: string, hash: string) => encodeHex(hashSHA256(new TextEncoder().encode(password))) === hash,
      userRepository: userRepository as any,
      generateToken: async (user: User) => {
        return createHS256JWT(
          { userId: user.id, email: user.email, role: (user as any).role },
          JWT_SECRET,
          { expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) }
        );
      }
    }),

    // 3. Social Login (OAuth Plugin)
    oauthPlugin({
      userRepository: userRepository,
      providers: {
        // MOCK PROVIDER for Simulation
        mock: {
          createAuthorizationURL: async (state: string, _scopes?: string[]) => {
            return new URL(`http://localhost:3000/auth/mock/authorize?state=${state}&redirect_uri=http://localhost:3000/api/auth/callback/mock`);
          },
          validateAuthorizationCode: async (_code: string) => {
            return {
              accessToken: () => 'mock_access_token'
            };
          }
        } as any // Use as any if using mock objects, or implement interface fully
      },
      getProfile: async (_provider: string, _token: string) => {
        const response = await fetch('http://localhost:3000/auth/mock/user');
        return response.json();
      },
      mapOAuthProfile: (_provider: string, profile: any) => ({
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar,
        role: 'user'
      })
    }),

    // 4. Stripe Subscription Plugin 💳
    stripePlugin({
      stripeClient: new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2026-03-25.dahlia' as any
      }),
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true,
      successUrl: 'http://localhost:3000/dashboard?success=true',
      cancelUrl: 'http://localhost:3000/pricing?cancel=true',
      plans
    })
  ],

  hooks: {
    afterSignin: ({ user, provider }) => {
      const method = provider ? `Social (${provider})` : 'Credentials';
      console.log(`\n[AUTH HOOK] ✅ Login Successful: ${user.email} via ${method}`);
    },
    afterSignup: ({ user }) => {
      console.log(`\n[AUTH HOOK] ✨ New User Created: ${user.email}`);
    },
    onError: (error) => {
      console.error(`\n[AUTH HOOK] ❌ Error Occurred: ${error.message}`);
    }
  },

  handler: {
    successRedirect: '/dashboard',
    errorRedirect: '/signin?error=auth_failed',
    cookieName: 'auth_token',
  }
});
