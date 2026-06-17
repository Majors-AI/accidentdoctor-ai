import { useState } from 'react';
import { db } from '@/api/entities';
import { ReadOnlyBanner } from './ProfileSection';

const WEEKDAYS = [
  { key: 1, label: 'Monday' },
  { key: 2, label: 'Tuesday' },
  { key: 3, label: 'Wednesday' },
  { key: 4, label: 'Thursday' },
  { key: 5, label: 'Friday' },
  { key: 6, label: 'Saturday' },
  { key: 0, label: 'Sunday' },
];

const DEFAULT_HOURS = {
  0: { open: '09:00', close: '17:00', closed: true },
  1: { open: '08:00', close: '18:00', closed: false },
  2: { open: '08:00', close: '18:00', closed: false },
  3: { open: '08:00', close: '18:00', closed: false },
  4: { open: '08:00', close: '18:00', closed: false },
  5: { open: '08:00', close: '18:00', closed: false },
  6: { open: '09:00', close: '14:00', closed: true },
};

export default function SchedulingSection({ practice, isAdmin, onSave }) {
  const [duration, setDuration] = useState(practice?.appt_duration_default ?? 45);
  const [hours, setHours] = useState(practice?.practice_hours ?? DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function setDay(dayKey, field, value) {
    setHours(h => ({ ...h, [dayKey]: { ...h[dayKey], [field]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    await db.entities.Practice.update(practice.id, {
      appt_duration_default: Number(duration),
      practice_hours: hours,
    });
    setSaving(false);
    setSaved(true);
    onSave({ appt_duration_default: Number(duration), practice_hours: hours });
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', margin: 0 }}>Scheduling Defaults</h2>
        <p style={{ color: '#525870', fontSize: 13.5, marginTop: 4 }}>Default appointment duration and practice hours.</p>
      </div>

      {/* Default duration */}
      <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, padding: '20px 22px', marginBottom: 18, boxShadow: '0 1px 3px rgba(22,24,31,.07)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 14px', color: '#16181f' }}>Default appointment duration</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {[15, 30, 45, 60, 90].map(m => (
            <button
              key={m}
              onClick={() => isAdmin && setDuration(m)}
              style={{
                padding: '7px 16px', borderRadius: 8, border: '1.5px solid',
                borderColor: duration === m ? '#4f46e5' : '#e0e3ed',
                background: duration === m ? '#ede9fe' : '#fff',
                color: duration === m ? '#4f46e5' : '#525870',
                fontWeight: 600, fontSize: 13.5, cursor: isAdmin ? 'pointer' : 'default',
              }}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>

      {/* Practice hours */}
      <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, padding: '20px 22px', marginBottom: 18, boxShadow: '0 1px 3px rgba(22,24,31,.07)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: '#16181f' }}>Practice hours</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {WEEKDAYS.map(({ key, label }) => {
            const day = hours[key] ?? { open: '08:00', close: '18:00', closed: false };
            return (
              <div key={key} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: '#16181f' }}>{label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#525870', cursor: isAdmin ? 'pointer' : 'default' }}>
                    <input
                      type="checkbox"
                      checked={!!day.closed}
                      disabled={!isAdmin}
                      onChange={e => setDay(key, 'closed', e.target.checked)}
                    />
                    Closed
                  </label>
                  {!day.closed && (
                    <>
                      <input
                        type="time"
                        value={day.open}
                        disabled={!isAdmin}
                        onChange={e => setDay(key, 'open', e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: 7, border: '1px solid #e0e3ed', fontSize: 13, background: isAdmin ? '#fff' : '#f4f5f9', color: '#16181f' }}
                      />
                      <span style={{ color: '#9ca0b8', fontSize: 13 }}>to</span>
                      <input
                        type="time"
                        value={day.close}
                        disabled={!isAdmin}
                        onChange={e => setDay(key, 'close', e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: 7, border: '1px solid #e0e3ed', fontSize: 13, background: isAdmin ? '#fff' : '#f4f5f9', color: '#16181f' }}
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Provider availability placeholder */}
      <div style={{ border: '1.5px dashed #c7cad8', borderRadius: 10, padding: '16px 20px', color: '#9ca0b8', fontSize: 13.5 }}>
        <strong style={{ color: '#525870' }}>Individual provider availability</strong>
        <p style={{ margin: '4px 0 0' }}>Per-provider schedules and blocked times will be configurable here in a future update.</p>
      </div>

      {isAdmin && (
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 600, fontSize: 13.5, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span style={{ fontSize: 13, color: '#059669', fontWeight: 500 }}>✓ Saved</span>}
        </div>
      )}
      {!isAdmin && <ReadOnlyBanner />}
    </div>
  );
}