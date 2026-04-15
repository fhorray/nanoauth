/** @jsxImportSource react */
import { useState, useEffect } from 'react';
import { authClient } from '../client';

export const Login = () => {
  // ⚡ The Ultimate Unified Pattern!
  const { isLoading, error, signIn } = authClient.useSession();
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (error) setStatus(error.message.toUpperCase());
  }, [error]);

  useEffect(() => {
    // URL check for errors
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) setStatus(err.toUpperCase().replace(/_/g, ' '));
  }, []);

  const handleAuth = async (action: 'login' | 'signup') => {
    const form = document.getElementById('authForm') as HTMLFormElement;
    if (!form) return;

    const data = Object.fromEntries(new FormData(form));
    setStatus(
      action === 'login' ? 'Initializing Session...' : 'Creating Profile...',
    );

    try {
      if (action === 'login') {
        await authClient.signIn('email', data);
        setStatus('AUTHENTICATED. ACCESS GRANTED.');
      } else {
        await authClient.signUp('email', data);
        setStatus('ACCOUNT CREATED. WELCOME.');
      }
      setTimeout(() => (window.location.href = '/dashboard'), 800);
    } catch (e: any) {
      // Error is handled by subscription above
    }
  };

  return (
    <div
      className="layout"
      style={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <div
        className="nano-module"
        style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}
      >
        <div style={{ marginBottom: '3rem' }}>
          <a
            href="/api/auth/signin/mock"
            className="btn btn-primary"
            style={{ opacity: isLoading ? 0.5 : 1 }}
          >
            Sign in with Mock Account
          </a>
        </div>

        <div
          className="flex items-center mb-4"
          style={{ gap: '1rem', margin: '2.5rem 0' }}
        >
          <div
            style={{ flex: 1, height: '1px', background: 'var(--border)' }}
          ></div>
          <span
            style={{
              fontSize: '9px',
              color: 'var(--text-dim)',
              fontWeight: 800,
            }}
          >
            OR USE CREDENTIALS
          </span>
          <div
            style={{ flex: 1, height: '1px', background: 'var(--border)' }}
          ></div>
        </div>

        <form id="authForm" style={{ textAlign: 'left' }}>
          <div>
            <span className="label">Email Address</span>
            <input
              type="email"
              name="email"
              defaultValue="test@example.com"
              placeholder="Enter your email"
              disabled={isLoading}
            />
          </div>
          <div style={{ marginBottom: '2.5rem' }}>
            <span className="label">Secure Passcode</span>
            <input
              type="password"
              name="password"
              defaultValue="password123"
              placeholder="Enter your password"
              disabled={isLoading}
            />
          </div>

          <div className="grid-2">
            <button
              type="button"
              onClick={() => handleAuth('login')}
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Sign In'}
            </button>
            <a
              href="/signup"
              className="btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
              }}
            >
              Register
            </a>
          </div>
        </form>

        <div
          style={{
            marginTop: '2.5rem',
            fontSize: '9px',
            fontWeight: 800,
            color: error ? 'var(--danger)' : 'var(--accent)',
            letterSpacing: '1px',
            borderTop: '1px dashed var(--border)',
            paddingTop: '1.5rem',
            minHeight: '1.5rem',
          }}
        >
          {status}
        </div>
      </div>
    </div>
  );
};
