import { NavLink } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import PracticeBar from '@/layout/PracticeBar';
import { PRACTICE_NAV } from '@/layout/practiceNav';

// Sidebar-less shell for practice staff: top header with working nav + wide
// content area + fixed bottom PracticeBar (full journey stages).
export default function PracticeShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const isPracticeAdmin = (user as any)?.app_role === 'practice_admin';
  const visibleNav = PRACTICE_NAV.filter(item => !item.adminOnly || isPracticeAdmin);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top header */}
      <header style={{
        background: '#1a1d2e',
        color: '#fff',
        padding: '0 20px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexShrink: 0,
        overflowX: 'auto',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            width: 28, height: 28, background: '#4f46e5', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 12, color: '#fff',
          }}>AD</div>
          <strong style={{ fontSize: 14, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>
            AccidentDoctor.AI
          </strong>
        </div>

        {/* Working nav */}
        <nav style={{ display: 'flex', gap: 2, flex: 1 }}>
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                color: isActive ? '#fff' : '#9ca0b8',
                background: isActive ? 'rgba(255,255,255,.12)' : 'transparent',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User + sign out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 12.5, color: '#9ca0b8', whiteSpace: 'nowrap' }}>
            {user?.full_name}
          </span>
          <button
            onClick={() => logout()}
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,.15)',
              color: '#9ca0b8', borderRadius: 6, padding: '4px 10px',
              fontSize: 12, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Content — padded bottom so PracticeBar doesn't overlap */}
      <main style={{ flex: 1, paddingBottom: 64 }}>
        {children}
      </main>

      <PracticeBar />
    </div>
  );
}