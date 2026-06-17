import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { db } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';

const APP_ROLES = ['front_desk', 'provider', 'billing_staff', 'practice_admin'];
const ROLE_LABEL = {
  front_desk: 'Front Desk',
  provider: 'Provider',
  billing_staff: 'Billing Staff',
  practice_admin: 'Practice Admin',
};
const ROLE_COLOR = {
  front_desk:    { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' },
  provider:      { bg: '#d1fae5', color: '#059669', border: '#a7f3d0' },
  billing_staff: { bg: '#fef9c3', color: '#b45309', border: '#fde68a' },
  practice_admin:{ bg: '#ede9fe', color: '#6d28d9', border: '#ddd6fe' },
};

const LOAD_TIMEOUT_MS = 8000;

export default function StaffSection({ isAdmin }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let cancelled = false;

    // Timeout guard — never leave the user on an infinite spinner
    const timer = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setLoadError('Request timed out. The server did not respond in time. Try refreshing the page.');
      }
    }, LOAD_TIMEOUT_MS);

    (async () => {
      try {
        // RLS scopes User.list() to the caller's practice. Other profiles expose
        // `role`, not `app_role` — map role -> app_role for the table.
        const rows = await db.entities.User.list();
        clearTimeout(timer);
        if (cancelled) return;
        const staff = rows
          .filter(u => APP_ROLES.includes(u.role))
          .map(u => ({ id: u.id, email: u.email, full_name: u.full_name, app_role: u.role }));
        setUsers(staff);
      } catch (err) {
        clearTimeout(timer);
        if (cancelled) return;
        setLoadError(err.message || 'Failed to load staff list.');
      }
      setLoading(false);
    })();

    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  async function callUpdateRole(userId, newRole) {
    setSaving(s => ({ ...s, [userId]: true }));
    setErrors(e => ({ ...e, [userId]: null }));

    const { data, error } = await supabase.functions.invoke('update-staff-role', { body: { userId, newRole } });
    if (error) {
      // Non-2xx — the function returns { error } in the response body.
      let msg = 'Failed to update role.';
      try { const b = await error.context.json(); if (b?.error) msg = b.error; } catch {}
      setErrors(e => ({ ...e, [userId]: msg }));
    } else if (data?.ok) {
      setUsers(us => us.map(u => u.id === userId ? { ...u, app_role: newRole } : u));
    } else {
      setErrors(e => ({ ...e, [userId]: data?.error || 'Failed to update role.' }));
    }
    setSaving(s => ({ ...s, [userId]: false }));
  }

  // Deactivation is not supported yet: profiles.role is NOT NULL, so update-staff-role
  // rejects newRole=null. The Deactivate control is rendered inert below.
  // TODO: deactivation needs an account-status field on profiles (Dom decision).

  if (loading) {
    return <div style={{ color: '#525870', padding: 12 }}>Loading staff…</div>;
  }

  if (loadError) {
    return (
      <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '16px 20px', color: '#dc2626', fontSize: 13.5 }}>
        <strong>Could not load staff list</strong>
        <p style={{ margin: '6px 0 0', color: '#991b1b', fontSize: 13 }}>{loadError}</p>
      </div>
    );
  }

  const practiceStaff = users.filter(u => u.app_role && APP_ROLES.includes(u.app_role));
  const noRole = users.filter(u => !u.app_role || !APP_ROLES.includes(u.app_role));

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', margin: 0 }}>Staff</h2>
        <p style={{ color: '#525870', fontSize: 13.5, marginTop: 4 }}>
          Manage roles for all practice users.
          {isAdmin && " As Practice Admin you can change any user's role or remove their access."}
        </p>
      </div>

      {/* Invite notice */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 22, fontSize: 13 }}>
        <strong style={{ color: '#1d4ed8' }}>Inviting new staff:</strong>{' '}
        <span style={{ color: '#1e3a8a' }}>
          Go to the platform dashboard → <em>Users</em> → <em>Invite user</em>. After they register, come back here to assign their app role.
        </span>
      </div>

      <UserTable
        title={`Active staff · ${practiceStaff.length}`}
        titleStyle={{ background: '#f8f9fd', color: '#525870' }}
        users={practiceStaff}
        isAdmin={isAdmin}
        currentUserId={currentUser?.id}
        saving={saving}
        errors={errors}
        onChangeRole={callUpdateRole}      />

      {noRole.length > 0 && (
        <UserTable
          title={`Pending / no role assigned · ${noRole.length}`}
          titleStyle={{ background: '#fffbeb', color: '#b45309' }}
          users={noRole}
          isAdmin={isAdmin}
          currentUserId={currentUser?.id}
          saving={saving}
          errors={errors}
          onChangeRole={callUpdateRole}
          onDeactivate={deactivateUser}
          isNoRole
        />
      )}
    </div>
  );
}

function UserTable({ title, titleStyle, users, isAdmin, currentUserId, saving, errors, onChangeRole, isNoRole }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, overflow: 'hidden', marginBottom: 20, boxShadow: '0 1px 3px rgba(22,24,31,.07)' }}>
      <div style={{ padding: '11px 16px', borderBottom: '1px solid #e0e3ed', fontSize: 12, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', ...titleStyle }}>
        {title}
      </div>
      {users.length === 0 && (
        <div style={{ padding: '20px 16px', color: '#9ca0b8', fontSize: 13.5 }}>No staff with a role assigned yet.</div>
      )}
      {users.map(u => {
        const rc = ROLE_COLOR[u.app_role] || {};
        const isSelf = u.id === currentUserId;
        const err = errors[u.id];
        return (
          <div key={u.id} style={{ borderBottom: '1px solid #f0f2f8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px' }}>
              {/* Avatar */}
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: isNoRole ? '#f4f5f9' : '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13.5, color: isNoRole ? '#9ca0b8' : '#6d28d9', flexShrink: 0 }}>
                {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: '#16181f', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {u.full_name || '—'}
                  {isSelf && <span style={{ fontSize: 10.5, fontWeight: 700, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 99, padding: '1px 7px' }}>You</span>}
                </div>
                <div style={{ fontSize: 12, color: '#525870' }}>{u.email}</div>
              </div>

              {/* Role control */}
              {isAdmin && !isSelf ? (
                <select
                  value={u.app_role || ''}
                  disabled={!!saving[u.id]}
                  onChange={e => { if (e.target.value) onChangeRole(u.id, e.target.value); }}
                  style={{ fontSize: 12.5, padding: '5px 8px', borderRadius: 7, border: `1px solid ${rc.border || '#e0e3ed'}`, background: rc.bg || '#fff', color: rc.color || '#16181f', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isNoRole && <option value="" disabled>Assign role…</option>}
                  {APP_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              ) : (
                u.app_role
                  ? <RoleBadge role={u.app_role} />
                  : <span style={{ fontSize: 12, color: '#9ca0b8', fontWeight: 500 }}>No role</span>
              )}

              {/* Deactivate — inert until deactivation is supported (see TODO above). */}
              {isAdmin && !isSelf && !isNoRole && (
                <button
                  type="button"
                  disabled
                  title="Deactivation not available yet"
                  style={{ background: 'none', border: '1px solid #e0e3ed', borderRadius: 7, padding: '4px 10px', fontSize: 12, color: '#9ca0b8', cursor: 'not-allowed', fontWeight: 500, flexShrink: 0 }}
                >
                  Deactivate
                </button>
              )}

              {/* Self-lock label */}
              {isAdmin && isSelf && (
                <span style={{ fontSize: 11.5, color: '#9ca0b8', fontStyle: 'italic' }}>Role locked (self)</span>
              )}
            </div>

            {/* Inline per-row error */}
            {err && (
              <div style={{ margin: '0 16px 10px', padding: '7px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 12.5, color: '#dc2626' }}>
                ⚠ {err}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RoleBadge({ role }) {
  const rc = ROLE_COLOR[role] || { bg: '#f4f5f9', color: '#525870', border: '#e0e3ed' };
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
      {ROLE_LABEL[role] || role}
    </span>
  );
}