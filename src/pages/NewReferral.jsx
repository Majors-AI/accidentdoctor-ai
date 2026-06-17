import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';

const PAYER_OPTIONS = [
  { value: 'pi_lien',          label: 'PI Lien' },
  { value: 'health_insurance', label: 'Health Insurance' },
  { value: 'pip_medpay',       label: 'PIP / MedPay' },
  { value: 'workers_comp',     label: "Workers' Comp" },
  { value: 'cash',             label: 'Cash' },
];

const SOURCE_OPTIONS = [
  { value: 'law_firm', label: 'Law Firm' },
  { value: 'direct',   label: 'Direct' },
  { value: 'other',    label: 'Other' },
];

const EMPTY = {
  referral_source: 'law_firm',
  firm_name: '',
  full_name: '',
  phone: '',
  email: '',
  date_of_birth: '',
  payer_type: 'pi_lien',
  date_of_injury: '',
  notes: '',
};

function Field({ label, required, error, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#16181f', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && <p style={{ fontSize: 12, color: '#dc2626', margin: '4px 0 0' }}>{error}</p>}
    </div>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #e0e3ed', borderRadius: 8,
  padding: '8px 11px', fontSize: 13.5, color: '#16181f',
  background: '#fff', outline: 'none',
};

export default function NewReferral() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: '' }));
  };

  function validate() {
    const e = {};
    if (!form.full_name.trim())   e.full_name   = 'Patient name is required.';
    if (!form.phone.trim())       e.phone       = 'Phone is required.';
    if (!form.payer_type)         e.payer_type  = 'Payer type is required.';
    if (!form.date_of_injury)     e.date_of_injury = 'Date of injury is required.';
    if (form.referral_source === 'law_firm' && !form.firm_name.trim())
      e.firm_name = 'Firm name is required when referral source is Law Firm.';
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setSubmitError('');
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    let patient;
    try {
      patient = await db.entities.Patient.create({
        practice_id:   user.practice_id,   // required by patients RLS write check
        full_name:     form.full_name.trim(),
        phone:         form.phone.trim(),
        email:         form.email.trim() || undefined,
        dob:           form.date_of_birth || undefined,   // column is `dob`, not date_of_birth
      });
    } catch (err) {
      setSaving(false);
      setSubmitError(`Failed to create patient record: ${err?.message || 'Unknown error'}`);
      return;
    }

    let chart;
    try {
      const referralNote = form.referral_source === 'law_firm' && form.firm_name.trim()
        ? `Referral source: Law Firm — ${form.firm_name.trim()}`
        : `Referral source: ${form.referral_source}`;
      const notesBody = [referralNote, form.notes.trim()].filter(Boolean).join('\n\n');

      chart = await db.entities.PatientChart.create({
        practice_id:    user.practice_id,   // required by patient_charts RLS write check
        patient_id:     patient.id,
        status:         'referral_received',
        payer_type:     form.payer_type,
        date_of_injury: form.date_of_injury || undefined,
        total_billed:   0,
        total_paid:     0,
        total_balance:  0,
        notes:          notesBody || undefined,
      });
    } catch (err) {
      setSaving(false);
      setSubmitError(`Patient created but chart creation failed: ${err?.message || 'Unknown error'}`);
      return;
    }

    nav(`/patients/${chart.id}`);
  }

  return (
    <div style={{ padding: '36px 44px', maxWidth: 680 }}>
      {/* Header */}
      <button
        onClick={() => nav('/patients')}
        style={{ background: 'none', border: 'none', color: '#525870', fontSize: 13, cursor: 'pointer', padding: '0 0 8px', fontWeight: 500 }}
      >
        ← Patients
      </button>
      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.03em', margin: '0 0 4px' }}>New Referral</h1>
      <p style={{ color: '#525870', fontSize: 13.5, margin: '0 0 28px' }}>Create a patient record and open their chart.</p>

      <form onSubmit={handleSubmit} noValidate>

        {/* ── Referral Source ── */}
        <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, padding: '22px 24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(22,24,31,.06)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: '#16181f' }}>Referral Source</h2>

          <Field label="Source" required>
            <select
              value={form.referral_source}
              onChange={e => set('referral_source', e.target.value)}
              style={inputStyle}
            >
              {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          {form.referral_source === 'law_firm' && (
            <Field label="Firm Name" required error={errors.firm_name}>
              <input
                type="text"
                value={form.firm_name}
                onChange={e => set('firm_name', e.target.value)}
                placeholder="e.g. Smith & Associates"
                style={inputStyle}
              />
            </Field>
          )}
        </div>

        {/* ── Patient Demographics ── */}
        <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, padding: '22px 24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(22,24,31,.06)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: '#16181f' }}>Patient Demographics</h2>

          <Field label="Full Name" required error={errors.full_name}>
            <input
              type="text"
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              placeholder="First and last name"
              style={inputStyle}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Phone" required error={errors.phone}>
              <input
                type="tel"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="(555) 000-0000"
                style={inputStyle}
              />
            </Field>
            <Field label="Email" error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="Optional"
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label="Date of Birth" error={errors.date_of_birth}>
            <input
              type="date"
              value={form.date_of_birth}
              onChange={e => set('date_of_birth', e.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>

        {/* ── Injury & Payer ── */}
        <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, padding: '22px 24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(22,24,31,.06)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: '#16181f' }}>Injury & Payer</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Payer Type" required error={errors.payer_type}>
              <select
                value={form.payer_type}
                onChange={e => set('payer_type', e.target.value)}
                style={inputStyle}
              >
                {PAYER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Date of Injury" required error={errors.date_of_injury}>
              <input
                type="date"
                value={form.date_of_injury}
                onChange={e => set('date_of_injury', e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label="Injury Notes" error={errors.notes}>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Brief description of injury, accident details, etc."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Field>
        </div>

        {/* Submit error */}
        {submitError && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#991b1b', fontSize: 13.5 }}>
            ⚠️ {submitError}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => nav('/patients')}
            style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 9, padding: '9px 20px', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: '#525870' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              background: saving ? '#a5b4fc' : '#4f46e5',
              color: '#fff', border: 'none', borderRadius: 9,
              padding: '9px 24px', fontWeight: 700, fontSize: 13.5,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Create Referral'}
          </button>
        </div>
      </form>
    </div>
  );
}