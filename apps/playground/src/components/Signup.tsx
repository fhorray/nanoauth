/** @jsxImportSource hono/jsx/dom */
import { useState, useEffect } from 'hono/jsx';
import { authClient } from '../client';

export const Signup = () => {
  const [isLoading, setIsLoading] = useState(authClient.isLoading.get());
  const [error, setError] = useState(authClient.error.get());
  const [status, setStatus] = useState<string | null>('READY FOR INITIALIZATION');

  useEffect(() => {
    const unsubs = [
      authClient.isLoading.subscribe((v) => setIsLoading(v)),
      authClient.error.subscribe((v) => {
        setError(v);
        if (v) setStatus(v.toUpperCase());
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, []);

  const handleSignup = async (e: any) => {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));

    setStatus('GENERATING CRYPTOGRAPHIC IDENTITY...');
    
    try {
      await authClient.signUp('email', data);
      setStatus('VAULT CREATED. REDIRECTING...');
      setTimeout(() => (window.location.href = '/dashboard'), 1000);
    } catch (e: any) {
      // Error is reactive
    }
  };

  return (
    <div
      class="layout"
      style={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <div
        class="nano-module"
        style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}
      >
        <div style={{ marginBottom: '3rem' }}>
          <div
            style={{
              display: 'inline-block',
              border: '1px solid var(--accent)',
              padding: '1rem',
              marginBottom: '1.5rem',
              background: 'var(--accent-soft)',
            }}
          >
            <span
              style={{
                fontSize: '24px',
                fontWeight: 900,
                color: 'var(--accent)',
              }}
            >
              NR
            </span>
          </div>
          <h2
            style={{
              fontSize: '14px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '4px',
              color: 'var(--accent)',
            }}
          >
            Create Account
          </h2>
          <p
            style={{
              fontSize: '9px',
              color: 'var(--text-dim)',
              marginTop: '0.75rem',
              letterSpacing: '2px',
            }}
          >
            Establishing new security credentials...
          </p>
        </div>

        <form onSubmit={handleSignup} style={{ textAlign: 'left' }}>
          <div>
            <span class="label">Full Identity Name</span>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. John Doe"
              disabled={isLoading}
            />
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <span class="label">Email Address</span>
            <input
              type="email"
              name="email"
              required
              placeholder="user@example.com"
              disabled={isLoading}
            />
          </div>
          <div style={{ margin: '1.5rem 0 2.5rem' }}>
            <span class="label">Secure Passcode</span>
            <input
              type="password"
              name="password"
              required
              placeholder="Min. 8 characters"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            class="btn btn-primary"
            style={{ width: '100%' }}
            disabled={isLoading}
          >
            {isLoading ? 'EXECUTING SIGNUP...' : 'COMPLETE REGISTRATION'}
          </button>
          
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
             <a href="/signin" style={{ fontSize: '10px', color: 'var(--text-dim)', textDecoration: 'none' }}>
                ALREADY HAVE AN ACCOUNT? <span style={{ color: 'var(--accent)', fontWeight: 800 }}>SIGN IN</span>
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
