import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';
import { sendSmsReminder } from '../../lib/notifications';

const statusTag: Record<string, string> = {
  in_treatment: 'good', referral_received: 'soft', intake_scheduled: 'gold',
  intake_complete: 'gold', treatment_paused: 'warn', treatment_complete: 'ink',
  discharged: 'soft', records_requested: 'soft', records_sent: 'soft', closed: 'soft',
};

const payerBadge: Record<string, { label: string; cls: string }> = {
  pi_lien:          { label: 'PI Lien',       cls: 'gold' },
  workers_comp:     { label: "Workers' Comp", cls: 'ink'  },
  health_insurance: { label: 'Health Ins',    cls: 'good' },
  pip_medpay:       { label: 'PIP/MedPay',    cls: 'warn' },
  cash:             { label: 'Cash',           cls: 'soft' },
};

const noteStatusTag: Record<string, string> = {
  draft: 'soft', signed: 'good', amended: 'warn', finalized: 'ink',
};

const apptStatusTag: Record<string, string> = {
  scheduled: 'gold', confirmed: 'gold', checked_in: 'warn',
  in_progress: 'warn', completed: 'good', no_show: 'bad', cancelled: 'soft',
};

const APPT_STATUSES = [
  'scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'no_show', 'cancelled',
];

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

export default function ChartDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { profile } = useAuth();

  const [chart, setChart]               = useState<any>(null);
  const [apts, setApts]                 = useState<any[]>([]);
  const [notes, setNotes]               = useState<any[]>([]);
  const [ledger, setLedger]             = useState<any[]>([]);
  const [treatmentPlan, setTreatmentPlan] = useState<any>(null);
  const [providers, setProviders]       = useState<any[]>([]);
  const [tab, setTab]                   = useState('overview');

  // Appointment form
  const [showApptForm, setShowApptForm] = useState(false);
  const [fDate, setFDate]               = useState('');
  const [fTime, setFTime]               = useState('');
  const [fDuration, setFDuration]       = useState('45');
  const [fProvider, setFProvider]       = useState('');
  const [fVisitType, setFVisitType]     = useState('');
  const [fSaving, setFSaving]           = useState(false);
  const [fErr, setFErr]                 = useState('');

  // Reminder state
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Intake complete
  const [markingComplete, setMarkingComplete] = useState(false);

  async function load() {
    const [{ data: c }, { data: a }, { data: n }, { data: l }, { data: tp }, { data: prov }] =
      await Promise.all([
        supabase.from('patient_charts').select('*, patients(*)').eq('id', id!).single(),
        supabase.from('appointments').select('*').eq('chart_id', id!).order('scheduled_at', { ascending: false }),
        supabase.from('visit_notes').select('*, charges(*)').eq('chart_id', id!).order('visit_date', { ascending: false }),
        supabase.from('billing_ledger').select('*').eq('chart_id', id!).order('entry_date', { ascending: false }),
        supabase.from('treatment_plans').select('id, frequency, planned_visits, modalities').eq('chart_id', id!).limit(1),
        supabase.from('profiles').select('id, full_name')
          .eq('practice_id', profile?.practice_id ?? '')
          .in('role', ['provider', 'practice_admin']),
      ]);
    setChart(c);
    setApts(a ?? []);
    setNotes(n ?? []);
    setLedger(l ?? []);
    setTreatmentPlan(tp?.[0] ?? null);
    setProviders(prov ?? []);
  }

  useEffect(() => { load(); }, [id]);

  if (!chart) return <div className="muted" style={{ padding: 40 }}>Loading…</div>;

  const pt    = chart.patients ?? {};
  const payer = payerBadge[chart.payer_type] ?? { label: chart.payer_type ?? '—', cls: 'soft' };

  const totalCharges = notes
    .flatMap((n: any) => n.charges ?? [])
    .reduce((s: number, c: any) => s + Number(c.fee_amount ?? 0) * Number(c.units ?? 1), 0);

  const Tab = ({ id: t, label }: { id: string; label: string }) => (
    <button className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{label}</button>
  );

  async function markIntakeComplete() {
    setMarkingComplete(true);
    const { error } = await supabase
      .from('patient_charts')
      .update({ status: 'intake_complete' })
      .eq('id', id!);
    if (!error) setChart((c: any) => ({ ...c, status: 'intake_complete' }));
    setMarkingComplete(false);
  }

  async function handleAddAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!fDate || !fTime) { setFErr('Date and time are required.'); return; }
    setFSaving(true);
    setFErr('');

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        chart_id:         id,
        practice_id:      profile?.practice_id,
        provider_id:      fProvider || null,
        scheduled_at:     `${fDate}T${fTime}:00`,
        duration_minutes: Number(fDuration),
        visit_type:       fVisitType || null,
        status:           'scheduled',
      })
      .select('*')
      .single();

    if (error || !data) {
      setFErr(error?.message ?? 'Failed to create appointment.');
      setFSaving(false);
      return;
    }

    setApts(prev => [data, ...prev]);
    setFDate(''); setFTime(''); setFDuration('45'); setFProvider(''); setFVisitType('');
    setShowApptForm(false);
    setFSaving(false);
  }

  async function updateApptStatus(apptId: string, status: string) {
    await supabase.from('appointments').update({ status }).eq('id', apptId);
    setApts(prev => prev.map(a => a.id === apptId ? { ...a, status } : a));
  }

  async function handleSendReminder(apt: any) {
    setSendingId(apt.id);
    const phone = pt.phone ?? '';
    const name  = pt.full_name ?? 'patient';
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

  return (
    <>
      {/* Page header */}
      <div className="page-h">
        <div>
          <div className="muted small" style={{ marginBottom: 4, cursor: 'pointer' }}
            onClick={() => nav('/patients')}>← Patients</div>
          <h1>{pt.full_name ?? '—'}</h1>
          <div className="sub">
            {(chart.mechanism_of_injury ?? '').replace(/_/g, ' ')}
            {chart.date_of_injury && ` · injured ${chart.date_of_injury}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`tag ${payer.cls}`}>{payer.label}</span>
          <span className={`tag ${statusTag[chart.status] ?? 'soft'}`}>
            {(chart.status ?? '').replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <Tab id="overview"     label="Overview" />
        <Tab id="appointments" label={`Appointments (${apts.length})`} />
        <Tab id="notes"        label={`Visit notes (${notes.length})`} />
        <Tab id="billing"      label="Billing" />
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          {/* Intake complete callout */}
          {chart.status === 'referral_received' && (
            <div className="flag warn" style={{ marginBottom: 16, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <b>Intake pending</b> — this referral has been received but intake has not been marked complete.
              </div>
              <button
                className="btn sm"
                style={{ background: 'var(--warn)', borderColor: 'var(--warn)', whiteSpace: 'nowrap' }}
                disabled={markingComplete}
                onClick={markIntakeComplete}
              >
                {markingComplete ? 'Saving…' : 'Mark intake complete'}
              </button>
            </div>
          )}

          {/* Patient demographics */}
          <div className="card">
            <h3>Patient</h3>
            <dl className="kv">
              <dt>Name</dt>       <dd>{pt.full_name ?? '—'}</dd>
              <dt>DOB</dt>        <dd>{pt.dob ?? '—'}</dd>
              <dt>Phone</dt>      <dd>{pt.phone ?? '—'}</dd>
              <dt>Email</dt>      <dd>{pt.email ?? '—'}</dd>
              <dt>Address</dt>    <dd>{pt.address ?? '—'}</dd>
              <dt>Health ins.</dt><dd>{pt.health_insurer ?? '—'}</dd>
              {pt.health_policy_number && <><dt>Policy #</dt><dd>{pt.health_policy_number}</dd></>}
              {pt.al_patient_ref && <><dt>AL patient ref</dt><dd><code className="small">{pt.al_patient_ref}</code></dd></>}
            </dl>
          </div>

          {/* Injury block */}
          <div className="card">
            <h3>Injury</h3>
            <dl className="kv">
              <dt>Date of injury</dt>
              <dd>{chart.date_of_injury ?? '—'}</dd>
              <dt>Mechanism</dt>
              <dd>{(chart.mechanism_of_injury ?? '—').replace(/_/g, ' ')}</dd>
              <dt>Body regions</dt>
              <dd>{(chart.body_regions_affected ?? []).join(', ') || '—'}</dd>
              <dt>Description</dt>
              <dd>{chart.injury_description ?? '—'}</dd>
            </dl>
          </div>

          {/* PI Lien payer block */}
          {chart.payer_type === 'pi_lien' && (
            <div className="card">
              <h3>PI Lien</h3>
              <dl className="kv">
                <dt>Referring attorney</dt>
                <dd>{chart.referring_attorney_name ?? '—'}</dd>
                <dt>Law firm</dt>
                <dd>{chart.referring_law_firm ?? '—'}</dd>
                {chart.al_case_ref && (
                  <><dt>AL case ref</dt><dd><code className="small">{chart.al_case_ref}</code></dd></>
                )}
                <dt>Lien on file</dt>
                <dd>
                  {chart.lien_on_file
                    ? <span className="tag good tiny">
                        Yes{chart.lien_amount ? ` — $${Number(chart.lien_amount).toLocaleString()}` : ''}
                      </span>
                    : <span className="tag soft tiny">Not yet</span>}
                </dd>
              </dl>
            </div>
          )}

          {/* Workers' Comp payer block */}
          {chart.payer_type === 'workers_comp' && (
            <div className="card">
              <h3>Workers' Comp</h3>
              <dl className="kv">
                <dt>Claim #</dt>   <dd>{chart.wc_claim_number ?? '—'}</dd>
                <dt>Employer</dt>  <dd>{chart.wc_employer ?? '—'}</dd>
                <dt>Carrier</dt>   <dd>{chart.wc_carrier ?? '—'}</dd>
                <dt>Adjuster</dt>
                <dd>
                  {chart.wc_adjuster_name ?? '—'}
                  {chart.wc_adjuster_phone && ` · ${chart.wc_adjuster_phone}`}
                </dd>
                <dt>Auth status</dt>
                <dd>
                  {chart.wc_auth_status
                    ? <span className={`tag tiny ${chart.wc_auth_status === 'authorized' ? 'good' : chart.wc_auth_status === 'denied' ? 'bad' : 'warn'}`}>
                        {chart.wc_auth_status}
                      </span>
                    : '—'}
                </dd>
              </dl>
            </div>
          )}

          {/* Treatment plan summary */}
          {treatmentPlan && (
            <div className="card">
              <h3>Treatment plan</h3>
              <dl className="kv">
                {treatmentPlan.frequency    && <><dt>Frequency</dt><dd>{treatmentPlan.frequency}</dd></>}
                {treatmentPlan.planned_visits != null && <><dt>Planned visits</dt><dd>{treatmentPlan.planned_visits}</dd></>}
                {treatmentPlan.modalities?.length > 0 && (
                  <><dt>Modalities</dt><dd>{treatmentPlan.modalities.join(', ')}</dd></>
                )}
              </dl>
            </div>
          )}
        </>
      )}

      {/* ── APPOINTMENTS ─────────────────────────────────────────── */}
      {tab === 'appointments' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="muted small">
              {apts.length} appointment{apts.length !== 1 ? 's' : ''}
              {treatmentPlan?.frequency && (
                <span> · Treatment plan: <b>{treatmentPlan.frequency}</b></span>
              )}
            </div>
            <button className="btn sm oxblood" onClick={() => setShowApptForm(f => !f)}>
              + Add appointment
            </button>
          </div>

          {showApptForm && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 14 }}>New appointment</h3>
              <form onSubmit={handleAddAppointment}>
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
                <div>
                  <label>Provider</label>
                  <select value={fProvider} onChange={e => setFProvider(e.target.value)}>
                    <option value="">— unassigned —</option>
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </div>
                {fErr && <div className="err">{fErr}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button type="submit" disabled={fSaving}>
                    {fSaving ? 'Saving…' : 'Create appointment'}
                  </button>
                  <button type="button" className="btn ghost" onClick={() => setShowApptForm(false)}>
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
                  <th>Type</th>
                  <th>Dur.</th>
                  <th>Status</th>
                  <th>Reminder</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {apts.length === 0 && (
                  <tr><td colSpan={6} className="muted">No appointments yet.</td></tr>
                )}
                {apts.map((a: any) => {
                  const canRemind = ['scheduled', 'confirmed'].includes(a.status ?? '');
                  const alreadySent = a.reminder_status === 'sent';
                  const isSending = sendingId === a.id;
                  return (
                    <tr key={a.id}>
                      <td className="small">
                        {a.scheduled_at
                          ? new Date(a.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                          : '—'}
                      </td>
                      <td className="small">{(a.visit_type ?? '—').replace(/_/g, ' ')}</td>
                      <td className="small">{a.duration_minutes ? `${a.duration_minutes}m` : '—'}</td>
                      <td>
                        <select
                          value={a.status ?? 'scheduled'}
                          onChange={e => updateApptStatus(a.id, e.target.value)}
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
                              <div style={{ fontSize: 11, fontFamily: 'monospace', marginTop: 2, color: 'var(--ink-soft)' }}>
                                {a.twilio_message_sid}
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
      )}

      {/* ── VISIT NOTES ──────────────────────────────────────────── */}
      {tab === 'notes' && (
        <>
          {notes.length === 0 && (
            <div className="card"><span className="muted">No visit notes yet.</span></div>
          )}
          {notes.map((n: any) => {
            const charges: any[] = n.charges ?? [];
            const noteTotal = charges.reduce(
              (s: number, c: any) => s + Number(c.fee_amount ?? 0) * Number(c.units ?? 1), 0
            );
            return (
              <div key={n.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <b>{n.visit_date}</b>
                    <span className="muted small" style={{ marginLeft: 10 }}>
                      {(n.visit_type ?? '').replace(/_/g, ' ')}
                    </span>
                    {n.diagnosis_codes?.length > 0 && (
                      <span className="muted small" style={{ marginLeft: 10 }}>
                        {n.diagnosis_codes.join(', ')}
                      </span>
                    )}
                  </div>
                  <span className={`tag tiny ${noteStatusTag[n.status] ?? 'soft'}`}>{n.status}</span>
                </div>

                <dl className="kv" style={{ fontSize: 13.5 }}>
                  {n.subjective  && <><dt>S</dt><dd>{n.subjective}</dd></>}
                  {n.objective   && <><dt>O</dt><dd>{n.objective}</dd></>}
                  {n.assessment  && <><dt>A</dt><dd>{n.assessment}</dd></>}
                  {n.plan        && <><dt>P</dt><dd>{n.plan}</dd></>}
                </dl>

                {charges.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div className="muted small" style={{ marginBottom: 6, fontWeight: 600 }}>CPT charges</div>
                    <table style={{ fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th>Code</th><th>Description</th><th>Units</th>
                          <th style={{ textAlign: 'right' }}>Fee</th><th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {charges.map((c: any) => (
                          <tr key={c.id}>
                            <td><code>{c.cpt_code}</code></td>
                            <td className="small">{c.description ?? '—'}</td>
                            <td className="small">{c.units ?? 1}</td>
                            <td className="small" style={{ textAlign: 'right' }}>
                              ${(Number(c.fee_amount ?? 0) * Number(c.units ?? 1)).toLocaleString()}
                            </td>
                            <td>
                              <span className={`tag tiny ${c.status === 'paid' ? 'good' : c.status === 'billed' ? 'gold' : 'soft'}`}>
                                {c.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={3} />
                          <td className="small" style={{ textAlign: 'right', fontWeight: 600 }}>
                            ${noteTotal.toLocaleString()}
                          </td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {n.status === 'signed' && n.signed_at && (
                  <div className="muted tiny" style={{ marginTop: 10 }}>
                    Signed {new Date(n.signed_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ── BILLING ──────────────────────────────────────────────── */}
      {tab === 'billing' && (
        <>
          <div className="grid three" style={{ marginBottom: 16 }}>
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="muted small">Total billed</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--serif)', marginTop: 4 }}>
                ${Number(chart.total_billed ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="muted small">Total paid</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--serif)', marginTop: 4 }}>
                ${Number(chart.total_paid ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="muted small">Balance</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--serif)', marginTop: 4,
                color: Number(chart.total_balance ?? 0) > 0 ? 'var(--warn)' : 'var(--good)' }}>
                ${Number(chart.total_balance ?? 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Type</th><th>Memo</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 && (
                  <tr><td colSpan={4} className="muted">No ledger entries yet.</td></tr>
                )}
                {ledger.map((e: any) => (
                  <tr key={e.id}>
                    <td className="small">{e.entry_date ?? '—'}</td>
                    <td><span className="tag soft tiny">{(e.entry_type ?? '').replace(/_/g, ' ')}</span></td>
                    <td className="small muted">{e.memo ?? '—'}</td>
                    <td className="small" style={{ textAlign: 'right', fontWeight: 600,
                      color: Number(e.amount) < 0 ? 'var(--good)' : undefined }}>
                      {Number(e.amount) < 0 ? '-' : '+'}${Math.abs(Number(e.amount)).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="scaffold">
              Reduction portal, payments, and lien management — Chunk 4 (billing &amp; discharge).
            </div>
          </div>
        </>
      )}
    </>
  );
}
