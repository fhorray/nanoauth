# NanoAuth Plugins

NanoAuth is built with a highly extensible plugin architecture. This directory contains the officially supported plugins for the core library. By default, NanoAuth provides sensible and secure defaults (such as hashing passwords via `encodeHex(hashSHA256(...))` and generating/verifying JWT tokens via HMAC-SHA256), leveraging the `secret` configured in the `NanoAuthOptions`.

## 1. Email-Password Plugin (`email-password.ts`)

Provides basic email and password authentication out of the box.

### Features

- Sign up with email and password.
- Log in with email and password.
- Reset password flow.
- Change password for authenticated users.
- Automatically handles password hashing (`hashPassword`) and checking (`comparePassword`) if you don't provide custom overrides.
- Generates JWT tokens (`generateToken`) automatically based on `auth.config.secret`.

### Example Usage

```ts
import { nanoauth, emailPasswordPlugin } from 'nanoauth';

export const auth = nanoauth({
  adapter: myAdapter,
  secret: process.env.NANOAUTH_SECRET, // Required for default tokens!
  plugins: [
    emailPasswordPlugin({
      userRepository: myUserRepository,
      // hashPassword, comparePassword, and generateToken are optional!
    }),
  ],
});
```

## 2. Session Plugin (`session.ts`)

Manages saving, validting, tracking, and restoring authentication sessions and tokens.

### Features

- Supports multiple token storage mechanisms (`localStorage`, `sessionStorage`, `memory`, or custom implementations).
- Validates tokens automatically (via `verifyHS256JWT` defaults, if no `validateToken` is provided).
- Handles refresh tokens and auto-refresh mechanisms if properly configured.

### Example Usage

```ts
import { sessionPlugin } from 'nanoauth';

auth.use(
  sessionPlugin({
    storage: 'memory', // or 'localStorage' / 'sessionStorage'
    // validateToken is handled by default if `secret` is provided in NanoAuth config.
  }),
);
```

## 3. OAuth Plugin (`oauth.ts`)

Provides a unified interface for integrating Social Login providers (e.g., Google, GitHub, Mock).

### Features

- Generates OAuth authorization URLs.
- Handles OAuth callbacks (exchanging code for token, fetching user profile).
- Prevents CSRF and replay attacks via state validation.
- Automatically generates user tokens via defaults and `auth.config.secret`.

### Example Usage

```ts
import { oauthPlugin } from 'nanoauth';

auth.use(
  oauthPlugin({
    userRepository: myUserRepository,
    providers: {
      github: {
        name: 'GitHub',
        clientId: '...',
        clientSecret: '...',
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        redirectUri: 'http://localhost:3000/callback',
        scope: ['read:user', 'user:email'],
      },
    },
  }),
);
```

## 4. Magic Link Plugin (`magic-link.ts`)

Provides passwordless authentication using magic links sent via email.

### Features

- Generates secure, short-lived JWT tokens containing user emails (defaults to 15 min expiry).
- Automatically handles token verification and parsing.
- Customizable `sendEmail` strategy.

### Example Usage

```ts
import { magicLinkPlugin } from 'nanoauth';

auth.use(
  magicLinkPlugin({
    baseUrl: 'https://myapp.com', // Optional: defaults to https://myapp.com
    sendEmail: async (email, link) => {
      // Implement your email sending logic here (e.g. Resend, SendGrid)
      console.log(`Sending magic link to ${email}: ${link}`);
    },
  }),
);
```

---

**Note:** All these plugins inject heavily typed methods into your `AuthCoreInstance`. Because of `nanoauth`'s `ExtractPluginExports` utility, your developer experience will include full autocomplete for standard and custom methods alike.
