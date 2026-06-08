/* AD_ScreenPatients — patient list */
window.AD_ScreenPatients = (function() {
  const C   = window.AD_Components;
  const D   = window.AD_Data;

  return function ScreenPatients({ onSelectChart }) {
    const rows = D.getChartList();
    const active = rows.filter(function(r) { return !['discharged', 'closed', 'treatment_complete'].includes(r.status); }).length;

    return React.createElement(React.Fragment, null,

      React.createElement('div', { className: 'page-h' },
        React.createElement('div', null,
          React.createElement('h1', null, 'Patients'),
          React.createElement('div', { className: 'sub' }, rows.length + ' charts · ' + active + ' active'),
        ),
        React.createElement('div', { className: 'actions' },
          React.createElement(C.Btn, { variant: 'teal' }, '+ New referral'),
        ),
      ),

      React.createElement(C.Card, { noPad: true, overflow: true },
        React.createElement('table', null,
          React.createElement('thead', null,
            React.createElement('tr', null,
              React.createElement('th', null, 'Patient'),
              React.createElement('th', null, 'Status'),
              React.createElement('th', null, 'Payer'),
              React.createElement('th', null, 'Provider'),
              React.createElement('th', null, 'Date of injury'),
              React.createElement('th', { style: { textAlign: 'right' } }, 'Balance'),
            ),
          ),
          React.createElement('tbody', null,
            rows.map(function(r) {
              const payer = D.payerBadge[r.payer_type] || { label: r.payer_type || '—', cls: 'soft' };
              const statusCls = D.statusTag[r.status] || 'soft';
              const statusLabel = (r.status || '').replace(/_/g, ' ');
              return React.createElement('tr', {
                key: r.id,
                className: 'tr-click',
                onClick: function() { onSelectChart(r.id); },
              },
                React.createElement('td', null, React.createElement('strong', null, r.patients ? r.patients.full_name : '—')),
                React.createElement('td', null, React.createElement(C.Tag, { cls: statusCls }, statusLabel)),
                React.createElement('td', null, React.createElement(C.Tag, { cls: payer.cls }, payer.label)),
                React.createElement('td', { className: 'small muted' }, r.provider ? r.provider.full_name : '—'),
                React.createElement('td', { className: 'small' }, r.date_of_injury || '—'),
                React.createElement('td', { className: 'small', style: { textAlign: 'right' } },
                  r.total_balance != null ? '$' + Number(r.total_balance).toLocaleString() : '—'
                ),
              );
            })
          ),
        ),
      ),
    );
  };
})();
