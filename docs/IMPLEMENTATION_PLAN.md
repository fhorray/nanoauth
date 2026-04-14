# NanoAuth - Plano de Implementação (MVP)

## 📋 Estrutura do Monorepo

```
nanoauth/
├── packages/
│   └── nanoauth/           # Core da biblioteca
│       ├── src/
│       │   ├── index.ts     # Public exports
│       │   ├── core.ts      # AuthCore class
│       │   ├── types.ts     # Tipos principais
│       │   └── plugins/     # Plugins built-in
│       │       ├── email-password.ts
│       │       ├── session.ts
│       │       └── oauth.ts
│       ├── package.json
│       └── tsconfig.json
│
├── apps/
│   └── playground/         # Exemplo com Hono
│       ├── src/
│       │   ├── index.ts     # App Hono
│       │   ├── auth.ts      # Setup de auth
│       │   └── handlers/
│       │       ├── auth.ts  # Routes de auth
│       │       └── user.ts  # Routes de user
│       ├── package.json
│       └── tsconfig.json
│
├── package.json            # Root monorepo
├── tsconfig.json           # Root tsconfig
├── IMPLEMENTATION_PLAN.md  # Este arquivo
├── DESIGN.md
├── PLUGINS.md
└── README.md
```

---

## 🎯 MVP Phase 1: Core do NanoAuth

### Tarefa 1.1: Setup Inicial

- [ ] Criar estrutura de diretórios em `packages/nanoauth`
- [ ] Criar `packages/nanoauth/package.json`
- [ ] Criar `packages/nanoauth/tsconfig.json`
- [ ] Setup build scripts (tsc)

### Tarefa 1.2: Tipos Principais

- [ ] `User` interface
- [ ] `AuthState` interface
- [ ] `AuthAdapter` interface
- [ ] `Plugin` interface
- [ ] `AuthConfig` interface

### Tarefa 1.3: AuthCore Class

- [ ] Implementar classe `AuthCore` com:
  - `constructor(adapter, config)`
  - `onChange(key, callback)`
  - `getState(key)`
  - `setState(key, value)` (protected)
  - `on(event, callback)`
  - `emit(event, ...args)` (protected)
  - `use(plugin)` (para plugins)

### Tarefa 1.4: Factory Function

- [ ] Implementar `createAuth(adapter, config)`
- [ ] Exports públicos em `index.ts`

### Tarefa 1.5: Testes

- [ ] Unit tests para AuthCore
- [ ] Testes de plugins
- [ ] Testes de integração

---

## 🔌 MVP Phase 2: Plugins Built-in

### Tarefa 2.1: Session Plugin

- [ ] Implementar `sessionPlugin(config)`
  - [ ] localStorage support
  - [ ] sessionStorage support
  - [ ] memory support
  - [ ] Métodos: `restoreSession()`, `clearSession()`, `refreshToken()`

### Tarefa 2.2: Email/Password Plugin

- [ ] Implementar `emailPasswordPlugin(config)`
  - [ ] Validação de email
  - [ ] Validação de senha
  - [ ] Métodos: `login(email, password)`, `signup(email, password, name)`
  - [ ] Métodos: `changePassword()`, `resetPassword()`

### Tarefa 2.3: OAuth Plugin

- [ ] Implementar `oauthPlugin(config)`
  - [ ] Suporte a múltiplos provedores
  - [ ] Métodos: `getOAuthUrl(provider)`, `handleOAuthCallback(provider, code, state)`

---

## 🎮 MVP Phase 3: Playground (Hono Example)

### Tarefa 3.1: Setup Hono App

- [ ] Criar `apps/playground/package.json`
- [ ] Setup Hono básico
- [ ] Setup rotas de autenticação

### Tarefa 3.2: Auth Setup no Playground

- [ ] Criar `apps/playground/src/auth.ts` com:
  - [ ] AuthAdapter customizado
  - [ ] Plugins configurados (session + email/password + oauth)
  - [ ] Exportar instância de `auth`

### Tarefa 3.3: Rotas de Autenticação

- [ ] `POST /auth/login` - Email/Password login
- [ ] `POST /auth/signup` - Criar conta
- [ ] `POST /auth/logout` - Fazer logout
- [ ] `GET /auth/user` - Obter usuário atual
- [ ] `GET /auth/oauth/:provider` - Redirecionar para OAuth
- [ ] `GET /auth/oauth/callback` - Callback do OAuth

### Tarefa 3.4: Middleware de Autenticação

- [ ] Criar middleware `authenticated()` para proteger rotas
- [ ] Criar middleware `optional()` para rotas opcionais
- [ ] Middleware para extrair token do header Authorization

### Tarefa 3.5: Exemplo de Rotas Protegidas

- [ ] `GET /profile` - Rota protegida
- [ ] `PUT /profile` - Atualizar perfil
- [ ] `POST /profile/change-password` - Mudar senha

---

## 📦 Exports do Package.json (packages/nanoauth/package.json)

```json
{
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./plugins/email-password": {
      "types": "./dist/plugins/email-password.d.ts",
      "import": "./dist/plugins/email-password.js"
    },
    "./plugins/session": {
      "types": "./dist/plugins/session.d.ts",
      "import": "./dist/plugins/session.js"
    },
    "./plugins/oauth": {
      "types": "./dist/plugins/oauth.d.ts",
      "import": "./dist/plugins/oauth.js"
    }
  }
}
```

### Uso esperado:

```typescript
// Core
import { createAuth } from 'nanoauth';
import type { AuthCore, User, Plugin } from 'nanoauth';

// Plugins
import { emailPasswordPlugin } from 'nanoauth/plugins/email-password';
import { sessionPlugin } from 'nanoauth/plugins/session';
import { oauthPlugin } from 'nanoauth/plugins/oauth';
```

---

## 🏃 Timeline Estimated

| Phase | Tasks           | Dias | Status     |
| ----- | --------------- | ---- | ---------- |
| 1     | Core + Types    | 1-2  | 📋 Planned |
| 2     | 3 Plugins       | 2-3  | 📋 Planned |
| 3     | Playground Hono | 1-2  | 📋 Planned |
| Total | MVP Completo    | 4-7  | 📋 Planned |

---

## 🚀 Próximos Passos Após MVP

- [ ] Testes automatizados (Jest/Vitest)
- [ ] CI/CD (GitHub Actions)
- [ ] Documentação completa
- [ ] Exemplos adicionais (React, Vue, Svelte)
- [ ] Publicar no npm
- [ ] Website/Documentação
- [ ] Plugin ecosystem

---

## 📝 Checklist de Implementação

### Fase 1: Core

- [ ] Diretórios criados
- [ ] package.json configurado
- [ ] tsconfig.json configurado
- [ ] types.ts implementado
- [ ] core.ts implementado
- [ ] createAuth() testado
- [ ] index.ts com exports

### Fase 2: Plugins

- [ ] sessionPlugin implementado
- [ ] emailPasswordPlugin implementado
- [ ] oauthPlugin implementado
- [ ] Testes básicos

### Fase 3: Playground

- [ ] Estrutura Hono criada
- [ ] Auth setup completo
- [ ] Rotas de autenticação
- [ ] Middleware implementado
- [ ] Rotas de exemplo
