import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const payerBadge: Record<string, { label: string; cls: string }> = {
  pi_lien:          { label: 'PI Lien',       cls: 'gold' },
  workers_comp:     { label: "Workers' Comp", cls: 'ink'  },
  health_insurance: { label: 'Health Ins',    cls: 'good' },
  pip_medpay:       { label: 'PIP/MedPay',    cls: 'warn' },
  cash:             { label: 'Cash',           cls: 'soft' },
};

const statusTag: Record<string, string> = {
  in_treatment: 'good', referral_received: 'soft', intake_scheduled: 'gold',
  intake_complete: 'gold', treatment_paused: 'warn', treatment_complete: 'ink',
  discharged: 'soft', records_requested: 'soft', records_sent: 'soft', closed: 'soft',
};

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Billing() {
  const nav = useNavigate();
  const [charts, setCharts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('patient_charts')
      .select('id, patient_id, status, payer_type, date_of_injury, total_billed, total_paid, total_balance, patients(full_name)')
      .gt('total_balance', 0)
      .order('total_balance', { ascending: false })
      .then(({ data }) => { setCharts(data ?? []); setLoading(false); });
  }, []);

  const totalAR = charts.reduce((s, c) => s + Number(c.total_balance ?? 0), 0);
  const chartCount = charts.length;

  const byPayer: Record<string, { balance: number; count: number }> = {};
  for (const c of charts) {
    const pt = c.payer_type ?? 'other';
    if (!byPayer[pt]) byPayer[pt] = { balance: 0, count: 0 };
    byPayer[pt].balance += Number(c.total_balance ?? 0);
    byPayer[pt].count++;
  }

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Billing</h1>
          <div className="sub">Practice-wide AR — charts with an outstanding balance</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12, marginBottom: 24 }}>
        <div className="card stat-card" style={{ marginBottom: 0 }}>
          <div className="muted small">Total outstanding AR</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--serif)', marginTop: 4, color: totalAR > 0 ? 'var(--warn)' : undefined }}>
            ${fmt(totalAR)}
          </div>
          <div className="muted tiny" style={{ marginTop: 6 }}>
            {chartCount} chart{chartCount !== 1 ? 's' : ''} with a balance
          </div>
        </div>

        {Object.entries(byPayer).map(([pt, { balance, count }]) => {
          const badge = payerBadge[pt] ?? { label: pt.replace(/_/g, ' '), cls: 'soft' };
          return (
            <div key={pt} className="card stat-card" style={{ marginBottom: 0 }}>
              <div className="muted small">
                <span className={`tag tiny ${badge.cls}`}>{badge.label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--serif)', marginTop: 8 }}>
                ${fmt(balance)}
              </div>
              <div className="muted tiny" style={{ marginTop: 6 }}>
                {count} chart{count !== 1 ? 's' : ''}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px 12px', fontWeight: 600 }}>
          Charts with outstanding balance
          <span className="muted small" style={{ fontWeight: 400, marginLeft: 8 }}>
            · sorted by balance desc · click to open chart billing
          </span>
        </div>
        {loading ? (
          <div style={{ padding: '20px 18px' }} className="muted">Loading…</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Payer</th>
                <th>Status</th>
                <th>Date of injury</th>
                <th style={{ textAlign: 'right' }}>Billed</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {charts.length === 0 && (
                <tr><td colSpan={7} className="muted">No charts with an outstanding balance.</td></tr>
              )}
              {charts.map(c => {
                const payer = payerBadge[c.payer_type] ?? { label: c.payer_type ?? '—', cls: 'soft' };
                const stCls = statusTag[c.status] ?? 'soft';
                const bal = Number(c.total_balance ?? 0);
                return (
                  <tr key={c.id} className="clickable"
                    onClick={() => nav(`/patients/${c.id}?tab=billing`)}
                    style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 500 }}>{c.patients?.full_name ?? '—'}</td>
                    <td><span className={`tag tiny ${payer.cls}`}>{payer.label}</span></td>
                    <td><span className={`tag tiny ${stCls}`}>{(c.status ?? '—').replace(/_/g, ' ')}</span></td>
                    <td className="small muted">{c.date_of_injury ?? '—'}</td>
                    <td className="small" style={{ textAlign: 'right' }}>
                      ${fmt(Number(c.total_billed ?? 0))}
                    </td>
                    <td className="small" style={{ textAlign: 'right', color: 'var(--good)' }}>
                      ${fmt(Number(c.total_paid ?? 0))}
                    </td>
                    <td className="small" style={{ textAlign: 'right', fontWeight: 700,
                      color: bal > 0 ? 'var(--warn)' : 'var(--good)' }}>
                      ${fmt(bal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
