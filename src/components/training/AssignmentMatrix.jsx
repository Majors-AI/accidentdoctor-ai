import { useEffect, useState } from 'react';
import { db } from '@/api/entities';

const TIMEOUT_MS = 8000;
const PRACTICE_ROLES = ['front_desk', 'provider', 'billing_staff', 'practice_admin'];
const STATUS_COLOR = {
  assigned:    { bg: '#f1f5f9', color: '#64748b' },
  in_progress: { bg: '#fef9c3', color: '#b45309' },
  completed:   { bg: '#d1fae5', color: '#059669' },
};
const STATUS_LABEL = { assigned: 'Assigned', in_progress: 'In Progress', completed: 'Done' };
const ROLE_LABEL = { front_desk: 'Front Desk', provider: 'Provider', billing_staff: 'Billing', practice_admin: 'Admin' };

export default function AssignmentMatrix() {
  const [modules, setModules] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assigning, setAssigning] = useState({}); // key: `${userId}_${moduleId}`
  const [rowErrors, setRowErrors] = useState({}); // key: `${userId}_${moduleId}`

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) { setLoading(false); setError('Request timed out. Try refreshing.'); }
    }, TIMEOUT_MS);

    (async () => {
      try {
        // Assemble the matrix client-side (was the listStaffTrainingMatrix function).
        // RLS scopes User.list() and TrainingAssignment.list() to the caller's practice.
        const [mods, staffRows, assignRows] = await Promise.all([
          db.entities.TrainingModule.list(),
          db.entities.User.list(),
          db.entities.TrainingAssignment.list(),
        ]);
        clearTimeout(timer);
        if (cancelled) return;

        // Other profiles expose `role`, not `app_role` — map role -> app_role here.
        const staff = staffRows
          .filter(u => PRACTICE_ROLES.includes(u.role))
          .map(u => ({
            id: u.id,
            full_name: u.full_name || u.email || '—',
            app_role: u.role,
            assignments: assignRows
              .filter(a => a.user_id === u.id)
              .map(a => ({ module_id: a.module_id, status: a.status, assignment_id: a.id })),
          }));

        setModules(mods);
        setStaff(staff);
        setLoading(false);
      } catch (err) {
        clearTimeout(timer);
        if (cancelled) return;
        setError(err.message || 'Failed to load staff matrix.');
        setLoading(false);
      }
    })();

    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  // Derive a lookup: staffMember.assignments array → map by module_id
  function getAssignment(member, moduleId) {
    return member.assignments.find(a => a.module_id === moduleId) || null;
  }

  async function toggleAssign(member, mod) {
    const key = `${member.id}_${mod.id}`;
    const existing = getAssignment(member, mod.id);
    setAssigning(s => ({ ...s, [key]: true }));
    setRowErrors(e => ({ ...e, [key]: null }));

    try {
      if (existing) {
        // Remove assignment
        await db.entities.TrainingAssignment.delete(existing.assignment_id);
        setStaff(ss => ss.map(m => m.id !== member.id ? m : {
          ...m, assignments: m.assignments.filter(a => a.module_id !== mod.id),
        }));
      } else {
        // Create assignment
        const created = await db.entities.TrainingAssignment.create({
          user_id: member.id,
          module_id: mod.id,
          status: 'assigned',
        });
        setStaff(ss => ss.map(m => m.id !== member.id ? m : {
          ...m, assignments: [...m.assignments, { module_id: mod.id, status: 'assigned', assignment_id: created.id }],
        }));
      }
    } catch (err) {
      setRowErrors(e => ({ ...e, [key]: err.message || 'Operation failed.' }));
    }
    setAssigning(s => ({ ...s, [key]: false }));
  }

  if (loading) return <div style={{ color: '#525870', padding: 12 }}>Loading matrix…</div>;
  if (error) return <ErrorBanner msg={error} />;

  if (modules.length === 0) return (
    <div style={{ border: '1.5px dashed #e0e3ed', borderRadius: 12, padding: 32, textAlign: 'center', color: '#9ca0b8', fontSize: 14 }}>
      No modules yet. Create some in the Modules tab first.
    </div>
  );

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {staff.map(member => {
          const total = member.assignments.length;
          const done = member.assignments.filter(a => a.status === 'completed').length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <div key={member.id} style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(22,24,31,.06)' }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#16181f', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.full_name}</div>
              <div style={{ fontSize: 11.5, color: '#9ca0b8', marginBottom: 8 }}>{ROLE_LABEL[member.app_role] || member.app_role}</div>
              <div style={{ height: 4, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#059669' : '#4f46e5', borderRadius: 99, transition: 'width .3s' }} />
              </div>
              <div style={{ fontSize: 11.5, color: '#525870', marginTop: 5 }}>{done}/{total} · {pct}%</div>
            </div>
          );
        })}
      </div>

      {/* Matrix table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #e0e3ed', borderRadius: 12, overflow: 'hidden', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8f9fd', borderBottom: '1px solid #e0e3ed' }}>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 700, color: '#525870', fontSize: 12, whiteSpace: 'nowrap' }}>Module</th>
              {staff.map(m => (
                <th key={m.id} style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 600, color: '#525870', fontSize: 12, whiteSpace: 'nowrap', minWidth: 100 }}>
                  {m.full_name.split(' ')[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((mod, mi) => (
              <tr key={mod.id} style={{ borderBottom: mi < modules.length - 1 ? '1px solid #f0f2f8' : 'none' }}>
                <td style={{ padding: '11px 16px', fontWeight: 600, color: '#16181f', maxWidth: 240 }}>
                  <div>{mod.title}</div>
                  {mod.required && <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626' }}>Required</span>}
                </td>
                {staff.map(member => {
                   const asgn = getAssignment(member, mod.id);
                   const key = `${member.id}_${mod.id}`;
                   const busy = assigning[key];
                   const rowErr = rowErrors[key];
                   const sc = asgn ? STATUS_COLOR[asgn.status] : null;
                   return (
                     <td key={member.id} style={{ textAlign: 'center', padding: '10px 8px' }}>
                       <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                         {asgn ? (
                           <>
                             <span style={{ padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
                               {STATUS_LABEL[asgn.status]}
                             </span>
                             <button onClick={() => toggleAssign(member, mod)} disabled={busy}
                               style={{ fontSize: 10.5, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: busy ? 0.5 : 1 }}>
                               {busy ? '…' : 'Unassign'}
                             </button>
                           </>
                         ) : (
                           <button onClick={() => toggleAssign(member, mod)} disabled={busy}
                             style={{ fontSize: 11.5, color: '#4f46e5', background: 'none', border: '1px dashed #c4b5fd', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
                             {busy ? '…' : 'Assign'}
                           </button>
                         )}
                         {rowErr && (
                           <div style={{ fontSize: 9.5, color: '#dc2626', fontWeight: 500, maxWidth: 80, wordWrap: 'break-word', marginTop: 2 }}>
                             ⚠ {rowErr}
                           </div>
                         )}
                       </div>
                     </td>
                   );
                 })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ErrorBanner({ msg }) {
  return (
    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '16px 20px', color: '#dc2626', fontSize: 13.5 }}>
      <strong>Could not load assignment matrix</strong>
      <p style={{ margin: '6px 0 0', color: '#991b1b', fontSize: 13 }}>{msg}</p>
    </div>
  );
}