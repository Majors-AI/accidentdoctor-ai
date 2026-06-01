import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function Practices() {
  const [practices, setPractices] = useState<any[]>([]);
  const [metrics,   setMetrics]   = useState<any[]>([]);
  const [adding,    setAdding]    = useState(false);
  const [f, setF] = useState({
    name: '', specialty: '', city: '', state: '',
    marketing_source: '', metrics: true, security: true,
  });

  async function load() {
    const { data: pr } = await supabase
      .from('practices').select('*').order('created_at', { ascending: false });
    setPractices(pr ?? []);
    const { data: m } = await supabase.rpc('platform_metrics');
    setMetrics(m ?? []);
  }
  useEffect(() => { load(); }, []);

  async function addPractice() {
    if (!f.name.trim()) return;
    await supabase.from('practices').insert({
      name: f.name,
      specialty: f.specialty || null,
      city: f.city || null,
      state: f.state || null,
      marketing_source: f.marketing_source || null,
      allow_platform_metrics: f.metrics,
      data_security_agreed: f.security,
    });
    setF({ name: '', specialty: '', city: '', state: '', marketing_source: '', metrics: true, security: true });
    setAdding(false);
    load();
  }

  const metricFor = (id: string) => metrics.find((m: any) => m.practice_id === id);
  const statusTag: Record<string, string> = {
    active: 'good', past_due: 'warn', suspended: 'bad', cancelled: 'soft',
  };

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Practices</h1>
          <div className="sub">{practices.length} practices on the platform</div>
        </div>
        <button className="btn oxblood" onClick={() => setAdding(a => !a)}>
          {adding ? 'Cancel' : 'Add practice'}
        </button>
      </div>

      {adding && (
        <div className="card" style={{ maxWidth: 560 }}>
          <h3>New practice</h3>
          <div className="row">
            <div>
              <label>Practice name</label>
              <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })}
                placeholder="Desert Spine & Wellness" />
            </div>
            <div>
              <label>Specialty</label>
              <input value={f.specialty} onChange={e => setF({ ...f, specialty: e.target.value })}
                placeholder="chiropractic, orthopedics…" />
            </div>
          </div>
          <div className="row">
            <div>
              <label>City</label>
              <input value={f.city} onChange={e => setF({ ...f, city: e.target.value })} placeholder="Tempe" />
            </div>
            <div>
              <label>State</label>
              <input value={f.state} onChange={e => setF({ ...f, state: e.target.value })} placeholder="AZ" />
            </div>
          </div>
          <label>Marketing source</label>
          <input value={f.marketing_source} onChange={e => setF({ ...f, marketing_source: e.target.value })}
            placeholder="AccidentLawyer.AI, Google, referral…" />
          <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
            {([
              ['security', 'Practice agrees to handle patient data in compliance with HIPAA.'],
              ['metrics',  'Practice agrees to share aggregate metrics with the platform.'],
            ] as [string, string][]).map(([k, label]) => (
              <label key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontWeight: 400, color: 'var(--ink)' }}>
                <input type="checkbox" style={{ width: 18, marginTop: 2 }}
                  checked={(f as any)[k]} onChange={e => setF({ ...f, [k]: e.target.checked })} />
                <span className="small">{label}</span>
              </label>
            ))}
          </div>
          <button className="btn oxblood" style={{ marginTop: 16 }}
            disabled={!f.name || !f.security} onClick={addPractice}>
            Create practice
          </button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Practice</th>
              <th>Status</th>
              <th>Patients</th>
              <th>Active charts</th>
              <th>Marketing</th>
            </tr>
          </thead>
          <tbody>
            {practices.map(pr => {
              const m = metricFor(pr.id);
              return (
                <tr key={pr.id}>
                  <td>
                    <b>{pr.name}</b>
                    <div className="muted tiny">{pr.specialty ?? ''}{pr.city ? ` · ${pr.city}, ${pr.state ?? ''}` : ''}</div>
                  </td>
                  <td>
                    <span className={`tag tiny ${statusTag[pr.account_status] ?? 'soft'}`}>
                      {(pr.account_status ?? 'active').replace('_', ' ')}
                    </span>
                  </td>
                  <td>{m ? m.patient_count : <span className="muted tiny">—</span>}</td>
                  <td>{m ? m.active_charts : <span className="muted tiny">opted out</span>}</td>
                  <td className="small">{pr.marketing_source ?? '—'}</td>
                </tr>
              );
            })}
            {practices.length === 0 && (
              <tr><td colSpan={5} className="muted">No practices yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted tiny">
        Metrics are aggregates only — patient names and clinical details never leave a practice's boundary.
      </p>
    </>
  );
}
