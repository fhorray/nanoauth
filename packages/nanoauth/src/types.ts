/**
 * NanoAuth - Types
 * 
 * Main types of the library
 */

import { AuthCore } from "./core"
import { CookieOptions } from "./utils/cookie"

/**
 * Basic user - extend as needed
 */
export interface User {
  id: string
  email: string
  name: string
  role: string
  [key: string]: any
}

/**
 * Authentication state
 */
export interface AuthState<TUser extends User = User> {
  user: TUser | null
  isLoading: boolean
  error: Error | null
  token: string | null
  metadata: Record<string, any>
}

/**
 * Adapter - you implement to connect to your backend
 */
export interface AuthAdapter<TUser extends User = User> {
  getUser(userId: string): Promise<TUser | null>
  saveSession(sessionId: string, data: any): Promise<void>
  validateToken(token: string): Promise<boolean>
  deleteSession(sessionId: string): Promise<void>
  [key: string]: any
}

/**
 * Logger interface
 */
export interface AuthLogger {
  warn(message: string, ...args: any[]): void
  error(message: string, error?: any, ...args: any[]): void
  info?(message: string, ...args: any[]): void
  debug?(message: string, ...args: any[]): void
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  debug?: boolean
  logger?: AuthLogger
}

/**
 * Plugin - System extension
 */
export interface Plugin<TUser extends User = User, TExports = {}> {
  name: string
  setup(auth: AuthCoreInstance<TUser>): void | Promise<void>
}

/**
 * Event payloads definition
 */
export interface AuthEvents<TUser extends User = User> {
  afterLogin: { user: TUser; token: string; provider?: string }
  afterSignup: { user: TUser; token: string }
  afterLogout: void
  onError: Error
  [key: string]: any
}

/**
 * Authentication core
 */
export interface AuthCoreInstance<TUser extends User = User> {
  // State
  onChange(key: string, callback: (value: any) => void): () => void
  getState<T = any>(key: string): Promise<T | undefined>
  // Hooks / Events
  on<K extends keyof AuthEvents<TUser> & string>(
    event: K,
    callback: (data: AuthEvents<TUser>[K]) => void | Promise<void>
  ): () => void

  // Generic Handler (Web Standard Request/Response)
  handler(request: Request): Promise<Response>

  // Plugins
  use(plugin: Plugin<TUser>): AuthCore<TUser>

  // Standard methods (implemented by plugins)
  login(emailOrData: any, password?: string): Promise<TUser>
  logout(): Promise<void>
  signup(emailOrData: any, password?: string, name?: string): Promise<TUser>

  // Customizations
  [key: string]: any
}

/**
 * Unified Hooks definition
 */
export interface NanoAuthHooks<TUser extends User = User> {
  // Reactive Events (Fire and Forget)
  afterLogin?: (data: { user: TUser; token: string; provider?: string }) => void | Promise<void>
  afterSignup?: (data: { user: TUser; token: string }) => void | Promise<void>
  afterLogout?: () => void | Promise<void>
  onError?: (error: Error) => void | Promise<void>

  // Database Interceptors (Blocking, requires next())
  onGetUser?: (userId: string, next: (userId: string) => Promise<TUser | null>) => Promise<TUser | null>
  onSaveSession?: (sessionId: string, data: any, next: (sessionId: string, data: any) => Promise<void>) => Promise<void>
  onValidateToken?: (token: string, next: (token: string) => Promise<boolean>) => Promise<boolean>
  onDeleteSession?: (sessionId: string, next: (sessionId: string) => Promise<void>) => Promise<void>
}

/**
 * Helper types to extract exports from plugins array
 */
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
export type ExtractPluginExports<T> = T extends Plugin<any, infer E> ? E : {};

/**
 * Main configuration options for nanoauth factory
 */
export interface NanoAuthOptions<
  TUser extends User = User,
  TPlugins extends Plugin<TUser, any>[] = Plugin<TUser, any>[]
> extends AuthConfig {
  adapter: AuthAdapter<TUser>
  plugins?: [...TPlugins]
  hooks?: NanoAuthHooks<TUser>
  handler?: NanoAuthHandlerOptions
}

/**
 * Basic credentials
 */
export interface Credentials {
  email: string
  password: string
}

/**
 * Signup data
 */
export interface SignupData {
  email: string
  password: string
  name: string
  [key: string]: any
}

/**
 * Session data
 */
export interface SessionData<TUser extends User = User> {
  user: TUser
  token: string
  [key: string]: any
}

/**
 * Configuration for the generic Web Standard Handler
 */
export interface NanoAuthHandlerOptions {
  cookieName?: string
  cookieOptions?: CookieOptions
  successRedirect?: string
  errorRedirect?: string
}
