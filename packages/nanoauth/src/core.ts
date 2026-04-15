/**
 * NanoAuth - Core
 * 
 * Main class that manages the authentication state and logic
 */

import type { AuthAdapter, AuthConfig, AuthCoreInstance, NanoAuthOptions, Plugin, User, AuthEvents, UnionToIntersection, ExtractPluginExports } from './types'
import { handleRequest } from './handler'

/**
 * Class Implementation of AuthCore
 * 
 * Manages reactive state and allows extension via plugins
 */
export class AuthCore<TUser extends User = User> implements AuthCoreInstance<TUser> {
  private hooks: Map<string, Function[]> = new Map()
  public adapter: AuthAdapter<TUser>
  public config: AuthConfig

  public signin: any
  public signup: any
  public signout: any
  public verify: any
  public endpoints: Record<string, any> = {}

  constructor(adapter: AuthAdapter<TUser>, config?: AuthConfig) {
    this.adapter = adapter
    this.config = config ?? {}

    // Create proxies for auth methods to handle "not implemented" errors gracefully
    this.signin = this.createUnimplementedProxy('signin')
    this.signup = this.createUnimplementedProxy('signup')
    this.signout = this.createUnimplementedProxy('signout')
    this.verify = this.createUnimplementedProxy('verify')
  }

  /**
   * Helper to create a proxy that throws for missing auth methods
   */
  private createUnimplementedProxy(namespace: string): Record<string, Function> {
    const target: Record<string, Function> = {}
    return new Proxy(target, {
      get: (obj, prop) => {
        if (typeof prop === 'string' && prop in obj) return obj[prop]
        if (prop === 'then' || prop === 'toJSON' || typeof prop === 'symbol') return undefined
        return (...args: any[]) => {
          throw new Error(`[NanoAuth] auth.${namespace}.${String(prop)} is not implemented. Did you forget to load the necessary plugin?`)
        }
      },
      set: (obj, prop, value) => {
        if (typeof prop === 'string') {
          obj[prop] = value
          return true
        }
        return false
      },
      has: (obj, prop) => prop in obj
    })
  }

  /**
   * Extract session from request securely
   */
  async getSession(request: Request | Headers): Promise<{ user: TUser | null, token: string | null }> {
    const headers = request instanceof Headers ? request : request.headers;
    const cookieHeader = headers.get('Cookie');
    if (!cookieHeader) return { user: null, token: null };

    // Simple cookie parser
    const cookies = Object.fromEntries(
      (cookieHeader || '').split(';').map(v => v.split('=')).map(([k, v]) => [k?.trim(), decodeURIComponent(v || '')])
    );

    const token = cookies[this.config.handler?.cookieName || 'auth_token'];
    if (!token) return { user: null, token: null };

    try {
      // Decode JWT payload without verifying (verification happens in adapter)
      const base64Url = token.split('.')[1];
      if (!base64Url) return { user: null, token: null };
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(base64, 'base64').toString());

      if (this.adapter.validateToken) {
        const isValid = await this.adapter.validateToken(token);
        if (!isValid) return { user: null, token: null };
      }

      const user = await this.adapter.getUser(payload.userId);
      return { user: user as TUser | null, token };
    } catch {
      return { user: null, token: null };
    }
  }

  /**
   * Register hooks for events
   * @returns function to unsubscribe
   */
  on<K extends keyof AuthEvents<TUser> & string>(
    event: K,
    callback: (data: AuthEvents<TUser>[K]) => void | Promise<void>
  ): () => void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, [])
    }
    this.hooks.get(event)!.push(callback)

    return () => {
      const hooks = this.hooks.get(event)
      if (hooks) {
        const index = hooks.indexOf(callback)
        if (index !== -1) hooks.splice(index, 1)
      }
    }
  }

  /**
   * Emit hooks for events
   */
  emit(event: string, ...args: any[]): void {
    this.hooks.get(event)?.forEach((callback) => {
      try {
        callback(...args)
      } catch (error) {
        if (this.config.logger) {
          this.config.logger.error(`Error in hook "${event}":`, error)
        } else {
          console.error(`Error in hook "${event}":`, error)
        }
      }
    })
  }

  /**
   * Use a plugin
   * @param plugin Plugin to use
   * @returns AuthCore
   * @example
   * auth.use(emailPasswordPlugin())
   */
  use(plugin: Plugin<TUser>): this {
    if (typeof plugin.init === 'function') {
      const initResult = plugin.init(this);
      if (initResult instanceof Promise) {
        initResult.catch(err => {
          this.config.logger?.error(`[NanoAuth] Plugin "${plugin.name}" failed to initialize:`, err);
        });
      }
    }

    if (plugin.hooks) {
      const hooks = typeof plugin.hooks === 'function' ? plugin.hooks(this as any) : plugin.hooks;
      for (const [event, callback] of Object.entries(hooks)) {
        if (typeof callback === 'function') {
          this.on(event as any, callback as any);
        }
      }
    }

    if (plugin.endpoints) {
      for (const [key, endpoint] of Object.entries(plugin.endpoints)) {
        this.endpoints[key] = endpoint;
      }
    }

    let exports: any;
    if (typeof plugin.exports === 'function') {
      exports = plugin.exports(this);
    } else if (typeof plugin.setup === 'function') {
      exports = plugin.setup(this);
    }

    const namespaces = ['signin', 'signup', 'signout', 'verify'];

    const handleExports = (res: any) => {
      if (res && typeof res === 'object') {
        for (const ns of namespaces) {
          if (res[ns] && typeof res[ns] === 'object') {
            Object.assign((this as any)[ns], res[ns]);
          }
        }

        for (const key of Object.keys(res)) {
          if (!namespaces.includes(key) && (this as any)[key] !== res[key]) {
            (this as any)[key] = res[key];
          }
        }
      }
    };

    if (exports instanceof Promise) {
      exports.then(handleExports).catch(err => {
        this.config.logger?.error(`[NanoAuth] Plugin "${plugin.name}" failed to load exports:`, err);
      });
    } else {
      handleExports(exports);
    }

    return this;
  }

  async handler(request: Request): Promise<Response> {
    throw new Error('Handler not initialized. Use nanoauth() factory to create the instance.')
  }

  [key: string]: any
}

export function createAuth<TUser extends User = User>(
  adapter: AuthAdapter<TUser>,
  config?: AuthConfig
): AuthCore<TUser> {
  config = config ?? {}
  config.secret = config.secret || process.env.NANOAUTH_SECRET || 'unsafe-dev-secret';
  return new AuthCore<TUser>(adapter, config)
}

export function nanoauth<
  TUser extends User = User,
  TPlugins extends Plugin<TUser, any>[] = Plugin<TUser, any>[]
>(
  options: NanoAuthOptions<TUser, TPlugins>
): AuthCore<TUser> & UnionToIntersection<ExtractPluginExports<TPlugins[number]>> {
  const { adapter, plugins, hooks } = options
  options.secret = options.secret || process.env.NANOAUTH_SECRET || 'unsafe-dev-secret';

  const wrappedAdapter = { ...adapter }

  if (hooks) {
    const dbHookMapping: Record<string, keyof AuthAdapter<TUser>> = {
      onGetUser: 'getUser',
      onSaveSession: 'saveSession',
      onValidateToken: 'validateToken',
      onDeleteSession: 'deleteSession'
    }

    for (const [hookName, adapterMethod] of Object.entries(dbHookMapping)) {
      const userHook = (hooks as any)[hookName]
      if (userHook && typeof (adapter as any)[adapterMethod] === 'function') {
        const originalMethod = (adapter as any)[adapterMethod].bind(adapter)
          ; (wrappedAdapter as any)[adapterMethod] = async (...args: any[]) => {
            let nextCalled = false
            const next = async (...nextArgs: any[]) => {
              nextCalled = true
              const finalArgs = nextArgs.length > 0 ? nextArgs : args
              return originalMethod(...finalArgs)
            }
            const result = await userHook(...args, next)
            if (!nextCalled) throw new Error(`Interceptor hook '${hookName}' missed next().`)
            return result
          }
      }
    }
  }

  const auth = new AuthCore<TUser>(wrappedAdapter, options)

  if (hooks) {
    const events = ['afterSignin', 'afterSignup', 'afterLogout', 'onError']
    for (const event of events) {
      if (typeof (hooks as any)[event] === 'function') {
        auth.on(event, (hooks as any)[event]!)
      }
    }
  }

  if (plugins && Array.isArray(plugins)) {
    for (const plugin of plugins) {
      auth.use(plugin)
    }
  }

  if (typeof (wrappedAdapter as any).saveSession === 'function') {
    auth.on('afterSignin', async ({ user, token }) => {
      if (token && user) await (wrappedAdapter as any).saveSession(token, { userId: user.id, ...user })
    })

    auth.on('afterSignup', async ({ user, token }) => {
      if (token && user) await (wrappedAdapter as any).saveSession(token, { userId: user.id, ...user })
    })

    auth.on('afterLogout', async () => {
      console.warn('[NanoAuth] Session cleanup skipped - stateless core has no global token track.');
    })
  }

  const handlerOpts = options.handler || {}
    ; (auth as any).handler = (request: Request) => handleRequest(request, auth, handlerOpts)

  return auth as any
}
