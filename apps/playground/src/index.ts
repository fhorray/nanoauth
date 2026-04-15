/**
 * Playground - Full Authentication Flow UI
 */

import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { getCookie } from 'hono/cookie';
import { auth } from './lib/auth';
import { apiRoutes } from './routes/api.routes';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

// Generic Web Standard Handler ⚡
// This works with any framework that supports Request/Response
app.all('/api/auth/*', (c) => auth.handler(c.req.raw));

/**
 * DYNAMIC LISTENERS DEMONSTRATION 🎧
 * You can attach listeners anywhere, not just in the config hooks!
 */
auth.on('afterSignin', ({ user, provider }) => {
   const method = provider ? `Social (${provider})` : 'Credentials';
   console.log(`\n[DYNAMIC LISTENER] 🟢 User ${user.email} just signed in via ${method}!`);
});

auth.on('afterSignup', ({ user }) => {
   console.log(`\n[DYNAMIC LISTENER] ✨ New account created for ${user.email}! Sending virtual welcome email...`);
});

auth.on('onError', (error) => {
   console.log(`\n[DYNAMIC LISTENER] 🔴 Auth Error caught dynamically: ${error.message}`);
});

/**
 * MOCK OAUTH SIMULATION ROUTES
 * These routes mimic an external provider like Google/GitHub
 */
app.get('/auth/mock/authorize', (c) => {
   const state = c.req.query('state');
   const redirectUri = c.req.query('redirect_uri');

   // Simulation Page: "Sign in to Mock Provider"
   return c.html(`
    <style>body{background:#030712;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}div{background:#111827;padding:2rem;border-radius:1rem;border:1px solid #1f2937;text-align:center}a{display:inline-block;margin-top:1rem;background:#3b82f6;color:#fff;text-decoration:none;padding:0.75rem 1.5rem;border-radius:0.5rem;font-weight:600}</style>
    <div>
      <h2>Authorize NanoAuth?</h2>
      <p>This is a simulated Social Provider.</p>
      <a href="${redirectUri}?code=mock_code_123&state=${state}">Authorize and Continue</a>
    </div>
  `);
});

app.post('/auth/mock/token', (c) => c.json({ access_token: 'mock_access_token' }));

app.get('/auth/mock/user', (c) => c.json({
   id: 'mock_user_99',
   email: 'social@example.com',
   name: 'Social Explorer',
   avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=social'
}));

/**
 * UI ROUTES
 */

// Home Page
app.get('/', (c) => {
   return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8"><title>NanoAuth | Modern Auth</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-950 text-white min-h-screen flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-950 to-gray-950">
       <div class="max-w-xl text-center">
          <h1 class="text-6xl font-extrabold mb-6 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">NanoAuth</h1>
          <p class="text-xl text-gray-400 mb-10">Experience the full power of persistent auth with Drizzle, SQLite, and Native Framework Integration.</p>
          <div class="flex gap-4 justify-center">
             <a href="/signin" class="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20">Try the Flow</a>
             <a href="https://github.com/nanoauth/nanoauth" class="px-8 py-3 bg-gray-900 border border-gray-800 rounded-xl font-bold hover:bg-gray-800 transition-all">Documentation</a>
          </div>
       </div>
    </body>
    </html>
  `);
});

// Sign In / Sign Up Page
app.get('/signin', (c) => {
   return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8"><title>Sign In | NanoAuth</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-950 text-white min-h-screen flex items-center justify-center p-6">
       <div class="w-full max-w-md bg-gray-900 border border-gray-800 p-8 rounded-3xl shadow-2xl">
          <h2 class="text-2xl font-bold mb-8 text-center">Get Started</h2>
          
          <!-- Social Login (OAuth Native Endpoint) -->
          <a href="/api/auth/signin/mock" class="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-black font-bold rounded-xl mb-6 hover:bg-gray-200 transition-all">
             <span class="text-lg">✨</span> Sign in with Social Mock
          </a>

          <div class="relative mb-6">
             <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-800"></div></div>
             <div class="relative flex justify-center text-xs uppercase"><span class="bg-gray-900 px-2 text-gray-500 font-bold">Or use email</span></div>
          </div>

          <!-- Credentials Form -->
          <form id="authForm" class="space-y-4">
             <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Email</label>
                <input type="email" name="email" class="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" value="test@example.com">
             </div>
             <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Password</label>
                <input type="password" name="password" class="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" value="password123">
             </div>
             <div class="flex gap-3 pt-2">
                <button type="button" onclick="handleAuth('login')" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all">Login</button>
                <button type="button" onclick="handleAuth('signup')" class="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl border border-gray-700 transition-all">Sign Up</button>
             </div>
          </form>

          <p id="msg" class="mt-4 text-center text-sm font-medium"></p>
       </div>

       <script>
          async function handleAuth(type) {
             const form = document.getElementById('authForm');
             const data = Object.fromEntries(new FormData(form));
             const msg = document.getElementById('msg');
             
             msg.innerText = type === 'login' ? 'Authenticating...' : 'Creating account...';
             msg.className = 'mt-4 text-center text-sm text-blue-400';

             try {
                const res = await fetch(\`/api/auth/\${type}\`, {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify(data)
                });
                
                const result = await res.json();
                if (result.error) throw new Error(result.error);
                
                msg.innerText = 'Success! Redirecting...';
                setTimeout(() => window.location.href = '/dashboard', 1000);
             } catch (e) {
                msg.innerText = e.message;
                msg.className = 'mt-4 text-center text-sm text-red-500';
             }
          }
       </script>
    </body>
    </html>
  `);
});

// Dashboard (Protected Page)
app.get('/dashboard', async (c) => {
   // Get session from cookie
   const token = getCookie(c, 'auth_token');

   if (!token) {
      return c.redirect('/signin?error=unauthorized');
   }

   // Fetch session data (In a real app, use verifyJWT or trust the integration middleware)
   try {
      const session = await auth.getState('user'); // Library provides current user state
      if (!session) {
         // Fallback: try to re-validate token if state was lost
         return c.html(`<script>window.location.reload();</script>`);
      }

      return c.html(`
       <!DOCTYPE html>
       <html lang="en">
       <head>
          <meta charset="UTF-8"><title>Dashboard | NanoAuth</title>
          <script src="https://cdn.tailwindcss.com"></script>
       </head>
       <body class="bg-gray-950 text-white p-6 md:p-12">
          <div class="max-w-4xl mx-auto">
             <div class="flex justify-between items-center mb-12">
                <div class="flex items-center gap-4">
                   <div class="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-xl">N</div>
                   <h1 class="text-2xl font-bold tracking-tight">NanoAuth <span class="text-gray-500 font-normal">Dashboard</span></h1>
                </div>
                <button onclick="logout()" class="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold hover:bg-red-500/20 transition-all">Sign Out</button>
             </div>

             <div class="grid md:grid-cols-3 gap-8">
                <!-- Profile Card -->
                <div class="bg-gray-900 border border-gray-800 p-6 rounded-3xl shadow-xl">
                   <img src="${(session as any).avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + session.email}" class="w-20 h-20 rounded-2xl mb-4 bg-gray-800">
                   <h3 class="text-xl font-bold">${(session as any).name || 'Authenticated User'}</h3>
                   <p class="text-gray-500 text-sm mb-4">${session.email}</p>
                   <div class="inline-block px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-bold rounded-full border border-blue-400/20 uppercase tracking-widest">
                      ${(session as any).role || 'user'}
                   </div>
                </div>

                <!-- Raw Data Debugger -->
                <div class="md:col-span-2 bg-black border border-gray-800 p-6 rounded-3xl shadow-xl">
                   <div class="flex items-center justify-between mb-4">
                      <h3 class="text-sm font-bold uppercase tracking-widest text-gray-500">Raw Session Claims</h3>
                      <span class="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded font-mono">Verified HS256</span>
                   </div>
                   <pre class="bg-gray-900/50 p-4 rounded-xl text-xs text-blue-300 font-mono overflow-auto max-h-64">${JSON.stringify(session, null, 2)}</pre>
                </div>
             </div>

             <div class="mt-8 p-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-white/5 rounded-3xl">
                <h4 class="font-bold text-white mb-2">Persistence Active! 💾</h4>
                <p class="text-sm text-gray-400 leading-relaxed">This data is being served from your <strong>SQLite</strong> database via <strong>Drizzle ORM</strong>. Go ahead and refresh the page or restart the server—your session will persist thanks to HTTP-Only cookies.</p>
             </div>
          </div>

          <script>
             async function logout() {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/';
             }
          </script>
       </body>
       </html>
     `);
   } catch (e) {
      return c.redirect('/signin');
   }
});

app.get("/magic", async c => {
   await auth.sendMagicLink("test@example.com")
   return c.json({ success: true })
})

app.route('/api', apiRoutes);

console.log('🚀 NanoAuth Playground running at http://localhost:3000');

export default {
   port: 3000,
   fetch: app.fetch,
};
