import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

const BODY_PARTS = [
  'Head/Neck', 'Shoulder (L)', 'Shoulder (R)', 'Back (Upper)', 'Back (Lower)',
  'Knee (L)', 'Knee (R)', 'Hip (L)', 'Hip (R)', 'Wrist/Hand', 'Ankle/Foot', 'Other',
];

const INSURANCE_TYPES = ['PI Lien', 'Workers Comp', 'Health Insurance', 'PIP/MedPay', 'Cash'];

export default function PatientIntakeESign() {
  const { token } = useParams();
  const [loadState, setLoadState] = useState('loading'); // loading | completed | expired | revoked | not_found | error | ok
  const [linkData, setLinkData] = useState(null);
  const [submitState, setSubmitState] = useState('idle'); // idle | submitting | success | error
  const [submitError, setSubmitError] = useState('');

  const [form, setForm] = useState({
    date_of_injury: '',
    injury_description: '',
    body_parts: [],
    symptoms: '',
    insurance_type: '',
    insurance_details: '',
    accident_description: '',
    signer_name: '',
    authorization_affirmed: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getIntakeByToken', { token });
        const data = res.data ?? {};

        if (data.ok) {
          setLinkData(data);
          setLoadState('ok');
        } else {
          setLoadState(data.reason ?? 'error');
        }
      } catch (err) {
        setLoadState('error');
      }
    })();
  }, [token]);

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function toggleBodyPart(part) {
    setForm(f => ({
      ...f,
      body_parts: f.body_parts.includes(part)
        ? f.body_parts.filter(p => p !== part)
        : [...f.body_parts, part],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.authorization_affirmed) return;
    setSubmitState('submitting');
    setSubmitError('');
    const res = await base44.functions.invoke('submitIntake', { token, ...form });
    const data = res.data;
    if (data.ok) {
      setSubmitState('success');
    } else {
      setSubmitError(data.error || 'Submission failed. Please try again.');
      setSubmitState('error');
    }
  }

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-700 rounded-full animate-spin" />
      </div>
    );
  }

  const ERROR_SCREENS = {
    completed: { icon: '✅', title: 'Already submitted', body: 'This intake has already been submitted. Thank you — no further action is needed.' },
    expired:   { icon: '⏰', title: 'Link expired',      body: 'This intake link has expired. Please contact the practice for a new link.' },
    revoked:   { icon: '🔒', title: 'Link revoked',      body: 'This intake link is no longer valid.' },
    not_found: { icon: '🔍', title: 'Link not found',    body: 'This intake link was not found.' },
    error:     { icon: '⚠️', title: 'Something went wrong', body: 'Something went wrong loading this form. Please contact the practice.' },
  };

  const screen = ERROR_SCREENS[loadState];
  if (screen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
          <div className="text-4xl mb-4">{screen.icon}</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{screen.title}</h1>
          <p className="text-gray-500 text-sm">{screen.body}</p>
        </div>
      </div>
    );
  }

  if (submitState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-xl border border-green-200 p-8 text-center shadow-sm">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Submitted successfully</h1>
          <p className="text-gray-500 text-sm">Your intake information and authorization have been received. You may close this window.</p>
        </div>
      </div>
    );
  }

  const { patient_name, firm_name, phi_scope, purpose, expires_at } = linkData;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {/* PROTOTYPE BANNER */}
      <div className="max-w-2xl mx-auto mb-6 bg-yellow-100 border-2 border-yellow-400 rounded-lg px-5 py-3 text-center">
        <p className="text-yellow-900 font-bold text-sm uppercase tracking-wide">
          ⚠️ PROTOTYPE — Synthetic data only. Do not enter real patient information.
        </p>
      </div>

      <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-slate-800 text-white px-8 py-6">
          <h1 className="text-xl font-bold">Patient Intake & Authorization</h1>
          <p className="text-slate-300 text-sm mt-1">Patient: {patient_name}</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-8">

          {/* ── INTAKE FORM ── */}
          <section>
            <h2 className="text-base font-bold text-gray-900 mb-5 pb-2 border-b border-gray-100">Injury Information</h2>
            <div className="space-y-5">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Injury</label>
                <input
                  type="date"
                  value={form.date_of_injury}
                  onChange={e => setField('date_of_injury', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">How did the injury occur?</label>
                <textarea
                  value={form.accident_description}
                  onChange={e => setField('accident_description', e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                  placeholder="Briefly describe how the accident/injury happened…"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Injury description</label>
                <textarea
                  value={form.injury_description}
                  onChange={e => setField('injury_description', e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                  placeholder="Describe the injury and any diagnoses…"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Body parts affected</label>
                <div className="flex flex-wrap gap-2">
                  {BODY_PARTS.map(part => (
                    <button
                      key={part}
                      type="button"
                      onClick={() => toggleBodyPart(part)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        form.body_parts.includes(part)
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-slate-400'
                      }`}
                    >
                      {part}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current symptoms</label>
                <textarea
                  value={form.symptoms}
                  onChange={e => setField('symptoms', e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                  placeholder="Pain, numbness, limited range of motion, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Insurance type</label>
                  <select
                    value={form.insurance_type}
                    onChange={e => setField('insurance_type', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="">Select…</option>
                    {INSURANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Insurance details</label>
                  <input
                    type="text"
                    value={form.insurance_details}
                    onChange={e => setField('insurance_details', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    placeholder="Carrier, policy #, claim #…"
                  />
                </div>
              </div>

            </div>
          </section>

          {/* ── HIPAA AUTHORIZATION ── */}
          <section className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-blue-900 mb-1">HIPAA Authorization for Disclosure</h2>
            <p className="text-xs text-blue-700 mb-4 uppercase tracking-wide font-semibold">Please read carefully before signing</p>

            <div className="space-y-3 text-sm text-blue-900">
              <p>
                <span className="font-semibold">Disclosing party:</span> The practice identified in this intake.
              </p>
              <p>
                <span className="font-semibold">Recipient:</span> {firm_name}
              </p>
              <p>
                <span className="font-semibold">Information to be disclosed:</span>{' '}
                {Array.isArray(phi_scope) && phi_scope.length > 0
                  ? phi_scope.join(', ')
                  : 'Medical records and treatment information as specified by the practice.'}
              </p>
              <p>
                <span className="font-semibold">Purpose:</span> {purpose}
              </p>
              <p>
                <span className="font-semibold">Authorization expires:</span>{' '}
                {expires_at ? new Date(expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Upon completion of the legal matter or one year from signing, whichever comes first.'}
              </p>
              <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 mt-2">
                <p className="font-semibold mb-1">Your right to revoke</p>
                <p className="text-xs leading-relaxed">
                  You have the right to revoke this authorization at any time by submitting a written request to the practice.
                  Revocation will not affect any disclosures already made in reliance on this authorization prior to receiving your revocation.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-start gap-3">
              <input
                type="checkbox"
                id="auth_affirm"
                checked={form.authorization_affirmed}
                onChange={e => setField('authorization_affirmed', e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-400 accent-blue-700 cursor-pointer"
              />
              <label htmlFor="auth_affirm" className="text-sm font-medium text-blue-900 cursor-pointer leading-snug">
                I authorize the above disclosure of my protected health information. I have read and understand this authorization.
              </label>
            </div>
          </section>

          {/* ── SIGNATURE ── */}
          <section>
            <h2 className="text-base font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">Signature</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type your full legal name to sign <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.signer_name}
                onChange={e => setField('signer_name', e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="Full legal name"
              />
              <p className="text-xs text-gray-400 mt-1">
                By typing your name and clicking Submit, you are signing this form electronically. This signature has the same legal effect as a handwritten signature.
              </p>
            </div>
          </section>

          {/* ── SUBMIT ── */}
          {submitState === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={!form.authorization_affirmed || !form.signer_name.trim() || submitState === 'submitting'}
            className="w-full bg-slate-800 text-white font-semibold py-3 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitState === 'submitting' ? 'Submitting…' : 'Submit Intake & Authorization'}
          </button>

          {!form.authorization_affirmed && (
            <p className="text-center text-xs text-gray-400">You must check the authorization checkbox above before submitting.</p>
          )}

        </form>
      </div>
    </div>
  );
}