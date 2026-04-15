/** @jsxImportSource hono/jsx/dom */
import { render } from 'hono/jsx/dom';
import { createAuthClient } from 'nanoauth/client';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { Dashboard } from './components/Dashboard';

/**
 * NanoAuth Playground - Client Hydration Engine ⚡
 * Powered by NanoAuth Client SDK & Nanostores
 */

// Initialize the reactive client
export const authClient = createAuthClient();

function mountApp() {
  // Get initial data injected by the server
  const initialData = (window as any).__INITIAL_DATA__ || {};

  // Sync the initial server state to our nanostores client
  if (initialData.user) {
    authClient.session.set({
      user: initialData.user,
      token: initialData.token || null,
    });
  }

  // 1. Check for Login Root
  const loginRoot = document.getElementById('root-login');
  if (loginRoot) {
    console.log('[CLIENT] Mounting Login Component');
    render(<Login />, loginRoot);
    return;
  }

  // Check for Signup Root
  const signupRoot = document.getElementById('root-signup');
  if (signupRoot) {
    console.log('[CLIENT] Mounting Signup Component');
    render(<Signup />, signupRoot);
    return;
  }

  // 2. Check for Dashboard Root
  const dashboardRoot = document.getElementById('root-dashboard');
  if (dashboardRoot) {
    if (initialData.user) {
      console.log('[CLIENT] Mounting Dashboard Component');
      render(
        <Dashboard
          user={initialData.user}
          plans={initialData.plans || []}
          activePlan={initialData.activePlan}
        />,
        dashboardRoot,
      );
    } else {
      console.warn('[CLIENT] Dashboard root found but no user data available.');
    }
    return;
  }

  console.log('[CLIENT] Static page detected. No hydration needed.');
}

// Ensure the DOM is fully loaded before mounting
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}

console.log('🚀 NanoAuth Client SDK Ready.');
