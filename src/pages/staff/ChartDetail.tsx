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

const COMMON_CPT = [
  { code: '98940', desc: 'Chiropractic manipulation, 1–2 regions' },
  { code: '98941', desc: 'Chiropractic manipulation, 3–4 regions' },
  { code: '97110', desc: 'Therapeutic exercises' },
  { code: '97012', desc: 'Mechanical traction' },
  { code: '97014', desc: 'Electrical stimulation (unattended)' },
  { code: '97035', desc: 'Ultrasound therapy' },
  { code: '97530', desc: 'Therapeutic activities' },
  { code: '99213', desc: 'Office visit, established patient' },
];

export default function ChartDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { profile } = useAuth();

  const [chart, setChart]                 = useState<any>(null);
  const [apts, setApts]                   = useState<any[]>([]);
  const [notes, setNotes]                 = useState<any[]>([]);
  const [ledger, setLedger]               = useState<any[]>([]);
  const [treatmentPlan, setTreatmentPlan] = useState<any>(null);
  const [providers, setProviders]         = useState<any[]>([]);
  const [tab, setTab]                     = useState('overview');

  // Appointment form
  const [showApptForm, setShowApptForm] = useState(false);
  const [fDate, setFDate]               = useState('');
  const [fTime, setFTime]               = useState('');
  const [fDuration, setFDuration]       = useState('45');
  const [fProvider, setFProvider]       = useState('');
  const [fVisitType, setFVisitType]     = useState('');
  const [fSaving, setFSaving]           = useState(false);
  const [fErr, setFErr]                 = useState('');

  // Reminder + intake
  const [sendingId, setSendingId]           = useState<string | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);

  // Treatment plan form
  const [showTpForm, setShowTpForm]           = useState(false);
  const [tpFrequency, setTpFrequency]         = useState('');
  const [tpPlannedVisits, setTpPlannedVisits] = useState('');
  const [tpModalities, setTpModalities]       = useState('');
  const [tpGoals, setTpGoals]                 = useState('');
  const [tpSaving, setTpSaving]               = useState(false);
  const [tpErr, setTpErr]                     = useState('');

  // Visit note form
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editNoteId, setEditNoteId]     = useState<string | null>(null);
  const [nDate, setNDate]               = useState('');
  const [nApptId, setNApptId]           = useState('');
  const [nSubjective, setNSubjective]   = useState('');
  const [nObjective, setNObjective]     = useState('');
  const [nAssessment, setNAssessment]   = useState('');
  const [nPlan, setNPlan]               = useState('');
  const [nSaving, setNSaving]           = useState(false);
  const [nErr, setNErr]                 = useState('');

  // Signing
  const [signingId, setSigningId] = useState<string | null>(null);

  // CPT capture
  const [cptNoteId, setCptNoteId] = useState<string | null>(null);
  const [cptCode, setCptCode]     = useState('');
  const [cptDesc, setCptDesc]     = useState('');
  const [cptAmount, setCptAmount] = useState('');
  const [cptUnits, setCptUnits]   = useState('1');
  const [cptSaving, setCptSaving] = useState(false);
  const [cptErr, setCptErr]       = useState('');

  // Role helpers
  const role             = profile?.role ?? '';
  const canWriteClinical = ['provider', 'practice_admin', 'platform_admin'].includes(role);
  const isAdminRole      = ['practice_admin', 'platform_admin'].includes(role);

  const canEditNote = (n: any) =>
    canWriteClinical && n.status === 'draft' &&
    (n.provider_id === profile?.id || isAdminRole);

  const canSignNote = (n: any) =>
    canWriteClinical && n.status === 'draft' &&
    (n.provider_id === profile?.id || isAdminRole);

  async function load() {
    const [{ data: c }, { data: a }, { data: n }, { data: l }, { data: tp }, { data: prov }] =
      await Promise.all([
        supabase.from('patient_charts').select('*, patients(*)').eq('id', id!).single(),
        supabase.from('appointments').select('*').eq('chart_id', id!).order('scheduled_at', { ascending: false }),
        supabase.from('visit_notes')
          .select('*, charges(*), provider:profiles!provider_id(full_name)')
          .eq('chart_id', id!)
          .order('visit_date', { ascending: false }),
        supabase.from('billing_ledger').select('*').eq('chart_id', id!).order('entry_date', { ascending: false }),
        supabase.from('treatment_plans')
          .select('id, frequency, planned_visits, modalities, goals, status, created_by')
          .eq('chart_id', id!)
          .order('created_at', { ascending: false })
          .limit(1),
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

  const signedCount  = notes.filter((n: any) => n.status === 'signed').length;
  const totalCharges = notes
    .flatMap((n: any) => n.charges ?? [])
    .reduce((s: number, c: any) => s + Number(c.fee_amount ?? 0) * Number(c.units ?? 1), 0);

  const Tab = ({ id: t, label }: { id: string; label: string }) => (
    <button className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{label}</button>
  );

  // ── Appointment handlers ───────────────────────────────────────────────────

  async function markIntakeComplete() {
    setMarkingComplete(true);
    const { error } = await supabase.from('patient_charts').update({ status: 'intake_complete' }).eq('id', id!);
    if (!error) setChart((c: any) => ({ ...c, status: 'intake_complete' }));
    setMarkingComplete(false);
  }

  async function handleAddAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!fDate || !fTime) { setFErr('Date and time are required.'); return; }
    setFSaving(true); setFErr('');
    const { data, error } = await supabase.from('appointments')
      .insert({
        chart_id: id, practice_id: profile?.practice_id,
        provider_id: fProvider || null,
        scheduled_at: `${fDate}T${fTime}:00`,
        duration_minutes: Number(fDuration),
        visit_type: fVisitType || null,
        status: 'scheduled',
      })
      .select('*').single();
    if (error || !data) { setFErr(error?.message ?? 'Failed.'); setFSaving(false); return; }
    setApts(prev => [data, ...prev]);
    setFDate(''); setFTime(''); setFDuration('45'); setFProvider(''); setFVisitType('');
    setShowApptForm(false); setFSaving(false);
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
    const { sid, error } = await sendSmsReminder(apt.id, phone, `Hi ${name}, reminder: appointment on ${dt}.`);
    if (!error) {
      setApts(prev => prev.map(a =>
        a.id === apt.id
          ? { ...a, reminder_status: 'sent', reminder_sent_at: new Date().toISOString(), twilio_message_sid: sid }
          : a
      ));
    }
    setSendingId(null);
  }

  // ── Treatment plan handlers ────────────────────────────────────────────────

  function openEditTp() {
    setTpFrequency(treatmentPlan?.frequency ?? '');
    setTpPlannedVisits(treatmentPlan?.planned_visits?.toString() ?? '');
    setTpModalities((treatmentPlan?.modalities ?? []).join(', '));
    setTpGoals(treatmentPlan?.goals ?? '');
    setTpErr('');
    setShowTpForm(true);
  }

  async function handleSaveTreatmentPlan(e: React.FormEvent) {
    e.preventDefault();
    setTpSaving(true); setTpErr('');
    const payload = {
      chart_id:       id,
      created_by:     profile?.id,
      frequency:      tpFrequency || null,
      planned_visits: tpPlannedVisits ? Number(tpPlannedVisits) : null,
      modalities:     tpModalities ? tpModalities.split(',').map(s => s.trim()).filter(Boolean) : [],
      goals:          tpGoals || null,
      status:         'active',
    };
    const { error } = treatmentPlan?.id
      ? await supabase.from('treatment_plans').update(payload).eq('id', treatmentPlan.id)
      : await supabase.from('treatment_plans').insert(payload);
    if (error) { setTpErr(error.message); setTpSaving(false); return; }
    await load();
    setShowTpForm(false); setTpSaving(false);
  }

  // ── Visit note handlers ────────────────────────────────────────────────────

  function openNewNote() {
    setEditNoteId(null);
    setNDate(new Date().toISOString().slice(0, 10));
    setNApptId(''); setNSubjective(''); setNObjective('');
    setNAssessment(''); setNPlan(''); setNErr('');
    setShowNoteForm(true);
  }

  function openEditNote(note: any) {
    setEditNoteId(note.id);
    setNDate(note.visit_date ?? '');
    setNApptId(note.appointment_id ?? '');
    setNSubjective(note.subjective ?? '');
    setNObjective(note.objective ?? '');
    setNAssessment(note.assessment ?? '');
    setNPlan(note.plan ?? '');
    setNErr('');
    setShowNoteForm(true);
  }

  function cancelNoteForm() {
    setShowNoteForm(false);
    setEditNoteId(null);
  }

  async function handleSaveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!nDate) { setNErr('Visit date is required.'); return; }
    setNSaving(true); setNErr('');
    const sel = '*, charges(*), provider:profiles!provider_id(full_name)';
    let error: any, data: any;
    if (editNoteId) {
      ({ error, data } = await supabase.from('visit_notes')
        .update({ visit_date: nDate, appointment_id: nApptId || null,
          subjective: nSubjective || null, objective: nObjective || null,
          assessment: nAssessment || null, plan: nPlan || null })
        .eq('id', editNoteId).select(sel).single());
    } else {
      ({ error, data } = await supabase.from('visit_notes')
        .insert({ chart_id: id, provider_id: profile?.id, visit_date: nDate,
          appointment_id: nApptId || null, subjective: nSubjective || null,
          objective: nObjective || null, assessment: nAssessment || null,
          plan: nPlan || null, status: 'draft' })
        .select(sel).single());
    }
    if (error || !data) { setNErr(error?.message ?? 'Failed to save note.'); setNSaving(false); return; }
    setNotes(prev => editNoteId
      ? prev.map(n => n.id === editNoteId ? data : n)
      : [data, ...prev]);
    cancelNoteForm(); setNSaving(false);
  }

  async function handleSignNote(noteId: string) {
    setSigningId(noteId);
    const { data, error } = await supabase.from('visit_notes')
      .update({ status: 'signed', signed_at: new Date().toISOString(), signed_by: profile?.id })
      .eq('id', noteId)
      .select('*, charges(*), provider:profiles!provider_id(full_name)')
      .single();
    if (!error && data) setNotes(prev => prev.map(n => n.id === noteId ? data : n));
    setSigningId(null);
  }

  // ── CPT handlers ──────────────────────────────────────────────────────────

  function openCptForm(noteId: string) {
    setCptNoteId(noteId);
    setCptCode(''); setCptDesc(''); setCptAmount(''); setCptUnits('1'); setCptErr('');
  }

  async function handleAddCpt(e: React.FormEvent) {
    e.preventDefault();
    if (!cptCode || !cptAmount) { setCptErr('CPT code and fee are required.'); return; }
    setCptSaving(true); setCptErr('');
    const { data, error } = await supabase.from('charges')
      .insert({
        visit_note_id: cptNoteId,
        chart_id:      id,
        cpt_code:      cptCode.trim(),
        description:   cptDesc || null,
        units:         Number(cptUnits) || 1,
        fee_amount:    Number(cptAmount),
        status:        'pending',
      })
      .select('*').single();
    if (error || !data) { setCptErr(error?.message ?? 'Failed to save charge.'); setCptSaving(false); return; }
    setNotes(prev => prev.map(n =>
      n.id === cptNoteId ? { ...n, charges: [...(n.charges ?? []), data] } : n
    ));
    setCptNoteId(null); setCptSaving(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
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

      <div className="tabs">
        <Tab id="overview"     label="Overview" />
        <Tab id="treatment"    label="Treatment" />
        <Tab id="appointments" label={`Appointments (${apts.length})`} />
        <Tab id="notes"        label={`Visit notes (${notes.length})`} />
        <Tab id="billing"      label="Billing" />
      </div>

      {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          {chart.status === 'referral_received' && (
            <div className="flag warn" style={{ marginBottom: 16, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <b>Intake pending</b> — this referral has been received but intake has not been marked complete.
              </div>
              <button className="btn sm"
                style={{ background: 'var(--warn)', borderColor: 'var(--warn)', whiteSpace: 'nowrap' }}
                disabled={markingComplete} onClick={markIntakeComplete}>
                {markingComplete ? 'Saving…' : 'Mark intake complete'}
              </button>
            </div>
          )}

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

          <div className="card">
            <h3>Injury</h3>
            <dl className="kv">
              <dt>Date of injury</dt><dd>{chart.date_of_injury ?? '—'}</dd>
              <dt>Mechanism</dt>     <dd>{(chart.mechanism_of_injury ?? '—').replace(/_/g, ' ')}</dd>
              <dt>Body regions</dt>  <dd>{(chart.body_regions_affected ?? []).join(', ') || '—'}</dd>
              <dt>Description</dt>   <dd>{chart.injury_description ?? '—'}</dd>
            </dl>
          </div>

          {chart.payer_type === 'pi_lien' && (
            <div className="card">
              <h3>PI Lien</h3>
              <dl className="kv">
                <dt>Referring attorney</dt><dd>{chart.referring_attorney_name ?? '—'}</dd>
                <dt>Law firm</dt>          <dd>{chart.referring_law_firm ?? '—'}</dd>
                {chart.al_case_ref && <><dt>AL case ref</dt><dd><code className="small">{chart.al_case_ref}</code></dd></>}
                <dt>Lien on file</dt>
                <dd>
                  {chart.lien_on_file
                    ? <span className="tag good tiny">Yes{chart.lien_amount ? ` — $${Number(chart.lien_amount).toLocaleString()}` : ''}</span>
                    : <span className="tag soft tiny">Not yet</span>}
                </dd>
              </dl>
            </div>
          )}

          {chart.payer_type === 'workers_comp' && (
            <div className="card">
              <h3>Workers' Comp</h3>
              <dl className="kv">
                <dt>Claim #</dt>  <dd>{chart.wc_claim_number ?? '—'}</dd>
                <dt>Employer</dt> <dd>{chart.wc_employer ?? '—'}</dd>
                <dt>Carrier</dt>  <dd>{chart.wc_carrier ?? '—'}</dd>
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

          {treatmentPlan && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <h3>Treatment plan</h3>
                {canWriteClinical && (
                  <button className="btn ghost sm" onClick={() => { setTab('treatment'); openEditTp(); }}>Edit</button>
                )}
              </div>
              <dl className="kv">
                {treatmentPlan.frequency && <><dt>Frequency</dt><dd>{treatmentPlan.frequency}</dd></>}
                {treatmentPlan.planned_visits != null && <><dt>Planned visits</dt><dd>{treatmentPlan.planned_visits}</dd></>}
                {treatmentPlan.modalities?.length > 0 && <><dt>Modalities</dt><dd>{treatmentPlan.modalities.join(', ')}</dd></>}
                {treatmentPlan.goals && <><dt>Goals</dt><dd>{treatmentPlan.goals}</dd></>}
                <dt>Progress</dt>
                <dd>
                  <b>{signedCount}</b> visit{signedCount !== 1 ? 's' : ''} completed
                  {treatmentPlan.planned_visits ? ` of ${treatmentPlan.planned_visits}` : ''}
                </dd>
              </dl>
            </div>
          )}
        </>
      )}

      {/* ── TREATMENT ─────────────────────────────────────────────────────── */}
      {tab === 'treatment' && (
        <>
          <div className="card">
            <h3 style={{ marginBottom: 10 }}>Visit progress</h3>
            <div style={{ fontSize: 15 }}>
              <b>{signedCount}</b> signed visit{signedCount !== 1 ? 's' : ''}
              {treatmentPlan?.planned_visits
                ? <span className="muted"> of {treatmentPlan.planned_visits} planned</span>
                : <span className="muted"> · no planned visit count set</span>}
            </div>
            {treatmentPlan?.planned_visits && (
              <div style={{ marginTop: 10, background: 'var(--paper-2)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: 'var(--oxblood)',
                  width: `${Math.min(100, Math.round((signedCount / treatmentPlan.planned_visits) * 100))}%`,
                  borderRadius: 6, transition: 'width .3s',
                }} />
              </div>
            )}
          </div>

          {treatmentPlan ? (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <h3>Active plan</h3>
                {canWriteClinical && !showTpForm && (
                  <button className="btn ghost sm" onClick={openEditTp}>Edit plan</button>
                )}
              </div>
              <dl className="kv">
                {treatmentPlan.frequency && <><dt>Frequency</dt><dd>{treatmentPlan.frequency}</dd></>}
                {treatmentPlan.planned_visits != null && <><dt>Planned visits</dt><dd>{treatmentPlan.planned_visits}</dd></>}
                {treatmentPlan.modalities?.length > 0 && <><dt>Modalities</dt><dd>{treatmentPlan.modalities.join(', ')}</dd></>}
                {treatmentPlan.goals && <><dt>Goals</dt><dd>{treatmentPlan.goals}</dd></>}
              </dl>
            </div>
          ) : (
            <div className="card">
              <div className="muted small" style={{ marginBottom: canWriteClinical && !showTpForm ? 12 : 0 }}>
                No treatment plan yet.
              </div>
              {canWriteClinical && !showTpForm && (
                <button className="btn sm oxblood" onClick={openEditTp}>+ Create treatment plan</button>
              )}
            </div>
          )}

          {showTpForm && canWriteClinical && (
            <div className="card">
              <h3 style={{ marginBottom: 14 }}>{treatmentPlan ? 'Edit' : 'New'} treatment plan</h3>
              <form onSubmit={handleSaveTreatmentPlan}>
                <div className="row">
                  <div>
                    <label>Frequency</label>
                    <input type="text" placeholder="e.g. 3x/week" value={tpFrequency}
                      onChange={e => setTpFrequency(e.target.value)} />
                  </div>
                  <div>
                    <label>Planned visits</label>
                    <input type="number" min="1" placeholder="24" value={tpPlannedVisits}
                      onChange={e => setTpPlannedVisits(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label>Modalities <span className="muted" style={{ fontWeight: 400 }}>(comma-separated)</span></label>
                  <input type="text" placeholder="Chiropractic, Physical therapy, Massage"
                    value={tpModalities} onChange={e => setTpModalities(e.target.value)} />
                </div>
                <div>
                  <label>Goals</label>
                  <textarea rows={3} style={{ resize: 'vertical' }}
                    placeholder="Treatment goals and clinical objectives…"
                    value={tpGoals} onChange={e => setTpGoals(e.target.value)} />
                </div>
                {tpErr && <div className="err">{tpErr}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button type="submit" disabled={tpSaving}>{tpSaving ? 'Saving…' : 'Save plan'}</button>
                  <button type="button" className="btn ghost" onClick={() => setShowTpForm(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {/* ── APPOINTMENTS ──────────────────────────────────────────────────── */}
      {tab === 'appointments' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="muted small">
              {apts.length} appointment{apts.length !== 1 ? 's' : ''}
              {treatmentPlan?.frequency && <span> · Treatment plan: <b>{treatmentPlan.frequency}</b></span>}
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
                      {[15, 30, 45, 60, 90].map(n => <option key={n} value={n}>{n} min</option>)}
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
                    {providers.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
                {fErr && <div className="err">{fErr}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button type="submit" disabled={fSaving}>{fSaving ? 'Saving…' : 'Create appointment'}</button>
                  <button type="button" className="btn ghost" onClick={() => setShowApptForm(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table>
              <thead>
                <tr>
                  <th>Date &amp; time</th><th>Type</th><th>Dur.</th>
                  <th>Status</th><th>Reminder</th><th></th>
                </tr>
              </thead>
              <tbody>
                {apts.length === 0 && <tr><td colSpan={6} className="muted">No appointments yet.</td></tr>}
                {apts.map((a: any) => {
                  const canRemind  = ['scheduled', 'confirmed'].includes(a.status ?? '');
                  const alreadySent = a.reminder_status === 'sent';
                  const isSending  = sendingId === a.id;
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
                        <select value={a.status ?? 'scheduled'}
                          onChange={e => updateApptStatus(a.id, e.target.value)}
                          style={{ width: 'auto', padding: '4px 8px', fontSize: 12.5, borderRadius: 7 }}>
                          {APPT_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
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
                          <button className="btn ghost sm" disabled={isSending}
                            onClick={() => handleSendReminder(a)}
                            style={alreadySent ? { opacity: 0.55, fontSize: 12 } : undefined}>
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

      {/* ── VISIT NOTES ───────────────────────────────────────────────────── */}
      {tab === 'notes' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="muted small">
              {notes.length} note{notes.length !== 1 ? 's' : ''} · {signedCount} signed
            </div>
            {canWriteClinical && (
              <button className="btn sm oxblood" onClick={openNewNote}>+ New note</button>
            )}
          </div>

          {showNoteForm && canWriteClinical && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 14 }}>{editNoteId ? 'Edit SOAP note' : 'New SOAP note'}</h3>
              <form onSubmit={handleSaveNote}>
                <div className="row">
                  <div>
                    <label>Visit date *</label>
                    <input type="date" value={nDate} onChange={e => setNDate(e.target.value)} required />
                  </div>
                  <div>
                    <label>Linked appointment</label>
                    <select value={nApptId} onChange={e => setNApptId(e.target.value)}>
                      <option value="">— none —</option>
                      {apts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.scheduled_at
                            ? new Date(a.scheduled_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                            : 'Unknown date'}
                          {a.visit_type ? ` · ${a.visit_type.replace(/_/g, ' ')}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label>Subjective</label>
                  <textarea rows={3} style={{ resize: 'vertical' }}
                    placeholder="Patient-reported complaints, pain level, history of present illness…"
                    value={nSubjective} onChange={e => setNSubjective(e.target.value)} />
                </div>
                <div>
                  <label>Objective</label>
                  <textarea rows={3} style={{ resize: 'vertical' }}
                    placeholder="Physical examination findings, vital signs, range of motion…"
                    value={nObjective} onChange={e => setNObjective(e.target.value)} />
                </div>
                <div>
                  <label>Assessment</label>
                  <textarea rows={3} style={{ resize: 'vertical' }}
                    placeholder="Clinical impression, diagnosis, response to treatment…"
                    value={nAssessment} onChange={e => setNAssessment(e.target.value)} />
                </div>
                <div>
                  <label>Plan</label>
                  <textarea rows={3} style={{ resize: 'vertical' }}
                    placeholder="Treatment performed, home exercise program, follow-up schedule…"
                    value={nPlan} onChange={e => setNPlan(e.target.value)} />
                </div>
                {nErr && <div className="err">{nErr}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button type="submit" disabled={nSaving}>
                    {nSaving ? 'Saving…' : editNoteId ? 'Save changes' : 'Save draft'}
                  </button>
                  <button type="button" className="btn ghost" onClick={cancelNoteForm}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {notes.length === 0 && !showNoteForm && (
            <div className="card"><span className="muted">No visit notes yet.</span></div>
          )}

          {notes.map((n: any) => {
            const charges: any[]  = n.charges ?? [];
            const noteTotal       = charges.reduce((s: number, c: any) => s + Number(c.fee_amount ?? 0) * Number(c.units ?? 1), 0);
            const linkedAppt      = apts.find((a: any) => a.id === n.appointment_id);
            const providerName    = n.provider?.full_name ?? '—';
            const isSigned        = n.status === 'signed';
            const isSigning       = signingId === n.id;
            const showCpt         = cptNoteId === n.id;

            return (
              <div key={n.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <b>{n.visit_date}</b>
                    <span className="muted small" style={{ marginLeft: 10 }}>{providerName}</span>
                    {linkedAppt && (
                      <span className="muted small" style={{ marginLeft: 10 }}>
                        · {linkedAppt.visit_type ? linkedAppt.visit_type.replace(/_/g, ' ') : 'Appt.'}
                        {linkedAppt.scheduled_at
                          ? ` ${new Date(linkedAppt.scheduled_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                          : ''}
                      </span>
                    )}
                    {n.diagnosis_codes?.length > 0 && (
                      <span className="muted small" style={{ marginLeft: 10 }}>{n.diagnosis_codes.join(', ')}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
                    <span className={`tag tiny ${noteStatusTag[n.status] ?? 'soft'}`}>{n.status}</span>
                    {canEditNote(n) && (
                      <button className="btn ghost sm" style={{ fontSize: 12 }} onClick={() => openEditNote(n)}>
                        Edit
                      </button>
                    )}
                    {canSignNote(n) && (
                      <button
                        className="btn sm"
                        style={{ background: 'var(--good)', borderColor: 'var(--good)', fontSize: 12 }}
                        disabled={isSigning}
                        onClick={() => handleSignNote(n.id)}>
                        {isSigning ? 'Signing…' : 'Sign note'}
                      </button>
                    )}
                  </div>
                </div>

                <dl className="kv" style={{ fontSize: 13.5 }}>
                  {n.subjective  && <><dt>S</dt><dd>{n.subjective}</dd></>}
                  {n.objective   && <><dt>O</dt><dd>{n.objective}</dd></>}
                  {n.assessment  && <><dt>A</dt><dd>{n.assessment}</dd></>}
                  {n.plan        && <><dt>P</dt><dd>{n.plan}</dd></>}
                </dl>

                {isSigned && n.signed_at && (
                  <div className="muted tiny" style={{ marginTop: 8 }}>
                    Signed {new Date(n.signed_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                )}

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

                {isSigned && canWriteClinical && (
                  <div style={{ marginTop: 12 }}>
                    {!showCpt ? (
                      <button className="btn ghost sm" style={{ fontSize: 12 }} onClick={() => openCptForm(n.id)}>
                        + Add CPT charge
                      </button>
                    ) : (
                      <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '14px 16px', background: 'var(--paper)' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Add CPT charge</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                          {COMMON_CPT.map(p => (
                            <button key={p.code} type="button" className="btn ghost sm"
                              style={{ fontSize: 11.5, padding: '3px 9px' }}
                              onClick={() => { setCptCode(p.code); setCptDesc(p.desc); }}>
                              {p.code}
                            </button>
                          ))}
                        </div>
                        <form onSubmit={handleAddCpt}>
                          <div className="row">
                            <div>
                              <label>CPT code *</label>
                              <input type="text" placeholder="98940" value={cptCode}
                                onChange={e => setCptCode(e.target.value)} />
                            </div>
                            <div>
                              <label>Units</label>
                              <input type="number" min="1" value={cptUnits}
                                onChange={e => setCptUnits(e.target.value)} />
                            </div>
                          </div>
                          <div>
                            <label>Description</label>
                            <input type="text" placeholder="Chiropractic manipulation…" value={cptDesc}
                              onChange={e => setCptDesc(e.target.value)} />
                          </div>
                          <div>
                            <label>Fee amount *</label>
                            <input type="number" min="0" step="0.01" placeholder="150.00" value={cptAmount}
                              onChange={e => setCptAmount(e.target.value)} />
                          </div>
                          {cptErr && <div className="err">{cptErr}</div>}
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button type="submit" disabled={cptSaving} style={{ fontSize: 13, padding: '7px 14px' }}>
                              {cptSaving ? 'Saving…' : 'Add charge'}
                            </button>
                            <button type="button" className="btn ghost sm" style={{ fontSize: 13 }}
                              onClick={() => setCptNoteId(null)}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ── BILLING ───────────────────────────────────────────────────────── */}
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
                {ledger.length === 0 && <tr><td colSpan={4} className="muted">No ledger entries yet.</td></tr>}
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
