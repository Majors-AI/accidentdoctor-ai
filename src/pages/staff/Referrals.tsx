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

export default function Referrals() {
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('patient_charts')
        .select(`
          id, status, payer_type, date_of_injury, created_at,
          patients(full_name),
          referring_attorney_name, referring_law_firm,
          wc_claim_number, wc_employer
        `)
        .eq('status', 'referral_received')
        .order('created_at', { ascending: false });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Referrals</h1>
          <div className="sub">{rows.length} pending intake</div>
        </div>
        <button className="btn oxblood" onClick={() => nav('/referrals/new')}>
          + New referral
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Payer</th>
              <th>Referring source</th>
              <th>Date of injury</th>
              <th>Received</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="muted">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No pending referrals. Use "+ New referral" to add one manually, or wait for AccidentLawyer.AI imports.
                </td>
              </tr>
            )}
            {rows.map(r => {
              const payer = payerBadge[r.payer_type] ?? { label: r.payer_type ?? '—', cls: 'soft' };
              const source =
                r.payer_type === 'pi_lien'
                  ? (r.referring_law_firm ?? r.referring_attorney_name ?? '—')
                  : r.payer_type === 'workers_comp'
                  ? (r.wc_employer ?? (r.wc_claim_number ? `Claim ${r.wc_claim_number}` : '—'))
                  : '—';
              return (
                <tr key={r.id} className="clickable" onClick={() => nav(`/patients/${r.id}`)}>
                  <td><b>{r.patients?.full_name ?? '—'}</b></td>
                  <td><span className={`tag tiny ${payer.cls}`}>{payer.label}</span></td>
                  <td className="small">{source}</td>
                  <td className="small">{r.date_of_injury ?? '—'}</td>
                  <td className="small muted">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </td>
                  <td>
                    <button
                      className="btn ghost sm"
                      onClick={e => { e.stopPropagation(); nav(`/patients/${r.id}`); }}
                    >
                      Open chart →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
