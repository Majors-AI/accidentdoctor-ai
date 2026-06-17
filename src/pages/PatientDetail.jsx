import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import DeletePatientDialog from '@/components/DeletePatientDialog';

const PAYER_BADGE = {
  pi_lien:         { label: 'PI Lien',       cls: 'gold' },
  workers_comp:    { label: "Workers' Comp", cls: 'ink' },
  health_insurance:{ label: 'Health Ins',    cls: 'good' },
  pip_medpay:      { label: 'PIP/MedPay',    cls: 'warn' },
  cash:            { label: 'Cash',          cls: 'soft' },
};

const STATUS_OPTIONS = [
  'referral_received','intake_scheduled','intake_complete','in_treatment',
  'treatment_paused','treatment_complete','discharged','records_requested','records_sent','closed',
];

export default function PatientDetail() {
  const nav = useNavigate();
  const { user } = useAuth();
  const isPracticeAdmin = user?.app_role === 'practice_admin';
  const id = window.location.pathname.split('/').pop();
  const [chart, setChart] = useState(null);
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [chartData, apptData] = await Promise.all([
        base44.entities.PatientChart.filter({ id }),
        base44.entities.Appointment.filter({ chart_id: id }, '-scheduled_at'),
      ]);
      const c = chartData?.[0] || null;
      setChart(c);
      if (c?.patient_id) {
        const pts = await base44.entities.Patient.filter({ id: c.patient_id });
        setPatient(pts?.[0] || null);
      }
      setAppointments(apptData || []);
      setLoading(false);
    })();
  }, [id]);

  async function updateStatus(status) {
    await base44.entities.PatientChart.update(chart.id, { status });
    setChart(c => ({ ...c, status }));
  }

  if (loading) return <div style={{ padding: 44, color: '#525870' }}>Loading…</div>;
  if (!chart) return <div style={{ padding: 44, color: '#525870' }}>Chart not found.</div>;

  const payer = PAYER_BADGE[chart.payer_type] || { label: chart.payer_type || '—', cls: 'soft' };

  return (
    <div style={{ padding: '36px 44px', maxWidth: 1060 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <button onClick={() => nav('/patients')} style={{ background: 'none', border: 'none', color: '#525870', fontSize: 13, cursor: 'pointer', padding: '0 0 6px', fontWeight: 500 }}>
            ← Patients
          </button>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.03em', margin: 0 }}>
            {patient?.full_name || 'Unknown patient'}
          </h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <Tag cls={payer.cls} label={payer.label} />
            <Tag cls="soft" label={(chart.status || '').replace(/_/g, ' ')} />
            {chart.date_of_injury && <Tag cls="soft" label={`DOI: ${chart.date_of_injury}`} />}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={chart.status}
            onChange={e => updateStatus(e.target.value)}
            style={{ fontSize: 13, padding: '6px 10px', borderRadius: 8, border: '1px solid #e0e3ed', background: '#fff', cursor: 'pointer' }}
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          {isPracticeAdmin && (
            <button
              onClick={() => setShowDeleteDialog(true)}
              style={{
                background: '#fff', border: '1px solid #fca5a5', borderRadius: 8,
                padding: '6px 13px', fontSize: 13, fontWeight: 600,
                color: '#dc2626', cursor: 'pointer',
              }}
            >
              Delete patient
            </button>
          )}
        </div>
      </div>

      {/* Delete dialog */}
      {showDeleteDialog && (
        <DeletePatientDialog
          patient={patient}
          chart={chart}
          appointments={appointments}
          onSuccess={() => nav('/patients?deleted=1')}
          onClose={() => setShowDeleteDialog(false)}
        />
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1.5px solid #e0e3ed', marginBottom: 24 }}>
        {['overview', 'appointments', 'billing'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: 'none', border: 'none', borderBottom: tab === t ? '2.5px solid #4f46e5' : '2.5px solid transparent',
              color: tab === t ? '#4f46e5' : '#525870', padding: '9px 16px',
              fontSize: 13.5, fontWeight: tab === t ? 700 : 500, cursor: 'pointer',
              marginBottom: -1.5, textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card title="Patient info">
            <KV label="Name" value={patient?.full_name || '—'} />
            <KV label="Phone" value={patient?.phone || '—'} />
            <KV label="Email" value={patient?.email || '—'} />
            <KV label="DOB" value={patient?.date_of_birth || '—'} />
          </Card>
          <Card title="Chart info">
            <KV label="Status" value={(chart.status || '').replace(/_/g, ' ')} />
            <KV label="Payer" value={payer.label} />
            <KV label="Date of injury" value={chart.date_of_injury || '—'} />
            <KV label="Balance" value={chart.total_balance != null ? `$${Number(chart.total_balance).toLocaleString()}` : '—'} />
          </Card>
          {chart.notes && (
            <div style={{ gridColumn: '1 / -1' }}>
              <Card title="Notes">
                <p style={{ color: '#525870', fontSize: 13.5, margin: 0 }}>{chart.notes}</p>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Appointments */}
      {tab === 'appointments' && (
        <Card title={`Appointments (${appointments.length})`}>
          {appointments.length === 0 ? (
            <p style={{ color: '#525870', fontSize: 13.5 }}>No appointments yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr>
                  {['Date & time', 'Visit type', 'Duration', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontWeight: 600, color: '#525870', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', padding: '8px 12px', borderBottom: '1px solid #e0e3ed' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appointments.map(a => (
                  <tr key={a.id}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f2f8' }}>
                      {a.scheduled_at ? new Date(a.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f2f8', color: '#525870' }}>
                      {(a.visit_type || '—').replace(/_/g, ' ')}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f2f8', color: '#525870' }}>
                      {a.duration_minutes ? `${a.duration_minutes}m` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f2f8' }}>
                      <Tag cls="soft" label={(a.status || '').replace(/_/g, ' ')} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Billing */}
      {tab === 'billing' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
          <StatCard label="Total billed" value={`$${Number(chart.total_billed || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
          <StatCard label="Total paid" value={`$${Number(chart.total_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
          <StatCard label="Balance" value={`$${Number(chart.total_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} warn={Number(chart.total_balance || 0) > 0} />
        </div>
      )}
    </div>
  );
}

function Tag({ cls, label }) {
  const colors = {
    ink:  { bg: '#16181f', color: '#fff' },
    gold: { bg: '#fef9c3', color: '#b45309', border: '#fde68a' },
    good: { bg: '#d1fae5', color: '#059669', border: '#a7f3d0' },
    warn: { bg: '#fef3c7', color: '#d97706', border: '#fde68a' },
    soft: { bg: '#f4f5f9', color: '#525870', border: '#e0e3ed' },
  };
  const c = colors[cls] || colors.soft;
  return (
    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border || 'transparent'}` }}>
      {label}
    </span>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 3px rgba(22,24,31,.08)' }}>
      <h3 style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-.015em', marginBottom: 14, color: '#16181f', marginTop: 0 }}>{title}</h3>
      {children}
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '5px 12px', fontSize: 13.5, marginBottom: 6 }}>
      <dt style={{ color: '#525870', margin: 0 }}>{label}</dt>
      <dd style={{ margin: 0, color: '#16181f' }}>{value}</dd>
    </div>
  );
}

function StatCard({ label, value, warn }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, padding: '18px 22px', boxShadow: '0 1px 3px rgba(22,24,31,.08)' }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#525870', margin: '0 0 8px' }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.03em', margin: 0, color: warn ? '#d97706' : '#16181f' }}>{value}</p>
    </div>
  );
}