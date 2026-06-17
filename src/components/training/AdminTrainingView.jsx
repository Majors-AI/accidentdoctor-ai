import { useState } from 'react';
import ModuleManager from './ModuleManager';
import AssignmentMatrix from './AssignmentMatrix';

const TABS = [
  { id: 'modules', label: '📚 Modules' },
  { id: 'matrix',  label: '📊 Assignment Matrix' },
];

export default function AdminTrainingView() {
  const [tab, setTab] = useState('modules');

  return (
    <div style={{ padding: '36px 44px', maxWidth: 1100, fontFamily: 'inherit' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-.02em' }}>Staff Training</h1>
        <p style={{ color: '#525870', fontSize: 13.5, marginTop: 4 }}>Manage training modules and track staff completion.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid #e0e3ed' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', padding: '8px 18px', fontSize: 13.5, fontWeight: 600,
            color: tab === t.id ? '#4f46e5' : '#525870', cursor: 'pointer',
            borderBottom: tab === t.id ? '2px solid #4f46e5' : '2px solid transparent',
            marginBottom: -1, transition: 'color .1s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'modules' && <ModuleManager />}
      {tab === 'matrix'  && <AssignmentMatrix />}
    </div>
  );
}