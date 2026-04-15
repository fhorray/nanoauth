<div align="center">
  <h1>🚀 NanoAuth</h1>
  <p><strong>The most lightweight, pluggable, and developer-friendly authentication library for the modern web.</strong></p>
  <p>Bring your own database, define your own user structure, and let NanoAuth handle the heavy lifting of authentication flows, security, and stateless sessions.</p>
</div>

---

## 🌟 Why NanoAuth?

NanoAuth was built on a simple philosophy: **You should control your data, and the auth library should just orchestrate the logic.**

Unlike bloated full-stack mono-libraries that try to insert their own rigid database schemas into your project, NanoAuth provides a robust, zero-dependency, **completely stateless core** that you extend via **Plugins** and **Adapters**.

- **✨ 100% Type-Safe**: Built from the ground up with TypeScript Generics. If your user has a custom `subscriptionStatus` field, all NanoAuth hooks and plugins will know about it.
- **🛡️ Secure Stateless Architecture**: The server core is pure and stateless. It relies on standard Web Request/Response flows to read contexts via `auth.getSession(request)`, ensuring no global state leaks between concurrent requests.
- **🧩 Pluggable Architecture**: Only bundle what you use. Need Email/Password? Add the plugin. Need Session Management? Add the plugin.
- **⚡ Reactive Client SDK**: An ultra-lightweight frontend SDK powered by Nanostores makes bridging your UI with the authentication state incredibly easy and framework-agnostic.
- **🔥 Generic Web Handler**: Use our built-in `auth.handler(request)` to automatically generate all authentication endpoints for modern environments (Next.js, Cloudflare Workers, Hono, Bun, etc.).

---

## 📦 Installation

```bash
bun add nanoauth
```

> NanoAuth is intended to be framework-agnostic. Use it in Node, Bun, Deno, Cloudflare Workers, or wherever TypeScript runs!

---

## 🏛️ The 4 Pillars of NanoAuth

To master NanoAuth, you just need to understand its 4 core pillars:

1. **The User Type**: Your custom data structure.
2. **The Database Adapter**: How NanoAuth talks to _your_ database (built via `defineAdapter`).
3. **The Plugins**: The actual auth logic and endpoints (built via `definePlugin`).
4. **The Client SDK**: Reading auth state gracefully in the browser.

Let's dive into each one! 👇

---

## 🧍‍♀️ 1. The User Type (Generics)

NanoAuth doesn't force a database schema on you. 
You define your schema by extending the base `User` interface. NanoAuth will infer this type _everywhere_.

```typescript
import type { User } from 'nanoauth';

export interface MyAwesomeUser extends User {
  role: 'admin' | 'customer';
  tenantId: string;
  favoriteColor: string; // Because why not? 🎨
}
```

---

## 💾 2. The Database Adapter (`defineAdapter`)

The **Adapter** is the bridge between NanoAuth and your actual database. The library provides the `defineAdapter` helper to give you strict type checking and perfect autocomplete.

```typescript
import { defineAdapter } from 'nanoauth';
import type { MyAwesomeUser } from './types';
import { db } from './my-database';

// defineAdapter provides perfect autocompletion for the required methods!
export const myAdapter = defineAdapter<MyAwesomeUser>({
  // NanoAuth asks: "Hey, fetch a user by this ID"
  async getUser(userId) {
    return await db.users.findUnique({ where: { id: userId } });
  },

  // NanoAuth asks: "Hey, store this session payload"
  async saveSession(sessionId, data) {
    await db.sessions.insert({ id: sessionId, payload: data });
  },

  // NanoAuth asks: "Hey, delete this session"
  async deleteSession(sessionId) {
    await db.sessions.delete({ where: { id: sessionId } });
  },

  // NanoAuth asks: "Hey, is this token valid?"
  async validateToken(token) {
    const session = await db.sessions.findByToken(token);
    return session !== null;
  },

  // 💡 You can also add ANY extra custom method you want!
  async assignRole(userId, role) {
    await db.users.updateRole(userId, role);
  }
});
```

---

## 🔌 3. Building & Using Plugins (`definePlugin`)

The true power of NanoAuth lies in its declarative, plugin-first architecture. A Plugin is responsible for defining how your feature integrates with the auth lifecycle, what HTTP endpoints it needs, and what methods it exports.

To provide the best Developer Experience (DX), use the `definePlugin` helper.

### The Anatomy of a Plugin

A modern NanoAuth plugin consists of four main properties:
1.  **`name`**: The unique identifier of the plugin.
2.  **`endpoints`**: Custom HTTP routes (e.g., `/api/auth/magic/verify`) that the handler will process automatically.
3.  **`hooks`**: Listeners to lifecycle events.
4.  **`exports`**: Inject new stateless methods into the `auth` object (e.g., `auth.signin.magicLink()`). **Crucially, exported methods must return `{ user, token }`** to allow the handler to create the session cookes securely.

### Example: Custom Magic Link Plugin

```typescript
import { definePlugin } from 'nanoauth';
import { createHS256JWT } from 'nanoauth/utils';

export interface MagicLinkConfig {
  sendEmail: (email: string, link: string) => Promise<void>;
  generateToken: () => string;
}

export const magicLinkPlugin = definePlugin<MagicLinkConfig>((config) => ({
  name: 'magic-link',

  // 1. Export stateless methods to the Auth instance
  exports: (auth) => ({
    signin: {
      magicLinkVerify: async (token: string) => {
        // Validation logic here...
        const user = await auth.adapter.getUserByToken(token);
        
        // Return user and the newly generated session token!
        // The NanoAuth core will automatically handle cookies based on this return.
        const sessionToken = await createHS256JWT({ userId: user.id }, 'my-secret');
        return { user, token: sessionToken };
      }
    }
  }),

  // 2. Register HTTP endpoints processed by auth.handler()
  endpoints: {
    verify: {
      path: '/magic/verify',
      method: 'GET',
      handler: async (req, auth) => {
        const url = new URL(req.url);
        const token = url.searchParams.get('token');

        // Here we call the exported method!
        const { user, token: sessionToken } = await auth.signin.magicLinkVerify(token);
        
        // Return a successful response, the handler handles the rest.
        return new Response('Success!', { status: 200 });
      }
    }
  },

  // 3. React to core events statelessly
  hooks: {
    afterSignin: async ({ user, provider }) => {
      console.log(`User ${user.email} signed in via ${provider || 'credentials'}`);
    }
  }
}));
```

### Initializing the Core

Weave your adapter and plugins together using the factory:

```typescript
import { nanoauth, emailPasswordPlugin, sessionPlugin } from 'nanoauth';

export const auth = nanoauth<MyAwesomeUser>({
  adapter: myAdapter,
  secret: process.env.AUTH_SECRET,
  plugins: [
    sessionPlugin(),
    emailPasswordPlugin({ ... })
  ]
});
```

### Reading State on the Server 🛡️

Since the backend is strictly stateless, you retrieve the current user context directly from the active HTTP Request:

```typescript
// Inside any Next.js API Route, Hono Handler, or Bun Server:
const { user, token } = await auth.getSession(request);

if (!user) {
    return new Response('Unauthorized', { status: 401 });
}

console.log(`Hello, ${user.name}`);
```

---

## 📚 API Reference

### `auth` Instance Properties & Methods

Once you initialize `nanoauth`, the resulting `auth` instance provides the following core capabilities:

- **`auth.getSession(request: Request): Promise<{ user, token }>`**
  Statelessly parses the request (cookies/headers) to validate the session. Returns the user object and the session token if active, or `null` if unauthenticated.
- **`auth.handler(request: Request): Promise<Response>`**
  The Web Standard handler that automatically intercepts plugin endpoints (e.g. `/api/auth/signin/email`) and executes them, handling cookies and redirects automatically.
- **`auth.use(plugin: Plugin)`**
  Allows dynamically attaching additional plugins to an existing `auth` instance.
- **`auth.on(event, callback)`**
  Registers a dynamic listener for reactive events like `afterSignin`, `afterSignup`, `afterLogout`, and `onError`.

### `defineAdapter` vs `definePlugin`

- **`defineAdapter<UserType>(config)`**: An identity pass-through function just like `defineConfig` in Vite. It gives you 100% autocompletion for Database Adapter methods (like `getUser`, `saveSession`) and infers your custom generic `UserType`.
- **`definePlugin<Options, Exports, UserType>(factory)`**: Creates a robust, fully-typed authentication plugin. It structures the plugin into `endpoints` (for HTTP routing), `hooks` (for listening to core events), and `exports` (for attaching new methods to the `auth` instance statelessly).

---

## ⚡ 4. React Native & Frontend: The Client SDK

NanoAuth provides an ultra-lightweight, framework-agnostic Frontend Client powered by Nanostores. This handles reactivity, syncing state, and communicating with the generic web handler!

```typescript
import { createAuthClient } from 'nanoauth/client';

// 1. Initialize the client (usually in a separate file like lib/clientAuth.ts)
export const authClient = createAuthClient({
  baseURL: 'http://localhost:3000' // Your API URL
});

// 2. State is strictly defined!
// You can use these everywhere: React, Vue, Svelte, Vanilla JS.
authClient.session.subscribe(session => {
  if (session.user) {
    console.log(`Welcome back, ${session.user.name}`);
  }
});

authClient.isLoading.subscribe(loading => {
  if (loading) console.log('Processing authentication...');
});

// 3. Simple, unified API to sign in and out
await authClient.signIn('email', { email: 'user@example.com', password: '123' });

await authClient.signOut();
```

---

## 🔥 Generic Web Framework Integration (Zero Boilerplate!)

Tired of writing `/auth/login` and `/auth/signup` controllers? Let our built-in Web Standard Handler process standard Fetch `Request` objects automatically.

```typescript
// Example using Hono, but works the same in Next.js App Router, Cloudflare, or Bun!
import { Hono } from 'hono';
import { auth } from './auth'; // Your NanoAuth instance

const app = new Hono();

// Boom! 🔥 One line handles all your endpoints:
// POST /api/auth/signin/:provider
// POST /api/auth/signup/:provider
// POST /api/auth/signout
app.all('/api/auth/*', (c) => auth.handler(c.req.raw));

export default app;
```

---

## 🧪 Testing

NanoAuth takes security seriously. The core functions and crypto utilities are tested exhaustively. Run the test suite:

```bash
bun run test
```

## 🤝 Contributing

We love contributions! The core principle is keeping the main package dependency-free (or as close to zero as possible) while building powerful wrappers around it. Feel free to open a PR!

<div align="center">
  <br/>
  <p>Built with ❤️ by fhorray</p>
</div>
