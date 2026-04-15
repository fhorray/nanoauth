/**
 * NanoAuth - Developer Experience Helpers
 * 
 * Utility functions to provide better type inference and autocomplete
 * when creating custom plugins and adapters.
 */

import type { AuthAdapter, AuthCoreInstance, Plugin, User } from '../types';

/**
 * Define an Auth Adapter with strict type checking and autocomplete.
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
 */
export function definePlugin<
  TOptions,
  TExports = {},
  TUser extends User = User
>(
  factory: (options: TOptions) => Plugin<TUser, TExports>
): (options: TOptions) => Plugin<TUser, TExports> {
  return (options: TOptions) => factory(options);
}

/**
 * Define a simple Plugin without options.
 */
export function createPlugin<
  TUser extends User = User
>(
  definition: Plugin<TUser, any>
): Plugin<TUser, any> {
  return definition;
}
