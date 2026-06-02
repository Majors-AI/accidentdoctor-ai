import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';

// chart_status → tag class
const statusTag: Record<string, string> = {
  referral_received: 'soft',
  intake_scheduled:  'gold',
  intake_complete:   'gold',
  in_treatment:      'good',
  treatment_paused:  'warn',
  treatment_complete:'ink',
  discharged:        'soft',
  records_requested: 'soft',
  records_sent:      'soft',
  closed:            'soft',
};

// payer_type → { label, tag }
const payerBadge: Record<string, { label: string; cls: string }> = {
  pi_lien:       { label: 'PI Lien',    cls: 'gold' },
  workers_comp:  { label: 'Workers\' Comp', cls: 'ink' },
  health_insurance:{ label: 'Health Ins', cls: 'good' },
  pip_medpay:    { label: 'PIP/MedPay', cls: 'warn' },
  cash:          { label: 'Cash',       cls: 'soft' },
};

export default function PatientList() {
  const nav = useNavigate();
  const { profile } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const canReferral = ['front_desk', 'practice_admin', 'platform_admin'].includes(profile?.role ?? '');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('patient_charts')
        .select(`
          id, status, payer_type, date_of_injury, total_balance, updated_at,
          patients(full_name),
          provider:profiles!primary_provider_id(full_name)
        `)
        .order('updated_at', { ascending: false });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  const active = rows.filter(r => !['discharged','closed'].includes(r.status)).length;

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Patients</h1>
          <div className="sub">{rows.length} charts · {active} active</div>
        </div>
        {canReferral && (
          <button className="btn oxblood" onClick={() => nav('/referrals/new')}>
            + New referral
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Status</th>
              <th>Payer</th>
              <th>Provider</th>
              <th>Date of injury</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="muted">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="muted">No patient charts yet.</td></tr>
            )}
            {rows.map(r => {
              const payer = payerBadge[r.payer_type] ?? { label: r.payer_type ?? '—', cls: 'soft' };
              return (
                <tr key={r.id} className="clickable" onClick={() => nav(`/patients/${r.id}`)}>
                  <td><b>{r.patients?.full_name ?? '—'}</b></td>
                  <td>
                    <span className={`tag ${statusTag[r.status] ?? 'soft'}`}>
                      {(r.status ?? '').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td><span className={`tag tiny ${payer.cls}`}>{payer.label}</span></td>
                  <td className="small">{r.provider?.full_name ?? '—'}</td>
                  <td className="small">{r.date_of_injury ?? '—'}</td>
                  <td className="small" style={{ textAlign: 'right' }}>
                    {r.total_balance != null
                      ? `$${Number(r.total_balance).toLocaleString()}`
                      : '—'}
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
