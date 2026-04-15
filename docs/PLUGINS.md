# NanoAuth - Sistema de Plugins (Zero Dependencies)

## 🎯 Filosofia

**NanoAuth é apenas uma base, 100% agnóstica.** O desenvolvedor cria exatamente o que precisa usando plugins. Sem opiniões, sem overhead, sem dependências externas para o usuário.

```
npm install nanoauth
(Nenhuma outra dependência necessária!)
                ↓
           AuthCore Mínimo
       (nanostores é interno)
                ↓
          + Plugin Email ───┐
             ↓              ├─→ Sua Autenticação
          + Plugin OAuth ──┤     Customizada
             ↓              ├─→ Exatamente como
          + Plugin Session ┘     você quer
```

---

## 📦 Arquitetura Base (Mínima)

### O que o usuário vê (API Pública):

```typescript
// ✨ Zero imports de dependências externas!

import { createAuth } from 'nanoauth';

const auth = createAuth();

// Usar diretamente
await auth.login({ email: 'user@example.com', password: 'pass' });

// Observar mudanças
auth.onChange('user', (newUser) => {
  console.log('Usuário mudou:', newUser);
});

// Obter valor atual
const currentUser = await auth.getState('user');
```

### O que é fornecido internamente:

```typescript
// nanoauth/core.ts (INTERNO - usuário não precisa conhecer)

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  token: string | null;
  metadata: Record<string, any>;
}

export interface Plugin {
  name: string;
  setup(auth: AuthCore): void | Promise<void>;
}

export class AuthCore {
  // ⚠️ Estado reativo implementado internamente
  // Pode ser nanostores, MobX, signals, qualquer coisa
  private state: Map<string, any> = new Map();
  private observers: Map<string, Set<Function>> = new Map();

  // API Pública
  async getState<T = any>(key: string): Promise<T | undefined>;
  setState<T = any>(key: string, value: T): void;
  onChange(key: string, callback: (value: any) => void): () => void;
  on(event: string, callback: Function): void;
  emit(event: string, ...args: any[]): void;

  // Métodos (implementados por plugins)
  async login(credentials: any): Promise<User>;
  async logout(): Promise<void>;
  async signup(data: any): Promise<User>;
}

export function createAuth(): AuthCore {
  return new AuthCore();
}
```

---

## 🔌 API Pública (Sem Dependências)

### Métodos Básicos

```typescript
import { createAuth } from 'nanoauth';

const auth = createAuth();

// Observar mudanças (padrão Pub/Sub común)
const unsubscribe = auth.onChange('user', (user) => {
  console.log('Usuário:', user);
});

// Parar de observar
unsubscribe();

// Obter estado atual
const user = await auth.getState('user');
const isLoading = await auth.getState('isLoading');

// Atualizar estado (para plugins)
auth.setState('user', newUser);

// Hooks do ciclo de vida
auth.on('beforeLogin', (credentials) => {
  console.log('Tentando login...');
});

auth.on('afterLogin', (user) => {
  console.log('Login bem-sucedido!');
});

auth.on('onError', (error) => {
  console.error('Erro:', error.message);
});
```

---

## 🧩 Exemplo 1: Plugin Email/Password

```typescript
// plugins/email-password.ts

import { Plugin, AuthCore } from 'nanoauth';

interface EmailPasswordConfig {
  validateEmail?: (email: string) => boolean;
  hashPassword: (password: string) => Promise<string>;
  comparePassword: (password: string, hash: string) => Promise<boolean>;
  userRepository: {
    findByEmail(email: string): Promise<User | null>;
    create(user: User): Promise<User>;
  };
}

export function emailPasswordPlugin(config: EmailPasswordConfig): Plugin {
  return {
    name: 'email-password',

    async setup(auth: AuthCore) {
      // Método login
      auth.login = async (email: string, password: string) => {
        try {
          auth.setState('isLoading', true);
          auth.emit('beforeLogin', { email });

          // Validação
          if (config.validateEmail && !config.validateEmail(email)) {
            throw new Error('Email inválido');
          }

          // Buscar usuário
          const user = await config.userRepository.findByEmail(email);
          if (!user) {
            throw new Error('Usuário não encontrado');
          }

          // Comparar senha
          const isValid = await config.comparePassword(
            password,
            user.passwordHash,
          );
          if (!isValid) {
            throw new Error('Senha incorreta');
          }

          // Atualizar estado
          const token = generateToken(user); // seu método
          auth.setState('user', user);
          auth.setState('token', token);
          auth.setState('isLoading', false);

          auth.emit('afterLogin', { user, token });
          return user;
        } catch (error) {
          auth.setState('error', error as Error);
          auth.setState('isLoading', false);
          auth.emit('onError', error);
          throw error;
        }
      };

      // Método signup
      auth.signup = async (
        email: string,
        password: string,
        name: string,
      ) => {
        try {
          auth.setState('isLoading', true);

          const exists = await config.userRepository.findByEmail(email);
          if (exists) {
            throw new Error('Email já registrado');
          }

          const passwordHash = await config.hashPassword(password);
          const user = await config.userRepository.create({
            id: generateId(),
            email,
            name,
            passwordHash,
            createdAt: new Date(),
          });

          const token = generateToken(user);
          auth.setState('user', user);
          auth.setState('token', token);
          auth.setState('isLoading', false);

          auth.emit('afterLogin', { user, token });
          return user;
        } catch (error) {
          auth.setState('error', error as Error);
          auth.setState('isLoading', false);
          auth.emit('onError', error);
          throw error;
        }
      };

      // Métodos específicos do plugin
      auth.changePassword = async (
        email: string,
        oldPassword: string,
        newPassword: string,
      ) => {
        const user = await config.userRepository.findByEmail(email);
        if (!user) throw new Error('Usuário não encontrado');

        const isValid = await config.comparePassword(
          oldPassword,
          user.passwordHash,
        );
        if (!isValid) throw new Error('Senha atual incorreta');

        const newHash = await config.hashPassword(newPassword);
        // Atualizar no banco
        await config.userRepository.update(user.id, { passwordHash: newHash });
      };
    },
  };
}
```

### Usando o Plugin (Sem nenhuma dependência externa!)

```typescript
// auth.ts

import { createAuth } from 'nanoauth';
import { emailPasswordPlugin } from 'nanoauth/plugins';
import { hashPassword, comparePassword } from './crypto';
import { UserRepository } from './db';

const auth = createAuth();

// Adicionar plugin
auth.use(
  emailPasswordPlugin({
    hashPassword,
    comparePassword,
    userRepository: new UserRepository(),
  }),
);

export default auth;
```

```typescript
// Componente React (SEM NENHUMA DEPENDÊNCIA!)

import auth from '@/auth'

export function LoginForm() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Observar mudanças
  useEffect(() => {
    // Observar usuário
    const unsub1 = auth.onChange('user', (u) => setUser(u))
    const unsub2 = auth.onChange('isLoading', (l) => setIsLoading(l))
    const unsub3 = auth.onChange('error', (e) => setError(e))

    return () => {
      unsub1()
      unsub2()
      unsub3()
    }
  }, [])

  const handleLogin = async (email: string, password: string) => {
    try {
      await auth.login(email, password)
    } catch (err) {
      // erro já está em error
    }
  }

  if (user) {
    return <Dashboard user={user} />
  }

  return (
    <div>
      {error && <div className="error">{error.message}</div>}
      <button onClick={() => handleLogin('user@example.com', 'pass')}
              disabled={isLoading}>
        {isLoading ? 'Entrando...' : 'Entrar'}
      </button>
    </div>
  )
}
```

```typescript
// Componente Vue (SEM NENHUMA DEPENDÊNCIA!)

<template>
  <div>
    <div v-if="error" class="error">{{ error.message }}</div>
    <div v-if="user" class="dashboard">
      <p>Bem-vindo, {{ user.name }}!</p>
      <button @click="logout">Logout</button>
    </div>
    <div v-else class="login">
      <button @click="handleLogin" :disabled="isLoading">
        {{ isLoading ? 'Entrando...' : 'Entrar com Email' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import auth from '@/auth'

const user = ref(null)
const isLoading = ref(false)
const error = ref(null)
let unsubUser, unsubLoading, unsubError

onMounted(() => {
  unsubUser = auth.onChange('user', (u) => (user.value = u))
  unsubLoading = auth.onChange('isLoading', (l) => (isLoading.value = l))
  unsubError = auth.onChange('error', (e) => (error.value = e))
})

onUnmounted(() => {
  unsubUser?.()
  unsubLoading?.()
  unsubError?.()
})

const handleLogin = () => {
  auth.login('user@example.com', 'password')
}

const logout = () => {
  auth.logout()
}
</script>
```

```typescript
// Componente Svelte (SEM NENHUMA DEPENDÊNCIA!)

<script>
  import auth from '@/auth'
  import { onMount } from 'svelte'

  let user
  let isLoading
  let error

  onMount(() => {
    const unsub1 = auth.onChange('user', (u) => (user = u))
    const unsub2 = auth.onChange('isLoading', (l) => (isLoading = l))
    const unsub3 = auth.onChange('error', (e) => (error = e))

    return () => {
      unsub1()
      unsub2()
      unsub3()
    }
  })

  const handleLogin = () => {
    auth.login('user@example.com', 'password')
  }

  const handleLogout = () => {
    auth.logout()
  }
</script>

{#if error}
  <div class="error">{error.message}</div>
{/if}

{#if user}
  <div class="dashboard">
    <p>Bem-vindo, {user.name}!</p>
    <button on:click={handleLogout}>Logout</button>
  </div>
{:else}
  <div class="login">
    <button on:click={handleLogin} disabled={isLoading}>
      {isLoading ? 'Entrando...' : 'Entrar'}
    </button>
  </div>
{/if}
```

---

## 🧩 Exemplo 2: Plugin OAuth

```typescript
// plugins/oauth.ts

import { Plugin, AuthCore } from 'nanoauth';

interface OAuthProvider {
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  redirectUri: string;
  scope: string[];
}

interface OAuthConfig {
  providers: Record<string, OAuthProvider>;
  userRepository: {
    findByOAuthId(provider: string, id: string): Promise<User | null>;
    create(user: User): Promise<User>;
    linkOAuthAccount(
      userId: string,
      provider: string,
      oauthId: string,
    ): Promise<void>;
  };
}

export function oauthPlugin(config: OAuthConfig): Plugin {
  return {
    name: 'oauth',

    async setup(auth: AuthCore) {
      // Gerar URL de autorização
      auth.getOAuthAuthorizationUrl = (providerName: string) => {
        const provider = config.providers[providerName];
        if (!provider)
          throw new Error(`Provider ${providerName} não encontrado`);

        const state = generateRandomString(32);
        localStorage.setItem(`oauth_state_${providerName}`, state);

        const params = new URLSearchParams({
          client_id: provider.clientId,
          redirect_uri: provider.redirectUri,
          response_type: 'code',
          scope: provider.scope.join(' '),
          state,
        });

        return `${provider.authorizationUrl}?${params.toString()}`;
      };

      // Callback do OAuth
      auth.handleOAuthCallback = async (
        providerName: string,
        code: string,
        state: string,
      ) => {
        try {
          const provider = config.providers[providerName];
          if (!provider)
            throw new Error(`Provider ${providerName} não encontrado`);

          const savedState = localStorage.getItem(
            `oauth_state_${providerName}`,
          );
          if (state !== savedState) {
            throw new Error('State mismatch');
          }

          auth.setState('isLoading', true);

          // Trocar code por token
          const tokenResponse = await fetch(provider.tokenUrl, {
            method: 'POST',
            body: JSON.stringify({
              client_id: provider.clientId,
              client_secret: provider.clientSecret,
              code,
              redirect_uri: provider.redirectUri,
              grant_type: 'authorization_code',
            }),
          }).then((r) => r.json());

          const accessToken = tokenResponse.access_token;

          // Buscar dados do usuário
          const userInfoResponse = await fetch(provider.userInfoUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }).then((r) => r.json());

          let user = await config.userRepository.findByOAuthId(
            providerName,
            userInfoResponse.id,
          );

          if (!user) {
            user = await config.userRepository.create({
              id: generateId(),
              email: userInfoResponse.email,
              name: userInfoResponse.name,
              avatar: userInfoResponse.picture,
              createdAt: new Date(),
            });
          } else {
            await config.userRepository.linkOAuthAccount(
              user.id,
              providerName,
              userInfoResponse.id,
            );
          }

          const token = generateToken(user);
          auth.setState('user', user);
          auth.setState('token', token);
          auth.setState('isLoading', false);

          auth.emit('afterLogin', { user, token });
          return user;
        } catch (error) {
          auth.setState('error', error as Error);
          auth.setState('isLoading', false);
          auth.emit('onError', error);
          throw error;
        }
      };
    },
  };
}
```

### Usando OAuth Plugin

```typescript
import { createAuth } from 'nanoauth';
import { oauthPlugin } from 'nanoauth/plugins';

const auth = createAuth();

auth.use(
  oauthPlugin({
    providers: {
      google: {
        name: 'google',
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        redirectUri: 'http://localhost:3000/auth/oauth/callback',
        scope: ['email', 'profile'],
      },
    },
    userRepository: new UserRepository(),
  }),
);

export default auth;
```

```typescript
// Em um componente
import auth from '@/auth';

// Obter URL de login
const googleLoginUrl = auth.getOAuthAuthorizationUrl('google');
window.location.href = googleLoginUrl;

// No callback
auth.handleOAuthCallback('google', code, state);
```

---

## 🧩 Exemplo 3: Plugin Session

```typescript
// plugins/session.ts

import { Plugin, AuthCore } from 'nanoauth';

interface SessionConfig {
  tokenKey: string;
  refreshTokenKey: string;
  storage: 'localStorage' | 'sessionStorage' | 'memory';
  tokenExpirationTime: number; // ms
  refreshTokenRotation: boolean;
  validateTokenFn: (token: string) => Promise<boolean>;
}

export function sessionPlugin(config: SessionConfig): Plugin {
  return {
    name: 'session',

    async setup(auth: AuthCore) {
      const getStorage = () => {
        switch (config.storage) {
          case 'localStorage':
            return localStorage;
          case 'sessionStorage':
            return sessionStorage;
          case 'memory':
            return new Map<string, string>();
          default:
            return localStorage;
        }
      };

      const storage = getStorage();

      // Restaurar sessão ao inicializar
      auth.restoreSession = async () => {
        const token = getToken();
        if (!token) return;

        try {
          auth.setState('isLoading', true);

          const isValid = await config.validateTokenFn(token);
          if (!isValid) {
            clearStorage();
            return;
          }

          auth.emit('beforeRestoreSession', { token });

          // Aqui assumimos que outro plugin tem getUser()
          const user = await auth.getUser?.(token);
          if (user) {
            auth.setState('user', user);
            auth.setState('token', token);
            auth.setState('isLoading', false);
          }
        } catch (error) {
          clearStorage();
          auth.setState('error', error as Error);
          auth.setState('isLoading', false);
        }
      };

      // Refresh token
      auth.refreshToken = async () => {
        try {
          const refreshToken = getRefreshToken();
          if (!refreshToken) throw new Error('No refresh token');

          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
          }).then((r) => r.json());

          const newToken = response.token;
          const newRefreshToken = response.refreshToken;

          saveToken(newToken);
          if (newRefreshToken) {
            saveRefreshToken(newRefreshToken);
          }

          auth.setState('token', newToken);
          auth.emit('onTokenRefreshed', { token: newToken });

          return newToken;
        } catch (error) {
          clearStorage();
          throw error;
        }
      };

      // Limpar sessão
      auth.clearSession = async () => {
        clearStorage();
        auth.setState('user', null);
        auth.setState('token', null);
      };

      // Hooks
      auth.on('afterLogin', ({ token }) => {
        saveToken(token);
      });

      auth.on('afterLogout', () => {
        clearStorage();
      });

      // Setup automático de refresh
      if (config.tokenExpirationTime) {
        setInterval(async () => {
          try {
            await auth.refreshToken();
          } catch (error) {
            console.error('Token refresh falhou:', error);
          }
        }, config.tokenExpirationTime - 60000);
      }

      // Funções auxiliares
      function getToken(): string | null {
        if (config.storage === 'memory') {
          return (storage as Map<string, string>).get(config.tokenKey) || null;
        }
        return (storage as Storage).getItem(config.tokenKey);
      }

      function getRefreshToken(): string | null {
        if (config.storage === 'memory') {
          return (
            (storage as Map<string, string>).get(config.refreshTokenKey) || null
          );
        }
        return (storage as Storage).getItem(config.refreshTokenKey);
      }

      function saveToken(token: string) {
        if (config.storage === 'memory') {
          (storage as Map<string, string>).set(config.tokenKey, token);
        } else {
          (storage as Storage).setItem(config.tokenKey, token);
        }
      }

      function saveRefreshToken(token: string) {
        if (config.storage === 'memory') {
          (storage as Map<string, string>).set(config.refreshTokenKey, token);
        } else {
          (storage as Storage).setItem(config.refreshTokenKey, token);
        }
      }

      function clearStorage() {
        if (config.storage === 'memory') {
          (storage as Map<string, string>).delete(config.tokenKey);
          (storage as Map<string, string>).delete(config.refreshTokenKey);
        } else {
          (storage as Storage).removeItem(config.tokenKey);
          (storage as Storage).removeItem(config.refreshTokenKey);
        }
      }
    },
  };
}
```

---

## 🛠️ Criando Seu Próprio Plugin

```typescript
// plugins/custom-logger.ts

import { Plugin, AuthCore } from 'nanoauth';

export function customLoggerPlugin(): Plugin {
  return {
    name: 'custom-logger',

    async setup(auth: AuthCore) {
      // Observar qualquer mudança
      const keys = ['user', 'isLoading', 'error', 'token'];

      keys.forEach((key) => {
        auth.onChange(key, (value) => {
          console.log(`[AUTH] ${key}:`, value);
        });
      });

      // Ouvir eventos
      auth.on('beforeLogin', ({ email }) => {
        console.log(`[AUTH] Tentando login com ${email}`);
      });

      auth.on('afterLogin', ({ user }) => {
        console.log(`[AUTH] Login bem-sucedido: ${user.email}`);
      });

      auth.on('onError', (error) => {
        console.error(`[AUTH] Erro:`, error.message);
      });
    },
  };
}
```

### Exemplo: Plugin de Rate Limiting

```typescript
// plugins/rate-limit.ts

import { Plugin, AuthCore } from 'nanoauth';

interface RateLimitConfig {
  maxLoginAttempts: number;
  lockoutDuration: number; // ms
}

export function rateLimitPlugin(config: RateLimitConfig): Plugin {
  const attempts = new Map<string, { count: number; lockedUntil: number }>();

  return {
    name: 'rate-limit',

    async setup(auth: AuthCore) {
      // Interceptar método login
      const originalLogin = auth.login;

      auth.login = async (email: string, password: string) => {
        const key = email;
        const attempt = attempts.get(key);

        if (attempt && attempt.lockedUntil > Date.now()) {
          const remainingTime = Math.ceil(
            (attempt.lockedUntil - Date.now()) / 1000,
          );
          throw new Error(
            `Muitas tentativas. Tente novamente em ${remainingTime}s`,
          );
        }

        try {
          const user = await originalLogin.call(auth, email, password);
          attempts.delete(key);
          return user;
        } catch (error) {
          const current = attempts.get(key) ?? { count: 0, lockedUntil: 0 };
          current.count++;

          if (current.count >= config.maxLoginAttempts) {
            current.lockedUntil = Date.now() + config.lockoutDuration;
          }

          attempts.set(key, current);
          throw error;
        }
      };
    },
  };
}
```

---

## 🎯 Montagem Completa

```typescript
// auth.ts

import { createAuth } from 'nanoauth';
import {
  emailPasswordPlugin,
  oauthPlugin,
  sessionPlugin,
} from 'nanoauth/plugins';

const auth = createAuth();

// 1. Session (base para persistência)
auth.use(
  sessionPlugin({
    tokenKey: 'auth:token',
    refreshTokenKey: 'auth:refresh',
    storage: 'localStorage',
    tokenExpirationTime: 1000 * 60 * 60 * 24,
    refreshTokenRotation: true,
    validateTokenFn: async (token) => {
      const res = await fetch('/api/auth/validate-token', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    },
  }),
);

// 2. Email/Password
auth.use(
  emailPasswordPlugin({
    hashPassword: async (pwd) => bcrypt.hash(pwd, 10),
    comparePassword: async (pwd, hash) => bcrypt.compare(pwd, hash),
    userRepository: userRepo,
  }),
);

// 3. OAuth
auth.use(
  oauthPlugin({
    providers: {
      google: {
        /* ... */
      },
      github: {
        /* ... */
      },
    },
    userRepository: userRepo,
  }),
);

// 4. Hooks customizados (sem plugins)
auth.on('afterLogin', ({ user }) => {
  console.log('✅ Login:', user.email);
});

auth.on('onError', (error) => {
  console.error('❌', error.message);
});

// 5. Restaurar sessão ao inicializar
auth.restoreSession();

export default auth;
```

---

## 📚 API Completa

```typescript
// Observação de estado
auth.onChange(key: string, callback: (value: any) => void): () => void

// State management
auth.getState<T>(key: string): Promise<T | undefined>
auth.setState(key: string, value: any): void

// Hooks do ciclo de vida
auth.on(event: string, callback: Function): void
auth.emit(event: string, ...args: any[]): void

// Plugin management
auth.use(plugin: Plugin): void

// Métodos (implementados por plugins)
auth.login(...args: any[]): Promise<User>
auth.logout(): Promise<void>
auth.signup(...args: any[]): Promise<User>

// Qualquer outro método adicionado por plugins
;auth.meuMetodo?.(...)
```

---

## 🚀 Resumo final

✅ **Sem dependências externas** para o usuário final  
✅ **Totalmente agnóstico** - você escolhe persistência, estratégias, etc  
✅ **Simples de usar** - apenas onChange() e getState()  
✅ **Extensível** - crie plugins facilmente  
✅ **Type-safe** - TypeScript completo  
✅ **Framework-agnostic** - funciona com qualquer framework  
✅ **Zero overhead** - pague apenas por plugins que usa

**Filosofia:** NanoAuth é só um container reativo. Você constrói a autenticação que precisa. Nada mais.
