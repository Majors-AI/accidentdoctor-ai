import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import ProfileSection from '@/components/settings/ProfileSection';
import StaffSection from '@/components/settings/StaffSection';
import SchedulingSection from '@/components/settings/SchedulingSection';
import BillingSection from '@/components/settings/BillingSection';

const SECTIONS = [
  { id: 'profile',    label: 'Practice Profile', icon: '🏥' },
  { id: 'staff',      label: 'Staff',            icon: '👥' },
  { id: 'scheduling', label: 'Scheduling',        icon: '📅' },
  { id: 'billing',    label: 'Billing Defaults',  icon: '💰' },
];

export default function PracticeSettings() {
  const { user } = useAuth();
  const isAdmin = user?.app_role === 'practice_admin';
  const [practice, setPractice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('staff');



  useEffect(() => {
    (async () => {
      const data = await base44.entities.Practice.list('-created_date', 1);
      setPractice(data?.[0] || null);
      setLoading(false);
    })();
  }, []);

  function handleSave(updates) {
    setPractice(p => ({ ...p, ...updates }));
  }

  if (loading) return <div style={{ padding: 44, color: '#525870' }}>Loading…</div>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'inherit' }}>
      {/* Left nav */}
      <nav style={{
        width: 208, flexShrink: 0,
        padding: '32px 10px',
        borderRight: '1px solid #e0e3ed',
        background: '#f8f9fd',
      }}>
        <div style={{ padding: '0 8px 16px' }}>
          <h1 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#16181f', letterSpacing: '-.02em' }}>
            {practice?.name || 'Practice Settings'}
          </h1>
          {isAdmin && (
            <p style={{ fontSize: 11.5, color: '#4f46e5', margin: '2px 0 0', fontWeight: 600 }}>Practice Admin</p>
          )}
          {!isAdmin && (
            <p style={{ fontSize: 11.5, color: '#9ca0b8', margin: '2px 0 0' }}>Read-only</p>
          )}
        </div>
        <div style={{ borderBottom: '1px solid #e0e3ed', margin: '0 8px 14px' }} />
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9ca0b8', margin: '0 0 8px 8px' }}>Settings</p>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: activeSection === s.id ? '#4f46e5' : 'transparent',
              color: activeSection === s.id ? '#fff' : '#525870',
              fontWeight: activeSection === s.id ? 600 : 500,
              fontSize: 13.5, marginBottom: 2, textAlign: 'left',
              transition: 'background .12s',
            }}
          >
            <span style={{ fontSize: 15 }}>{s.icon}</span>
            {s.label}
            {s.id === 'staff' && (
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: activeSection === 'staff' ? 'rgba(255,255,255,.25)' : '#4f46e5', color: '#fff', borderRadius: 99, padding: '1px 6px' }}>
                Key
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div style={{ flex: 1, padding: '36px 44px', maxWidth: 840, overflowY: 'auto' }}>


        {!practice ? (
          <div style={{ border: '1.5px dashed #e0e3ed', borderRadius: 10, padding: 32, color: '#525870', fontSize: 14, background: '#fff', textAlign: 'center' }}>
            No practice record found. Contact your platform administrator.
          </div>
        ) : (
          <>
            {activeSection === 'profile' && (
              <ProfileSection practice={practice} isAdmin={isAdmin} onSave={handleSave} />
            )}
            {activeSection === 'staff' && (
              <StaffSection isAdmin={isAdmin} />
            )}
            {activeSection === 'scheduling' && (
              <SchedulingSection practice={practice} isAdmin={isAdmin} onSave={handleSave} />
            )}
            {activeSection === 'billing' && (
              <BillingSection practice={practice} isAdmin={isAdmin} onSave={handleSave} />
            )}
          </>
        )}
      </div>
    </div>
  );
}