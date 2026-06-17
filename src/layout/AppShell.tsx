import { Outlet } from 'react-router-dom';
import JourneyBar from '@/journey/JourneyBar';
import { useAuth } from '@/lib/AuthContext';

// Shared chrome for admin journey: top header + routed stage page + fixed bottom JourneyBar.
export default function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header style={{
        background: '#1a1d2e',
        color: '#fff',
        padding: '0 24px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, background: '#4f46e5', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 12, color: '#fff',
          }}>AD</div>
          <strong style={{ fontSize: 14, letterSpacing: '-.01em' }}>AccidentDoctor.AI</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12.5, color: '#9ca0b8' }}>{user?.full_name}</span>
          <button
            onClick={() => logout()}
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,.15)',
              color: '#9ca0b8', borderRadius: 6, padding: '4px 12px',
              fontSize: 12.5, cursor: 'pointer', fontWeight: 500,
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main style={{ flex: 1, paddingBottom: 64 }}>
        <Outlet />
      </main>

      <JourneyBar />
    </div>
  );
}