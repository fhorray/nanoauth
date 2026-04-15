/** @jsxImportSource react */
import { hydrateRoot } from 'react-dom/client';
import { createAuthClient } from 'nanoauth/react';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { Dashboard } from './components/Dashboard';

/**
 * NanoAuth Playground - Client Hydration Engine ⚡
 * Proudly provided by Antigravity.
 */

// Initialize the official React-powered client!
export const authClient = createAuthClient();

function mountApp() {
  // Get initial data injected by the server
  const initialData = (window as any).__INITIAL_DATA__ || {};

  // Sync the initial server state to our nanostores client
  if (initialData.user) {
    authClient.$stores.session.set({
      user: initialData.user,
      token: initialData.token || null,
    });
  }

  // 1. Check for Login Root
  const loginRoot = document.getElementById('root-login');
  if (loginRoot) {
    console.log('[CLIENT] Hydrating Login Component');
    hydrateRoot(loginRoot, <Login />);
    return;
  }

  // Check for Signup Root
  const signupRoot = document.getElementById('root-signup');
  if (signupRoot) {
    console.log('[CLIENT] Hydrating Signup Component');
    hydrateRoot(signupRoot, <Signup />);
    return;
  }

  // 2. Check for Dashboard Root
  const dashboardRoot = document.getElementById('root-dashboard');
  if (dashboardRoot) {
    if (initialData.user) {
      console.log('[CLIENT] Hydrating Dashboard Component');
      hydrateRoot(
        dashboardRoot,
        <Dashboard
          user={initialData.user}
          plans={initialData.plans || []}
          activePlan={initialData.activePlan}
        />
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
