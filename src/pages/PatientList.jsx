import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/api/entities';

const STATUS_TAG = {
  referral_received: 'soft', intake_scheduled: 'gold', intake_complete: 'gold',
  in_treatment: 'good', treatment_paused: 'warn', treatment_complete: 'ink',
  discharged: 'soft', records_requested: 'soft', records_sent: 'soft', closed: 'soft',
};

const PAYER_BADGE = {
  pi_lien:        { label: 'PI Lien',       cls: 'gold' },
  workers_comp:   { label: "Workers' Comp", cls: 'ink' },
  health_insurance:{ label: 'Health Ins',   cls: 'good' },
  pip_medpay:     { label: 'PIP/MedPay',    cls: 'warn' },
  cash:           { label: 'Cash',          cls: 'soft' },
};

export default function PatientList() {
  const nav = useNavigate();
  const [charts, setCharts] = useState([]);
  const [patients, setPatients] = useState({});
  const [loading, setLoading] = useState(true);
  const deleted = new URLSearchParams(window.location.search).get('deleted') === '1';

  useEffect(() => {
    (async () => {
      const [chartData, patientData] = await Promise.all([
        db.entities.PatientChart.list('-updated_date', 200),
        db.entities.Patient.list('-created_date', 200),
      ]);
      const pMap = {};
      (patientData || []).forEach(p => { pMap[p.id] = p; });
      setPatients(pMap);
      setCharts(chartData || []);
      setLoading(false);
    })();
  }, []);

  const active = charts.filter(r => !['discharged', 'closed'].includes(r.status)).length;

  return (
    <div style={{ padding: '36px 44px', maxWidth: 1160 }}>
      {deleted && (
        <div style={{
          background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 10,
          padding: '11px 16px', marginBottom: 20, color: '#065f46', fontSize: 13.5, fontWeight: 500,
        }}>
          ✓ Patient, chart, and appointments deleted successfully.
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.03em', margin: 0 }}>Patients</h1>
          <p style={{ color: '#525870', fontSize: 13.5, marginTop: 3, fontWeight: 400 }}>
            {charts.length} charts · {active} active
          </p>
        </div>
        <button
          onClick={() => nav('/referrals/new')}
          style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 18px', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}
        >
          + New referral
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(22,24,31,.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr>
              {['Patient', 'Status', 'Payer', 'Date of Injury', 'Balance'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontWeight: 600, color: '#525870', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', padding: '10px 14px', borderBottom: '1px solid #e0e3ed', background: '#f4f5f9' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} style={{ padding: 24, color: '#525870', textAlign: 'center' }}>Loading…</td></tr>
            )}
            {!loading && charts.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 24, color: '#525870', textAlign: 'center' }}>No patient charts yet.</td></tr>
            )}
            {charts.map(r => {
              const patient = patients[r.patient_id];
              const payer = PAYER_BADGE[r.payer_type] || { label: r.payer_type || '—', cls: 'soft' };
              const stCls = STATUS_TAG[r.status] || 'soft';
              return (
                <tr
                  key={r.id}
                  onClick={() => nav(`/patients/${r.id}`)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8f9fd'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', fontWeight: 600 }}>
                    {patient?.full_name || '—'}
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8' }}>
                    <StatusTag cls={stCls} label={(r.status || '').replace(/_/g, ' ')} />
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8' }}>
                    <StatusTag cls={payer.cls} label={payer.label} />
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', color: '#525870' }}>
                    {r.date_of_injury || '—'}
                  </td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8' }}>
                    {r.total_balance != null ? `$${Number(r.total_balance).toLocaleString()}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusTag({ cls, label }) {
  const colors = {
    ink:  { bg: '#16181f', color: '#fff' },
    gold: { bg: '#fef9c3', color: '#b45309', border: '#fde68a' },
    good: { bg: '#d1fae5', color: '#059669', border: '#a7f3d0' },
    warn: { bg: '#fef3c7', color: '#d97706', border: '#fde68a' },
    bad:  { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
    soft: { bg: '#f4f5f9', color: '#525870', border: '#e0e3ed' },
  };
  const c = colors[cls] || colors.soft;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: 999,
      fontSize: 11.5, fontWeight: 600, letterSpacing: '.02em',
      background: c.bg, color: c.color, border: `1px solid ${c.border || 'transparent'}`,
    }}>
      {label}
    </span>
  );
}