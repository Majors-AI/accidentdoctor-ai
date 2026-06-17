import { useEffect, useState } from 'react';
import { db } from '@/api/entities';

const STATUS_TAG = { active: 'good', past_due: 'warn', suspended: 'bad', cancelled: 'soft' };

export default function PracticesAdmin() {
  const [practices, setPractices] = useState([]);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', specialty: '', city: '', state: '', marketing_source: '', allow_platform_metrics: true, data_security_agreed: false });
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await db.entities.Practice.list('-created_date', 100);
    setPractices(data || []);
  }
  useEffect(() => { load(); }, []);

  async function addPractice() {
    if (!f.name.trim()) return;
    setSaving(true);
    await db.entities.Practice.create({
      name: f.name, specialty: f.specialty || null, city: f.city || null,
      state: f.state || null, marketing_source: f.marketing_source || null,
      allow_platform_metrics: f.allow_platform_metrics,
      data_security_agreed: f.data_security_agreed,
    });
    setF({ name: '', specialty: '', city: '', state: '', marketing_source: '', allow_platform_metrics: true, data_security_agreed: false });
    setAdding(false);
    setSaving(false);
    load();
  }

  const colors = { good: { bg: '#d1fae5', color: '#059669', border: '#a7f3d0' }, warn: { bg: '#fef3c7', color: '#d97706', border: '#fde68a' }, bad: { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' }, soft: { bg: '#f4f5f9', color: '#525870', border: '#e0e3ed' } };

  return (
    <div style={{ padding: '36px 44px', maxWidth: 1160 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.03em', margin: 0 }}>Practices</h1>
          <p style={{ color: '#525870', fontSize: 13.5, marginTop: 3 }}>{practices.length} practices on the platform</p>
        </div>
        <button onClick={() => setAdding(a => !a)} style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 18px', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>
          {adding ? 'Cancel' : 'Add practice'}
        </button>
      </div>

      {adding && (
        <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, padding: '24px', marginBottom: 24, boxShadow: '0 1px 3px rgba(22,24,31,.08)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px' }}>New practice</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[['Practice name *', 'name', 'Desert Spine & Wellness'], ['Specialty', 'specialty', 'chiropractic, orthopedics…'], ['City', 'city', 'Tempe'], ['State', 'state', 'AZ'], ['Marketing source', 'marketing_source', 'AccidentLawyer.AI, Google…']].map(([label, key, placeholder]) => (
              <div key={key} style={{ gridColumn: key === 'marketing_source' ? '1 / -1' : undefined }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#525870', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{label}</label>
                <input value={f[key]} onChange={e => setF({ ...f, [key]: e.target.value })} placeholder={placeholder}
                  style={{ width: '100%', fontSize: 14, padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e0e3ed', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[['data_security_agreed', 'Practice agrees to handle patient data in compliance with HIPAA.'], ['allow_platform_metrics', 'Practice agrees to share aggregate metrics with the platform.']].map(([k, lbl]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#16181f', fontWeight: 'normal', textTransform: 'none', letterSpacing: 0 }}>
                <input type="checkbox" checked={f[k]} onChange={e => setF({ ...f, [k]: e.target.checked })} />
                {lbl}
              </label>
            ))}
          </div>
          <button onClick={addPractice} disabled={saving} style={{ marginTop: 16, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 20px', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Creating…' : 'Create practice'}
          </button>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(22,24,31,.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr>
              {['Practice', 'Status', 'Plan', 'Specialty', 'Location', 'Marketing'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontWeight: 600, color: '#525870', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', padding: '10px 14px', borderBottom: '1px solid #e0e3ed', background: '#f4f5f9' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {practices.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#525870' }}>No practices yet.</td></tr>}
            {practices.map(pr => {
              const stKey = STATUS_TAG[pr.account_status] || 'soft';
              const c = colors[stKey];
              return (
                <tr key={pr.id} onMouseEnter={e => e.currentTarget.style.background = '#f8f9fd'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', fontWeight: 600 }}>{pr.name}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8' }}>
                    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                      {(pr.account_status || 'active').replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', color: '#525870' }}>{pr.plan || '—'}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', color: '#525870' }}>{pr.specialty || '—'}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', color: '#525870' }}>{pr.city ? `${pr.city}, ${pr.state || ''}` : '—'}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', color: '#525870' }}>{pr.marketing_source || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: '#525870', marginTop: 12 }}>Metrics are aggregates only — patient names and clinical details never leave a practice's boundary.</p>
    </div>
  );
}