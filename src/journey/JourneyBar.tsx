import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { visibleStages } from '@/journey/stages';

// Fixed full-width bottom bar. Renders only the stages visible to the current
// profile (empty-roles stages are hidden). Active state derived from route.
export default function JourneyBar() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  const profile = user ? { role: user.role ?? 'user' } : null;
  const stages = visibleStages(profile);

  return (
    <nav className="journey-bar">
      {stages.map((s) => {
        const active = pathname === s.path || pathname.startsWith(s.path + '/');
        return (
          <Link key={s.id} to={s.path} className={`journey-pill${active ? ' active' : ''}`}>
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}