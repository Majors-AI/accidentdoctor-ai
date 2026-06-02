import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';
import { sendSmsReminder } from '../../lib/notifications';

const VISIT_TYPES = [
  { v: 'initial_evaluation', l: 'Initial evaluation' },
  { v: 'follow_up',          l: 'Follow-up' },
  { v: 'chiropractic',       l: 'Chiropractic' },
  { v: 'physical_therapy',   l: 'Physical therapy' },
  { v: 'massage',            l: 'Massage' },
  { v: 'acupuncture',        l: 'Acupuncture' },
  { v: 'imaging',            l: 'Imaging' },
  { v: 'other',              l: 'Other' },
];

const APPT_STATUSES = [
  'scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'no_show', 'cancelled',
];

const statusTag: Record<string, string> = {
  scheduled: 'gold', confirmed: 'gold', checked_in: 'warn',
  in_progress: 'warn', completed: 'good', no_show: 'bad', cancelled: 'soft',
};

export default function Schedule() {
  const { profile } = useAuth();
  const [apts, setApts]         = useState<any[]>([]);
  const [charts, setCharts]     = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // New appointment form
  const [fChartId, setFChartId]       = useState('');
  const [fDate, setFDate]             = useState('');
  const [fTime, setFTime]             = useState('');
  const [fDuration, setFDuration]     = useState('45');
  const [fProvider, setFProvider]     = useState('');
  const [fVisitType, setFVisitType]   = useState('');
  const [fSaving, setFSaving]         = useState(false);
  const [fErr, setFErr]               = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [{ data: a }, { data: c }, { data: p }] = await Promise.all([
      supabase
        .from('appointments')
        .select('*, patient_charts(id, patients(full_name, phone)), provider:profiles!provider_id(full_name)')
        .order('scheduled_at'),
      supabase
        .from('patient_charts')
        .select('id, patients(full_name)')
        .neq('status', 'discharged')
        .neq('status', 'closed')
        .order('updated_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('practice_id', profile?.practice_id ?? '')
        .in('role', ['provider', 'practice_admin']),
    ]);
    setApts(a ?? []);
    setCharts(c ?? []);
    setProviders(p ?? []);
    setLoading(false);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const visible = showPast
    ? apts
    : apts.filter(a => !a.scheduled_at || a.scheduled_at >= todayStr);

  async function updateStatus(apptId: string, status: string) {
    await supabase.from('appointments').update({ status }).eq('id', apptId);
    setApts(prev => prev.map(a => a.id === apptId ? { ...a, status } : a));
  }

  async function handleSendReminder(apt: any) {
    setSendingId(apt.id);
    const phone = apt.patient_charts?.patients?.phone ?? '';
    const name  = apt.patient_charts?.patients?.full_name ?? 'patient';
    const dt    = apt.scheduled_at
      ? new Date(apt.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : 'your upcoming appointment';
    const msg = `Hi ${name}, reminder: appointment on ${dt}.`;
    const { sid, error } = await sendSmsReminder(apt.id, phone, msg);
    if (!error) {
      setApts(prev => prev.map(a =>
        a.id === apt.id
          ? { ...a, reminder_status: 'sent', reminder_sent_at: new Date().toISOString(), twilio_message_sid: sid }
          : a
      ));
    }
    setSendingId(null);
  }

  async function handleAddAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!fChartId)         { setFErr('Select a patient.'); return; }
    if (!fDate || !fTime)  { setFErr('Date and time are required.'); return; }
    setFSaving(true);
    setFErr('');

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        chart_id:        fChartId,
        practice_id:     profile?.practice_id,
        provider_id:     fProvider || null,
        scheduled_at:    `${fDate}T${fTime}:00`,
        duration_minutes: Number(fDuration),
        visit_type:      fVisitType || null,
        status:          'scheduled',
      })
      .select('*, patient_charts(id, patients(full_name, phone)), provider:profiles!provider_id(full_name)')
      .single();

    if (error || !data) {
      setFErr(error?.message ?? 'Failed to create appointment.');
      setFSaving(false);
      return;
    }

    setApts(prev =>
      [...prev, data].sort((a, b) =>
        (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '')
      )
    );
    setFChartId(''); setFDate(''); setFTime('');
    setFDuration('45'); setFProvider(''); setFVisitType('');
    setShowForm(false);
    setFSaving(false);
  }

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Schedule</h1>
          <div className="sub">{visible.length} appointment{visible.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost sm" onClick={() => setShowPast(p => !p)}>
            {showPast ? 'Hide past' : 'Show past'}
          </button>
          <button className="btn oxblood" onClick={() => setShowForm(f => !f)}>
            + New appointment
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16 }}>New appointment</h3>
          <form onSubmit={handleAddAppointment}>
            <div className="row">
              <div>
                <label>Patient / chart *</label>
                <select value={fChartId} onChange={e => setFChartId(e.target.value)}>
                  <option value="">— select patient —</option>
                  {charts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.patients?.full_name ?? c.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Provider</label>
                <select value={fProvider} onChange={e => setFProvider(e.target.value)}>
                  <option value="">— unassigned —</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="row">
              <div>
                <label>Date *</label>
                <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} />
              </div>
              <div>
                <label>Time *</label>
                <input type="time" value={fTime} onChange={e => setFTime(e.target.value)} />
              </div>
            </div>
            <div className="row">
              <div>
                <label>Duration</label>
                <select value={fDuration} onChange={e => setFDuration(e.target.value)}>
                  {[15, 30, 45, 60, 90].map(n => (
                    <option key={n} value={n}>{n} min</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Visit type</label>
                <select value={fVisitType} onChange={e => setFVisitType(e.target.value)}>
                  <option value="">— select —</option>
                  {VISIT_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
            </div>
            {fErr && <div className="err">{fErr}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="submit" disabled={fSaving}>
                {fSaving ? 'Saving…' : 'Create appointment'}
              </button>
              <button type="button" className="btn ghost" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Date &amp; time</th>
              <th>Patient</th>
              <th>Provider</th>
              <th>Type</th>
              <th>Dur.</th>
              <th>Status</th>
              <th>Reminder</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="muted">Loading…</td></tr>}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  {showPast ? 'No appointments.' : 'No upcoming appointments. Use "+ New appointment" to schedule one.'}
                </td>
              </tr>
            )}
            {visible.map(a => {
              const dt = a.scheduled_at
                ? new Date(a.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                : '—';
              const canRemind = ['scheduled', 'confirmed'].includes(a.status ?? '');
              const alreadySent = a.reminder_status === 'sent';
              const isSending = sendingId === a.id;

              return (
                <tr key={a.id}>
                  <td className="small"><b>{dt}</b></td>
                  <td className="small">{a.patient_charts?.patients?.full_name ?? '—'}</td>
                  <td className="small">{a.provider?.full_name ?? <span className="muted">—</span>}</td>
                  <td className="small">{a.visit_type ? a.visit_type.replace(/_/g, ' ') : <span className="muted">—</span>}</td>
                  <td className="small">{a.duration_minutes ? `${a.duration_minutes}m` : '—'}</td>
                  <td>
                    <select
                      value={a.status ?? 'scheduled'}
                      onChange={e => updateStatus(a.id, e.target.value)}
                      style={{ width: 'auto', padding: '4px 8px', fontSize: 12.5, borderRadius: 7 }}
                    >
                      {APPT_STATUSES.map(s => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {alreadySent ? (
                      <div>
                        <span className="tag good tiny">sent</span>
                        {a.twilio_message_sid && (
                          <div className="muted" style={{ fontSize: 11, marginTop: 2, fontFamily: 'monospace' }}>
                            {a.twilio_message_sid}
                          </div>
                        )}
                        {a.reminder_sent_at && (
                          <div className="muted tiny">
                            {new Date(a.reminder_sent_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="muted tiny">{a.reminder_status ?? '—'}</span>
                    )}
                  </td>
                  <td>
                    {(canRemind || alreadySent) && (
                      <button
                        className="btn ghost sm"
                        disabled={isSending}
                        onClick={() => handleSendReminder(a)}
                        style={alreadySent ? { opacity: 0.55, fontSize: 12 } : undefined}
                      >
                        {isSending ? 'Sending…' : alreadySent ? 'Resend' : 'Send reminder'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
