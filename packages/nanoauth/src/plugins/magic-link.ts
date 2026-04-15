import { definePlugin } from "../utils";
import type { AuthCoreInstance, User } from "../types";
import { createHS256JWT, verifyHS256JWT } from "../utils";
import { NanoAuthError } from "../errors";

export interface MagicLinkConfig {
  sendEmail: (email: string, link: string) => Promise<void>;
  generateToken?: (email: string) => string | Promise<string>;
  verifyToken?: (token: string) => Promise<{ email: string } | null>;
  baseUrl?: string;
}

export const magicLinkPlugin = definePlugin((config: MagicLinkConfig) => ({
  name: 'magic-link',

  setup(auth: AuthCoreInstance<User>) {
    return {
      signin: {
        magicLink: async (email: string) => {
          try {
            const secretStr = (auth as any).config?.secret;
            const secretBytes = secretStr ? new TextEncoder().encode(secretStr) : new Uint8Array();

            const generateTokenFn = config.generateToken ? config.generateToken : async (email: string) => {
              if (!secretStr) {
                throw new NanoAuthError('A "secret" is required in nanoauth options to use the default magic link generation.');
              }
              return createHS256JWT(
                { email },
                secretBytes,
                { expiresAt: new Date(Date.now() + 1000 * 60 * 15) } // 15 minutes
              );
            };

            const token = await generateTokenFn(email);
            const baseUrl = config.baseUrl ?? 'https://myapp.com';
            const link = `${baseUrl}/auth/verify?token=${token}`;

            await config.sendEmail(email, link);
          } catch (error) {
            auth.emit('onError', error);
            throw error;
          }
        }
      },

      verify: {
        magicLink: async (token: string) => {
          try {
            const secretStr = (auth as any).config?.secret;
            const secretBytes = secretStr ? new TextEncoder().encode(secretStr) : new Uint8Array();

            const verifyTokenFn = config.verifyToken ? config.verifyToken : async (token: string) => {
              if (!secretStr) {
                throw new NanoAuthError('A "secret" is required in nanoauth options to use the default magic link validation.');
              }
              try {
                const payload = await verifyHS256JWT(token, secretBytes);
                return { email: payload.email as string };
              } catch {
                return null;
              }
            };

            const payload = await verifyTokenFn(token);

            if (!payload) {
              throw new Error("Invalid or expired magic link token");
            }

            return payload;
          } catch (error) {
            auth.emit('onError', error);
            throw error;
          }
        }
      }
    };
  }
}));