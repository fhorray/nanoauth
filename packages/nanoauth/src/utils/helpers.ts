/**
 * NanoAuth - Developer Experience Helpers
 * 
 * Utility functions to provide better type inference and autocomplete
 * when creating custom plugins and adapters.
 */

import type { AuthAdapter, Plugin, User } from '../types';

/**
 * Define an Auth Adapter with strict type checking and autocomplete.
 * This helper ensures you implement the required methods while allowing
 * you to add custom properties or methods.
 * 
 * @example
 * const myAdapter = defineAdapter({
 *   async getUser(id) { ... },
 *   async saveSession(id, data) { ... },
 *   // ... other required methods
 *   async myCustomQuery() { ... } // Extra methods are preserved!
 * });
 */
export function defineAdapter<
  TUser extends User = User,
  TExtras extends Record<string, any> = {}
>(
  adapter: AuthAdapter<TUser> & TExtras
): AuthAdapter<TUser> & TExtras {
  return adapter;
}

/**
 * Define a Plugin with full automatic type inference.
 * No generics needed - types are extracted from the setup return!
 * 
 * @example
 * export const magicLinkPlugin = definePlugin((config: MagicLinkConfig) => ({
 *   name: 'magic-link',
 *   setup(auth) {
 *     return {
 *       sendMagicLink: async (email: string) => {
 *         await config.sendEmail(email, 'link');
 *       }
 *     };
 *   }
 * }));
 * 
 * // sendMagicLink is fully typed automatically!
 * await auth.sendMagicLink('user@example.com');
 */
export function definePlugin<
  const TFactory extends (options: any) => {
    name: string;
    setup(auth: any): Record<string, any> | Promise<Record<string, any>>;
  }
>(
  factory: TFactory
): TFactory extends (options: infer TOptions) => infer TPluginDef
  ? TPluginDef extends { setup(auth: any): infer TSetupReturn }
  ? TSetupReturn extends Promise<infer TAwaited>
  ? TAwaited extends Record<string, any>
  ? (options: TOptions) => Plugin<User, TAwaited>
  : (options: TOptions) => Plugin<User, {}>
  : TSetupReturn extends Record<string, any>
  ? (options: TOptions) => Plugin<User, TSetupReturn>
  : (options: TOptions) => Plugin<User, {}>
  : never
  : never;

export function definePlugin(factory: any): any {
  return (options: any) => {
    const def = factory(options);

    return {
      name: def.name,
      async setup(auth: any) {
        const result = await def.setup(auth);

        // Merge exported methods into auth
        if (result && typeof result === 'object' && result !== auth) {
          Object.assign(auth, result);
        }

        return result;
      }
    };
  };
}

/**
 * Define a simple Plugin without options.
 * 
 * @example
 * const simplePlugin = createPlugin({
 *   name: 'simple',
 *   setup(auth) {
 *     return {
 *       customMethod: () => 'hello'
 *     };
 *   }
 * });
 */
export function createPlugin<
  TUser extends User = User
>(
  definition: Plugin<TUser, any>
): Plugin<TUser, any> {
  return definition;
}
