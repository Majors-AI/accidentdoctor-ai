import { NavLink } from 'react-router-dom';
import { useAuth } from '../App';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const superAdmin = profile?.is_platform_admin;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          Accident<br />Doctor<span style={{ color: 'var(--oxblood)' }}>.ai</span>
          <small>{superAdmin ? 'Platform Admin' : 'Provider Portal'}</small>
        </div>

        {superAdmin ? (
          <nav className="nav">
            <div className="group">Platform</div>
            <NavLink to="/practices" className={({ isActive }) => isActive ? 'active' : ''}>
              Practices
            </NavLink>
          </nav>
        ) : (
          <nav className="nav">
            <div className="group">Clinic</div>
            <NavLink to="/patients" className={({ isActive }) => isActive ? 'active' : ''}>
              Patients
            </NavLink>
            <NavLink to="/schedule" className={({ isActive }) => isActive ? 'active' : ''}>
              Schedule
            </NavLink>
            <div className="group">Finance</div>
            <NavLink to="/billing" className={({ isActive }) => isActive ? 'active' : ''}>
              Billing
            </NavLink>
            <div className="group">Practice</div>
            <NavLink to="/account" className={({ isActive }) => isActive ? 'active' : ''}>
              Account & billing
            </NavLink>
          </nav>
        )}

        <div className="who">
          <b>{profile?.full_name}</b><br />
          <span className="muted tiny">{profile?.role?.replace(/_/g, ' ')}</span>
          <button
            className="btn ghost sm"
            style={{ color: '#e9e3d4', borderColor: 'rgba(255,255,255,.2)' }}
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
