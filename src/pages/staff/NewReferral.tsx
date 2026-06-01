import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';

const MECHANISMS = [
  { v: 'motor_vehicle_accident', l: 'Motor vehicle accident' },
  { v: 'slip_and_fall',          l: 'Slip and fall' },
  { v: 'work_injury',            l: 'Work injury' },
  { v: 'sports_injury',          l: 'Sports injury' },
  { v: 'pedestrian_accident',    l: 'Pedestrian accident' },
  { v: 'other',                  l: 'Other' },
];

const BODY_REGIONS = [
  'Cervical', 'Thoracic', 'Lumbar',
  'Shoulder (L)', 'Shoulder (R)',
  'Knee (L)', 'Knee (R)',
  'Hip (L)', 'Hip (R)',
  'Wrist (L)', 'Wrist (R)',
  'Ankle (L)', 'Ankle (R)',
  'Head', 'Ribs', 'Other',
];

const WC_AUTH_STATUSES = [
  { v: 'pending',    l: 'Pending' },
  { v: 'authorized', l: 'Authorized' },
  { v: 'denied',     l: 'Denied' },
  { v: 'modified',   l: 'Modified' },
];

export default function NewReferral() {
  const nav = useNavigate();
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Patient demographics
  const [fullName, setFullName]           = useState('');
  const [dob, setDob]                     = useState('');
  const [phone, setPhone]                 = useState('');
  const [email, setEmail]                 = useState('');
  const [address, setAddress]             = useState('');
  const [healthInsurer, setHealthInsurer] = useState('');
  const [healthPolicyNum, setHealthPolicyNum] = useState('');
  const [alPatientRef, setAlPatientRef]   = useState('');
  const [referralFirm, setReferralFirm]   = useState('');

  // Injury
  const [doi, setDoi]             = useState('');
  const [mechanism, setMechanism] = useState('');
  const [injuryDesc, setInjuryDesc] = useState('');
  const [bodyRegions, setBodyRegions] = useState<string[]>([]);

  // Payer
  const [payerType, setPayerType] = useState('');
  // PI Lien
  const [refAttorney, setRefAttorney] = useState('');
  const [refFirm, setRefFirm]         = useState('');
  const [alCaseRef, setAlCaseRef]     = useState('');
  const [lienOnFile, setLienOnFile]   = useState(false);
  const [lienAmount, setLienAmount]   = useState('');
  // Workers' Comp
  const [wcClaimNum, setWcClaimNum]   = useState('');
  const [wcEmployer, setWcEmployer]   = useState('');
  const [wcCarrier, setWcCarrier]     = useState('');
  const [wcAdjName, setWcAdjName]     = useState('');
  const [wcAdjPhone, setWcAdjPhone]   = useState('');
  const [wcAuthStatus, setWcAuthStatus] = useState('pending');

  function toggleRegion(r: string) {
    setBodyRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setErr('Patient full name is required.'); return; }
    if (!payerType) { setErr('Payer type is required.'); return; }

    setSaving(true);
    setErr('');

    const { data: pt, error: ptErr } = await supabase
      .from('patients')
      .insert({
        practice_id:         profile?.practice_id,
        full_name:           fullName.trim(),
        dob:                 dob || null,
        phone:               phone || null,
        email:               email || null,
        address:             address || null,
        health_insurer:      healthInsurer || null,
        health_policy_number: healthPolicyNum || null,
        al_patient_ref:      alPatientRef || null,
        referral_firm_name:  referralFirm || null,
      })
      .select('id')
      .single();

    if (ptErr || !pt) {
      setErr(ptErr?.message ?? 'Failed to create patient record.');
      setSaving(false);
      return;
    }

    const chartPayload: Record<string, any> = {
      practice_id:         profile?.practice_id,
      patient_id:          pt.id,
      payer_type:          payerType,
      status:              'referral_received',
      date_of_injury:      doi || null,
      mechanism_of_injury: mechanism || null,
      injury_description:  injuryDesc || null,
      body_regions_affected: bodyRegions.length > 0 ? bodyRegions : null,
    };

    if (payerType === 'pi_lien') {
      chartPayload.referring_attorney_name = refAttorney || null;
      chartPayload.referring_law_firm      = refFirm || null;
      chartPayload.al_case_ref             = alCaseRef || null;
      chartPayload.lien_on_file            = lienOnFile;
      chartPayload.lien_amount             = lienOnFile && lienAmount ? Number(lienAmount) : null;
    }

    if (payerType === 'workers_comp') {
      chartPayload.wc_claim_number  = wcClaimNum || null;
      chartPayload.wc_employer      = wcEmployer || null;
      chartPayload.wc_carrier       = wcCarrier || null;
      chartPayload.wc_adjuster_name  = wcAdjName || null;
      chartPayload.wc_adjuster_phone = wcAdjPhone || null;
      chartPayload.wc_auth_status    = wcAuthStatus || null;
    }

    const { data: chart, error: cErr } = await supabase
      .from('patient_charts')
      .insert(chartPayload)
      .select('id')
      .single();

    if (cErr || !chart) {
      setErr(cErr?.message ?? 'Failed to create chart.');
      setSaving(false);
      return;
    }

    nav(`/patients/${chart.id}`);
  }

  return (
    <>
      <div className="page-h">
        <div>
          <div
            className="muted small"
            style={{ marginBottom: 4, cursor: 'pointer' }}
            onClick={() => nav('/referrals')}
          >
            ← Referrals
          </div>
          <h1>New referral</h1>
          <div className="sub">Create patient record and intake chart</div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Patient demographics ─────────────────────────────────── */}
        <div className="card">
          <h3>Patient demographics</h3>
          <div className="row">
            <div>
              <label>Full name *</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" />
            </div>
            <div>
              <label>Date of birth</label>
              <input type="date" value={dob} onChange={e => setDob(e.target.value)} />
            </div>
          </div>
          <div className="row">
            <div>
              <label>Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" />
            </div>
          </div>
          <div>
            <label>Address</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St, City, ST 00000" />
          </div>
          <div className="row">
            <div>
              <label>Health insurer</label>
              <input value={healthInsurer} onChange={e => setHealthInsurer(e.target.value)} placeholder="Blue Cross…" />
            </div>
            <div>
              <label>Health policy #</label>
              <input value={healthPolicyNum} onChange={e => setHealthPolicyNum(e.target.value)} />
            </div>
          </div>
          <div className="row">
            <div>
              <label>Referral firm name</label>
              <input value={referralFirm} onChange={e => setReferralFirm(e.target.value)} placeholder="Smith & Associates" />
            </div>
            <div>
              <label>
                AL patient ref{' '}
                <span className="muted" style={{ fontWeight: 400 }}>(AccidentLawyer.AI bridge)</span>
              </label>
              <input value={alPatientRef} onChange={e => setAlPatientRef(e.target.value)} placeholder="AL-PT-…" />
            </div>
          </div>
        </div>

        {/* ── Injury ───────────────────────────────────────────────── */}
        <div className="card">
          <h3>Injury</h3>
          <div className="row">
            <div>
              <label>Date of injury</label>
              <input type="date" value={doi} onChange={e => setDoi(e.target.value)} />
            </div>
            <div>
              <label>Mechanism</label>
              <select value={mechanism} onChange={e => setMechanism(e.target.value)}>
                <option value="">— select —</option>
                {MECHANISMS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label>Injury description</label>
            <textarea
              value={injuryDesc}
              onChange={e => setInjuryDesc(e.target.value)}
              rows={3}
              placeholder="Describe symptoms, chief complaints, and relevant history…"
            />
          </div>
          <div>
            <label>Body regions affected</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 6 }}>
              {BODY_REGIONS.map(r => (
                <label
                  key={r}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, margin: 0,
                    cursor: 'pointer', fontSize: 13.5, fontWeight: 'normal', color: 'var(--ink)' }}
                >
                  <input
                    type="checkbox"
                    checked={bodyRegions.includes(r)}
                    onChange={() => toggleRegion(r)}
                    style={{ width: 'auto' }}
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ── Payer ────────────────────────────────────────────────── */}
        <div className="card">
          <h3>Payer</h3>
          <div style={{ maxWidth: 320 }}>
            <label>Payer type *</label>
            <select value={payerType} onChange={e => setPayerType(e.target.value)}>
              <option value="">— select —</option>
              <option value="pi_lien">PI Lien</option>
              <option value="workers_comp">Workers' Comp</option>
              <option value="health_insurance">Health Insurance</option>
              <option value="pip_medpay">PIP / MedPay</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          {payerType === 'pi_lien' && (
            <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
              <div className="row">
                <div>
                  <label>Referring attorney</label>
                  <input value={refAttorney} onChange={e => setRefAttorney(e.target.value)} placeholder="John Doe, Esq." />
                </div>
                <div>
                  <label>Law firm</label>
                  <input value={refFirm} onChange={e => setRefFirm(e.target.value)} placeholder="Doe & Partners LLP" />
                </div>
              </div>
              <div className="row">
                <div>
                  <label>
                    AL case ref{' '}
                    <span className="muted" style={{ fontWeight: 400 }}>(AccidentLawyer.AI bridge)</span>
                  </label>
                  <input value={alCaseRef} onChange={e => setAlCaseRef(e.target.value)} placeholder="AL-CASE-…" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 2 }}>
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 7, margin: 0,
                      cursor: 'pointer', fontWeight: 'normal', color: 'var(--ink)', fontSize: 14 }}
                  >
                    <input
                      type="checkbox"
                      checked={lienOnFile}
                      onChange={e => setLienOnFile(e.target.checked)}
                      style={{ width: 'auto' }}
                    />
                    Lien on file
                  </label>
                </div>
              </div>
              {lienOnFile && (
                <div style={{ maxWidth: 220 }}>
                  <label>Lien amount ($)</label>
                  <input
                    type="number"
                    value={lienAmount}
                    onChange={e => setLienAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              )}
            </div>
          )}

          {payerType === 'workers_comp' && (
            <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
              <div className="row">
                <div>
                  <label>Claim number</label>
                  <input value={wcClaimNum} onChange={e => setWcClaimNum(e.target.value)} placeholder="WC-2024-…" />
                </div>
                <div>
                  <label>Employer</label>
                  <input value={wcEmployer} onChange={e => setWcEmployer(e.target.value)} placeholder="Acme Corp" />
                </div>
              </div>
              <div className="row">
                <div>
                  <label>Insurance carrier</label>
                  <input value={wcCarrier} onChange={e => setWcCarrier(e.target.value)} placeholder="State Fund…" />
                </div>
                <div>
                  <label>Auth status</label>
                  <select value={wcAuthStatus} onChange={e => setWcAuthStatus(e.target.value)}>
                    {WC_AUTH_STATUSES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                  </select>
                </div>
              </div>
              <div className="row">
                <div>
                  <label>Adjuster name</label>
                  <input value={wcAdjName} onChange={e => setWcAdjName(e.target.value)} placeholder="Jane Adjuster" />
                </div>
                <div>
                  <label>Adjuster phone</label>
                  <input value={wcAdjPhone} onChange={e => setWcAdjPhone(e.target.value)} placeholder="(555) 000-0000" />
                </div>
              </div>
            </div>
          )}

          {(payerType === 'health_insurance' || payerType === 'pip_medpay' || payerType === 'cash') && (
            <div
              className="muted small"
              style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}
            >
              No additional payer fields for this type. Demographics and injury info above are sufficient.
            </div>
          )}
        </div>

        {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10, marginBottom: 48 }}>
          <button type="submit" className="btn oxblood" disabled={saving}>
            {saving ? 'Saving…' : 'Save referral'}
          </button>
          <button type="button" className="btn ghost" onClick={() => nav('/referrals')}>
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
