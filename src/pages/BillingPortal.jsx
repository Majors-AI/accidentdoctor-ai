import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/api/entities';

const PAYER_BADGE = {
  pi_lien:         { label: 'PI Lien',       cls: 'gold' },
  workers_comp:    { label: "Workers' Comp", cls: 'ink' },
  health_insurance:{ label: 'Health Ins',    cls: 'good' },
  pip_medpay:      { label: 'PIP/MedPay',    cls: 'warn' },
  cash:            { label: 'Cash',          cls: 'soft' },
};

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BillingPortal() {
  const nav = useNavigate();
  const [charts, setCharts] = useState([]);
  const [patients, setPatients] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [chartData, patientData] = await Promise.all([
        db.entities.PatientChart.list('-total_balance', 200),
        db.entities.Patient.list('-created_date', 200),
      ]);
      const pMap = {};
      (patientData || []).forEach(p => { pMap[p.id] = p; });
      setPatients(pMap);
      // Only charts with a balance
      setCharts((chartData || []).filter(c => Number(c.total_balance || 0) > 0));
      setLoading(false);
    })();
  }, []);

  const totalAR = charts.reduce((s, c) => s + Number(c.total_balance || 0), 0);

  // Group by payer
  const byPayer = {};
  for (const c of charts) {
    const pt = c.payer_type || 'other';
    if (!byPayer[pt]) byPayer[pt] = { balance: 0, count: 0 };
    byPayer[pt].balance += Number(c.total_balance || 0);
    byPayer[pt].count++;
  }

  return (
    <div style={{ padding: '36px 44px', maxWidth: 1160 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.03em', margin: 0 }}>Billing Portal</h1>
          <p style={{ color: '#525870', fontSize: 13.5, marginTop: 3 }}>Practice-wide AR — charts with an outstanding balance</p>
        </div>
      </div>

      {/* AR summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 3px rgba(22,24,31,.08)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#525870', margin: '0 0 8px' }}>Total outstanding AR</p>
          <p style={{ fontSize: 32, fontWeight: 800, margin: 0, color: totalAR > 0 ? '#d97706' : '#059669' }}>${fmt(totalAR)}</p>
          <p style={{ fontSize: 12.5, color: '#525870', margin: '4px 0 0' }}>{charts.length} chart{charts.length !== 1 ? 's' : ''} with a balance</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignContent: 'start' }}>
          {Object.entries(byPayer).map(([pt, { balance, count }]) => {
            const badge = PAYER_BADGE[pt] || { label: pt.replace(/_/g, ' '), cls: 'soft' };
            return (
              <div key={pt} style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 10, padding: '14px 18px' }}>
                <p style={{ fontSize: 11.5, fontWeight: 600, color: '#525870', margin: '0 0 4px' }}>{badge.label}</p>
                <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>${fmt(balance)}</p>
                <p style={{ fontSize: 11.5, color: '#525870', margin: '2px 0 0' }}>{count} chart{count !== 1 ? 's' : ''}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts table */}
      <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(22,24,31,.08)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e0e3ed', background: '#f4f5f9' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#16181f' }}>Charts with outstanding balance</span>
          <span style={{ fontSize: 12, color: '#525870', marginLeft: 8 }}>· sorted by balance desc · click to open</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr>
              {['Patient', 'Payer', 'Status', 'Date of injury', 'Billed', 'Paid', 'Balance'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontWeight: 600, color: '#525870', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', padding: '10px 14px', borderBottom: '1px solid #e0e3ed', background: '#f4f5f9' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#525870' }}>Loading…</td></tr>}
            {!loading && charts.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#525870' }}>No charts with an outstanding balance.</td></tr>}
            {charts.map(c => {
              const payer = PAYER_BADGE[c.payer_type] || { label: c.payer_type || '—', cls: 'soft' };
              const bal = Number(c.total_balance || 0);
              return (
                <tr key={c.id} onClick={() => nav(`/patients/${c.id}`)} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8f9fd'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', fontWeight: 600 }}>{patients[c.patient_id]?.full_name || '—'}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8' }}><Tag cls={payer.cls} label={payer.label} /></td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', color: '#525870' }}>{(c.status || '—').replace(/_/g, ' ')}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', color: '#525870' }}>{c.date_of_injury || '—'}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8' }}>${fmt(c.total_billed)}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8' }}>${fmt(c.total_paid)}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', fontWeight: 700, color: bal > 0 ? '#d97706' : '#059669' }}>${fmt(bal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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