/* AD_Reference — design system reference page */
;(function() {
  const C = window.AD_Components;

  const COLORS = [
    { name: 'paper',    var: '--paper',    hex: '#f6f2e9' },
    { name: 'paper-2',  var: '--paper-2',  hex: '#efe9db' },
    { name: 'white',    var: '--white',    hex: '#fffdf8' },
    { name: 'line',     var: '--line',     hex: '#d9d0bd' },
    { name: 'ink',      var: '--ink',      hex: '#1c2230' },
    { name: 'ink-soft', var: '--ink-soft', hex: '#3a4254' },
    { name: 'teal',     var: '--teal',     hex: '#0e6b6b' },
    { name: 'teal-2',   var: '--teal-2',   hex: '#0f8585' },
    { name: 'gold',     var: '--gold',     hex: '#b08338' },
    { name: 'good',     var: '--good',     hex: '#3d6b4f' },
    { name: 'warn',     var: '--warn',     hex: '#b07a1f' },
    { name: 'bad',      var: '--bad',      hex: '#9a3b3b' },
  ];

  function Swatch({ name, hex, cssVar }) {
    return React.createElement('div', { className: 'swatch' },
      React.createElement('div', { className: 'swatch-color', style: { background: hex } }),
      React.createElement('div', { className: 'swatch-label' }, name),
      React.createElement('span', { className: 'swatch-var' }, cssVar),
    );
  }

  function Section({ title, children }) {
    return React.createElement('section', { className: 'ref-section' },
      React.createElement('div', { className: 'ref-section-h' }, title),
      children,
    );
  }

  function Reference() {
    return React.createElement('div', { className: 'ref-page' },

      /* Hero */
      React.createElement('div', { className: 'ref-hero' },
        React.createElement('div', { className: 'ref-version' }, 'v0.1.0 · design-exploration'),
        React.createElement('h1', null, 'AccidentDoctor.ai', React.createElement('br'), 'Design System'),
        React.createElement('p', null, 'Tokens, components, and patterns for the clinical portal. Inter + IBM Plex Mono · warm paper palette.'),
      ),

      /* Color */
      React.createElement(Section, { title: 'Color' },
        React.createElement('div', { className: 'swatch-grid' },
          COLORS.map(function(c) { return React.createElement(Swatch, { key: c.name, name: c.name, hex: c.hex, cssVar: c.var }); })
        ),

        React.createElement('div', { style: { marginTop: 20 } },
          React.createElement('div', { className: 'comp-label' }, 'Semantic tag colors'),
          React.createElement('div', { className: 'comp-row' },
            React.createElement(C.Tag, { cls: 'good' }, 'in treatment'),
            React.createElement(C.Tag, { cls: 'gold' }, 'intake scheduled'),
            React.createElement(C.Tag, { cls: 'warn' }, 'treatment paused'),
            React.createElement(C.Tag, { cls: 'bad' },  'closed'),
            React.createElement(C.Tag, { cls: 'ink' },  'treatment complete'),
            React.createElement(C.Tag, { cls: 'soft' }, 'referral received'),
            React.createElement(C.Tag, { cls: 'teal' }, 'in review'),
          ),
          React.createElement('div', { className: 'comp-row', style: { marginTop: 8 } },
            React.createElement(C.Tag, { cls: 'gold' }, 'PI Lien'),
            React.createElement(C.Tag, { cls: 'ink' },  "Workers' Comp"),
            React.createElement(C.Tag, { cls: 'good' }, 'Health Ins'),
            React.createElement(C.Tag, { cls: 'warn' }, 'PIP/MedPay'),
            React.createElement(C.Tag, { cls: 'soft' }, 'Cash'),
          ),
        ),
      ),

      /* Typography */
      React.createElement(Section, { title: 'Typography' },
        [
          { sample: React.createElement('h1', { style: { fontSize: 32 } }, 'Page heading / 32px 700'), spec: 'Inter 700  32px  −0.025em' },
          { sample: React.createElement('h1', { style: { fontSize: 26 } }, 'Page heading / 26px 700'), spec: 'Inter 700  26px  −0.02em' },
          { sample: React.createElement('h3', null, 'Card heading / 15px 600'), spec: 'Inter 600  15px  −0.01em' },
          { sample: React.createElement('p',  { style: { margin: 0 } }, 'Body text — clinical notes, patient data, form inputs.'), spec: 'Inter 400  15px  1.55' },
          { sample: React.createElement('p',  { className: 'small', style: { margin: 0 } }, 'Small text — table cells, secondary labels, metadata.'), spec: 'Inter 400  12.5px' },
          { sample: React.createElement('p',  { className: 'muted tiny', style: { margin: 0 } }, 'Tiny text — timestamps, captions, fine print.'), spec: 'Inter 400  11px' },
          { sample: React.createElement('code', { className: 'mono' }, '98940  SM9a2b3c4d  KIM-2025-441'), spec: 'IBM Plex Mono  13px' },
        ].map(function(row, i) {
          return React.createElement('div', { key: i, className: 'type-row' },
            React.createElement('div', null, row.sample),
            React.createElement('div', { className: 'spec' }, row.spec),
          );
        })
      ),

      /* Buttons */
      React.createElement(Section, { title: 'Buttons' },
        React.createElement('div', { className: 'comp-box' },
          React.createElement('div', { className: 'comp-label' }, 'Variants'),
          React.createElement('div', { className: 'comp-row' },
            React.createElement(C.Btn, null, 'Primary'),
            React.createElement(C.Btn, { variant: 'teal' }, 'Teal / CTA'),
            React.createElement(C.Btn, { variant: 'ghost' }, 'Ghost'),
            React.createElement(C.Btn, { disabled: true }, 'Disabled'),
          ),
          React.createElement('div', { className: 'comp-label', style: { marginTop: 14 } }, 'Sizes'),
          React.createElement('div', { className: 'comp-row' },
            React.createElement(C.Btn, null, 'Default (8/16)'),
            React.createElement(C.Btn, { sm: true }, 'Small (5/12)'),
            React.createElement(C.Btn, { xs: true }, 'XSmall (3/8)'),
          ),
        ),
      ),

      /* Cards */
      React.createElement(Section, { title: 'Cards' },
        React.createElement('div', { className: 'ref-grid' },
          React.createElement(C.Card, null,
            React.createElement(C.CardHeader, { title: 'Basic card', action: React.createElement(C.Btn, { variant: 'ghost', sm: true }, 'Edit') }),
            React.createElement('p', { className: 'small muted', style: { margin: 0 } }, 'White background, paper border, drop shadow. Max-width 1120px within main content area.'),
          ),
          React.createElement(C.Card, { noPad: true, overflow: true },
            React.createElement('div', { style: { padding: '12px 18px', borderBottom: '1px solid var(--line)', fontWeight: 600, fontSize: 14 } }, 'Table card (no padding)'),
            React.createElement('table', null,
              React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', null, 'Column A'), React.createElement('th', null, 'Column B'))),
              React.createElement('tbody', null,
                React.createElement('tr', { className: 'tr-click' }, React.createElement('td', null, 'Row one'), React.createElement('td', null, 'Value')),
                React.createElement('tr', { className: 'tr-click' }, React.createElement('td', null, 'Row two'), React.createElement('td', null, 'Value')),
              ),
            ),
          ),
        ),
      ),

      /* KV */
      React.createElement(Section, { title: 'Key-value list' },
        React.createElement('div', { className: 'comp-box' },
          React.createElement(C.Kv, null,
            React.createElement(C.Dt, null, 'Patient name'),     React.createElement(C.Dd, null, 'Maria Reyes'),
            React.createElement(C.Dt, null, 'Date of injury'),   React.createElement(C.Dd, null, '2025-11-04'),
            React.createElement(C.Dt, null, 'Mechanism'),        React.createElement(C.Dd, null, 'Motor vehicle accident'),
            React.createElement(C.Dt, null, 'Payer'),            React.createElement(C.Dd, null, React.createElement(C.Tag, { cls: 'gold' }, 'PI Lien')),
            React.createElement(C.Dt, null, 'Status'),           React.createElement(C.Dd, null, React.createElement(C.Tag, { cls: 'good' }, 'in treatment')),
          ),
        ),
      ),

      /* Flags */
      React.createElement(Section, { title: 'Flags / Alerts' },
        React.createElement(C.Flag, { variant: 'warn' }, React.createElement(React.Fragment, null, React.createElement('strong', null, 'Intake pending'), ' — referral received but intake not yet marked complete.')),
        React.createElement(C.Flag, { variant: 'bad'  }, React.createElement(React.Fragment, null, React.createElement('strong', null, 'Consent required'), ' — record sharing is not authorized for this patient.')),
        React.createElement(C.Flag, { variant: 'good' }, React.createElement(React.Fragment, null, React.createElement('strong', null, 'Discharge complete'), ' — package generated and records ready to transmit.')),
        React.createElement(C.Flag, { variant: 'info' }, 'Firm sharing is active. Records will be transmitted upon request.'),
      ),

      /* Tabs */
      React.createElement(Section, { title: 'Tabs' },
        React.createElement('div', { className: 'comp-box' },
          React.createElement(C.Tabs, {
            tabs: [
              { id: 'overview', label: 'Overview' },
              { id: 'treatment', label: 'Treatment' },
              { id: 'billing', label: 'Billing' },
              { id: 'discharge', label: 'Discharge' },
            ],
            active: 'overview',
            onChange: function() {},
          }),
          React.createElement('div', { className: 'muted small' }, 'Tab content area'),
        ),
      ),

      /* Form elements */
      React.createElement(Section, { title: 'Form elements' },
        React.createElement('div', { className: 'comp-box' },
          React.createElement('div', { className: 'row' },
            React.createElement('div', null,
              React.createElement('label', null, 'Visit date'),
              React.createElement('input', { type: 'date', defaultValue: '2026-06-08' }),
            ),
            React.createElement('div', null,
              React.createElement('label', null, 'Visit type'),
              React.createElement('select', null,
                React.createElement('option', null, '— select —'),
                React.createElement('option', null, 'Initial evaluation'),
                React.createElement('option', null, 'Follow-up'),
                React.createElement('option', null, 'Chiropractic'),
              ),
            ),
          ),
          React.createElement('div', null,
            React.createElement('label', null, 'Clinical notes'),
            React.createElement('textarea', { rows: 3, placeholder: 'Subjective findings…', style: { resize: 'vertical' } }),
          ),
        ),
      ),

      /* Billing stat grid */
      React.createElement(Section, { title: 'Billing stat grid' },
        React.createElement('div', { className: 'stat-grid' },
          React.createElement(C.StatCard, { label: 'Pending charges', value: '$255.00',    color: 'var(--warn)' }),
          React.createElement(C.StatCard, { label: 'Total billed',    value: '$8,200.00'  }),
          React.createElement(C.StatCard, { label: 'Total paid',      value: '$0.00',      color: 'var(--good)' }),
          React.createElement(C.StatCard, { label: 'Balance',         value: '$8,200.00',  color: 'var(--warn)' }),
        ),
      ),

    );
  }

  const mount = function() {
    if (!window.AD_Components) { setTimeout(mount, 30); return; }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Reference));
  };
  mount();
})();
