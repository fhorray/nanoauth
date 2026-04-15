/**
 * NanoAuth - Types
 * 
 * Main types of the library
 */

import { AuthCore } from "./core"
import type { CookieOptions } from "./utils/cookie"

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
  secret?: string
  handler?: NanoAuthHandlerOptions
}

/**
 * Custom logic for specific URL path
 */
export interface AuthEndpoint {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'ALL'
  handler: (request: Request, auth: AuthCoreInstance<any>, config: NanoAuthHandlerOptions) => Promise<Response>
}

/**
 * Plugin - System extension
 */
export interface Plugin<TUser extends User = User, TExports = {}> {
  name: string
  id?: string
  endpoints?: Record<string, AuthEndpoint>
  hooks?: Partial<NanoAuthHooks<TUser>> | ((auth: AuthCoreInstance<TUser>) => Partial<NanoAuthHooks<TUser>>)
  exports?: (auth: AuthCoreInstance<TUser>) => TExports | Promise<TExports>
  init?: (auth: AuthCoreInstance<TUser>) => void | Promise<void>
  setup?(auth: AuthCoreInstance<TUser>): void | Promise<void> | TExports | Promise<TExports>
}

/**
 * Event payloads definition
 */
export interface AuthEvents<TUser extends User = User> {
  afterSignin: { user: TUser; token: string; provider?: string }
  afterSignup: { user: TUser; token: string }
  afterLogout: void
  onError: Error
  [key: string]: any
}

/**
 * Authentication core
 */
export interface AuthCoreInstance<TUser extends User = User> {
  // Stateless Session Access
  getSession(request: Request | Headers): Promise<{ user: TUser | null, token: string | null }>
  
  // Hooks / Events
  on<K extends keyof AuthEvents<TUser> & string>(
    event: K,
    callback: (data: AuthEvents<TUser>[K]) => void | Promise<void>
  ): () => void
  emit(event: string, ...args: any[]): void

  // Generic Handler (Web Standard Request/Response)
  handler(request: Request): Promise<Response>

  // Plugins
  use(plugin: Plugin<TUser>): AuthCore<TUser>

  // Namespaces (extended by plugins)
  signin: any
  signup: any
  signout: any
  verify?: any

  /** Registry of custom endpoints registered by plugins */
  endpoints: Record<string, AuthEndpoint>

  // Config
  adapter: AuthAdapter<TUser>
  config: AuthConfig

  // Customizations
  [key: string]: any
}

/**
 * Unified Hooks definition
 */
export interface NanoAuthHooks<TUser extends User = User> {
  afterSignin?: (data: { user: TUser; token: string; provider?: string }) => void | Promise<void>
  afterSignup?: (data: { user: TUser; token: string }) => void | Promise<void>
  afterLogout?: () => void | Promise<void>
  onError?: (error: Error) => void | Promise<void>

  onGetUser?: (userId: string, next: (userId: string) => Promise<TUser | null>) => Promise<TUser | null>
  onSaveSession?: (sessionId: string, data: any, next: (sessionId: string, data: any) => Promise<void>) => Promise<void>
  onValidateToken?: (token: string, next: (token: string) => Promise<boolean>) => Promise<boolean>
  onDeleteSession?: (sessionId: string, next: (sessionId: string) => Promise<void>) => Promise<void>
}

export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
export type ExtractPluginExports<T> = T extends Plugin<any, infer E> ? Awaited<E> : {};

export interface NanoAuthOptions<
  TUser extends User = User,
  TPlugins extends Plugin<TUser, any>[] = Plugin<TUser, any>[]
> extends AuthConfig {
  adapter: AuthAdapter<TUser>
  plugins?: [...TPlugins]
  hooks?: NanoAuthHooks<TUser>
  handler?: NanoAuthHandlerOptions
  secret?: string
}

export interface Credentials {
  email: string
  password: string
}

export interface SignupData {
  email: string
  password: string
  name: string
  [key: string]: any
}

export interface SessionData<TUser extends User = User> {
  user: TUser
  token: string
  [key: string]: any
}

export interface NanoAuthHandlerOptions {
  cookieName?: string
  cookieOptions?: CookieOptions
  successRedirect?: string
  errorRedirect?: string
}
