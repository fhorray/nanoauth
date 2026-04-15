import { StripeDashboard } from './StripeDashboard';
import { authClient } from '../client';

interface DashboardProps {
    user: any;
    plans: any[];
    activePlan?: string | null;
}

export const Dashboard = ({ user, plans, activePlan }: DashboardProps) => {
    const handleLogout = async () => {
        try {
            await authClient.signOut();
            window.location.href = '/signin';
        } catch (e) {
            console.error('Logout failed', e);
        }
    };

    return (
        <div class="container" style={{ paddingTop: '3rem' }}>
            <header class="flex justify-between items-center mb-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '4rem' }}>
                <div class="flex items-center gap-2">
                     <span style={{ fontWeight: 900, letterSpacing: '4px', color: 'var(--accent)' }}>NANOAUTH</span>
                     <span style={{ color: 'var(--text-dim)', fontSize: '9px' }}>/ v0.1.0 Alpha</span>
                </div>
                <button 
                  class="btn btn-danger" 
                  style={{ width: 'auto', padding: '0.4rem 1.2rem', fontSize: '9px' }}
                  onClick={handleLogout}
                >
                    Sign Out
                </button>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '4rem' }}>
                <main>
                    <StripeDashboard user={user} plans={plans} activePlan={activePlan} />

                    <div class="nano-module">
                        <span class="label">Debug Session Data</span>
                        <pre>
                            {JSON.stringify(user, null, 2)}
                        </pre>
                    </div>
                </main>

                <aside>
                    <div class="nano-module" style={{ padding: '2rem' }}>
                        <span class="label">User Profile</span>
                        <div style={{ padding: '4px', border: '1px solid var(--accent)', marginBottom: '2rem', background: '#000' }}>
                            <img 
                                src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
                                style={{ width: '100%', filter: 'grayscale(100%) brightness(0.8) contrast(1.2)', display: 'block' }} 
                            />
                        </div>
                        <h2 style={{ fontSize: '16px', fontWeight: 900, marginBottom: '0.5rem', color: 'var(--accent)' }}>{user.name || 'Anonymous User'}</h2>
                        <p style={{ color: 'var(--text-dim)', fontSize: '10px', marginBottom: '2rem' }}>{user.email}</p>
                        
                        <div style={{ marginBottom: '1.5rem', border: '1px solid var(--border)', padding: '1rem' }}>
                            <span class="label" style={{ marginBottom: '0.5rem' }}>Active Plan</span>
                            <div style={{ fontSize: '12px', fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase' }}>
                                {activePlan || 'Discovery (Free)'}
                            </div>
                        </div>

                        <div class="badge badge-active" style={{ width: '100%', textAlign: 'center' }}>
                            Role: {user.role || 'Guest'}
                        </div>
                    </div>

                    <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: '1.5rem', marginTop: '2rem' }}>
                         <span class="label">System Environment</span>
                         <p style={{ fontSize: '10px', color: 'var(--text-dim)', lineHeight: '1.8' }}>
                            » Persistence: SQLite (Online)<br/>
                            » Account Integrity: Verified<br/>
                            » Service Status: Operational
                         </p>
                    </div>
                </aside>
            </div>
        </div>
    );
};
