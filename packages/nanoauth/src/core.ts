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
  private state: Map<string, any> = new Map()
  private observers: Map<string, Set<Function>> = new Map()
  private hooks: Map<string, Function[]> = new Map()
  protected adapter: AuthAdapter<TUser>
  protected config: AuthConfig

  constructor(adapter: AuthAdapter<TUser>, config?: AuthConfig) {
    this.adapter = adapter
    this.config = config ?? {}
    this.initializeDefaultState()
  }

  /**
   * Initialize default state
   */
  private initializeDefaultState(): void {
    this.state.set('user', null)
    this.state.set('isAuthenticated', false)
    this.state.set('isLoading', false)
    this.state.set('error', null)
    this.state.set('token', null)
    this.state.set('metadata', {})
  }

  /**
   * Observe state changes
   * @returns function to unsubscribe
   */
  onChange(key: string, callback: (value: any) => void): () => void {
    if (!this.observers.has(key)) {
      this.observers.set(key, new Set())
    }
    this.observers.get(key)!.add(callback)

    // Return unsubscribe
    return () => {
      this.observers.get(key)?.delete(callback)
    }
  }

  /**
   * Get current state
   */
  async getState<T = any>(key: string): Promise<T | undefined> {
    return this.state.get(key) as T | undefined
  }

  /**
   * Update state (protected for plugins)
   */
  protected setState(key: string, value: any): void {
    this.state.set(key, value)
    // Notify observers
    this.observers.get(key)?.forEach((callback) => {
      try {
        callback(value)
      } catch (error) {
        if (this.config.logger) {
          this.config.logger.error(`Error in observer for key "${key}":`, error)
        } else {
          console.error(`Error in observer for key "${key}":`, error)
        }
      }
    })
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
  protected emit(event: string, ...args: any[]): void {
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
   * Add plugin
   */
  use(plugin: Plugin<TUser>): this {
    plugin.setup(this)
    return this
  }

  /**
   * Default methods (must be implemented by plugins)
   */

  async login(emailOrData: any, password?: string): Promise<TUser> {
    throw new Error(
      'Method "login" not implemented. Install email-password plugin using: auth.use(emailPasswordPlugin())'
    )
  }

  async logout(): Promise<void> {
    throw new Error('Method "logout" not implemented. Install session plugin using: auth.use(sessionPlugin())')
  }

  async signup(emailOrData: any, password?: string, name?: string): Promise<TUser> {
    throw new Error(
      'Method "signup" not implemented. Install email-password plugin using: auth.use(emailPasswordPlugin())'
    )
  }

  async handler(request: Request): Promise<Response> {
    throw new Error('Handler not initialized. Use nanoauth() factory to create the instance.')
  }

  /**
   * Allow adding custom methods via plugins
   */
  [key: string]: any
}

/**
 * Factory to create authentication instance
 */
export function createAuth<TUser extends User = User>(
  adapter: AuthAdapter<TUser>,
  config?: AuthConfig
): AuthCore<TUser> {
  return new AuthCore<TUser>(adapter, config)
}

/**
 * Modern declarative factory (Better Auth style)
 */
export function nanoauth<
  TUser extends User = User,
  TPlugins extends Plugin<TUser, any>[] = Plugin<TUser, any>[]
>(
  options: NanoAuthOptions<TUser, TPlugins>
): AuthCore<TUser> & UnionToIntersection<ExtractPluginExports<TPlugins[number]>> {
  const { adapter, plugins, hooks } = options

  // 1. Wrap adapter with database interceptors if hooks exist
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

          // Replace in the wrapped adapter
          ; (wrappedAdapter as any)[adapterMethod] = async (...args: any[]) => {
            let nextCalled = false

            const next = async (...nextArgs: any[]) => {
              nextCalled = true
              // If user passes new arguments, use them, otherwise use original args
              const finalArgs = nextArgs.length > 0 ? nextArgs : args
              return originalMethod(...finalArgs)
            }

            const result = await userHook(...args, next)

            if (!nextCalled) {
              throw new Error(`Fatal Error: Interceptor hook '${hookName}' finished execution without calling next(). This blocks database operations.`)
            }

            return result
          }
      }
    }
  }

  // 2. Create core instance
  const auth = new AuthCore<TUser>(wrappedAdapter, options)

  // 3. Register reactive hooks (Events)
  if (hooks) {
    const events = ['afterLogin', 'afterSignup', 'afterLogout', 'onError']
    for (const event of events) {
      if (typeof (hooks as any)[event] === 'function') {
        auth.on(event, (hooks as any)[event]!)
      }
    }
  }

  // 4. Load plugins
  if (plugins && Array.isArray(plugins)) {
    for (const plugin of plugins) {
      auth.use(plugin)
    }
  }

  // 5. Automatic Session Persistence (Backend Sync)
  if (typeof (wrappedAdapter as any).saveSession === 'function') {
    auth.on('afterLogin', async ({ user, token }) => {
      if (token && user) {
        await (wrappedAdapter as any).saveSession(token, { userId: user.id, ...user })
      }
    })

    auth.on('afterSignup', async ({ user, token }) => {
      if (token && user) {
        await (wrappedAdapter as any).saveSession(token, { userId: user.id, ...user })
      }
    })

    auth.on('afterLogout', async () => {
      const token = await auth.getState<string>('token')
      if (token && typeof (wrappedAdapter as any).deleteSession === 'function') {
        await (wrappedAdapter as any).deleteSession(token)
      }
    })
  }

  // 6. Bind standard Web Handle
  const handlerOpts = options.handler || {}
    ; (auth as any).handler = (request: Request) => handleRequest(request, auth, handlerOpts)

  return auth as AuthCore<TUser> & UnionToIntersection<ExtractPluginExports<TPlugins[number]>>
}
