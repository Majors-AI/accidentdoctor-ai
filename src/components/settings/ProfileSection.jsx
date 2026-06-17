import { useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function ProfileSection({ practice, isAdmin, onSave }) {
  const [form, setForm] = useState({
    name: practice?.name || '',
    specialty: practice?.specialty || '',
    address: practice?.address || '',
    city: practice?.city || '',
    state: practice?.state || '',
    phone: practice?.phone || '',
    npi: practice?.npi || '',
    tax_id: practice?.tax_id || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    setSaving(true);
    await base44.entities.Practice.update(practice.id, form);
    setSaving(false);
    setSaved(true);
    onSave(form);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      <SectionHeader title="Practice Profile" subtitle="Basic information about your practice." />

      {/* Logo placeholder */}
      <div style={{ marginBottom: 24 }}>
        <Label>Logo</Label>
        <div style={{
          width: 90, height: 90, borderRadius: 14, border: '1.5px dashed #c7cad8',
          background: '#f4f5f9', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 4, color: '#9ca0b8',
          fontSize: 11.5, fontWeight: 500, cursor: 'not-allowed',
        }}>
          <span style={{ fontSize: 22 }}>🏥</span>
          Upload
        </div>
        <p style={{ fontSize: 11.5, color: '#9ca0b8', margin: '6px 0 0' }}>Logo upload coming soon.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
        <Field label="Practice name *" span>
          <Input value={form.name} disabled={!isAdmin} onChange={e => set('name', e.target.value)} />
        </Field>
        <Field label="Specialty">
          <Input value={form.specialty} disabled={!isAdmin} onChange={e => set('specialty', e.target.value)} placeholder="e.g. Chiropractic" />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} disabled={!isAdmin} onChange={e => set('phone', e.target.value)} placeholder="(555) 000-0000" />
        </Field>
        <Field label="Street address" span>
          <Input value={form.address} disabled={!isAdmin} onChange={e => set('address', e.target.value)} placeholder="123 Main St" />
        </Field>
        <Field label="City">
          <Input value={form.city} disabled={!isAdmin} onChange={e => set('city', e.target.value)} placeholder="Los Angeles" />
        </Field>
        <Field label="State">
          <Input value={form.state} disabled={!isAdmin} onChange={e => set('state', e.target.value)} placeholder="CA" />
        </Field>
        <Field label="NPI number">
          <Input value={form.npi} disabled={!isAdmin} onChange={e => set('npi', e.target.value)} placeholder="10-digit NPI" />
        </Field>
        <Field label="Tax ID / EIN">
          <Input value={form.tax_id} disabled={!isAdmin} onChange={e => set('tax_id', e.target.value)} placeholder="XX-XXXXXXX" />
        </Field>
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

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', margin: 0 }}>{title}</h2>
      {subtitle && <p style={{ color: '#525870', fontSize: 13.5, marginTop: 4 }}>{subtitle}</p>}
    </div>
  );
}

function Label({ children }) {
  return <p style={{ fontSize: 12, fontWeight: 600, color: '#525870', margin: '0 0 6px', letterSpacing: '.02em' }}>{children}</p>;
}

function Field({ label, children, span }) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : {}}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, disabled }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8,
        border: '1px solid #e0e3ed', fontSize: 13.5, background: disabled ? '#f4f5f9' : '#fff',
        color: disabled ? '#525870' : '#16181f', outline: 'none',
      }}
    />
  );
}

export function ReadOnlyBanner() {
  return (
    <div style={{ marginTop: 16, fontSize: 12.5, color: '#9ca0b8', background: '#f8f9fd', border: '1px solid #e0e3ed', borderRadius: 8, padding: '8px 14px' }}>
      🔒 Read-only — only Practice Admins can edit settings.
    </div>
  );
}