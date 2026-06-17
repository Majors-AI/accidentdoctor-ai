import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';


const STATUS_NEXT = { assigned: 'in_progress', in_progress: 'completed' };
const STATUS_LABEL = { assigned: 'Not started', in_progress: 'In progress', completed: 'Completed' };
const STATUS_COLOR = {
  assigned:    { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' },
  in_progress: { bg: '#fef9c3', color: '#b45309', border: '#fde68a' },
  completed:   { bg: '#d1fae5', color: '#059669', border: '#a7f3d0' },
};
const CAT_COLOR = {
  HIPAA:      '#7c3aed', Onboarding: '#0369a1', Billing: '#b45309',
  Clinical:   '#059669', General:    '#475569',
};

const TIMEOUT_MS = 8000;

export default function StaffTrainingView() {
  const { user } = useAuth();
  const [modules, setModules] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState({});

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) { setLoading(false); setError('Request timed out. Try refreshing.'); }
    }, TIMEOUT_MS);

    (async () => {
      const [mods, assigns] = await Promise.all([
        base44.entities.TrainingModule.list(),
        base44.entities.TrainingAssignment.filter({ user_id: user.id }),
      ]);
      clearTimeout(timer);
      if (cancelled) return;
      setModules(mods);
      setAssignments(assigns);
      setLoading(false);
    })();

    return () => { cancelled = true; clearTimeout(timer); };
  }, [user.id]);

  async function advance(assignment) {
    const next = STATUS_NEXT[assignment.status];
    if (!next) return;
    setSaving(s => ({ ...s, [assignment.id]: true }));
    const updates = { status: next };
    if (next === 'completed') updates.completed_at = new Date().toISOString();
    await base44.entities.TrainingAssignment.update(assignment.id, updates);
    setAssignments(as => as.map(a => a.id === assignment.id ? { ...a, ...updates } : a));
    setSaving(s => ({ ...s, [assignment.id]: false }));
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBanner msg={error} />;


  const assignmentMap = Object.fromEntries(assignments.map(a => [a.module_id, a]));
  const myModules = modules.filter(m => assignmentMap[m.id]);
  const completed = myModules.filter(m => assignmentMap[m.id]?.status === 'completed').length;

  return (
    <div style={{ padding: '36px 44px', maxWidth: 780, fontFamily: 'inherit' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-.02em' }}>My Training</h1>
        <p style={{ color: '#525870', fontSize: 13.5, marginTop: 4 }}>
          {myModules.length === 0
            ? 'No modules assigned yet.'
            : `${completed} of ${myModules.length} module${myModules.length !== 1 ? 's' : ''} completed`}
        </p>
      </div>

      {myModules.length === 0 && (
        <div style={{ border: '1.5px dashed #e0e3ed', borderRadius: 12, padding: 32, textAlign: 'center', color: '#9ca0b8', fontSize: 14 }}>
          Your practice admin hasn't assigned any training modules yet.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {myModules.map(mod => {
          const asgn = assignmentMap[mod.id];
          const sc = STATUS_COLOR[asgn.status];
          const next = STATUS_NEXT[asgn.status];
          const isSaving = saving[asgn.id];
          return (
            <div key={mod.id} style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 12, padding: '18px 22px', boxShadow: '0 1px 3px rgba(22,24,31,.06)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: CAT_COLOR[mod.category] || '#475569' }}>{mod.category}</span>
                  {mod.required && <span style={{ fontSize: 10.5, fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 99, padding: '1px 7px' }}>Required</span>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#16181f' }}>{mod.title}</div>
                {mod.description && <div style={{ fontSize: 12.5, color: '#525870', marginTop: 3 }}>{mod.description}</div>}
                {mod.estimated_minutes && <div style={{ fontSize: 12, color: '#9ca0b8', marginTop: 4 }}>~{mod.estimated_minutes} min</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <span style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 600, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                  {STATUS_LABEL[asgn.status]}
                </span>
                {next && (
                  <button
                    onClick={() => advance(asgn)}
                    disabled={isSaving}
                    style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1 }}
                  >
                    {isSaving ? '…' : next === 'in_progress' ? 'Start' : 'Mark complete'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Loading() {
  return <div style={{ padding: 44, color: '#525870' }}>Loading your training…</div>;
}

function ErrorBanner({ msg }) {
  return (
    <div style={{ margin: 44, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '16px 20px', color: '#dc2626', fontSize: 13.5 }}>
      <strong>Could not load training</strong>
      <p style={{ margin: '6px 0 0', color: '#991b1b', fontSize: 13 }}>{msg}</p>
    </div>
  );
}