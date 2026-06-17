import { useAuth } from '@/lib/AuthContext';

export default function PendingSetup() {
  const { user, logout } = useAuth();
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f4f5f9',
    }}>
      <div style={{
        background: '#fff', border: '1px solid #e0e3ed', borderRadius: 16,
        padding: '40px 48px', maxWidth: 440, textAlign: 'center',
        boxShadow: '0 2px 12px rgba(22,24,31,.08)',
      }}>
        <div style={{
          width: 48, height: 48, background: '#f0f0ff', borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, margin: '0 auto 20px',
        }}>⏳</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 8px', color: '#16181f' }}>
          Account not configured
        </h1>
        <p style={{ fontSize: 14, color: '#525870', margin: '0 0 20px', lineHeight: 1.6 }}>
          Your account (<strong>{user?.email}</strong>) doesn't have an app role assigned yet.
          Ask your platform administrator to set your <code style={{ background: '#f4f5f9', padding: '1px 5px', borderRadius: 4, fontSize: 12.5 }}>app_role</code> in the Users panel.
        </p>
        <button
          onClick={() => logout()}
          style={{
            background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
            padding: '9px 22px', fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}