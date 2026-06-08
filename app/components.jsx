/* AD_Components — shared UI components */
window.AD_Components = (function() {
  const { useState } = React;

  /* Tag / Badge */
  function Tag({ cls, children, style }) {
    return React.createElement('span', { className: 'tag ' + (cls || 'soft'), style }, children);
  }

  /* Button */
  function Btn({ variant, sm, xs, onClick, disabled, children, style, type }) {
    const cls = ['btn', variant || '', sm ? 'sm' : '', xs ? 'xs' : ''].filter(Boolean).join(' ');
    return React.createElement('button', { className: cls, onClick, disabled, style, type: type || 'button' }, children);
  }

  /* Card */
  function Card({ children, style, noPad, overflow }) {
    return React.createElement('div', {
      className: 'card',
      style: Object.assign({}, style, noPad ? { padding: 0 } : {}, overflow ? { overflow: 'hidden' } : {}),
    }, children);
  }

  /* CardHeader — title + optional action slot */
  function CardHeader({ title, action }) {
    return React.createElement('div', { className: 'card-h' },
      React.createElement('h3', null, title),
      action || null,
    );
  }

  /* KV list */
  function Kv({ children }) {
    return React.createElement('dl', { className: 'kv' }, children);
  }
  function Dt({ children }) { return React.createElement('dt', null, children); }
  function Dd({ children }) { return React.createElement('dd', null, children); }

  /* Tabs */
  function Tabs({ tabs, active, onChange }) {
    return React.createElement('div', { className: 'tabs' },
      tabs.map(function(t) {
        return React.createElement('button', {
          key: t.id,
          className: 'tab' + (active === t.id ? ' on' : ''),
          onClick: function() { onChange(t.id); },
        }, t.label);
      })
    );
  }

  /* Flag / Alert */
  function Flag({ variant, children }) {
    return React.createElement('div', { className: 'flag ' + (variant || 'warn') }, children);
  }

  /* Stat card */
  function StatCard({ label, value, color, sub }) {
    return React.createElement('div', { className: 'stat-card' },
      React.createElement('div', { className: 'stat-label' }, label),
      React.createElement('div', { className: 'stat-val', style: color ? { color } : {} }, value),
      sub ? React.createElement('div', { className: 'stat-sub' }, sub) : null,
    );
  }

  /* Progress bar */
  function Progress({ value, max }) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    return React.createElement('div', { className: 'progress-wrap' },
      React.createElement('div', { className: 'progress-fill', style: { width: pct + '%' } })
    );
  }

  /* Form row */
  function Row({ children }) {
    return React.createElement('div', { className: 'row' }, children);
  }

  /* Back link */
  function BackLink({ onClick, children }) {
    const Icons = window.AD_Icons;
    return React.createElement('div', { className: 'back-link', onClick },
      Icons ? React.createElement(Icons.ChevronLeft, { size: 12 }) : '←',
      children,
    );
  }

  /* Empty state */
  function Empty({ children }) {
    return React.createElement('div', { className: 'muted small', style: { padding: '8px 0' } }, children || 'Nothing here yet.');
  }

  /* Scaffold placeholder */
  function Scaffold({ children }) {
    return React.createElement('div', { className: 'scaffold' }, children);
  }

  /* Inset form container */
  function InsetForm({ title, children }) {
    return React.createElement('div', { className: 'inset-form' },
      React.createElement('div', { className: 'inset-title' }, title),
      children,
    );
  }

  return { Tag, Btn, Card, CardHeader, Kv, Dt, Dd, Tabs, Flag, StatCard, Progress, Row, BackLink, Empty, Scaffold, InsetForm };
})();
