/** Left-nav shell for the Practice Settings hub. */
export default function SettingsShell({ activeSection, onSection, sections }) {
  return (
    <div style={{ display: 'flex', gap: 0, minHeight: '100%' }}>
      {/* Left nav */}
      <nav style={{
        width: 200, flexShrink: 0, padding: '32px 12px',
        borderRight: '1px solid #e0e3ed', background: '#f8f9fd',
      }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9ca0b8', margin: '0 0 10px 8px' }}>Settings</p>
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => onSection(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: activeSection === s.id ? '#4f46e5' : 'transparent',
              color: activeSection === s.id ? '#fff' : '#525870',
              fontWeight: activeSection === s.id ? 600 : 500,
              fontSize: 13.5, marginBottom: 2, textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 15 }}>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </nav>

      {/* Content area */}
      <div style={{ flex: 1, padding: '32px 40px', maxWidth: 820, overflowY: 'auto' }}>
      </div>
    </div>
  );
}