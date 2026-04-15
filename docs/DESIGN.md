# NanoAuth - Biblioteca de Autenticação Agnóstica

## 📋 Visão Geral

**NanoAuth** é uma biblioteca TypeScript de autenticação **extremamente simples, agnóstica e extensível**. Ao contrário de outras bibliotecas, NanoAuth:

- 🔓 **Não é opinionada**: Você decide como implementar tudo
- 🧩 **Extensível ao máximo**: Via plugins, hooks e customizações
- 🔌 **Agnóstica**: Funciona com qualquer banco de dados, API, storage
- 📦 **Minimalista**: Apenas o essencial na base, tudo o mais é plugin
- ⚡ **Zero dependencies**: Nenhuma dependência externa para o usuário
- 🎯 **Type-safe**: TypeScript completo com tipos inferidos
- 🔄 **Reativa**: Estado reativo internamente, sua forma de usar é síncrona

---

## 🎯 Princípios Fundamentais

1. **Developer Freedom** - Você controla 100% do comportamento
2. **Pluggable Architecture** - Estenda conforme necessário
3. **Separation of Concerns** - Autenticação ≠ Persistência
4. **Type Safety** - Tipos TypeScript para tudo
5. **Framework Agnostic** - Funciona com React, Vue, Svelte, Angular, etc
6. **Agnóstico ao Máximo** - Nenhuma opinião sobre banco de dados, API endpoints, estrutura de usuário

---

## 🏗️ Arquitetura Base (Opção 1: Factory Pattern)

### Filosofia da Arquitetura

```
+-----------+
| createAuth() => AuthInstance
|
| Estado interno reativo gerenciado internamente
| ├── user
| ├── isLoading
| ├── error
| ├── token
| └── metadata (qualquer coisa customizada)
|
| API Pública (simples e agnóstica)
| ├── onChange(key, callback)
| ├── getState(key)
| ├── login(credentials)
| ├── logout()
| ├── signup(data)
| ├── use(plugin)
| └── on(event, callback)
|
+-----------+
```

### Core Mínimo (nanoauth/core.ts)

```typescript
/**
 * Interface básica que você precisa implementar/adaptar
 * para ligar NanoAuth ao seu backend
 */
export interface AuthAdapter {
  // Buscar usuário (pode vir de API, DB, qualquer lugar)
  getUser(userId: string): Promise<User | null>

  // Salvar sessão (localStorage, sessionStorage, cookie, seu backend, etc)
  saveSession(sessionId: string, data: SessionData): Promise<void>

  // Validar token (JWT, OAuth, seu sistema, qualquer coisa)
  validateToken(token: string): Promise<boolean>

  // Deletar sessão
  deleteSession(sessionId: string): Promise<void>

  // [CUSTOMIZÁVEL] Qualquer método que você precisar
  [key: string]: any
}

/**
 * Estado que você pode customizar
 */
export interface AuthState {
  user: User | null
  isLoading: boolean
  error: Error | null
  token: string | null
  // Adicione seus próprios campos!
  metadata: Record<string, any>
}

/**
 * Interface de plugins (extensibilidade)
 */
export interface Plugin {
  name: string
  setup(auth: AuthCore): void | Promise<void>
}

/**
 * Classe principal - toda a lógica está aqui
 * O usuário não precisa conhecer os detalhes
 */
export class AuthCore {
  private state: Map<string, any> = new Map()
  private observers: Map<string, Set<Function>> = new Map()
  private hooks: Map<string, Function[]> = new Map()

  // Inicializar com adapter customizado
  constructor(adapter: AuthAdapter, config?: Partial<AuthConfig>) {
    this.adapter = adapter
    this.config = config ?? {}
    this.initializeDefaultState()
  }

  // ====== API PÚBLICA ======

  /**
   * Observar mudanças de estado (Pub/Sub)
   * @returns função para desinscrever
   */
  onChange(key: string, callback: (value: any) => void): () => void {
    if (!this.observers.has(key)) {
      this.observers.set(key, new Set())
    }
    this.observers.get(key)!.add(callback)

    // Retornar unsubscribe
    return () => {
      this.observers.get(key)?.delete(callback)
    }
  }

  /**
   * Obter estado atual
   */
  async getState<T = any>(key: string): Promise<T | undefined> {
    return this.state.get(key) as T | undefined
  }

  /**
   * Atualizar estado (interno para plugins)
   */
  protected setState(key: string, value: any): void {
    this.state.set(key, value)
    // Notificar observers
    this.observers.get(key)?.forEach((callback) => callback(value))
  }

  /**
   * Registrar hooks (para plugins)
   */
  on(event: string, callback: Function): void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, [])
    }
    this.hooks.get(event)!.push(callback)
  }

  /**
   * Disparar hooks (para plugins)
   */
  protected emit(event: string, ...args: any[]): void {
    this.hooks.get(event)?.forEach((callback) => callback(...args))
  }

  /**
   * Adicionar plugin
   */
  use(plugin: Plugin): this {
    plugin.setup(this)
    return this // Para chain
  }

  // ====== MÉTODOS PADRÃO (que plugins implementam) ======

  async login(credentials: any): Promise<User> {
    throw new Error('Plugin not installed: email-password or oauth')
  }

  async logout(): Promise<void> {
    throw new Error('Plugin not installed: session')
  }

  async signup(data: any): Promise<User> {
    throw new Error('Plugin not installed: email-password')
  }

  // ====== CUSTOMIZAÇÃO PARA PLUGINS ======

  /**
   * Plugins podem adicionar métodos dinamicamente
   */
  [key: string]: any
}

export function createAuth(adapter: AuthAdapter, config?: Partial<AuthConfig>): AuthCore {
  return new AuthCore(adapter, config)
}
```

---

## 🔌 Sistema de Plugins (Extensibilidade Total)

### Por que Plugins?

A ideia é que **você não importa plugins, você os cria**. NanoAuth fornece uma base, seus plugins adicionam:

- ✅ Estratégias de autenticação (email/password, OAuth, SAML, etc)
- ✅ Persistência de sessão (localStorage, cookies, IndexedDB, Redis, etc)
- ✅ Validações customizadas (password strength, email validation, etc)
- ✅ Hooks de ciclo de vida (logging, analytics, webhooks, etc)
- ✅ Features adicionais (2FA, rate limiting, device management, etc)
- ✅ Qualquer lógica customizada

### Estrutura de um Plugin

```typescript
// plugins/seu-plugin.ts

import { Plugin, AuthCore } from 'nanoauth'

interface SeuPluginConfig {
  // suas opções
}

export function seuPlugin(config: SeuPluginConfig): Plugin {
  return {
    name: 'seu-plugin',

    async setup(auth: AuthCore) {
      // 1. Adicionar métodos
      ;auth.seuMetodo = async (param: string) => {
        // sua lógica
      }

      // 2. Ouvir eventos
      auth.on('afterLogin', async ({ user, token }) => {
        // reagir a login
      })

      // 3. Observar estado
      const unsub = auth.onChange('user', (newUser) => {
        // reagir a mudanças
      })

      // 4. Adicionar hooks
      auth.on('beforeLogout', async () => {
        // antes de logout
      })

      // 5. Adicionar estado customizado
      auth.setState('meuEstado', {})
    }
  }
}
```

### Exemplo 1: Plugin Email/Password Customizado

```typescript
// plugins/email-password-custom.ts

import { Plugin, AuthCore } from 'nanoauth'

interface EmailPluginConfig {
  // VOCÊ DECIDE TUDO!
  minPasswordLength?: number
  requireSpecialChar?: boolean
  requireNumbers?: boolean
  requireUppercase?: boolean
  validateEmail?: (email: string) => boolean
  hashPassword: (password: string) => Promise<string>
  comparePassword: (password: string, hash: string) => Promise<boolean>
  // Aqui você conecta ao SEU banco de dados
  userRepository: {
    findByEmail(email: string): Promise<User | null>
    create(user: User): Promise<User>
    updatePassword(userId: string, hash: string): Promise<void>
    // adicione o que precisar!
    [key: string]: any
  }
}

export function emailPasswordPlugin(config: EmailPluginConfig): Plugin {
  return {
    name: 'email-password',

    async setup(auth: AuthCore) {
      // Implementar login
      ;auth.login = async (email: string, password: string) => {
        try {
          auth.setState('isLoading', true)
          auth.emit('beforeLogin', { email })

          // Validação customizada
          if (config.validateEmail && !config.validateEmail(email)) {
            throw new Error('Email inválido')
          }

          // Buscar usuário do SEU repositório
          const user = await config.userRepository.findByEmail(email)
          if (!user) {
            throw new Error('Usuário não encontrado')
          }

          // Comparar senha usando SEU método
          const isValid = await config.comparePassword(password, user.passwordHash)
          if (!isValid) {
            throw new Error('Senha incorreta')
          }

          // Atualizar estado
          const token = seu_generateToken(user) // seu método!
          auth.setState('user', user)
          auth.setState('token', token)
          auth.setState('isLoading', false)

          auth.emit('afterLogin', { user, token })
          return user
        } catch (error) {
          auth.setState('error', error as Error)
          auth.setState('isLoading', false)
          auth.emit('onError', error)
          throw error
        }
      }

      // Implementar signup
      ;auth.signup = async (email: string, password: string, name: string) => {
        try {
          auth.setState('isLoading', true)

          // Validar se email já existe
          const exists = await config.userRepository.findByEmail(email)
          if (exists) {
            throw new Error('Email já registrado')
          }

          // Validar força da senha
          const passwordErrors = this.validatePassword(password, config)
          if (passwordErrors.length > 0) {
            throw new Error(`Senha fraca: ${passwordErrors.join(', ')}`)
          }

          // Hash a senha com SEU método
          const passwordHash = await config.hashPassword(password)

          // Criar usuário no SEU banco
          const user = await config.userRepository.create({
            id: crypto.randomUUID(),
            email,
            name,
            passwordHash,
            createdAt: new Date(),
            // você adiciona os campos que quiser!
          })

          const token = seu_generateToken(user)
          auth.setState('user', user)
          auth.setState('token', token)
          auth.setState('isLoading', false)

          auth.emit('afterSignup', { user })
          return user
        } catch (error) {
          auth.setState('error', error as Error)
          auth.setState('isLoading', false)
          throw error
        }
      }

      // Métodos customizados do plugin
      ;auth.changePassword = async (
        email: string,
        oldPassword: string,
        newPassword: string
      ) => {
        const user = await config.userRepository.findByEmail(email)
        if (!user) throw new Error('Usuário não encontrado')

        const isValid = await config.comparePassword(oldPassword, user.passwordHash)
        if (!isValid) throw new Error('Senha atual incorreta')

        const newHash = await config.hashPassword(newPassword)
        await config.userRepository.updatePassword(user.id, newHash)
      }

      ;auth.resetPassword = async (email: string, newPassword: string) => {
        // sua lógica de reset
      }
    }
  }
}

// Função helper para validar senha
function validatePassword(password: string, config: EmailPluginConfig): string[] {
  const errors: string[] = []

  if (password.length < (config.minPasswordLength ?? 8)) {
    errors.push(`Mínimo ${config.minPasswordLength ?? 8} caracteres`)
  }

  if (config.requireUppercase && !password.match(/[A-Z]/)) {
    errors.push('Precisa de letra maiúscula')
  }

  if (config.requireNumbers && !password.match(/[0-9]/)) {
    errors.push('Precisa de número')
  }

  if (config.requireSpecialChar && !password.match(/[!@#$%^&*]/)) {
    errors.push('Precisa de caractere especial')
  }

  return errors
}
```

### Exemplo 2: Plugin Session/Tokens

```typescript
// plugins/session.ts

import { Plugin, AuthCore } from 'nanoauth'

interface SessionPluginConfig {
  // VOCÊ ESCOLHE ONDE SALVAR
  storage: 'localStorage' | 'sessionStorage' | 'cookie' | 'indexeddb' | 'custom'
  storageKey?: string
  refreshTokenKey?: string

  // VOCÊ ESCOLHE COMO GERAR/VALIDAR TOKENS
  generateToken: (user: User) => string
  generateRefreshToken?: (user: User) => string
  validateToken: (token: string) => Promise<boolean>
  refreshTokenFn?: (refreshToken: string) => Promise<string>

  // Configurações
  tokenExpirationTime?: number // ms
  autoRefreshTokens?: boolean
  onTokenExpired?: () => void
}

export function sessionPlugin(config: SessionPluginConfig): Plugin {
  return {
    name: 'session',

    async setup(auth: AuthCore) {
      // Salvar sessão quando usuário faz login
      auth.on('afterLogin', async ({ user, token }) => {
        // VOCÊ DECIDE COMO SALVAR
        if (config.storage === 'localStorage') {
          localStorage.setItem(config.storageKey ?? 'auth:token', token)
        } else if (config.storage === 'custom') {
          // seu próprio storage
          await seu_storage.save('token', token)
        }
      })

      // Restaurar sessão ao inicializar
      ;auth.restoreSession = async () => {
        let token: string | null = null

        // VOCÊ DECIDE COMO RECUPERAR
        if (config.storage === 'localStorage') {
          token = localStorage.getItem(config.storageKey ?? 'auth:token')
        } else if (config.storage === 'cookie') {
          token = getCookie(config.storageKey ?? 'auth:token')
        }

        if (!token) return

        try {
          auth.setState('isLoading', true)

          // Validar token
          const isValid = await config.validateToken(token)
          if (!isValid) {
            // Token expirado, limpar
            await auth.clearSession()
            if (config.onTokenExpired) {
              config.onTokenExpired()
            }
            return
          }

          // Aqui você pode buscar dados atualizados do usuário
          // Se tiver um plugin que implementa getUser()
          const user = await auth.getUser?.(token)
          if (user) {
            auth.setState('user', user)
            auth.setState('token', token)
          }

          auth.setState('isLoading', false)
        } catch (error) {
          await auth.clearSession()
        }
      }

      // Limpar sessão
      ;auth.clearSession = async () => {
        if (config.storage === 'localStorage') {
          localStorage.removeItem(config.storageKey ?? 'auth:token')
        } else if (config.storage === 'cookie') {
          deleteCookie(config.storageKey ?? 'auth:token')
        }

        auth.setState('user', null)
        auth.setState('token', null)
      }

      // Refresh token se implementado
      if (config.refreshTokenFn) {
        ;auth.refreshToken = async () => {
          const refreshToken = localStorage.getItem(config.refreshTokenKey ?? 'auth:refresh')
          if (!refreshToken) throw new Error('No refresh token')

          const newToken = await config.refreshTokenFn(refreshToken)
          localStorage.setItem(config.storageKey ?? 'auth:token', newToken)
          auth.setState('token', newToken)

          return newToken
        }

        // Auto refresh se habilitado
        if (config.autoRefreshTokens && config.tokenExpirationTime) {
          setInterval(async () => {
            try {
              await auth.refreshToken()
            } catch (error) {
              console.error('Token refresh falhou:', error)
            }
          }, (config.tokenExpirationTime ?? 3600000) - 60000)
        }
      }

      // Limpar sessão ao fazer logout
      auth.on('afterLogout', async () => {
        await auth.clearSession()
      })
    }
  }
}
```

### Exemplo 3: Plugin OAuth Customizado

```typescript
// plugins/oauth.ts

import { Plugin, AuthCore } from 'nanoauth'

interface OAuthProvider {
  name: string
  clientId: string
  clientSecret: string
  authorizationUrl: string
  tokenUrl: string
  userInfoUrl: string
  redirectUri: string
  scope: string[]
  // VOCÊ PODE ADICIONAR O QUE QUISER
  [key: string]: any
}

interface OAuthPluginConfig {
  providers: Record<string, OAuthProvider>
  userRepository: {
    findByOAuthId(provider: string, oauthId: string): Promise<User | null>
    create(user: User): Promise<User>
    linkAccount(userId: string, provider: string, oauthId: string): Promise<void>
  }
  // User mapping customizado
  mapOAuthProfile?: (provider: string, profile: any) => Partial<User>
}

export function oauthPlugin(config: OAuthPluginConfig): Plugin {
  return {
    name: 'oauth',

    async setup(auth: AuthCore) {
      ;auth.getOAuthUrl = (provider: string) => {
        const providerConfig = config.providers[provider]
        if (!providerConfig) throw new Error(`Provider ${provider} not found`)

        // Gerar state e salvar
        const state = generateRandomString(32)
        localStorage.setItem(`oauth_state_${provider}`, state)

        const params = new URLSearchParams({
          client_id: providerConfig.clientId,
          redirect_uri: providerConfig.redirectUri,
          response_type: 'code',
          scope: providerConfig.scope.join(' '),
          state
        })

        return `${providerConfig.authorizationUrl}?${params.toString()}`
      }

      ;auth.handleOAuthCallback = async (provider: string, code: string, state: string) => {
        try {
          const providerConfig = config.providers[provider]
          if (!providerConfig) throw new Error(`Provider ${provider} not found`)

          // Validar state
          const savedState = localStorage.getItem(`oauth_state_${provider}`)
          if (state !== savedState) throw new Error('State validation failed')

          auth.setState('isLoading', true)

          // Trocar código por token
          const tokenResponse = await fetch(providerConfig.tokenUrl, {
            method: 'POST',
            body: JSON.stringify({
              client_id: providerConfig.clientId,
              client_secret: providerConfig.clientSecret,
              code,
              redirect_uri: providerConfig.redirectUri,
              grant_type: 'authorization_code'
            })
          }).then((r) => r.json())

          // Buscar dados do usuário
          const profile = await fetch(providerConfig.userInfoUrl, {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
          }).then((r) => r.json())

          // Mapear perfil (customizável!)
          const userData = config.mapOAuthProfile?.(provider, profile) ?? {
            email: profile.email,
            name: profile.name,
            avatar: profile.picture
          }

          // Buscar ou criar usuário
          let user = await config.userRepository.findByOAuthId(provider, profile.id)

          if (!user) {
            user = await config.userRepository.create({
              id: crypto.randomUUID(),
              ...userData,
              createdAt: new Date()
            })
          } else {
            await config.userRepository.linkAccount(user.id, provider, profile.id)
          }

          const token = seu_generateToken(user)
          auth.setState('user', user)
          auth.setState('token', token)
          auth.setState('isLoading', false)

          auth.emit('afterLogin', { user, token })
          return user
        } catch (error) {
          auth.setState('error', error as Error)
          auth.setState('isLoading', false)
          throw error
        }
      }
    }
  }
}
```

---

## 🎁 Ideas de Plugins (você pode criar!)

### Autenticação e Estratégias
- [ ] Email/Password (básico ou avançado)
- [ ] OAuth2 (Google, GitHub, Facebook, etc)
- [ ] SAML
- [ ] OpenID Connect
- [ ] Magic Links
- [ ] Passwordless (SMS, Email)
- [ ] Biometria (WebAuthn)

### Sessão e Tokens
- [ ] JWT com refresh tokens
- [ ] Session storage customizado
- [ ] Token rotation
- [ ] Device/Browser tracking
- [ ] Session revocation
- [ ] Multi-session support

### Segurança
- [ ] Rate limiting
- [ ] Brute force protection
- [ ] CSRF protection
- [ ] 2FA/MFA (TOTP, SMS, Email)
- [ ] Password strength validation
- [ ] Account lockout
- [ ] IP whitelist/blacklist

### Autorização
- [ ] RBAC (Role-Based Access Control)
- [ ] ABAC (Attribute-Based Access Control)
- [ ] Permissões granulares
- [ ] Resource-based authorization
- [ ] Delegation/Impersonation

### Persistência e Dados
- [ ] User profile management
- [ ] Account linking/federation
- [ ] Account recovery
- [ ] Email verification
- [ ] Phone verification
- [ ] Social data sync

### Analytics e Logging
- [ ] Audit logs
- [ ] Login/logout tracking
- [ ] Failed attempt logging
- [ ] Analytics integration
- [ ] Webhook notifications
- [ ] Email notifications

### Integração
- [ ] Webhook hooks
- [ ] Analytics providers (Google Analytics, Mixpanel, etc)
- [ ] Email providers (SendGrid, AWS SES, etc)
- [ ] SMS providers (Twilio, etc)
- [ ] Push notifications
- [ ] Database drivers (custom adapters)

---

## 💻 Usando a Biblioteca

### Setup Simples

```typescript
// auth.ts
import { createAuth } from 'nanoauth'
import { emailPasswordPlugin } from './plugins/email-password'
import { sessionPlugin } from './plugins/session'
import { UserRepository } from './db/users'
import { hashPassword, comparePassword } from './crypto'

const userRepo = new UserRepository()

export const auth = createAuth({
  // Seu adapter customizado - você decide como buscar usuários!
  async getUser(userId: string) {
    return userRepo.findById(userId)
  }
})

// Plugin 1: Session/Tokens
auth.use(
  sessionPlugin({
    storage: 'localStorage',
    tokenExpirationTime: 24 * 60 * 60 * 1000,
    generateToken: (user) => seu_jwt_sign(user),
    validateToken: (token) => seu_jwt_verify(token)
  })
)

// Plugin 2: Email/Password
auth.use(
  emailPasswordPlugin({
    hashPassword,
    comparePassword,
    validateEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    userRepository: userRepo
  })
)

// Restaurar sessão ao inicializar
auth.restoreSession()

export default auth
```

### Em Componentes React

```typescript
import { useEffect, useState } from 'react'
import auth from '@/auth'

export function App() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Observar mudanças
    const unsub1 = auth.onChange('user', setUser)
    const unsub2 = auth.onChange('isLoading', setIsLoading)

    return () => {
      unsub1()
      unsub2()
    }
  }, [])

  if (isLoading) return <div>Carregando...</div>

  if (user) {
    return <Dashboard user={user} />
  }

  return <Login />
}

function Login() {
  const handleLogin = async (email: string, password: string) => {
    try {
      await auth.login(email, password)
    } catch (error) {
      console.error('Login falhou:', error)
    }
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        const email = e.currentTarget.email.value
        const password = e.currentTarget.password.value
        await handleLogin(email, password)
      }}
    >
      <input name="email" type="email" />
      <input name="password" type="password" />
      <button type="submit">Entrar</button>
    </form>
  )
}

function Dashboard({ user }) {
  return (
    <div>
      <h1>Bem-vindo, {user.name}</h1>
      <button onClick={() => auth.logout()}>Logout</button>
    </div>
  )
}
```

### Em Componentes Vue

```vue
<template>
  <div>
    <div v-if="isLoading">Carregando...</div>
    <Dashboard v-else-if="user" :user="user" />
    <Login v-else @login="handleLogin" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import auth from '@/auth'

const user = ref(null)
const isLoading = ref(false)
let unsubUser, unsubLoading

onMounted(() => {
  unsubUser = auth.onChange('user', (u) => (user.value = u))
  unsubLoading = auth.onChange('isLoading', (l) => (isLoading.value = l))
})

onUnmounted(() => {
  unsubUser?.()
  unsubLoading?.()
})

const handleLogin = async (email, password) => {
  try {
    await auth.login(email, password)
  } catch (error) {
    console.error('Login falhou:', error)
  }
}
</script>
```

---

## 🔧 Extensibilidade Avançada

### Adicionar Métodos Customizados

```typescript
// Seus plugins podem adicionar qualquer método
auth.use(meuPlugin())

// Depois usar
await auth.meuMetodo()
```

### Hooks do Ciclo de Vida

```typescript
// Plugins podem registrar hooks
auth.on('beforeLogin', async ({ email }) => {
  console.log(`Tentando login com ${email}`)
})

auth.on('afterLogin', async ({ user, token }) => {
  console.log(`Login bem-sucedido: ${user.email}`)
  // Enviar analytics, fazer chamadas API, etc
})

auth.on('beforeLogout', async () => {
  console.log('Saindo...')
})

auth.on('afterLogout', async () => {
  console.log('Usuário saiu')
})

auth.on('onError', async (error) => {
  console.error('Erro de autenticação:', error)
})
```

### Observar Estado

```typescript
// Qualquer mudança de estado pode ser observada
const unsubscribe = auth.onChange('user', (newUser) => {
  console.log('Usuário mudou:', newUser)
})

// Parar de observar
unsubscribe()

// Observar múltiplas mudanças
auth.onChange('token', (token) => {
  // Token mudou
})

auth.onChange('error', (error) => {
  // Erro mudou
})
```

### Criar Seus Próprios Plugins

```typescript
import { Plugin, AuthCore } from 'nanoauth'

export function meuPluginCustomizado(): Plugin {
  return {
    name: 'meu-plugin',

    async setup(auth: AuthCore) {
      // Adicionar estado
      auth.setState('meuEstado', {})

      // Adicionar método
      ;auth.meuMetodo = async (param: string) => {
        // sua lógica
      }

      // Ouvir hooks
      auth.on('afterLogin', async ({ user }) => {
        // reagir
      })

      // Observar mudanças
      auth.onChange('user', (newUser) => {
        // reagir
      })
    }
  }
}

// Usar
auth.use(meuPluginCustomizado())
```

---

## 📚 Tipos e Interfaces

```typescript
// Types principais que você vai usar

export interface User {
  id: string
  email: string
  name: string
  // Adicione qualquer campo que quiser!
  [key: string]: any
}

export interface AuthAdapter {
  getUser(userId: string): Promise<User | null>
  saveSession(sessionId: string, data: any): Promise<void>
  validateToken(token: string): Promise<boolean>
  deleteSession(sessionId: string): Promise<void>
  // Seus métodos customizados aqui!
  [key: string]: any
}

export interface Plugin {
  name: string
  setup(auth: AuthCore): void | Promise<void>
}

export interface AuthConfig {
  // Customizar comportamento da auth
  [key: string]: any
}

export interface AuthCore {
  // Estado
  onChange(key: string, callback: (value: any) => void): () => void
  getState<T = any>(key: string): Promise<T | undefined>

  // Hooks
  on(event: string, callback: Function): void

  // Plugins
  use(plugin: Plugin): this

  // Métodos padrão (implementados por plugins)
  login(credentials: any): Promise<User>
  logout(): Promise<void>
  signup(data: any): Promise<User>

  // Qualquer método customizado de seus plugins
  [key: string]: any
}
```

---

## 🚀 Roadmap de Implementação

### Fase 1: Core Mínimo
- [ ] AuthCore class
- [ ] onChange/getState API
- [ ] Plugin system
- [ ] Hooks system

### Fase 2: Plugins Built-in
- [ ] Email/Password plugin
- [ ] Session plugin
- [ ] OAuth plugin base

### Fase 3: Documentação e Exemplos
- [ ] Documentação completa
- [ ] Exemplos com React, Vue, Svelte
- [ ] Exemplos de plugins customizados
- [ ] Guia de arquitetura

### Fase 4: Features Adicionais
- [ ] 2FA plugin
- [ ] Rate limiting plugin
- [ ] Audit log plugin
- [ ] Device management

### Fase 5: Ecossistema
- [ ] Comunidade de plugins
- [ ] Publicar plugins no npm
- [ ] Criar showcase de projetos usando NanoAuth

---

## 🎯 Conclusão

**NanoAuth é para você se:**

✅ Quer controle total sobre autenticação  
✅ Tem requisitos únicos e específicos  
✅ Quer evitar vendor lock-in  
✅ Prefere composição a configuração  
✅ Quer zero dependências  

**NanoAuth NÃO é para você se:**

❌ Quer algo pronto para usar em 5 minutos  
❌ Quer muita magia automática  
❌ Quer que alguém else decida os padrões  

---

## 📖 Referências

- [PLUGINS_V2.md](./PLUGINS_V2.md) - Sistema detalhado de plugins
- [Better Auth](https://better-auth.com) - Inspiração
- [NextAuth.js](https://next-auth.js.org) - Inspiração
