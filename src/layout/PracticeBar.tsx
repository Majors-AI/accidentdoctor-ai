import { Link, useLocation } from 'react-router-dom';
import { JOURNEY_STAGES } from '@/journey/stages';

// Full-width bottom bar for practice users: all ten numbered journey stage
// pills. Active state derived from current route. Scrolls horizontally when narrow.
export default function PracticeBar() {
  const { pathname } = useLocation();

  return (
    <nav className="journey-bar">
      {JOURNEY_STAGES.map((s) => {
        const active = pathname === s.path || pathname.startsWith(s.path + '/');
        return (
          <Link key={s.id} to={s.path} className={`journey-pill${active ? ' active' : ''}`}>
            <span style={{ fontSize: 10, opacity: 0.45, marginRight: 1 }}>{s.id}</span>
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}