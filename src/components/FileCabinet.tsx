import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../App';

const FOLDERS: [string, string][] = [
  ['intake_form',      'Intake forms'],
  ['imaging',          'Imaging'],
  ['lab',              'Lab results'],
  ['referral',         'Referral documents'],
  ['records_package',  'Records package'],
  ['billing',          'Billing'],
  ['lien_document',    'Lien documents'],
  ['other',            'Other'],
];

export default function FileCabinet({ chartId, practiceId }: { chartId: string; practiceId: string }) {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [busy, setBusy] = useState('');

  async function load() {
    const { data } = await supabase
      .from('documents').select('*').eq('chart_id', chartId).order('created_at', { ascending: false });
    setDocs(data ?? []);
  }
  useEffect(() => { load(); }, [chartId]);

  async function upload(category: string, file: File) {
    setBusy(category);
    const path = `${practiceId}/${chartId}/${category}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('patient-files').upload(path, file);
    if (!error) {
      await supabase.from('documents').insert({
        chart_id: chartId, name: file.name, category,
        storage_path: path, uploaded_by: profile?.id,
      });
    }
    setBusy('');
    load();
  }

  async function openDoc(d: any) {
    if (!d.storage_path) return;
    const { data } = await supabase.storage.from('patient-files').createSignedUrl(d.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  return (
    <div className="grid two">
      {FOLDERS.map(([cat, label]) => {
        const items = docs.filter(d => d.category === cat);
        return (
          <div className="card" key={cat} style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{label}</h3>
              <span className="tag soft tiny">{items.length}</span>
            </div>
            <div style={{ margin: '10px 0' }}>
              {items.length === 0 && <span className="muted small">Empty.</span>}
              {items.map(d => (
                <div key={d.id} className="clickable" onClick={() => openDoc(d)}
                  style={{ display: 'flex', justifyContent: 'space-between',
                    padding: '5px 0', borderBottom: '1px solid var(--paper-2)', fontSize: 13.5 }}>
                  <span>{d.name}</span>
                  <span className="muted tiny">{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
            <label className="btn ghost sm" style={{ display: 'inline-block', cursor: 'pointer' }}>
              {busy === cat ? 'Uploading…' : '+ Upload'}
              <input type="file" style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && upload(cat, e.target.files[0])} />
            </label>
          </div>
        );
      })}
    </div>
  );
}
