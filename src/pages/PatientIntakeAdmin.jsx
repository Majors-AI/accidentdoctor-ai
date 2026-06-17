import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { db } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';

const PHI_OPTIONS = [
  { value: 'intake_forms',       label: 'Intake Forms' },
  { value: 'treatment_records',  label: 'Treatment Records' },
  { value: 'billing_records',    label: 'Billing Records' },
  { value: 'imaging',            label: 'Imaging' },
  { value: 'progress_notes',     label: 'Progress Notes' },
];

const STATUS_STYLE = {
  pending:   'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  expired:   'bg-gray-100 text-gray-600',
  revoked:   'bg-red-100 text-red-700',
};

const EMPTY_FORM = {
  patient_name: '', patient_email: '', patient_phone: '',
  firm_name: '', purpose: '', phi_scope: [],
  expires_in_days: 14, practice_id: '',
};

export default function PatientIntakeAdmin() {
  const { user } = useAuth();
  const appRole = user?.app_role;

  const [practices, setPractices] = useState([]);
  const [practicesFallback, setPracticesFallback] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [createdUrl, setCreatedUrl] = useState('');
  const [formError, setFormError] = useState('');

  const [links, setLinks] = useState([]);
  const [linksLoading, setLinksLoading] = useState(true);
  // { [link_id]: { auth, intake, expanded } }
  const [rowState, setRowState] = useState({});
  const [revoking, setRevoking] = useState({});

  useEffect(() => {
    db.entities.Practice.list().then(rows => {
      if (rows.length === 0) setPracticesFallback(true);
      else setPractices(rows);
    }).catch(() => setPracticesFallback(true));
  }, []);

  useEffect(() => {
    loadLinks();
  }, []);

  async function loadLinks() {
    setLinksLoading(true);
    const rows = await base44.entities.IntakeLink.list('-created_date');
    // Pre-fetch authorizations for all links
    const authMap = {};
    await Promise.all(rows.map(async (row) => {
      const auths = await base44.entities.PatientAuthorization.filter({ link_id: row.id });
      authMap[row.id] = auths[0] ?? null;
    }));
    setLinks(rows);
    setRowState(prev => {
      const next = { ...prev };
      rows.forEach(r => {
        next[r.id] = { ...next[r.id], auth: authMap[r.id] };
      });
      return next;
    });
    setLinksLoading(false);
  }

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function togglePhi(val) {
    setForm(f => ({
      ...f,
      phi_scope: f.phi_scope.includes(val)
        ? f.phi_scope.filter(v => v !== val)
        : [...f.phi_scope, val],
    }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError('');
    if (!form.patient_name || !form.firm_name || !form.purpose || !form.practice_id || form.phi_scope.length === 0) {
      setFormError('Patient name, firm name, purpose, practice, and at least one PHI scope are required.');
      return;
    }
    setSubmitting(true);
    setCreatedUrl('');
    const res = await base44.functions.invoke('createIntakeLink', form);
    setSubmitting(false);
    if (res.data?.ok) {
      setCreatedUrl(`${window.location.origin}${res.data.url}`);
      setForm(EMPTY_FORM);
      loadLinks();
    } else {
      setFormError(res.data?.error || 'Failed to create link.');
    }
  }

  async function handleViewIntake(linkId) {
    setRowState(prev => ({ ...prev, [linkId]: { ...prev[linkId], intakeLoading: true, expanded: true } }));
    const intakes = await base44.entities.PatientIntake.filter({ link_id: linkId });
    setRowState(prev => ({ ...prev, [linkId]: { ...prev[linkId], intake: intakes[0] ?? null, intakeLoading: false } }));
  }

  async function handleRevoke(auth) {
    const reason = window.prompt('Reason for revocation (optional):') ?? '';
    setRevoking(r => ({ ...r, [auth.id]: true }));
    await base44.functions.invoke('revokePatientAuthorization', {
      authorization_id: auth.id,
      revoke_reason: reason,
    });
    setRevoking(r => ({ ...r, [auth.id]: false }));
    loadLinks();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-xl font-bold text-gray-900">Patient Intake Links</h1>

      {/* ── NEW LINK FORM ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-5">Create new intake link</h2>
        <form onSubmit={handleCreate} className="space-y-4">

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Patient name <span className="text-red-500">*</span></label>
              <input value={form.patient_name} onChange={e => setField('patient_name', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="Full name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Patient email</label>
              <input type="email" value={form.patient_email} onChange={e => setField('patient_email', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Patient phone</label>
              <input value={form.patient_phone} onChange={e => setField('patient_phone', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="(555) 000-0000" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Firm name <span className="text-red-500">*</span></label>
              <input value={form.firm_name} onChange={e => setField('firm_name', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="Law firm or requesting entity" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Purpose <span className="text-red-500">*</span></label>
              <input value={form.purpose} onChange={e => setField('purpose', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="e.g. Personal injury litigation" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Practice <span className="text-red-500">*</span></label>
              {practicesFallback ? (
                <input value={form.practice_id} onChange={e => setField('practice_id', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="Practice ID" />
              ) : (
                <select value={form.practice_id} onChange={e => setField('practice_id', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                  <option value="">Select practice…</option>
                  {practices.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expires in (days)</label>
              <input type="number" min={1} max={365} value={form.expires_in_days}
                onChange={e => setField('expires_in_days', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">PHI scope <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-2">
              {PHI_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => togglePhi(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    form.phi_scope.includes(opt.value)
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-slate-400'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <button type="submit" disabled={submitting}
            className="bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
            {submitting ? 'Creating…' : 'Create intake link'}
          </button>
        </form>

        {createdUrl && (
          <div className="mt-5 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-green-800 mb-2 uppercase tracking-wide">Shareable link</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 text-xs text-green-900 break-all">{createdUrl}</code>
              <button onClick={() => navigator.clipboard.writeText(createdUrl)}
                className="shrink-0 text-xs font-semibold bg-green-700 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 transition-colors">
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── LINK LIST ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">All intake links</h2>
        </div>

        {linksLoading ? (
          <div className="px-6 py-8 text-sm text-gray-400">Loading…</div>
        ) : links.length === 0 ? (
          <div className="px-6 py-8 text-sm text-gray-400">No intake links yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {links.map(link => {
              const rs = rowState[link.id] ?? {};
              const auth = rs.auth;
              const hasActiveAuth = auth && auth.status === 'active' && !auth.revoked_at;
              const canRevoke = appRole === 'practice_admin' && hasActiveAuth;
              const canViewIntake = appRole === 'practice_admin' || appRole === 'provider';

              return (
                <div key={link.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-gray-900">{link.patient_name || '—'}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[link.status] || 'bg-gray-100 text-gray-600'}`}>
                          {link.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {link.firm_name} {link.expires_at && `· expires ${new Date(link.expires_at).toLocaleDateString()}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {canViewIntake && (
                        <button onClick={() => rs.expanded ? setRowState(p => ({ ...p, [link.id]: { ...p[link.id], expanded: false } })) : handleViewIntake(link.id)}
                          className="text-xs font-medium text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                          {rs.expanded ? 'Hide intake' : 'View intake'}
                        </button>
                      )}
                      {canRevoke && (
                        <button onClick={() => handleRevoke(auth)} disabled={revoking[auth.id]}
                          className="text-xs font-medium text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
                          {revoking[auth.id] ? 'Revoking…' : 'Revoke authorization'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded intake view */}
                  {rs.expanded && (
                    <div className="mt-3 bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
                      {rs.intakeLoading ? (
                        <span className="text-gray-400">Loading intake…</span>
                      ) : !rs.intake ? (
                        <span className="text-gray-400 italic">No intake data submitted yet.</span>
                      ) : (
                        <div className="space-y-1.5">
                          {rs.intake.date_of_injury && <div><span className="font-medium">Date of injury:</span> {rs.intake.date_of_injury}</div>}
                          {rs.intake.accident_description && <div><span className="font-medium">Accident:</span> {rs.intake.accident_description}</div>}
                          {rs.intake.injury_description && <div><span className="font-medium">Injury:</span> {rs.intake.injury_description}</div>}
                          {rs.intake.body_parts?.length > 0 && <div><span className="font-medium">Body parts:</span> {rs.intake.body_parts.join(', ')}</div>}
                          {rs.intake.symptoms && <div><span className="font-medium">Symptoms:</span> {rs.intake.symptoms}</div>}
                          {rs.intake.insurance_type && <div><span className="font-medium">Insurance:</span> {rs.intake.insurance_type} {rs.intake.insurance_details && `— ${rs.intake.insurance_details}`}</div>}
                          {rs.intake.signer_name && <div><span className="font-medium">Signed by:</span> {rs.intake.signer_name}</div>}
                          {rs.intake.submitted_at && <div><span className="font-medium">Submitted:</span> {new Date(rs.intake.submitted_at).toLocaleString()}</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}