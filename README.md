<div align="center">
  <h1>🚀 NanoAuth</h1>
  <p><strong>The most lightweight, pluggable, and developer-friendly authentication library for the modern web.</strong></p>
  <p>Bring your own database, define your own user structure, and let NanoAuth handle the heavy lifting of authentication flows, security, and sessions.</p>
</div>

---

## 🌟 Why NanoAuth?

NanoAuth was built on a simple philosophy: **You should control your data, and the auth library should just orchestrate the logic.**

Unlike bloated full-stack mono-libraries that try to insert their own rigid database schemas into your project, NanoAuth provides a robust, zero-dependency core that you extend via **Plugins** and **Adapters**.

- **✨ 100% Type-Safe**: Built from the ground up with TypeScript Generics. If your user has a custom `subscriptionStatus` field, all NanoAuth hooks and plugins will know about it. No more `any` types!
- **🧩 Pluggable Architecture**: Only bundle what you use. Need Email/Password? Add the plugin. Need Session Management? Add the plugin. Need OAuth? You guessed it.
- **⚡ Reactive Events & Interceptors**: Hook into the exact lifecycle of your authentication to trigger emails (`afterSignup`) or intercept database saves (`onSaveSession`).
- **🔥 Generic Web Handler**: Tired of writing HTTP boilerplate? Use our built-in `auth.handler(request)` that automatically generates all authentication endpoints for any modern framework (Next.js, Cloudflare Workers, Hono, Bun, etc.).

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
2. **The Database Adapter**: How NanoAuth talks to _your_ database.
3. **The Plugins**: The actual auth methods (Email/Pass, OAuth).
4. **The Hooks**: Lifecycles and Interceptors.

Let's dive into each one! 👇

---

## 🧍‍♀️ 1. The User Type (Generics)

NanoAuth doesn't force a database schema on you. By default, a `User` just needs an `id` and an `email`. Everything else is up to you!

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

## 💾 2. The Database Adapter

The **Adapter** is the bridge between NanoAuth and your actual database. We don't care if you use Postgres, MongoDB, Prisma, Drizzle, or a JSON file.

You simply provide an object that implements the `AuthAdapter` interface. NanoAuth will call these methods when it needs to interact with your data.

```typescript
import type { AuthAdapter } from 'nanoauth';
import { db } from './my-database';

// Tell the adapter about your custom user type!
const myAdapter: AuthAdapter<MyAwesomeUser> = {
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

  // Optional: Custom token validation logic
  async validateToken(token) {
    const session = await db.sessions.findByToken(token);
    return session !== null;
  },
};
```

That's it! NanoAuth now knows how to persist data in your specific architecture. 🧠

> **💡 Pro Tip (Developer Experience):**
> To get perfect autocompletion and ensure you don't miss any required methods, use the `defineAdapter` helper! It acts exactly like a normal object, but supercharges your TypeScript experience:
>
> ```typescript
> import { defineAdapter } from 'nanoauth';
>
> const myAdapter = defineAdapter({
>    async getUser(userId) { ... },
>    // Autocomplete will guide you through all required methods!
>
>    // You can also add ANY extra custom method you want!
>    async getSuperUser(email) { ... }
> });
> ```

---

## 🔌 3. Plugins & Setup

Now that you have your adapter, you weave it together with plugins using the `nanoauth()` factory.

```typescript
import { nanoauth, emailPasswordPlugin, sessionPlugin } from 'nanoauth';

export const auth = nanoauth<MyAwesomeUser>({
  adapter: myAdapter,

  plugins: [
    // Handles tokens, refreshing, and storage logic
    sessionPlugin({ storage: 'memory' }),

    // Handles login(), signup(), and password hashing
    emailPasswordPlugin({
      userRepository: db.users, // Your DB queries
      hashPassword: async (pwd) => bun.password.hash(pwd),
      comparePassword: async (pwd, hash) => bun.password.verify(pwd, hash),
    }),
  ],
});
```

### 🌐 OAuth (Social Login)

The holy grail. Define your providers (Google, GitHub, Discord) and let NanoAuth handle the state validation, anti-CSRF handshakes, and profile mapping.

```typescript
import { oauthPlugin } from 'nanoauth';

oauthPlugin({
  providers: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_SECRET,
      authorizationUrl: '...',
      tokenUrl: '...',
      redirectUri: 'http://localhost:3000/api/auth/callback/google',
      scope: ['email', 'profile'],
    },
  },
  // Magically map the Google profile to YOUR database schema
  mapOAuthProfile: (provider, profile) => ({
    email: profile.email,
    name: profile.name,
    role: 'customer',
    favoriteColor: 'blue',
  }),
});
```

---

## 🪝 4. Hooks & Interceptors (The Magic Sauce)

NanoAuth has two completely distinct hook ecosystems. This is where the power user inside you comes alive. 🧙‍♂️

### ⚡ Reactive Events (Fire-and-forget)

These happen _after_ an action completes. Use them for side-effects, analytics, or triggering webhooks. They **do not** block the auth flow.

```typescript
hooks: {
  afterSignup: ({ user }) => {
    // Because of generics, TypeScript knows `user` has a `role`!
    console.log(`New ${user.role} joined: ${user.email} 🎊`);
    sendWelcomeEmail(user.email);
  },
  afterSignin: ({ user, token }) => {
    logger.info(`${user.name} just logged in.`);
  },
  onError: (error) => {
    sentry.captureException(error);
  }
}
```

> **Dynamic Listeners**: You are not restricted to defining events only during initialization! You can attach listeners dynamically anywhere in your application using `auth.on()`:
>
> ```typescript
> // Subscribe to an event programmatically
> const unsubscribe = auth.on('afterSignin', ({ user }) => {
>   websocket.broadcast(`User ${user.name} is online!`);
> });
>
> // Later, if you want to stop listening:
> unsubscribe();
> ```

### 🛡️ Database Interceptors (Middleware)

These act as middleware _before_ your Adapter executes a database command.
If you define an interceptor, **you MUST call `next()`**. If you forget, NanoAuth will throw a fatal error to protect you from silent database failures.

They are incredibly powerful for injecting caching, audting, or modifying data on the fly.

```typescript
hooks: {
  // Let's add Redis caching to the getUser flow!
  onGetUser: async (userId, next) => {
    // 1. Check Cache
    const cached = await redis.get(`user:${userId}`);
    if (cached) return JSON.parse(cached);

    // 2. Call next() to let the Adapter fetch from PostgreSQL
    const user = await next(userId);

    // 3. Update Cache & Return
    if (user) await redis.set(`user:${userId}`, JSON.stringify(user));
    return user;
  },

  // Let's modify the session data before saving!
  onSaveSession: async (sessionId, data, next) => {
    console.log('User is generating a new session!');

    const enhancedData = {
       ...data,
       ipAddress: "127.0.0.1",
       device: "iPhone"
    };

    // Pass the modified data down to your Database Adapter
    return next(sessionId, enhancedData);
  }
}
```

---

## 🔥 Generic Web Framework Integration (Zero Boilerplate!)

Tired of writing `/auth/login` and `/auth/signup` controllers? Let our built-in Web Standard Handler process standard Fetch `Request` objects automatically.

```typescript
// Example using Hono, but works the same in Next.js, Cloudflare, or Bun!
import { Hono } from 'hono';
import { auth } from './auth'; // Your NanoAuth instance

const app = new Hono();

// Boom! 🔥 One line creates:
// POST /api/auth/login
// POST /api/auth/signup
// POST /api/auth/logout
// GET  /api/auth/session
// GET  /api/auth/signin/:provider  (OAuth Redirects)
// GET  /api/auth/callback/:provider (OAuth Handshake)
app.all('/api/auth/*', (c) => auth.handler(c.req.raw));

export default app;
```

---

## 🛠️ Building Custom Plugins

The true power of NanoAuth lies in its pluggable architecture. Creating your own plugin is extremely simple. A plugin is just an object that implements the `Plugin` interface, which requires a `name` and a `setup` function.

To provide the best Developer Experience (DX) and strict Type Safety without boilerplate, we provide the `definePlugin` and `createPlugin` helpers.

Inside the `setup` function, you get access to the main `AuthCoreInstance`. This allows your plugin to:

1. **Listen to Events:** Use `auth.on('event', ...)` to trigger side-effects.
2. **Read/Write State:** Use `auth.getState('token')` or `auth.setState('isLoading', true)`.
3. **Inject or Override Methods:** Add new methods to the `auth` object or override placeholders like `auth.login`.

### Example: A Magic Link Plugin

Here is a simplified example of how you might create a custom "Magic Link" plugin that adds a `sendMagicLink` method to your NanoAuth instance:

```typescript
import { definePlugin } from 'nanoauth';

// 1. Define your Plugin Config interface
export interface MagicLinkConfig {
  sendEmail: (email: string, link: string) => Promise<void>;
  generateToken: () => string;
}

// 2. Create the Plugin Factory using the Helper
// This gives you perfect autocomplete for 'config' and 'auth'
export const magicLinkPlugin = definePlugin<MagicLinkConfig>((config) => ({
  name: 'magic-link', // Must be unique

  // 3. The setup function is called once during initialization
  async setup(auth) {
    // Inject a brand new method into the auth instance
    auth.sendMagicLink = async (email: string) => {
      try {
        auth.setState('isLoading', true); // Update internal state

        const token = config.generateToken();
        const link = `https://myapp.com/auth/verify?token=${token}`;

        await config.sendEmail(email, link);

        auth.setState('isLoading', false);
      } catch (error) {
        auth.setState('error', error);
        auth.setState('isLoading', false);

        // Emit a reactive event if things fail
        auth.emit('onError', error);
      }
    };
  },
}));
```

> **Note:** If your plugin doesn't need external configuration, you can use `createPlugin({ name: '...', setup(auth) { ... } })` directly!

**How to use it:**

```typescript
import { nanoauth } from 'nanoauth';
import { magicLinkPlugin } from './my-plugins/magic-link';

const auth = nanoauth({
  adapter: myAdapter,
  plugins: [
    magicLinkPlugin({
      generateToken: () => crypto.randomUUID(),
      sendEmail: async (email, link) => {
        console.log(`Sending login link to ${email}: ${link}`);
      },
    }),
  ],
});

// The custom method is now available!
await auth.sendMagicLink('user@example.com');
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
