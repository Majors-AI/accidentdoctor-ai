import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { db } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';

const CATEGORIES = ['HIPAA', 'Onboarding', 'Billing', 'Clinical', 'General'];
const CAT_COLOR = {
  HIPAA: '#7c3aed', Onboarding: '#0369a1', Billing: '#b45309',
  Clinical: '#059669', General: '#475569',
};
const TIMEOUT_MS = 8000;
const BLANK = { title: '', description: '', category: 'HIPAA', required: false, estimated_minutes: 30 };

export default function ModuleManager() {
  const { user } = useAuth();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | module object
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState(BLANK);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) { setLoading(false); setError('Request timed out. Try refreshing.'); }
    }, TIMEOUT_MS);

    (async () => {
      const mods = await db.entities.TrainingModule.list();
      clearTimeout(timer);
      if (cancelled) return;
      setModules(mods);
      setLoading(false);
    })();

    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  function openNew() { setForm(BLANK); setEditing('new'); }
  function openEdit(mod) { setForm({ ...mod }); setEditing(mod); }
  function closeForm() { setEditing(null); }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = { ...form, estimated_minutes: Number(form.estimated_minutes) || 0 };
    if (editing === 'new') {
      // practice_id is required by the multi-tenant training_modules table + its
      // RLS write check (practice_id = my_practice_id()); supply the caller's practice.
      const created = await db.entities.TrainingModule.create({ ...payload, practice_id: user.practice_id });
      setModules(ms => [...ms, created]);
    } else {
      await db.entities.TrainingModule.update(editing.id, payload);
      setModules(ms => ms.map(m => m.id === editing.id ? { ...m, ...payload } : m));
    }
    setSaving(false);
    closeForm();
  }

  async function handleSeed() {
    setSeeding(true);
    const res = await base44.functions.invoke('seedTrainingModules', {});
    if (res.data?.ok) {
      const fresh = await db.entities.TrainingModule.list();
      setModules(fresh);
    }
    setSeeding(false);
  }

  async function handleDelete(mod) {
    if (!window.confirm(`Delete module "${mod.title}"? This won't remove existing assignments.`)) return;
    await db.entities.TrainingModule.delete(mod.id);
    setModules(ms => ms.filter(m => m.id !== mod.id));
  }

  if (loading) return <div style={{ color: '#525870', padding: 12 }}>Loading modules…</div>;
  if (error) return <ErrorBanner msg={error} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13.5, color: '#525870' }}>{modules.length} module{modules.length !== 1 ? 's' : ''}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {modules.length === 0 && (
            <button onClick={handleSeed} disabled={seeding} style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 8, padding: '7px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: seeding ? 0.7 : 1 }}>
              {seeding ? 'Seeding…' : '✦ Load sample modules'}
            </button>
          )}
          <button onClick={openNew} style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            + Add module
          </button>
        </div>
      </div>

      {/* Form */}
      {editing && (
        <div style={{ background: '#f8f9fd', border: '1px solid #ddd6fe', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>{editing === 'new' ? 'New Module' : 'Edit Module'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Label>Title *</Label>
              <FInput value={form.title} onChange={v => set('title', v)} placeholder="Module title" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Label>Description</Label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Brief description" rows={2}
                style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e3ed', fontSize: 13, resize: 'vertical' }} />
            </div>
            <div>
              <Label>Category</Label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e3ed', fontSize: 13 }}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>Estimated minutes</Label>
              <FInput value={form.estimated_minutes} onChange={v => set('estimated_minutes', v)} type="number" placeholder="30" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="req" checked={!!form.required} onChange={e => set('required', e.target.checked)} />
              <label htmlFor="req" style={{ fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>Required module</label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={handleSave} disabled={saving || !form.title.trim()}
              style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={closeForm} style={{ background: 'none', border: '1px solid #e0e3ed', borderRadius: 8, padding: '7px 18px', fontSize: 13, cursor: 'pointer', color: '#525870' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Module list */}
      <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(22,24,31,.07)' }}>
        {modules.length === 0 && (
          <div style={{ padding: '28px 20px', color: '#9ca0b8', textAlign: 'center', fontSize: 13.5 }}>
            No modules yet. Click "Add module" to create one.
          </div>
        )}
        {modules.map((mod, i) => (
          <div key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderBottom: i < modules.length - 1 ? '1px solid #f0f2f8' : 'none' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: CAT_COLOR[mod.category] || '#475569' }}>{mod.category}</span>
                {mod.required && <span style={{ fontSize: 10, fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 99, padding: '1px 6px' }}>Required</span>}
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#16181f' }}>{mod.title}</div>
              {mod.description && <div style={{ fontSize: 12.5, color: '#525870', marginTop: 1 }}>{mod.description}</div>}
            </div>
            {mod.estimated_minutes && <span style={{ fontSize: 12, color: '#9ca0b8', flexShrink: 0 }}>~{mod.estimated_minutes} min</span>}
            <button onClick={() => openEdit(mod)} style={{ background: 'none', border: '1px solid #e0e3ed', borderRadius: 7, padding: '4px 12px', fontSize: 12, color: '#525870', cursor: 'pointer' }}>Edit</button>
            <button onClick={() => handleDelete(mod)} style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 7, padding: '4px 12px', fontSize: 12, color: '#dc2626', cursor: 'pointer' }}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Label({ children }) {
  return <p style={{ fontSize: 12, fontWeight: 600, color: '#525870', margin: '0 0 5px' }}>{children}</p>;
}
function FInput({ value, onChange, placeholder, type = 'text' }) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e3ed', fontSize: 13 }} />;
}
function ErrorBanner({ msg }) {
  return (
    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '16px 20px', color: '#dc2626', fontSize: 13.5 }}>
      <strong>Could not load modules</strong>
      <p style={{ margin: '6px 0 0', color: '#991b1b', fontSize: 13 }}>{msg}</p>
    </div>
  );
}