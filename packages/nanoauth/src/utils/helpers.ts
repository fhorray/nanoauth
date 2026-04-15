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
 * Define a factory function for a Plugin that accepts options.
 * Provides excellent type inference for the options and the inner plugin definition.
 * 
 * @example
 * const myPlugin = definePlugin<{ myOption: string }, { sendMagicLink: () => void }>((options) => ({
 *   name: 'my-plugin',
 *   setup(auth) {
 *     console.log(options.myOption);
 *     (auth as any).sendMagicLink = () => {}
 *   }
 * }));
 */
export function definePlugin<
  TOptions = void,
  TExports = {},
  TUser extends User = User
>(
  factory: (options: TOptions) => Plugin<TUser, TExports>
): (options: TOptions) => Plugin<TUser, TExports> {
  return factory;
}

/**
 * Define a simple Plugin without options.
 * Provides immediate autocomplete for the `setup` method and `auth` instance.
 * 
 * @example
 * const simplePlugin = createPlugin<{}, { customMethod: () => string }>({
 *   name: 'simple',
 *   setup(auth) {
 *     (auth as any).customMethod = () => 'hello';
 *   }
 * });
 */
export function createPlugin<
  TExports = {},
  TUser extends User = User
>(
  definition: Plugin<TUser, TExports>
): Plugin<TUser, TExports> {
  return definition;
}
