/** @jsxImportSource hono/jsx */
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { jsxRenderer } from 'hono/jsx-renderer';
import { auth } from './lib/auth';
import { plans } from './lib/plans';

// DB & Logic
import { db, userRepository } from './db/client';
import * as schema from './db/schema';
import { eq, and } from 'drizzle-orm';

// Components (Only Layout for SSR shell)
import { Layout } from './components/Layout';

const app = new Hono();

declare module 'hono' {
  interface ContextRenderer {
    (
      content: string | Promise<string>,
      props?: { title: string; data?: any },
    ): Response | Promise<Response>;
  }
}

app.use('*', logger());
app.use('*', cors());

// ⚡ GLOBAL RENDERER MIDDLEWARE
app.use(
  '*',
  jsxRenderer(({ children, title, data }) => {
    return (
      <Layout title={title} data={data}>
        {children}
      </Layout>
    );
  }),
);

/**
 * 🛠️ ASSET SERVING
 */
let cachedClientBundle: string | null = null;

app.get('/client.js', async (c) => {
  if (!cachedClientBundle) {
    const result = await Bun.build({
      entrypoints: ['./src/client.tsx'],
      minify: true,
    });

    const output = result.outputs[0];
    if (!output) return c.text('Build failed', 500);
    cachedClientBundle = await output.text();
  }

  return c.text(cachedClientBundle, 200, {
    'Content-Type': 'application/javascript',
  });
});

app.get('/global.css', async (c) => {
  const css = await Bun.file('./src/global.css').text();
  return c.text(css, 200, { 'Content-Type': 'text/css' });
});

/**
 * ⚡ NANOAUTH INTEGRATION
 */
app.all('/api/auth/*', (c) => auth.handler(c.req.raw));

app.post('/api/manage-billing', async (c) => {
  try {
    // 🛡️ Stateless: Get user from request context
    const { user } = await auth.getSession(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const portalUrl = await auth.stripe.getPortalUrl(
      user,
      'http://localhost:3000/dashboard',
    );
    return c.json({ url: portalUrl });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

/**
 * 🖥️ UI ROUTES
 */

app.get('/', (c) => {
  return c.render(
    <div
      class="layout"
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <div class="nano-module" style={{ maxWidth: '600px' }}>
        <span class="label">Core Framework</span>
        <h1
          style={{
            fontSize: '64px',
            fontWeight: 900,
            marginBottom: '1.5rem',
            letterSpacing: '-4px',
            color: 'var(--accent)',
          }}
        >
          NANOAUTH
        </h1>
        <p
          style={{
            color: 'var(--text-dim)',
            fontSize: '11px',
            maxWidth: '450px',
            margin: '0 auto 3.5rem',
            lineHeight: '2',
            letterSpacing: '1px',
          }}
        >
          Sophisticated authentication infrastructure built for the modern web
          standard. Declarative, atomic, and secure by design.
        </p>
        <div class="grid-2">
          <a href="/signin" class="btn btn-primary">
            Enter Playground
          </a>
          <a href="https://github.com" class="btn">
            Documentation
          </a>
        </div>
      </div>
      <div
        style={{
          marginTop: '2rem',
          fontSize: '10px',
          color: 'var(--border)',
          fontWeight: 800,
          letterSpacing: '5px',
        }}
      >
        SECURE ENGINE SYSTEM READY
      </div>
    </div>,
    { title: 'Home' },
  );
});

app.get('/signin', (c) => {
  return c.render(<div id="root-login"></div>, { title: 'Sign In' });
});

app.get('/signup', (c) => {
  return c.render(<div id="root-signup"></div>, { title: 'Create Account' });
});

app.get('/dashboard', async (c) => {
  // 🛡️ Stateless: Extract session from request
  const { user } = await auth.getSession(c.req.raw);
  if (!user) return c.redirect('/signin');

  // Get active subscription info
  const subscription = await db.query.subscriptions.findFirst({
    where: and(
      eq(schema.subscriptions.referenceId, user.id),
      eq(schema.subscriptions.status, 'active'),
    ),
  });

  return c.render(<div id="root-dashboard"></div>, {
    title: 'Dashboard',
    data: {
      user: user,
      plans,
      activePlan: subscription?.plan || null,
    },
  });
});

/**
 * 🎭 MOCK OAUTH SIMULATION
 */
app.get('/auth/mock/authorize', (c) => {
  const state = c.req.query('state');
  const redirectUri = c.req.query('redirect_uri');

  return c.render(
    <div
      class="layout"
      style={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <div
        class="nano-module"
        style={{ maxWidth: '400px', textAlign: 'center' }}
      >
        <h2
          style={{
            marginBottom: '1rem',
            fontSize: '14px',
            color: 'var(--accent)',
          }}
        >
          EXTERNAL OAUTH PROVIDER
        </h2>
        <p
          style={{
            color: 'var(--text-dim)',
            marginBottom: '2rem',
            fontSize: '0.75rem',
          }}
        >
          Authorize NanoAuth to access your profile?
        </p>
        <a
          href={`${redirectUri}?code=mock_code_123&state=${state}`}
          class="btn btn-primary"
        >
          Confirm Authorization
        </a>
      </div>
    </div>,
    { title: 'Authorize' },
  );
});

app.get('/auth/mock/user', (c) => {
  return c.json({
    id: 'mock_user_99',
    email: 'social@example.com',
    name: 'Social Explorer',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=social',
  });
});

export default {
  port: 3000,
  fetch: app.fetch,
};
