import { useState } from 'react';
import { db } from '@/api/entities';
import { ReadOnlyBanner } from './ProfileSection';

const SEED_FEE_SCHEDULE = [
  { code: '98940', description: 'Chiropractic Manipulative Treatment – 1-2 regions', charge: 75 },
  { code: '98941', description: 'Chiropractic Manipulative Treatment – 3-4 regions', charge: 95 },
  { code: '98942', description: 'Chiropractic Manipulative Treatment – 5 regions', charge: 115 },
  { code: '97110', description: 'Therapeutic Exercise', charge: 65 },
  { code: '97140', description: 'Manual Therapy Techniques', charge: 70 },
  { code: '97012', description: 'Mechanical Traction', charge: 55 },
  { code: '97035', description: 'Ultrasound Therapy', charge: 45 },
  { code: '99203', description: 'Office Visit – New Patient, Low Complexity', charge: 120 },
  { code: '99213', description: 'Office Visit – Established Patient, Low Complexity', charge: 90 },
];

export default function BillingSection({ practice, isAdmin, onSave }) {
  const [rows, setRows] = useState(
    practice?.fee_schedule?.length ? practice.fee_schedule : SEED_FEE_SCHEDULE
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function setRow(i, field, value) {
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function addRow() {
    setRows(rs => [...rs, { code: '', description: '', charge: 0 }]);
  }

  function removeRow(i) {
    setRows(rs => rs.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    const cleaned = rows.map(r => ({ ...r, charge: Number(r.charge) || 0 }));
    try {
      await db.entities.Practice.update(practice.id, { fee_schedule: cleaned });
    } catch (err) {
      setSaving(false);
      setError(err?.message || 'Failed to save fee schedule.');
      return;
    }
    setSaving(false);
    setSaved(true);
    onSave({ fee_schedule: cleaned });
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', margin: 0 }}>Billing Defaults</h2>
        <p style={{ color: '#525870', fontSize: 13.5, marginTop: 4 }}>CPT fee schedule — default charges used when billing encounters.</p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(22,24,31,.07)' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 110px 40px', gap: 0, padding: '9px 16px', borderBottom: '1px solid #e0e3ed', background: '#f8f9fd' }}>
          {['CPT Code', 'Description', 'Charge ($)', ''].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: '#525870', letterSpacing: '.08em', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>

        {rows.map((row, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 110px 40px', gap: 0, padding: '8px 12px', borderBottom: '1px solid #f0f2f8', alignItems: 'center' }}>
            <FeeInput value={row.code} disabled={!isAdmin} onChange={v => setRow(i, 'code', v)} placeholder="98940" mono />
            <FeeInput value={row.description} disabled={!isAdmin} onChange={v => setRow(i, 'description', v)} placeholder="Description" />
            <FeeInput value={row.charge} disabled={!isAdmin} onChange={v => setRow(i, 'charge', v)} placeholder="0.00" type="number" />
            {isAdmin ? (
              <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 16, cursor: 'pointer', padding: 4 }} title="Remove">×</button>
            ) : <span />}
          </div>
        ))}

        {isAdmin && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid #e0e3ed' }}>
            <button
              onClick={addRow}
              style={{ background: 'none', border: '1px dashed #c7cad8', borderRadius: 7, padding: '5px 14px', fontSize: 13, color: '#525870', cursor: 'pointer', fontWeight: 500 }}
            >
              + Add CPT code
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 600, fontSize: 13.5, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving…' : 'Save fee schedule'}
          </button>
          {saved && <span style={{ fontSize: 13, color: '#059669', fontWeight: 500 }}>✓ Saved</span>}
          {error && <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>⚠️ {error}</span>}
        </div>
      )}
      {!isAdmin && <ReadOnlyBanner />}
    </div>
  );
}

function FeeInput({ value, onChange, placeholder, disabled, type = 'text', mono }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: '95%', padding: '5px 8px', borderRadius: 6,
        border: disabled ? 'none' : '1px solid #e0e3ed',
        background: disabled ? 'transparent' : '#fff',
        fontSize: 13, color: '#16181f', outline: 'none',
        fontFamily: mono ? 'monospace' : 'inherit',
      }}
    />
  );
}