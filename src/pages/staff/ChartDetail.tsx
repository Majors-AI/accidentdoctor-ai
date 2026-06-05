import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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

function computeChartFinancials(charges: any[], ledger: any[]) {
  const allCharges = charges.map((c: any) => ({ ...c, visitDate: c.visit_notes?.visit_date }));
  const billedTotal = allCharges
    .filter((c: any) => ['billed', 'paid', 'adjusted', 'written_off'].includes(c.status))
    .reduce((s: number, c: any) => s + Number(c.fee_amount) * Number(c.units ?? 1), 0);
  const pendingTotal = allCharges
    .filter((c: any) => c.status === 'pending')
    .reduce((s: number, c: any) => s + Number(c.fee_amount) * Number(c.units ?? 1), 0);
  const paidTotal = ledger
    .filter((e: any) => Number(e.amount) < 0 && e.entry_type === 'payment')
    .reduce((s: number, e: any) => s + Math.abs(Number(e.amount)), 0);
  const reductionTotal = ledger
    .filter((e: any) => Number(e.amount) < 0 && e.entry_type === 'lien_reduction')
    .reduce((s: number, e: any) => s + Math.abs(Number(e.amount)), 0);
  const balance = billedTotal - paidTotal - reductionTotal;
  return { allCharges, billedTotal, pendingTotal, paidTotal, reductionTotal, balance };
}

function firmSharingActive(chart: any): boolean {
  return !!(chart?.consent_share_with_firm && !chart?.consent_revoked_at);
}

export default function ChartDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();

  const [chart, setChart]                       = useState<any>(null);
  const [apts, setApts]                         = useState<any[]>([]);
  const [notes, setNotes]                       = useState<any[]>([]);
  const [ledger, setLedger]                     = useState<any[]>([]);
  const [treatmentPlan, setTreatmentPlan]       = useState<any>(null);
  const [providers, setProviders]               = useState<any[]>([]);
  const [dischargePackage, setDischargePackage] = useState<any>(null);
  const [charges, setCharges]                   = useState<any[]>([]);
  const [tab, setTab]                           = useState(searchParams.get('tab') ?? 'overview');

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

  // Billing
  const [reductions, setReductions]        = useState<any[]>([]);
  const [showPayForm, setShowPayForm]       = useState(false);
  const [pyAmount, setPyAmount]             = useState('');
  const [pyDate, setPyDate]                 = useState('');
  const [pyMethod, setPyMethod]             = useState('cash');
  const [pyMemo, setPyMemo]                 = useState('');
  const [pySaving, setPySaving]             = useState(false);
  const [pyErr, setPyErr]                   = useState('');
  const [showRedForm, setShowRedForm]       = useState(false);
  const [rdAttorney, setRdAttorney]         = useState('');
  const [rdFirm, setRdFirm]                 = useState('');
  const [rdRequestedTo, setRdRequestedTo]   = useState('');
  const [rdNotes, setRdNotes]               = useState('');
  const [rdSaving, setRdSaving]             = useState(false);
  const [rdErr, setRdErr]                   = useState('');
  const [approvingId, setApprovingId]       = useState<string | null>(null);
  const [decliningId, setDecliningId]       = useState<string | null>(null);

  // Discharge
  const [showDischForm, setShowDischForm] = useState(false);
  const [dxSummary, setDxSummary]         = useState('');
  const [txSummary, setTxSummary]         = useState('');
  const [dischSaving, setDischSaving]     = useState(false);
  const [dischErr, setDischErr]           = useState('');

  // Consent
  const [consentSaving, setConsentSaving] = useState(false);

  // Role helpers
  const role             = profile?.role ?? '';
  const canWriteClinical = ['provider', 'practice_admin', 'platform_admin'].includes(role);
  const isAdminRole      = ['practice_admin', 'platform_admin'].includes(role);
  const canBillingWrite  = ['billing_staff', 'practice_admin', 'platform_admin'].includes(role);
  const canApproveRed    = ['practice_admin', 'platform_admin'].includes(role);

  const canEditNote = (n: any) =>
    canWriteClinical && n.status === 'draft' &&
    (n.provider_id === profile?.id || isAdminRole);

  const canSignNote = (n: any) =>
    canWriteClinical && n.status === 'draft' &&
    (n.provider_id === profile?.id || isAdminRole);

  async function load() {
    const [{ data: c }, { data: a }, { data: n }, { data: l }, { data: tp }, { data: prov }, { data: reds }, { data: dp }, { data: ch }] =
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
        supabase.from('reduction_requests')
          .select('*, reviewer:profiles!reviewed_by(full_name), reduction_audit_log(*, performer:profiles!performed_by(full_name))')
          .eq('chart_id', id!)
          .order('created_at', { ascending: false }),
        supabase.from('discharge_packages')
          .select('*')
          .eq('chart_id', id!)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase.from('charges').select('*, visit_notes(visit_date)').eq('chart_id', id!).order('created_at', { ascending: false }),
      ]);
    setChart(c);
    setApts(a ?? []);
    setNotes(n ?? []);
    setLedger(l ?? []);
    setTreatmentPlan(tp?.[0] ?? null);
    setProviders(prov ?? []);
    setReductions(reds ?? []);
    setDischargePackage(dp?.[0] ?? null);
    setCharges(ch ?? []);
  }

  useEffect(() => { load(); }, [id]);

  if (!chart) return <div className="muted" style={{ padding: 40 }}>Loading…</div>;

  const pt    = chart.patients ?? {};
  const payer = payerBadge[chart.payer_type] ?? { label: chart.payer_type ?? '—', cls: 'soft' };

  const signedCount  = notes.filter((n: any) => n.status === 'signed').length;
  const totalCharges = notes
    .flatMap((n: any) => n.charges ?? [])
    .reduce((s: number, c: any) => s + Number(c.fee_amount ?? 0) * Number(c.units ?? 1), 0);

  const { allCharges, billedTotal, pendingTotal, paidTotal, balance } = computeChartFinancials(charges, ledger);

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
    await load();
    setCptNoteId(null); setCptSaving(false);
  }

  // ── Billing handlers ──────────────────────────────────────────────────────

  async function markChargeBilled(charge: any) {
    const fee = Number(charge.fee_amount) * Number(charge.units ?? 1);
    const { billedTotal: curBilled, balance: curBalance } = computeChartFinancials(charges, ledger);
    await supabase.from('charges').update({ status: 'billed' }).eq('id', charge.id);
    await supabase.from('billing_ledger').insert({
      chart_id:       id,
      practice_id:    profile?.practice_id,
      entry_type:     'charge',
      amount:         fee,
      reference_id:   charge.id,
      reference_type: 'charge',
      memo:           `CPT ${charge.cpt_code}${charge.description ? ' — ' + charge.description : ''}`,
      created_by:     profile?.id,
    });
    await supabase.from('patient_charts').update({
      total_billed:  curBilled + fee,
      total_balance: curBalance + fee,
    }).eq('id', id!);
    await load();
  }

  async function markAllPendingBilled() {
    const { allCharges: cur, billedTotal: curBilled, balance: curBalance } = computeChartFinancials(charges, ledger);
    const pending = cur.filter((c: any) => c.status === 'pending');
    if (!pending.length) return;
    const ids = pending.map((c: any) => c.id);
    const tot = pending.reduce((s: number, c: any) => s + Number(c.fee_amount) * Number(c.units ?? 1), 0);
    await supabase.from('charges').update({ status: 'billed' }).in('id', ids);
    await supabase.from('billing_ledger').insert(
      pending.map((c: any) => ({
        chart_id:       id,
        practice_id:    profile?.practice_id,
        entry_type:     'charge',
        amount:         Number(c.fee_amount) * Number(c.units ?? 1),
        reference_id:   c.id,
        reference_type: 'charge',
        memo:           `CPT ${c.cpt_code}${c.description ? ' — ' + c.description : ''}`,
        created_by:     profile?.id,
      }))
    );
    await supabase.from('patient_charts').update({
      total_billed:  curBilled + tot,
      total_balance: curBalance + tot,
    }).eq('id', id!);
    await load();
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!pyAmount || !pyDate) { setPyErr('Amount and date are required.'); return; }
    const amt = Number(pyAmount);
    if (amt <= 0) { setPyErr('Amount must be positive.'); return; }
    setPySaving(true); setPyErr('');
    await supabase.from('billing_ledger').insert({
      chart_id:       id,
      practice_id:    profile?.practice_id,
      entry_date:     pyDate,
      entry_type:     'payment',
      amount:         -amt,
      reference_type: 'payment',
      memo:           pyMemo || `Payment via ${pyMethod}`,
      created_by:     profile?.id,
    });
    const { paidTotal: curPaid, balance: curBalance } = computeChartFinancials(charges, ledger);
    await supabase.from('patient_charts').update({
      total_paid:    curPaid + amt,
      total_balance: curBalance - amt,
    }).eq('id', id!);
    setPyAmount(''); setPyDate(''); setPyMethod('cash'); setPyMemo('');
    setShowPayForm(false); setPySaving(false);
    await load();
  }

  async function handleCreateReduction(e: React.FormEvent) {
    e.preventDefault();
    if (!rdRequestedTo) { setRdErr('Requested settlement amount is required.'); return; }
    const reqTo = Number(rdRequestedTo);
    if (reqTo < 0) { setRdErr('Amount must be ≥ 0.'); return; }
    setRdSaving(true); setRdErr('');
    const snapshot = billedTotal || Number(chart.total_billed ?? 0);
    const { data: red, error } = await supabase.from('reduction_requests')
      .insert({
        chart_id:               id,
        practice_id:            profile?.practice_id,
        requesting_attorney:    rdAttorney || null,
        requesting_firm:        rdFirm || null,
        total_billed:           snapshot,
        reduction_requested_to: reqTo,
        notes:                  rdNotes || null,
        status:                 'pending',
      })
      .select('*')
      .single();
    if (error || !red) { setRdErr(error?.message ?? 'Failed.'); setRdSaving(false); return; }
    await supabase.from('reduction_audit_log').insert({
      reduction_id:   red.id,
      action:         'submitted',
      performed_by:   profile?.id,
      new_status:     'pending',
      amount_at_time: reqTo,
      notes:          rdNotes || null,
    });
    setRdAttorney(''); setRdFirm(''); setRdRequestedTo(''); setRdNotes('');
    setShowRedForm(false); setRdSaving(false);
    await load();
  }

  async function handleApproveReduction(red: any) {
    setApprovingId(red.id);
    const reductionAmt = Math.max(0, Number(red.total_billed) - Number(red.reduction_requested_to));
    const { balance: curBalance } = computeChartFinancials(charges, ledger);
    await supabase.from('reduction_requests').update({
      status:      'approved',
      reviewed_by: profile?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', red.id);
    if (reductionAmt > 0) {
      await supabase.from('billing_ledger').insert({
        chart_id:       id,
        practice_id:    profile?.practice_id,
        entry_type:     'lien_reduction',
        amount:         -reductionAmt,
        reference_id:   red.id,
        reference_type: 'reduction',
        memo:           `Reduction approved — billed $${Number(red.total_billed).toLocaleString()} → settled $${Number(red.reduction_requested_to).toLocaleString()}`,
        created_by:     profile?.id,
      });
      await supabase.from('patient_charts').update({
        total_balance: curBalance - reductionAmt,
      }).eq('id', id!);
    }
    await supabase.from('reduction_audit_log').insert({
      reduction_id:   red.id,
      action:         'approved',
      performed_by:   profile?.id,
      old_status:     'pending',
      new_status:     'approved',
      amount_at_time: Number(red.reduction_requested_to),
    });
    setApprovingId(null);
    await load();
  }

  async function handleDeclineReduction(red: any) {
    setDecliningId(red.id);
    await supabase.from('reduction_requests').update({
      status:      'declined',
      reviewed_by: profile?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', red.id);
    await supabase.from('reduction_audit_log').insert({
      reduction_id:   red.id,
      action:         'declined',
      performed_by:   profile?.id,
      old_status:     'pending',
      new_status:     'declined',
      amount_at_time: Number(red.reduction_requested_to),
    });
    setDecliningId(null);
    await load();
  }

  // ── Discharge handler ─────────────────────────────────────────────────────

  async function handleGenerateDischarge(e: React.FormEvent) {
    e.preventDefault();
    if (!dxSummary.trim()) { setDischErr('Diagnosis summary is required.'); return; }
    setDischSaving(true); setDischErr('');

    const { billedTotal: snapBilled, paidTotal: snapPaid, balance: snapBalance } = computeChartFinancials(charges, ledger);
    const signedNotes = notes.filter((n: any) => n.status === 'signed');
    const visitDates  = signedNotes.map((n: any) => n.visit_date).filter(Boolean).sort();

    const { data, error } = await supabase.from('discharge_packages').insert({
      chart_id:          id,
      status:            'complete',
      visit_count:       signedNotes.length,
      date_first_visit:  visitDates[0] ?? null,
      date_last_visit:   visitDates[visitDates.length - 1] ?? null,
      total_billed:      snapBilled,
      total_paid:        snapPaid,
      total_balance:     snapBalance,
      diagnosis_summary: dxSummary.trim(),
      treatment_summary: txSummary.trim() || null,
      created_by:        profile?.id,
    }).select('*').single();

    if (error || !data) { setDischErr(error?.message ?? 'Failed to generate discharge package.'); setDischSaving(false); return; }

    await supabase.from('patient_charts').update({
      status:           'discharged',
      discharge_status: 'complete',
      discharge_date:   new Date().toISOString().slice(0, 10),
    }).eq('id', id!);

    setShowDischForm(false); setDischSaving(false);
    await load();
  }

  // ── Consent handlers ─────────────────────────────────────────────────────

  async function handleMarkHipaaSigned() {
    setConsentSaving(true);
    const { data } = await supabase.from('patient_charts')
      .update({ hipaa_authorization_signed: true, hipaa_signed_at: new Date().toISOString() })
      .eq('id', id!).select('*, patients(*)').single();
    if (data) setChart(data);
    setConsentSaving(false);
  }

  async function handleGrantConsent() {
    setConsentSaving(true);
    const { data } = await supabase.from('patient_charts')
      .update({ consent_share_with_firm: true, consent_granted_at: new Date().toISOString(), consent_revoked_at: null })
      .eq('id', id!).select('*, patients(*)').single();
    if (data) setChart(data);
    setConsentSaving(false);
  }

  async function handleRevokeConsent() {
    setConsentSaving(true);
    const { data } = await supabase.from('patient_charts')
      .update({ consent_share_with_firm: false, consent_revoked_at: new Date().toISOString() })
      .eq('id', id!).select('*, patients(*)').single();
    if (data) setChart(data);
    setConsentSaving(false);
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
        <Tab id="discharge"    label="Discharge" />
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

          <div className="card">
            <h3>Consent &amp; record sharing</h3>
            <dl className="kv">
              <dt>HIPAA authorization</dt>
              <dd>
                {chart.hipaa_authorization_signed ? (
                  <>
                    <span className="tag good tiny">Signed</span>
                    {chart.hipaa_signed_at && (
                      <span className="muted small" style={{ marginLeft: 8 }}>
                        {new Date(chart.hipaa_signed_at).toLocaleDateString()}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="tag soft tiny">Not on file</span>
                )}
              </dd>
              <dt>Share with referring firm</dt>
              <dd>
                {firmSharingActive(chart) ? (
                  <>
                    <span className="tag good tiny">Sharing active</span>
                    {chart.consent_granted_at && (
                      <span className="muted small" style={{ marginLeft: 8 }}>
                        granted {new Date(chart.consent_granted_at).toLocaleDateString()}
                      </span>
                    )}
                  </>
                ) : chart.consent_revoked_at ? (
                  <>
                    <span className="tag warn tiny">Revoked</span>
                    <span className="muted small" style={{ marginLeft: 8 }}>
                      {new Date(chart.consent_revoked_at).toLocaleDateString()}
                    </span>
                  </>
                ) : (
                  <span className="tag soft tiny">Not granted</span>
                )}
              </dd>
            </dl>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {!chart.hipaa_authorization_signed && (
                <button className="btn ghost sm" disabled={consentSaving} onClick={handleMarkHipaaSigned}>
                  {consentSaving ? 'Saving…' : 'Mark HIPAA signed'}
                </button>
              )}
              {!firmSharingActive(chart) && (
                <button className="btn ghost sm" disabled={consentSaving} onClick={handleGrantConsent}>
                  {consentSaving ? 'Saving…' : 'Grant firm sharing'}
                </button>
              )}
              {firmSharingActive(chart) && (
                <button className="btn ghost sm" disabled={consentSaving}
                  style={{ color: 'var(--warn)', borderColor: 'var(--warn)' }}
                  onClick={handleRevokeConsent}>
                  {consentSaving ? 'Saving…' : 'Revoke'}
                </button>
              )}
            </div>
          </div>
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

          {chart.payer_type === 'pi_lien' && (
            <div style={{ marginBottom: 12 }}>
              {!firmSharingActive(chart) && (
                <div className="flag warn" style={{ marginBottom: 8 }}>
                  Record-sharing consent is not on file or has been revoked — cannot transmit to the referring firm.
                </div>
              )}
              <button
                className="btn ghost sm"
                disabled={!firmSharingActive(chart)}
                style={!firmSharingActive(chart) ? { opacity: 0.45 } : undefined}>
                Transmit records to {chart.referring_law_firm ?? 'referring firm'} (Phase 4)
              </button>
            </div>
          )}

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
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
            {([
              { label: 'Pending charges', val: pendingTotal, cls: pendingTotal > 0 ? 'var(--warn)' : undefined },
              { label: 'Total billed',    val: billedTotal,  cls: undefined },
              { label: 'Total paid',      val: paidTotal,    cls: 'var(--good)' },
            ] as { label: string; val: number; cls?: string }[]).map(s => (
              <div key={s.label} className="card" style={{ marginBottom: 0 }}>
                <div className="muted small">{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--serif)', marginTop: 4, color: s.cls }}>
                  ${s.val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            ))}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="muted small">Balance</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--serif)', marginTop: 4,
                color: balance > 0 ? 'var(--warn)' : balance < 0 ? 'var(--ink-soft)' : 'var(--good)' }}>
                ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {balance < 0 && (
                <div className="muted tiny" style={{ marginTop: 4 }}>credit · overpaid</div>
              )}
            </div>
          </div>

          {/* Charge line items */}
          <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600 }}>
                Charge line items
                {pendingTotal > 0 && (
                  <span className="muted small" style={{ fontWeight: 400, marginLeft: 8 }}>
                    · ${pendingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pending
                  </span>
                )}
              </div>
              {canBillingWrite && allCharges.some((c: any) => c.status === 'pending') && (
                <button className="btn ghost sm" onClick={markAllPendingBilled}>Mark all billed</button>
              )}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>CPT</th><th>Description</th>
                  <th style={{ textAlign: 'right' }}>Units</th>
                  <th style={{ textAlign: 'right' }}>Fee</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                  <th>Status</th>
                  {canBillingWrite && <th />}
                </tr>
              </thead>
              <tbody>
                {allCharges.length === 0 && (
                  <tr><td colSpan={canBillingWrite ? 8 : 7} className="muted">No charges yet — add CPT codes from signed visit notes.</td></tr>
                )}
                {allCharges.map((c: any) => {
                  const sub = Number(c.fee_amount) * Number(c.units ?? 1);
                  const stCls = c.status === 'paid' ? 'good' : c.status === 'billed' ? 'gold' : ['adjusted','written_off'].includes(c.status) ? 'ink' : 'soft';
                  return (
                    <tr key={c.id}>
                      <td className="small">{c.visitDate ?? '—'}</td>
                      <td><code style={{ fontSize: 12 }}>{c.cpt_code}</code></td>
                      <td className="small muted">{c.description ?? '—'}</td>
                      <td className="small" style={{ textAlign: 'right' }}>{c.units ?? 1}</td>
                      <td className="small" style={{ textAlign: 'right' }}>
                        ${Number(c.fee_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="small" style={{ textAlign: 'right', fontWeight: 600 }}>
                        ${sub.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td><span className={`tag tiny ${stCls}`}>{(c.status ?? '').replace(/_/g, ' ')}</span></td>
                      {canBillingWrite && (
                        <td>
                          {c.status === 'pending' && (
                            <button className="btn ghost sm" style={{ fontSize: 11.5 }}
                              onClick={() => markChargeBilled(c)}>
                              Mark billed
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Record payment */}
          {canBillingWrite && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: showPayForm ? 14 : 0 }}>
                <div style={{ fontWeight: 600 }}>Record payment</div>
                <button className="btn ghost sm" onClick={() => { setShowPayForm(f => !f); setPyErr(''); }}>
                  {showPayForm ? 'Cancel' : '+ Add payment'}
                </button>
              </div>
              {showPayForm && (
                <form onSubmit={handleRecordPayment}>
                  <div className="row">
                    <div>
                      <label>Amount *</label>
                      <input type="number" min="0.01" step="0.01" placeholder="0.00"
                        value={pyAmount} onChange={e => setPyAmount(e.target.value)} />
                    </div>
                    <div>
                      <label>Date *</label>
                      <input type="date" value={pyDate} onChange={e => setPyDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="row">
                    <div>
                      <label>Method</label>
                      <select value={pyMethod} onChange={e => setPyMethod(e.target.value)}>
                        <option value="cash">Cash</option>
                        <option value="check">Check</option>
                        <option value="ach">ACH / wire</option>
                        <option value="card">Card</option>
                        <option value="insurance">Insurance payment</option>
                        <option value="attorney">Attorney trust</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label>Memo</label>
                      <input type="text" placeholder="Check #1234, settlement ref…"
                        value={pyMemo} onChange={e => setPyMemo(e.target.value)} />
                    </div>
                  </div>
                  {pyErr && <div className="err">{pyErr}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button type="submit" disabled={pySaving}>{pySaving ? 'Saving…' : 'Record payment'}</button>
                    <button type="button" className="btn ghost" onClick={() => setShowPayForm(false)}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Billing ledger */}
          <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px 12px', fontWeight: 600 }}>Billing ledger</div>
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
                      {Number(e.amount) < 0 ? '−' : '+'}${Math.abs(Number(e.amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Reduction requests */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 600 }}>
                Reduction requests
                {chart.payer_type === 'pi_lien' && (
                  <span className="tag gold tiny" style={{ marginLeft: 8 }}>PI lien</span>
                )}
              </div>
              {canBillingWrite && !showRedForm && (
                <button className="btn ghost sm" onClick={() => {
                  setRdAttorney(chart.referring_attorney_name ?? '');
                  setRdFirm(chart.referring_law_firm ?? '');
                  setRdRequestedTo(''); setRdNotes(''); setRdErr('');
                  setShowRedForm(true);
                }}>
                  + New request
                </button>
              )}
            </div>

            {showRedForm && canBillingWrite && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, background: 'var(--paper)' }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 12 }}>New reduction request</div>
                <form onSubmit={handleCreateReduction}>
                  <div className="row">
                    <div>
                      <label>Requesting attorney</label>
                      <input type="text" placeholder="Jane Doe, Esq."
                        value={rdAttorney} onChange={e => setRdAttorney(e.target.value)} />
                    </div>
                    <div>
                      <label>Law firm</label>
                      <input type="text" placeholder="Smith &amp; Jones LLP"
                        value={rdFirm} onChange={e => setRdFirm(e.target.value)} />
                    </div>
                  </div>
                  <div className="row">
                    <div>
                      <label>Billed total (snapshot)</label>
                      <input type="text" readOnly
                        value={`$${(billedTotal || Number(chart.total_billed ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        style={{ background: 'var(--paper-2)', color: 'var(--ink-soft)' }} />
                    </div>
                    <div>
                      <label>Requested settlement amount *</label>
                      <input type="number" min="0" step="0.01" placeholder="0.00"
                        value={rdRequestedTo} onChange={e => setRdRequestedTo(e.target.value)} />
                    </div>
                  </div>
                  {rdRequestedTo && (
                    <div className="muted small" style={{ marginBottom: 8, marginTop: -4 }}>
                      Reduction of ${Math.max(0, (billedTotal || Number(chart.total_billed ?? 0)) - Number(rdRequestedTo))
                        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                  <div>
                    <label>Notes</label>
                    <textarea rows={2} style={{ resize: 'vertical' }}
                      placeholder="Reason for reduction request…"
                      value={rdNotes} onChange={e => setRdNotes(e.target.value)} />
                  </div>
                  {rdErr && <div className="err">{rdErr}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button type="submit" disabled={rdSaving}>{rdSaving ? 'Saving…' : 'Submit request'}</button>
                    <button type="button" className="btn ghost" onClick={() => setShowRedForm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {reductions.length === 0 && !showRedForm && (
              <div className="muted small">No reduction requests yet.</div>
            )}

            {reductions.map((red: any) => {
              const reductionAmt = Math.max(0, Number(red.total_billed) - Number(red.reduction_requested_to));
              const isPending    = red.status === 'pending';
              const isApproving  = approvingId === red.id;
              const isDeclining  = decliningId === red.id;
              const auditLog: any[] = red.reduction_audit_log ?? [];
              const stCls = red.status === 'approved' ? 'good' : red.status === 'declined' ? 'soft' : red.status === 'lien_released' ? 'ink' : 'gold';
              return (
                <div key={red.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <span className={`tag tiny ${stCls}`}>{red.status}</span>
                      {(red.requesting_attorney || red.requesting_firm) && (
                        <span className="muted small" style={{ marginLeft: 8 }}>
                          {[red.requesting_attorney, red.requesting_firm].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                    <div className="muted tiny">{new Date(red.created_at).toLocaleDateString()}</div>
                  </div>

                  <dl className="kv" style={{ fontSize: 13 }}>
                    <dt>Billed</dt>
                    <dd>${Number(red.total_billed).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
                    <dt>Settle to</dt>
                    <dd>${Number(red.reduction_requested_to).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
                    <dt>Reduction</dt>
                    <dd style={{ color: 'var(--warn)', fontWeight: 600 }}>
                      −${reductionAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </dd>
                    {red.notes && <><dt>Notes</dt><dd>{red.notes}</dd></>}
                    {red.reviewer?.full_name && <><dt>Reviewed by</dt><dd>{red.reviewer.full_name}</dd></>}
                  </dl>

                  {isPending && canApproveRed && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button className="btn sm"
                        style={{ background: 'var(--good)', borderColor: 'var(--good)', fontSize: 12 }}
                        disabled={isApproving || isDeclining}
                        onClick={() => handleApproveReduction(red)}>
                        {isApproving ? 'Approving…' : 'Approve'}
                      </button>
                      <button className="btn ghost sm" style={{ fontSize: 12 }}
                        disabled={isApproving || isDeclining}
                        onClick={() => handleDeclineReduction(red)}>
                        {isDeclining ? 'Declining…' : 'Decline'}
                      </button>
                    </div>
                  )}

                  {auditLog.length > 0 && (
                    <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                      <div className="muted tiny" style={{ marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        Audit trail
                      </div>
                      {auditLog.map((entry: any) => (
                        <div key={entry.id} style={{ display: 'flex', gap: 8, fontSize: 12.5, marginBottom: 4, alignItems: 'center' }}>
                          <span className="muted" style={{ minWidth: 88, fontSize: 12 }}>
                            {new Date(entry.created_at).toLocaleDateString()}
                          </span>
                          <span className="tag soft tiny">{entry.action}</span>
                          <span className="muted" style={{ fontSize: 12 }}>{entry.performer?.full_name ?? '—'}</span>
                          {entry.amount_at_time != null && (
                            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600 }}>
                              ${Number(entry.amount_at_time).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── DISCHARGE ─────────────────────────────────────────────────────── */}
      {tab === 'discharge' && (
        <>
          {dischargePackage ? (
            <>
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <h3>Discharge package</h3>
                  <span className="tag good tiny">complete</span>
                </div>
                <dl className="kv">
                  <dt>Discharge date</dt>
                  <dd>{chart.discharge_date ?? new Date(dischargePackage.created_at).toLocaleDateString()}</dd>
                  <dt>Visits completed</dt>
                  <dd>{dischargePackage.visit_count ?? signedCount}</dd>
                  {dischargePackage.date_first_visit && <><dt>First visit</dt><dd>{dischargePackage.date_first_visit}</dd></>}
                  {dischargePackage.date_last_visit  && <><dt>Last visit</dt> <dd>{dischargePackage.date_last_visit}</dd></>}
                  <dt>Total billed</dt>
                  <dd>${Number(dischargePackage.total_billed ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
                  <dt>Total paid</dt>
                  <dd>${Number(dischargePackage.total_paid ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
                  <dt>Balance at discharge</dt>
                  <dd style={{ fontWeight: 700, color: Number(dischargePackage.total_balance) < 0 ? 'var(--ink-soft)' : undefined }}>
                    ${Number(dischargePackage.total_balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {Number(dischargePackage.total_balance) < 0 && (
                      <span className="muted small" style={{ marginLeft: 6, fontWeight: 400 }}>credit</span>
                    )}
                  </dd>
                  {dischargePackage.diagnosis_summary && (
                    <><dt>Diagnosis summary</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{dischargePackage.diagnosis_summary}</dd></>
                  )}
                  {dischargePackage.treatment_summary && (
                    <><dt>Treatment summary</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{dischargePackage.treatment_summary}</dd></>
                  )}
                </dl>
                <div style={{ marginTop: 16 }}>
                  <button className="btn ghost sm" disabled
                    title="PDF export coming soon" style={{ opacity: 0.55 }}>
                    Export PDF (coming soon)
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {chart.status === 'discharged' ? (
                <div className="card">
                  <div className="muted">This chart is marked discharged but no discharge package was found.</div>
                </div>
              ) : (
                <>
                  {canWriteClinical && !showDischForm && (
                    <div className="card">
                      <div className="muted small" style={{ marginBottom: 14 }}>
                        No discharge package yet. Generate one to snapshot the final treatment record and mark this chart discharged.
                      </div>
                      <button className="btn sm oxblood" onClick={() => {
                        setTxSummary(treatmentPlan?.goals ?? '');
                        setDxSummary(''); setDischErr('');
                        setShowDischForm(true);
                      }}>
                        Generate discharge package
                      </button>
                    </div>
                  )}

                  {!canWriteClinical && (
                    <div className="card">
                      <div className="muted small">No discharge package yet. A provider or admin must generate it.</div>
                    </div>
                  )}
                </>
              )}

              {showDischForm && canWriteClinical && (
                <div className="card">
                  <h3 style={{ marginBottom: 14 }}>Generate discharge package</h3>
                  <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--paper-2)', borderRadius: 8, fontSize: 13.5 }}>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      <div><span className="muted">Signed visits</span> <b style={{ marginLeft: 6 }}>{signedCount}</b></div>
                      <div><span className="muted">Total billed</span> <b style={{ marginLeft: 6 }}>${billedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
                      <div><span className="muted">Total paid</span> <b style={{ marginLeft: 6 }}>${paidTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
                      <div>
                        <span className="muted">Balance</span>
                        <b style={{ marginLeft: 6, color: balance < 0 ? 'var(--ink-soft)' : undefined }}>
                          ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </b>
                        {balance < 0 && <span className="muted tiny" style={{ marginLeft: 5 }}>credit</span>}
                      </div>
                    </div>
                  </div>
                  <form onSubmit={handleGenerateDischarge}>
                    <div>
                      <label>Diagnosis summary *</label>
                      <textarea rows={4} style={{ resize: 'vertical' }}
                        placeholder="Final diagnosis codes and clinical summary…"
                        value={dxSummary} onChange={e => setDxSummary(e.target.value)} />
                    </div>
                    <div>
                      <label>Treatment summary <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
                      <textarea rows={4} style={{ resize: 'vertical' }}
                        placeholder="Summary of treatment provided, goals achieved, outcomes…"
                        value={txSummary} onChange={e => setTxSummary(e.target.value)} />
                    </div>
                    {dischErr && <div className="err">{dischErr}</div>}
                    <div className="flag warn" style={{ marginBottom: 14, marginTop: 4 }}>
                      <div>Generating will set chart status to <b>discharged</b>. This cannot be undone from the UI.</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" disabled={dischSaving}>
                        {dischSaving ? 'Generating…' : 'Generate & discharge'}
                      </button>
                      <button type="button" className="btn ghost" onClick={() => setShowDischForm(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
