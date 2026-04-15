/** @jsxImportSource react */
import { useState } from 'react';
import type { User } from 'nanoauth';

interface StripeDashboardProps {
  user: User;
  plans: any[];
  activePlan?: string | null;
}

export const StripeDashboard = ({
  user,
  plans,
  activePlan,
}: StripeDashboardProps) => {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  const handleUpgrade = async (plan: string) => {
    setLoadingPlan(plan);
    try {
      const res = await fetch('/api/auth/stripe/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
      else throw new Error('Failed to create checkout session');
    } catch (e: any) {
      alert(`Stripe Error: ${e.message}`);
      setLoadingPlan(null);
    }
  };

  const handlePortal = async () => {
    setIsPortalLoading(true);
    try {
      const res = await fetch('/api/manage-billing', { method: 'POST' });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (e: any) {
      alert(`Portal Error: ${e.message}`);
      setIsPortalLoading(false);
    }
  };

  return (
    <div className="nano-module">
      <div className="flex justify-between items-center mb-4">
        <div>
          <span className="label">Payment Engine</span>
          <h2
            style={{
              fontSize: '22px',
              fontWeight: 900,
              textTransform: 'uppercase',
              color: 'var(--accent)',
            }}
          >
            Stripe Integration
          </h2>
        </div>
        <div
          className={`badge ${user.subscriptionStatus === 'active' ? 'badge-active' : ''}`}
        >
          Status: {user.subscriptionStatus || 'Inactive'}
        </div>
      </div>

      <div
        style={{
          padding: '1rem',
          border: '1px solid var(--border)',
          marginBottom: '2.5rem',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <span className="label">Customer Identifier</span>
        <p
          style={{
            fontSize: '11px',
            color: 'var(--text-dim)',
            letterSpacing: '1px',
          }}
        >
          {user.stripeCustomerId || 'No linked account found'}
        </p>
      </div>

      <div className="mb-4">
        <span className="label">Available Subscription Plans</span>
        <div className="grid-2" style={{ gap: '15px' }}>
          {plans.map((plan) => {
            const isCurrent = activePlan === plan.name;
            return (
              <div
                key={plan.name}
                style={{
                  border: isCurrent
                    ? '2px solid var(--accent)'
                    : '1px solid var(--border)',
                  padding: '2rem',
                  textAlign: 'center',
                  position: 'relative',
                  background: isCurrent ? 'var(--accent-soft)' : 'transparent',
                }}
              >
                {isCurrent && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      background: 'var(--accent)',
                      color: '#000',
                      fontSize: '8px',
                      fontWeight: 900,
                      padding: '4px 8px',
                      letterSpacing: '1px',
                    }}
                  >
                    CURRENT PLAN
                  </div>
                )}
                <h4
                  style={{
                    fontSize: '10px',
                    fontWeight: 900,
                    marginBottom: '0.75rem',
                    color: 'var(--accent)',
                  }}
                >
                  {plan.name.toUpperCase()}
                </h4>
                <div
                  style={{
                    fontSize: '9px',
                    color: 'var(--text-dim)',
                    borderBottom: '1px dashed var(--border)',
                    paddingBottom: '1rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  ID: {plan.priceId.substring(0, 15)}...
                </div>
                <button
                  className={isCurrent ? 'btn btn-primary' : 'btn'}
                  disabled={loadingPlan !== null || isCurrent}
                  onClick={() => handleUpgrade(plan.name)}
                >
                  {loadingPlan === plan.name
                    ? 'Connecting...'
                    : isCurrent
                      ? 'Active Plan'
                      : 'Select Plan'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <button
          className="btn btn-primary"
          disabled={isPortalLoading}
          onClick={handlePortal}
        >
          {isPortalLoading ? 'Opening Portal...' : 'Manage Billing Portal'}
        </button>
      </div>
    </div>
  );
};
