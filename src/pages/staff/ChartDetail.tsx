import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

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

export default function ChartDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [chart, setChart]   = useState<any>(null);
  const [apts, setApts]     = useState<any[]>([]);
  const [notes, setNotes]   = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [tab, setTab]       = useState('overview');

  async function load() {
    const [{ data: c }, { data: a }, { data: n }, { data: l }] = await Promise.all([
      supabase.from('patient_charts')
        .select('*, patients(*)')
        .eq('id', id).single(),
      supabase.from('appointments')
        .select('*')
        .eq('chart_id', id)
        .order('scheduled_at', { ascending: false }),
      supabase.from('visit_notes')
        .select('*, charges(*)')
        .eq('chart_id', id)
        .order('visit_date', { ascending: false }),
      supabase.from('billing_ledger')
        .select('*')
        .eq('chart_id', id)
        .order('entry_date', { ascending: false }),
    ]);
    setChart(c);
    setApts(a ?? []);
    setNotes(n ?? []);
    setLedger(l ?? []);
  }

  useEffect(() => { load(); }, [id]);
  if (!chart) return <div className="muted" style={{ padding: 40 }}>Loading…</div>;

  const pt    = chart.patients ?? {};
  const payer = payerBadge[chart.payer_type] ?? { label: chart.payer_type ?? '—', cls: 'soft' };

  const totalCharges = notes.flatMap((n: any) => n.charges ?? [])
    .reduce((s: number, c: any) => s + Number(c.fee_amount ?? 0) * Number(c.units ?? 1), 0);

  const Tab = ({ id: t, label }: { id: string; label: string }) => (
    <button className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{label}</button>
  );

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

          {/* Payer block — branches on payer_type */}
          {chart.payer_type === 'pi_lien' && (
            <div className="card">
              <h3>PI Lien</h3>
              <dl className="kv">
                <dt>Referring attorney</dt>
                <dd>{chart.referring_attorney_name ?? '—'}</dd>
                <dt>Law firm</dt>
                <dd>{chart.referring_law_firm ?? '—'}</dd>
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
                <dt>Claim #</dt>      <dd>{chart.wc_claim_number ?? '—'}</dd>
                <dt>Employer</dt>     <dd>{chart.wc_employer ?? '—'}</dd>
                <dt>Carrier</dt>      <dd>{chart.wc_carrier ?? '—'}</dd>
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
        </>
      )}

      {/* ── APPOINTMENTS ─────────────────────────────────────────── */}
      {tab === 'appointments' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Date &amp; time</th>
                <th>Type</th>
                <th>Status</th>
                <th>Reminder</th>
              </tr>
            </thead>
            <tbody>
              {apts.length === 0 && (
                <tr><td colSpan={4} className="muted">No appointments yet.</td></tr>
              )}
              {apts.map((a: any) => (
                <tr key={a.id}>
                  <td className="small">
                    {a.scheduled_at
                      ? new Date(a.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                      : '—'}
                  </td>
                  <td className="small">{(a.visit_type ?? '—').replace(/_/g, ' ')}</td>
                  <td>
                    <span className={`tag tiny ${apptStatusTag[a.status] ?? 'soft'}`}>
                      {(a.status ?? '').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    {a.reminder_status
                      ? <span className={`tag tiny ${a.reminder_status === 'sent' ? 'good' : a.reminder_status === 'failed' ? 'bad' : 'soft'}`}>
                          {a.reminder_status}
                        </span>
                      : <span className="muted tiny">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

                {/* SOAP */}
                <dl className="kv" style={{ fontSize: 13.5 }}>
                  {n.subjective  && <><dt>S</dt><dd>{n.subjective}</dd></>}
                  {n.objective   && <><dt>O</dt><dd>{n.objective}</dd></>}
                  {n.assessment  && <><dt>A</dt><dd>{n.assessment}</dd></>}
                  {n.plan        && <><dt>P</dt><dd>{n.plan}</dd></>}
                </dl>

                {/* CPT charges */}
                {charges.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div className="muted small" style={{ marginBottom: 6, fontWeight: 600 }}>
                      CPT charges
                    </div>
                    <table style={{ fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th>Code</th><th>Description</th><th>Units</th><th style={{ textAlign: 'right' }}>Fee</th><th>Status</th>
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
                            <td><span className={`tag tiny ${c.status === 'paid' ? 'good' : c.status === 'billed' ? 'gold' : 'soft'}`}>{c.status}</span></td>
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
                  <th>Date</th><th>Type</th><th>Memo</th><th style={{ textAlign: 'right' }}>Amount</th>
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
              Reduction portal, payments, and lien management — Chunk 4 (billing & discharge).
            </div>
          </div>
        </>
      )}
    </>
  );
}
