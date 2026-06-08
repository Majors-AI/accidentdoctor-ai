/* AD_ScreenChart — chart detail with tabs */
window.AD_ScreenChart = (function() {
  const { useState } = React;
  const C   = window.AD_Components;
  const D   = window.AD_Data;

  const TABS = [
    { id: 'overview',     label: 'Overview' },
    { id: 'treatment',    label: 'Treatment' },
    { id: 'appointments', label: 'Appointments' },
    { id: 'notes',        label: 'Visit notes' },
    { id: 'billing',      label: 'Billing' },
    { id: 'discharge',    label: 'Discharge' },
  ];

  const noteStatusTag = { draft: 'soft', signed: 'good', amended: 'warn', finalized: 'ink' };

  function fmtDt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function dollars(n, decimals) {
    if (n == null) return '—';
    return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: decimals || 0, maximumFractionDigits: decimals || 0 });
  }

  /* ── OVERVIEW tab ── */
  function TabOverview({ chart, notes, apts, treatmentPlan }) {
    const pt = chart.patients || {};
    const signedCount = notes.filter(function(n) { return n.status === 'signed'; }).length;

    return React.createElement(React.Fragment, null,

      React.createElement(C.Card, null,
        React.createElement(C.CardHeader, { title: 'Patient' }),
        React.createElement(C.Kv, null,
          React.createElement(C.Dt, null, 'Name'),        React.createElement(C.Dd, null, pt.full_name || '—'),
          React.createElement(C.Dt, null, 'DOB'),         React.createElement(C.Dd, null, pt.dob || '—'),
          React.createElement(C.Dt, null, 'Phone'),       React.createElement(C.Dd, null, pt.phone || '—'),
          React.createElement(C.Dt, null, 'Email'),       React.createElement(C.Dd, null, pt.email || '—'),
          React.createElement(C.Dt, null, 'Address'),     React.createElement(C.Dd, null, pt.address || '—'),
          React.createElement(C.Dt, null, 'Health ins.'), React.createElement(C.Dd, null, pt.health_insurer || '—'),
        ),
      ),

      React.createElement(C.Card, null,
        React.createElement(C.CardHeader, { title: 'Injury' }),
        React.createElement(C.Kv, null,
          React.createElement(C.Dt, null, 'Date of injury'), React.createElement(C.Dd, null, chart.date_of_injury || '—'),
          React.createElement(C.Dt, null, 'Mechanism'),      React.createElement(C.Dd, null, (chart.mechanism_of_injury || '—').replace(/_/g, ' ')),
          React.createElement(C.Dt, null, 'Body regions'),   React.createElement(C.Dd, null, (chart.body_regions_affected || []).join(', ') || '—'),
          React.createElement(C.Dt, null, 'Description'),    React.createElement(C.Dd, null, chart.injury_description || '—'),
        ),
      ),

      chart.payer_type === 'pi_lien' && React.createElement(C.Card, null,
        React.createElement(C.CardHeader, { title: 'PI Lien' }),
        React.createElement(C.Kv, null,
          React.createElement(C.Dt, null, 'Attorney'),   React.createElement(C.Dd, null, chart.referring_attorney_name || '—'),
          React.createElement(C.Dt, null, 'Law firm'),   React.createElement(C.Dd, null, chart.referring_law_firm || '—'),
          chart.al_case_ref && React.createElement(C.Dt, null, 'AL case ref'),
          chart.al_case_ref && React.createElement(C.Dd, null, React.createElement('code', { className: 'small mono' }, chart.al_case_ref)),
          React.createElement(C.Dt, null, 'Lien on file'),
          React.createElement(C.Dd, null, chart.lien_on_file
            ? React.createElement(C.Tag, { cls: 'good' }, 'Yes' + (chart.lien_amount ? ' — $' + Number(chart.lien_amount).toLocaleString() : ''))
            : React.createElement(C.Tag, { cls: 'soft' }, 'Not yet')
          ),
        ),
      ),

      chart.payer_type === 'workers_comp' && React.createElement(C.Card, null,
        React.createElement(C.CardHeader, { title: "Workers' Comp" }),
        React.createElement(C.Kv, null,
          React.createElement(C.Dt, null, 'Claim #'),    React.createElement(C.Dd, null, chart.wc_claim_number || '—'),
          React.createElement(C.Dt, null, 'Employer'),   React.createElement(C.Dd, null, chart.wc_employer || '—'),
          React.createElement(C.Dt, null, 'Carrier'),    React.createElement(C.Dd, null, chart.wc_carrier || '—'),
          React.createElement(C.Dt, null, 'Adjuster'),   React.createElement(C.Dd, null,
            (chart.wc_adjuster_name || '—') + (chart.wc_adjuster_phone ? ' · ' + chart.wc_adjuster_phone : '')
          ),
          React.createElement(C.Dt, null, 'Auth status'),
          React.createElement(C.Dd, null,
            chart.wc_auth_status
              ? React.createElement(C.Tag, { cls: chart.wc_auth_status === 'authorized' ? 'good' : chart.wc_auth_status === 'denied' ? 'bad' : 'warn' }, chart.wc_auth_status)
              : '—'
          ),
        ),
      ),

      treatmentPlan && React.createElement(C.Card, null,
        React.createElement(C.CardHeader, { title: 'Treatment plan' }),
        React.createElement(C.Kv, null,
          treatmentPlan.frequency     && React.createElement(C.Dt, null, 'Frequency'),
          treatmentPlan.frequency     && React.createElement(C.Dd, null, treatmentPlan.frequency),
          treatmentPlan.planned_visits != null && React.createElement(C.Dt, null, 'Planned visits'),
          treatmentPlan.planned_visits != null && React.createElement(C.Dd, null, treatmentPlan.planned_visits),
          treatmentPlan.modalities && treatmentPlan.modalities.length > 0 && React.createElement(C.Dt, null, 'Modalities'),
          treatmentPlan.modalities && treatmentPlan.modalities.length > 0 && React.createElement(C.Dd, null, treatmentPlan.modalities.join(', ')),
          treatmentPlan.goals && React.createElement(C.Dt, null, 'Goals'),
          treatmentPlan.goals && React.createElement(C.Dd, null, treatmentPlan.goals),
          React.createElement(C.Dt, null, 'Progress'),
          React.createElement(C.Dd, null,
            React.createElement('strong', null, signedCount),
            ' visit' + (signedCount !== 1 ? 's' : '') + ' completed' +
            (treatmentPlan.planned_visits ? ' of ' + treatmentPlan.planned_visits : '')
          ),
        ),
      ),

      React.createElement(C.Card, null,
        React.createElement(C.CardHeader, { title: 'Consent & record sharing' }),
        React.createElement(C.Kv, null,
          React.createElement(C.Dt, null, 'HIPAA authorization'),
          React.createElement(C.Dd, null,
            chart.hipaa_authorization_signed
              ? React.createElement(React.Fragment, null,
                  React.createElement(C.Tag, { cls: 'good' }, 'Signed'),
                  chart.hipaa_signed_at && React.createElement('span', { className: 'muted small', style: { marginLeft: 8 } }, fmtDate(chart.hipaa_signed_at)),
                )
              : React.createElement(C.Tag, { cls: 'soft' }, 'Not on file')
          ),
          React.createElement(C.Dt, null, 'Share with firm'),
          React.createElement(C.Dd, null,
            chart.consent_share_with_firm && !chart.consent_revoked_at
              ? React.createElement(C.Tag, { cls: 'good' }, 'Sharing active')
              : chart.consent_revoked_at
                ? React.createElement(C.Tag, { cls: 'warn' }, 'Revoked')
                : React.createElement(C.Tag, { cls: 'soft' }, 'Not granted')
          ),
        ),
      ),
    );
  }

  /* ── TREATMENT tab ── */
  function TabTreatment({ notes, treatmentPlan }) {
    const signed = notes.filter(function(n) { return n.status === 'signed'; }).length;
    const planned = treatmentPlan ? treatmentPlan.planned_visits : null;

    return React.createElement(React.Fragment, null,
      React.createElement(C.Card, null,
        React.createElement(C.CardHeader, { title: 'Visit progress' }),
        React.createElement('div', { style: { fontSize: 15 } },
          React.createElement('strong', null, signed),
          ' signed visit' + (signed !== 1 ? 's' : ''),
          planned ? React.createElement('span', { className: 'muted' }, ' of ' + planned + ' planned') : null,
        ),
        planned ? React.createElement(C.Progress, { value: signed, max: planned }) : null,
      ),

      treatmentPlan ? React.createElement(C.Card, null,
        React.createElement(C.CardHeader, { title: 'Active plan' }),
        React.createElement(C.Kv, null,
          treatmentPlan.frequency     && React.createElement(C.Dt, null, 'Frequency'),
          treatmentPlan.frequency     && React.createElement(C.Dd, null, treatmentPlan.frequency),
          treatmentPlan.planned_visits != null && React.createElement(C.Dt, null, 'Planned visits'),
          treatmentPlan.planned_visits != null && React.createElement(C.Dd, null, treatmentPlan.planned_visits),
          treatmentPlan.modalities && treatmentPlan.modalities.length > 0 && React.createElement(C.Dt, null, 'Modalities'),
          treatmentPlan.modalities && treatmentPlan.modalities.length > 0 && React.createElement(C.Dd, null, treatmentPlan.modalities.join(', ')),
          treatmentPlan.goals && React.createElement(C.Dt, null, 'Goals'),
          treatmentPlan.goals && React.createElement(C.Dd, null, treatmentPlan.goals),
        ),
      ) : React.createElement(C.Card, null, React.createElement(C.Empty, null, 'No treatment plan yet.')),
    );
  }

  /* ── APPOINTMENTS tab ── */
  function TabAppointments({ apts }) {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 } },
        React.createElement('div', { className: 'muted small' }, apts.length + ' appointment' + (apts.length !== 1 ? 's' : '')),
        React.createElement(C.Btn, { variant: 'teal', sm: true }, '+ Add appointment'),
      ),
      React.createElement(C.Card, { noPad: true, overflow: true },
        React.createElement('table', null,
          React.createElement('thead', null,
            React.createElement('tr', null,
              React.createElement('th', null, 'Date & time'),
              React.createElement('th', null, 'Type'),
              React.createElement('th', null, 'Duration'),
              React.createElement('th', null, 'Status'),
              React.createElement('th', null, 'Reminder'),
            ),
          ),
          React.createElement('tbody', null,
            apts.length === 0
              ? React.createElement('tr', null, React.createElement('td', { colSpan: 5, className: 'muted' }, 'No appointments yet.'))
              : apts.map(function(a) {
                  return React.createElement('tr', { key: a.id },
                    React.createElement('td', { className: 'small' }, fmtDt(a.scheduled_at)),
                    React.createElement('td', { className: 'small' }, (a.visit_type || '—').replace(/_/g, ' ')),
                    React.createElement('td', { className: 'small' }, a.duration_minutes ? a.duration_minutes + 'm' : '—'),
                    React.createElement('td', null, React.createElement(C.Tag, { cls: a.status === 'completed' ? 'good' : a.status === 'cancelled' ? 'bad' : a.status === 'no_show' ? 'warn' : 'soft' }, a.status.replace(/_/g, ' '))),
                    React.createElement('td', null,
                      a.reminder_status === 'sent'
                        ? React.createElement(C.Tag, { cls: 'good' }, 'sent')
                        : React.createElement('span', { className: 'muted tiny' }, '—')
                    ),
                  );
                })
          ),
        ),
      ),
    );
  }

  /* ── VISIT NOTES tab ── */
  function TabNotes({ notes }) {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 } },
        React.createElement('div', { className: 'muted small' }, notes.length + ' note' + (notes.length !== 1 ? 's' : '') + ' · ' + notes.filter(function(n) { return n.status === 'signed'; }).length + ' signed'),
        React.createElement(C.Btn, { variant: 'teal', sm: true }, '+ New note'),
      ),

      notes.length === 0 && React.createElement(C.Card, null, React.createElement(C.Empty, null, 'No visit notes yet.')),

      notes.map(function(n) {
        const charges = n.charges || [];
        const noteTotal = charges.reduce(function(s, c) { return s + Number(c.fee_amount || 0) * Number(c.units || 1); }, 0);

        return React.createElement(C.Card, { key: n.id },
          React.createElement('div', { className: 'note-meta' },
            React.createElement('div', null,
              React.createElement('div', { className: 'note-date' }, n.visit_date),
              React.createElement('div', { className: 'note-provider' }, n.provider ? n.provider.full_name : '—'),
            ),
            React.createElement('div', { className: 'note-actions' },
              React.createElement(C.Tag, { cls: noteStatusTag[n.status] || 'soft' }, n.status),
              n.status === 'draft' && React.createElement(C.Btn, { sm: true }, 'Sign note'),
            ),
          ),
          React.createElement(C.Kv, null,
            n.subjective  && React.createElement(C.Dt, null, 'S'),
            n.subjective  && React.createElement(C.Dd, null, n.subjective),
            n.objective   && React.createElement(C.Dt, null, 'O'),
            n.objective   && React.createElement(C.Dd, null, n.objective),
            n.assessment  && React.createElement(C.Dt, null, 'A'),
            n.assessment  && React.createElement(C.Dd, null, n.assessment),
            n.plan        && React.createElement(C.Dt, null, 'P'),
            n.plan        && React.createElement(C.Dd, null, n.plan),
          ),

          n.status === 'signed' && n.signed_at && React.createElement('div', { className: 'muted tiny', style: { marginTop: 8 } },
            'Signed ' + fmtDt(n.signed_at)
          ),

          charges.length > 0 && React.createElement('div', { style: { marginTop: 14 } },
            React.createElement('div', { className: 'muted small', style: { marginBottom: 6, fontWeight: 600 } }, 'CPT charges'),
            React.createElement('table', { style: { fontSize: 13 } },
              React.createElement('thead', null,
                React.createElement('tr', null,
                  React.createElement('th', null, 'Code'),
                  React.createElement('th', null, 'Description'),
                  React.createElement('th', null, 'Units'),
                  React.createElement('th', { style: { textAlign: 'right' } }, 'Fee'),
                  React.createElement('th', null, 'Status'),
                ),
              ),
              React.createElement('tbody', null,
                charges.map(function(c) {
                  return React.createElement('tr', { key: c.id },
                    React.createElement('td', null, React.createElement('code', { className: 'mono small' }, c.cpt_code)),
                    React.createElement('td', { className: 'small muted' }, c.description || '—'),
                    React.createElement('td', { className: 'small' }, c.units || 1),
                    React.createElement('td', { className: 'small', style: { textAlign: 'right' } },
                      dollars(Number(c.fee_amount || 0) * Number(c.units || 1), 2)
                    ),
                    React.createElement('td', null,
                      React.createElement(C.Tag, { cls: c.status === 'paid' ? 'good' : c.status === 'billed' ? 'gold' : 'soft' }, c.status)
                    ),
                  );
                }),
                React.createElement('tr', null,
                  React.createElement('td', { colSpan: 3 }),
                  React.createElement('td', { className: 'small', style: { textAlign: 'right', fontWeight: 700 } }, dollars(noteTotal, 2)),
                  React.createElement('td', null),
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  /* ── BILLING tab ── */
  function TabBilling({ chart, notes, ledger }) {
    const allCharges = notes.flatMap(function(n) { return n.charges || []; });
    const billedTotal = allCharges.filter(function(c) { return ['billed','paid','adjusted','written_off'].includes(c.status); })
      .reduce(function(s, c) { return s + Number(c.fee_amount) * Number(c.units || 1); }, 0);
    const pendingTotal = allCharges.filter(function(c) { return c.status === 'pending'; })
      .reduce(function(s, c) { return s + Number(c.fee_amount) * Number(c.units || 1); }, 0);
    const paidTotal = (ledger || []).filter(function(e) { return Number(e.amount) < 0 && e.entry_type === 'payment'; })
      .reduce(function(s, e) { return s + Math.abs(Number(e.amount)); }, 0);
    const balance = billedTotal - paidTotal;

    return React.createElement(React.Fragment, null,

      React.createElement('div', { className: 'stat-grid' },
        React.createElement(C.StatCard, { label: 'Pending charges', value: dollars(pendingTotal, 2), color: pendingTotal > 0 ? 'var(--warn)' : undefined }),
        React.createElement(C.StatCard, { label: 'Total billed',    value: dollars(billedTotal, 2) }),
        React.createElement(C.StatCard, { label: 'Total paid',      value: dollars(paidTotal, 2),  color: 'var(--good)' }),
        React.createElement(C.StatCard, { label: 'Balance',         value: dollars(balance, 2),    color: balance > 0 ? 'var(--warn)' : 'var(--good)' }),
      ),

      React.createElement(C.Card, { noPad: true, overflow: true, style: { marginBottom: 14 } },
        React.createElement('div', { style: { padding: '14px 18px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('strong', null, 'Charge line items'),
          allCharges.some(function(c) { return c.status === 'pending'; }) && React.createElement(C.Btn, { variant: 'ghost', sm: true }, 'Mark all billed'),
        ),
        React.createElement('table', null,
          React.createElement('thead', null,
            React.createElement('tr', null,
              React.createElement('th', null, 'CPT'),
              React.createElement('th', null, 'Description'),
              React.createElement('th', { style: { textAlign: 'right' } }, 'Units'),
              React.createElement('th', { style: { textAlign: 'right' } }, 'Subtotal'),
              React.createElement('th', null, 'Status'),
            ),
          ),
          React.createElement('tbody', null,
            allCharges.length === 0
              ? React.createElement('tr', null, React.createElement('td', { colSpan: 5, className: 'muted' }, 'No charges yet.'))
              : allCharges.map(function(c) {
                  const sub = Number(c.fee_amount) * Number(c.units || 1);
                  const cls = c.status === 'paid' ? 'good' : c.status === 'billed' ? 'gold' : 'soft';
                  return React.createElement('tr', { key: c.id },
                    React.createElement('td', null, React.createElement('code', { className: 'mono small' }, c.cpt_code)),
                    React.createElement('td', { className: 'small muted' }, c.description || '—'),
                    React.createElement('td', { className: 'small', style: { textAlign: 'right' } }, c.units || 1),
                    React.createElement('td', { className: 'small', style: { textAlign: 'right', fontWeight: 600 } }, dollars(sub, 2)),
                    React.createElement('td', null, React.createElement(C.Tag, { cls }, c.status)),
                  );
                })
          ),
        ),
      ),

      React.createElement(C.Card, null,
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 } },
          React.createElement('strong', null, 'Ledger'),
          React.createElement(C.Btn, { variant: 'ghost', sm: true }, '+ Record payment'),
        ),
        (ledger || []).length === 0
          ? React.createElement(C.Empty, null, 'No ledger entries yet.')
          : React.createElement('table', null,
              React.createElement('thead', null,
                React.createElement('tr', null,
                  React.createElement('th', null, 'Date'),
                  React.createElement('th', null, 'Type'),
                  React.createElement('th', null, 'Memo'),
                  React.createElement('th', { style: { textAlign: 'right' } }, 'Amount'),
                ),
              ),
              React.createElement('tbody', null,
                (ledger || []).map(function(e) {
                  return React.createElement('tr', { key: e.id },
                    React.createElement('td', { className: 'small' }, e.entry_date || '—'),
                    React.createElement('td', null, React.createElement(C.Tag, { cls: e.entry_type === 'payment' ? 'good' : 'soft' }, e.entry_type)),
                    React.createElement('td', { className: 'small muted' }, e.memo || '—'),
                    React.createElement('td', { className: 'small', style: { textAlign: 'right', color: Number(e.amount) < 0 ? 'var(--good)' : undefined } },
                      dollars(Math.abs(Number(e.amount)), 2)
                    ),
                  );
                })
              ),
            )
      ),
    );
  }

  /* ── DISCHARGE tab ── */
  function TabDischarge({ chart, notes, dischargePkg }) {
    const signed = notes.filter(function(n) { return n.status === 'signed'; });

    if (dischargePkg) {
      return React.createElement('div', { className: 'discharge-pkg' },
        React.createElement('div', { className: 'pkg-header' },
          'Discharge package',
          React.createElement(C.Tag, { cls: 'good', style: { background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'rgba(255,255,255,.3)' } }, 'Complete'),
        ),
        React.createElement('div', { className: 'pkg-body' },
          React.createElement(C.Kv, null,
            React.createElement(C.Dt, null, 'Visit count'),    React.createElement(C.Dd, null, dischargePkg.visit_count),
            React.createElement(C.Dt, null, 'First visit'),    React.createElement(C.Dd, null, fmtDate(dischargePkg.date_first_visit)),
            React.createElement(C.Dt, null, 'Last visit'),     React.createElement(C.Dd, null, fmtDate(dischargePkg.date_last_visit)),
            React.createElement(C.Dt, null, 'Total billed'),   React.createElement(C.Dd, null, dollars(dischargePkg.total_billed, 2)),
            React.createElement(C.Dt, null, 'Total paid'),     React.createElement(C.Dd, null, dollars(dischargePkg.total_paid, 2)),
            React.createElement(C.Dt, null, 'Balance'),        React.createElement(C.Dd, null, dollars(dischargePkg.total_balance, 2)),
          ),
          React.createElement('div', { style: { marginTop: 14 } },
            React.createElement('div', { className: 'muted small', style: { marginBottom: 4, fontWeight: 600 } }, 'Diagnosis'),
            React.createElement('div', { style: { fontSize: 14 } }, dischargePkg.diagnosis_summary),
          ),
          dischargePkg.treatment_summary && React.createElement('div', { style: { marginTop: 10 } },
            React.createElement('div', { className: 'muted small', style: { marginBottom: 4, fontWeight: 600 } }, 'Treatment summary'),
            React.createElement('div', { style: { fontSize: 14 } }, dischargePkg.treatment_summary),
          ),
        ),
      );
    }

    return React.createElement(React.Fragment, null,
      signed.length === 0 && React.createElement(C.Flag, { variant: 'warn' }, 'No signed visit notes on file. Sign visit notes before generating a discharge package.'),
      React.createElement(C.Card, null,
        React.createElement(C.CardHeader, { title: 'Generate discharge package' }),
        React.createElement('div', null,
          React.createElement('label', null, 'Diagnosis summary'),
          React.createElement('textarea', { rows: 3, placeholder: 'ICD-10 codes, clinical summary…', style: { resize: 'vertical' } }),
          React.createElement('label', null, 'Treatment summary'),
          React.createElement('textarea', { rows: 3, placeholder: 'Overview of care provided…', style: { resize: 'vertical' } }),
          React.createElement('div', { className: 'form-actions' },
            React.createElement(C.Btn, { variant: 'teal', disabled: signed.length === 0 }, 'Generate discharge package'),
          ),
        ),
      ),
    );
  }

  /* ── Main chart screen ── */
  return function ScreenChart({ chartId, onBack }) {
    const [tab, setTab] = useState('overview');
    const chart = D.getChart(chartId);
    if (!chart) return React.createElement('div', { className: 'muted', style: { padding: 40 } }, 'Chart not found.');

    const pt          = chart.patients || {};
    const payer       = D.payerBadge[chart.payer_type] || { label: chart.payer_type || '—', cls: 'soft' };
    const statusCls   = D.statusTag[chart.status] || 'soft';
    const apts        = D.appointments[chartId] || [];
    const notes       = D.visitNotes[chartId] || [];
    const treatPlan   = D.treatmentPlans[chartId] || null;
    const ledger      = D.ledger[chartId] || [];
    const dischargePkg = D.dischargePackages[chartId] || null;

    const tabsWithCounts = TABS.map(function(t) {
      if (t.id === 'appointments') return { id: t.id, label: 'Appointments (' + apts.length + ')' };
      if (t.id === 'notes')        return { id: t.id, label: 'Visit notes (' + notes.length + ')' };
      return t;
    });

    return React.createElement(React.Fragment, null,

      React.createElement('div', { className: 'back-link', onClick: onBack },
        '← Patients'
      ),

      React.createElement('div', { className: 'page-h' },
        React.createElement('div', null,
          React.createElement('h1', null, pt.full_name || '—'),
          React.createElement('div', { className: 'sub' },
            (chart.mechanism_of_injury || '').replace(/_/g, ' ') +
            (chart.date_of_injury ? ' · injured ' + chart.date_of_injury : '')
          ),
        ),
        React.createElement('div', { className: 'actions' },
          React.createElement(C.Tag, { cls: payer.cls }, payer.label),
          React.createElement(C.Tag, { cls: statusCls }, (chart.status || '').replace(/_/g, ' ')),
        ),
      ),

      React.createElement(C.Tabs, { tabs: tabsWithCounts, active: tab, onChange: setTab }),

      tab === 'overview'     && React.createElement(TabOverview, { chart, notes, apts, treatmentPlan: treatPlan }),
      tab === 'treatment'    && React.createElement(TabTreatment, { notes, treatmentPlan: treatPlan }),
      tab === 'appointments' && React.createElement(TabAppointments, { apts }),
      tab === 'notes'        && React.createElement(TabNotes, { notes }),
      tab === 'billing'      && React.createElement(TabBilling, { chart, notes, ledger }),
      tab === 'discharge'    && React.createElement(TabDischarge, { chart, notes, dischargePkg }),
    );
  };
})();
