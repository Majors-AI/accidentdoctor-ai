import { useEffect, useState, useMemo } from 'react';
import { db } from '@/api/entities';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from 'date-fns';

const PAYER_LABEL = {
  pi_lien: 'PI Lien',
  workers_comp: "Worker's Comp",
  health_insurance: 'Health Ins.',
  pip_medpay: 'PIP/MedPay',
  cash: 'Cash',
};

const ACTIVE_STATUSES = new Set(['referral_received', 'intake_scheduled', 'intake_complete', 'in_treatment', 'treatment_paused']);

function fmt$(n) {
  return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function ErrorBox({ msg }) {
  return (
    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', color: '#dc2626', fontSize: 13.5, marginBottom: 20 }}>
      ⚠ {msg}
    </div>
  );
}

function KPI({ label, value, sub, color = '#4f46e5' }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, padding: '20px 24px', flex: '1 1 180px', boxShadow: '0 1px 3px rgba(22,24,31,.07)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#525870', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: '-.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca0b8', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function Reporting() {
  const [charts, setCharts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appts, setAppts] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sortField, setSortField] = useState('balance');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    let cancelled = false;
    const errs = [];

    async function load() {
      const [chartsRes, patientsRes, apptsRes] = await Promise.allSettled([
        db.entities.PatientChart.list('-created_date', 500),
        db.entities.Patient.list('-created_date', 500),
        db.entities.Appointment.list('-scheduled_at', 2000),
      ]);

      if (cancelled) return;

      if (chartsRes.status === 'fulfilled') setCharts(chartsRes.value);
      else errs.push('Failed to load patient charts: ' + chartsRes.reason?.message);

      if (patientsRes.status === 'fulfilled') setPatients(patientsRes.value);
      else errs.push('Failed to load patients: ' + patientsRes.reason?.message);

      if (apptsRes.status === 'fulfilled') setAppts(apptsRes.value);
      else errs.push('Failed to load appointments: ' + apptsRes.reason?.message);

      setErrors(errs);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── KPIs ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const activePatients = charts.filter(c => ACTIVE_STATUSES.has(c.status)).length;

    const apptsThisWeek = appts.filter(a => {
      try { return isWithinInterval(parseISO(a.scheduled_at), { start: weekStart, end: weekEnd }); }
      catch { return false; }
    }).length;

    const totalBalance = charts.reduce((s, c) => s + (Number(c.total_balance) || 0), 0);

    const monthCharts = charts.filter(c => {
      try { return isWithinInterval(parseISO(c.created_at), { start: monthStart, end: monthEnd }); }
      catch { return false; }
    });
    const chargesMonth = monthCharts.reduce((s, c) => s + (Number(c.total_billed) || 0), 0);
    const collectedMonth = monthCharts.reduce((s, c) => s + (Number(c.total_paid) || 0), 0);

    return { activePatients, apptsThisWeek, totalBalance, chargesMonth, collectedMonth };
  }, [charts, appts]);

  // ── Outstanding balance table ────────────────────────────────────────────
  const patientMap = useMemo(() => {
    const m = {};
    patients.forEach(p => { m[p.id] = p; });
    return m;
  }, [patients]);

  const lastApptByChart = useMemo(() => {
    const m = {};
    appts.forEach(a => {
      if (!a.chart_id) return;
      if (!m[a.chart_id] || a.scheduled_at > m[a.chart_id]) m[a.chart_id] = a.scheduled_at;
    });
    return m;
  }, [appts]);

  const balanceRows = useMemo(() => {
    return charts
      .filter(c => (Number(c.total_balance) || 0) > 0)
      .map(c => {
        const patient = patientMap[c.patient_id];
        const lastVisit = lastApptByChart[c.id];
        const daysSince = lastVisit
          ? Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86400000)
          : null;
        return {
          id: c.id,
          name: patient?.full_name || '—',
          payer: c.payer_type,
          balance: Number(c.total_balance) || 0,
          daysSince,
        };
      });
  }, [charts, patientMap, lastApptByChart]);

  const sortedRows = useMemo(() => {
    return [...balanceRows].sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (av === null) av = sortDir === 'desc' ? -Infinity : Infinity;
      if (bv === null) bv = sortDir === 'desc' ? -Infinity : Infinity;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [balanceRows, sortField, sortDir]);

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  }

  function SortArrow({ field }) {
    if (sortField !== field) return <span style={{ color: '#c7cad8', marginLeft: 3 }}>↕</span>;
    return <span style={{ color: '#4f46e5', marginLeft: 3 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  // ── Monthly referrals chart (last 6 months) ──────────────────────────────
  const referralData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const monthDate = subMonths(now, 5 - i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      const count = charts.filter(c => {
        try { return isWithinInterval(parseISO(c.created_at), { start, end }); }
        catch { return false; }
      }).length;
      return { month: format(monthDate, 'MMM yy'), count };
    });
  }, [charts]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#525870', fontSize: 14 }}>
        Loading reports…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 28px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', margin: 0 }}>Reporting</h1>
        <p style={{ color: '#525870', fontSize: 13.5, marginTop: 4 }}>Practice-wide read-only metrics.</p>
      </div>

      {errors.map((e, i) => <ErrorBox key={i} msg={e} />)}

      {/* KPIs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
        <KPI label="Active patients" value={kpis.activePatients} />
        <KPI label="Appts this week" value={kpis.apptsThisWeek} color="#0369a1" />
        <KPI label="Total outstanding" value={fmt$(kpis.totalBalance)} color="#dc2626" />
        <KPI label="Charges this month" value={fmt$(kpis.chargesMonth)} sub={`Collected: ${fmt$(kpis.collectedMonth)}`} color="#059669" />
      </div>

      {/* Monthly referrals chart */}
      <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, padding: '22px 24px', marginBottom: 28, boxShadow: '0 1px 3px rgba(22,24,31,.07)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 18px', color: '#16181f' }}>New referrals — last 6 months</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={referralData} barCategoryGap="40%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#525870' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#525870' }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{ border: '1px solid #e0e3ed', borderRadius: 8, fontSize: 13 }}
              formatter={(v) => [v, 'Referrals']}
            />
            <Bar dataKey="count" fill="#4f46e5" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Outstanding balance table */}
      <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(22,24,31,.07)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e3ed', display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#16181f' }}>Outstanding balances</h2>
          <span style={{ fontSize: 12, color: '#9ca0b8' }}>{sortedRows.length} patient{sortedRows.length !== 1 ? 's' : ''}</span>
        </div>
        {sortedRows.length === 0 ? (
          <div style={{ padding: '28px 20px', color: '#9ca0b8', fontSize: 13.5 }}>No outstanding balances.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: '#f8f9fd', borderBottom: '1px solid #e0e3ed' }}>
                  {[
                    { field: 'name', label: 'Patient' },
                    { field: 'payer', label: 'Payer' },
                    { field: 'balance', label: 'Balance' },
                    { field: 'daysSince', label: 'Days since last visit' },
                  ].map(col => (
                    <th
                      key={col.field}
                      onClick={() => toggleSort(col.field)}
                      style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#525870', letterSpacing: '.07em', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    >
                      {col.label}<SortArrow field={col.field} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, i) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f0f2f8', background: i % 2 === 0 ? '#fff' : '#fafbfd' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#16181f' }}>{row.name}</td>
                    <td style={{ padding: '10px 16px', color: '#525870' }}>{PAYER_LABEL[row.payer] || row.payer || '—'}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 700, color: '#dc2626' }}>{fmt$(row.balance)}</td>
                    <td style={{ padding: '10px 16px', color: row.daysSince > 60 ? '#dc2626' : '#525870' }}>
                      {row.daysSince === null ? '—' : `${row.daysSince}d ago`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}