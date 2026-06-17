import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { db } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';
import { logChartAccess } from '@/lib/accessLog';

const BUCKET = 'patient-documents';

// doc_category enum (schema.sql)
const CATEGORIES = [
  'intake_form', 'imaging', 'lab', 'referral',
  'records_request', 'records_package',
  'billing', 'auth_request', 'lien_document', 'other',
];
const CAT_LABEL = (c) => c.replace(/_/g, ' ');

export default function FileCabinet() {
  const { user } = useAuth();

  const [charts, setCharts] = useState([]);
  const [patientsById, setPatientsById] = useState({});
  const [staffById, setStaffById] = useState({});
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [selectedChartId, setSelectedChartId] = useState('');
  const [docs, setDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const [category, setCategory] = useState('other');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  // Load practice-scoped charts + patients + staff (all RLS-scoped to the practice).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [chartRows, patientRows, staffRows] = await Promise.all([
          db.entities.PatientChart.list('-created_at'),
          db.entities.Patient.list(),
          db.entities.User.list(),
        ]);
        if (cancelled) return;
        const pMap = {}; patientRows.forEach(p => { pMap[p.id] = p; });
        const sMap = {}; staffRows.forEach(s => { sMap[s.id] = s; });
        setPatientsById(pMap);
        setStaffById(sMap);
        setCharts(chartRows);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load patients.');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const chartOptions = useMemo(() => charts.map(c => {
    const p = patientsById[c.patient_id];
    const name = p?.full_name || 'Unknown patient';
    const doi = c.date_of_injury ? ` · DOI ${c.date_of_injury}` : '';
    return { id: c.id, label: `${name}${doi}` };
  }), [charts, patientsById]);

  async function loadDocs(chartId) {
    if (!chartId) { setDocs([]); return; }
    setLoadingDocs(true);
    setError('');
    try {
      const rows = await db.entities.Document.filter({ chart_id: chartId }, '-created_at');
      setDocs(rows);
    } catch (err) {
      setError(err.message || 'Failed to load documents.');
    } finally {
      setLoadingDocs(false);
    }
  }

  function onSelectChart(chartId) {
    setSelectedChartId(chartId);
    setError('');
    loadDocs(chartId);
  }

  async function handleUpload(file) {
    if (!file || !selectedChartId) return;
    setUploading(true);
    setError('');

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${user.practice_id}/${selectedChartId}/${crypto.randomUUID()}_${safeName}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
    if (upErr) {
      setError(`Upload failed: ${upErr.message}`);
      setUploading(false);
      return;
    }

    try {
      await db.entities.Document.create({
        chart_id: selectedChartId,
        name: file.name,
        category,
        storage_path: path,
        uploaded_by: user.id,
      });
    } catch (err) {
      // Don't orphan the object if the row insert fails.
      await supabase.storage.from(BUCKET).remove([path]);
      setError(`Could not save document record: ${err.message || 'Unknown error'}`);
      setUploading(false);
      return;
    }

    logChartAccess({
      chartId: selectedChartId,
      practiceId: user.practice_id,
      actorId: user.id,
      actorRole: user.app_role,
      action: 'upload_document',
    });

    await loadDocs(selectedChartId);
    setUploading(false);
  }

  async function handleDownload(doc) {
    setError('');
    const { data, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60);
    if (signErr || !data?.signedUrl) {
      setError(`Could not generate download link: ${signErr?.message || 'Unknown error'}`);
      return;
    }
    logChartAccess({
      chartId: selectedChartId,
      practiceId: user.practice_id,
      actorId: user.id,
      actorRole: user.app_role,
      action: 'download_document',
    });
    window.open(data.signedUrl, '_blank');
  }

  async function handleDelete(doc) {
    if (!window.confirm(`Delete "${doc.name}"? This permanently removes the file.`)) return;
    setError('');
    // Remove the object FIRST; only delete the row if the object removal succeeded.
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    if (rmErr) {
      setError(`Could not delete file: ${rmErr.message}`);
      return;
    }
    try {
      await db.entities.Document.delete(doc.id);
    } catch (err) {
      setError(`File removed but record delete failed: ${err.message || 'Unknown error'}`);
      return;
    }
    setDocs(ds => ds.filter(d => d.id !== doc.id));
  }

  return (
    <div style={{ padding: '36px 44px', maxWidth: 1060 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.03em', margin: 0 }}>File Cabinet</h1>
        <p style={{ color: '#525870', fontSize: 13.5, marginTop: 3 }}>Patient documents — select a patient to view and manage their files.</p>
      </div>

      {/* Patient picker */}
      <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, padding: '18px 22px', marginBottom: 20, boxShadow: '0 1px 3px rgba(22,24,31,.08)' }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#525870', marginBottom: 8 }}>Patient</label>
        <select
          value={selectedChartId}
          onChange={e => onSelectChart(e.target.value)}
          disabled={loadingMeta}
          style={{ width: '100%', maxWidth: 460, fontSize: 14, padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e0e3ed', background: '#fff', cursor: 'pointer' }}
        >
          <option value="">{loadingMeta ? 'Loading patients…' : 'Select a patient…'}</option>
          {chartOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '11px 16px', marginBottom: 20, color: '#991b1b', fontSize: 13.5 }}>
          ⚠️ {error}
        </div>
      )}

      {!selectedChartId ? (
        <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, padding: 32, textAlign: 'center', color: '#525870' }}>
          Choose a patient above to view their documents.
        </div>
      ) : (
        <>
          {/* Upload controls */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#525870', marginBottom: 8 }}>Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{ fontSize: 13.5, padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e3ed', background: '#fff', cursor: 'pointer', textTransform: 'capitalize' }}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL(c)}</option>)}
              </select>
            </div>
            <label style={{ background: uploading ? '#a5b4fc' : '#4f46e5', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 18px', fontWeight: 600, fontSize: 13.5, cursor: uploading ? 'not-allowed' : 'pointer', display: 'inline-block' }}>
              {uploading ? 'Uploading…' : '+ Upload file'}
              <input type="file" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} disabled={uploading} />
            </label>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files?.[0]; if (file) handleUpload(file); }}
            style={{
              border: `2px dashed ${dragOver ? '#4f46e5' : '#e0e3ed'}`,
              borderRadius: 14, padding: 32, textAlign: 'center', marginBottom: 24,
              background: dragOver ? '#eef0f6' : '#f4f5f9', transition: 'border-color .15s, background .15s',
              color: '#525870', fontSize: 13.5,
            }}
          >
            {uploading ? 'Uploading…' : `Drop a file here to add it as "${CAT_LABEL(category)}", or use the button above`}
          </div>

          {/* Document table */}
          {loadingDocs ? (
            <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, padding: 32, textAlign: 'center', color: '#525870' }}>Loading documents…</div>
          ) : docs.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, padding: 32, textAlign: 'center', color: '#525870' }}>
              No documents for this patient yet.
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(22,24,31,.08)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr>
                    {['Name', 'Category', 'Uploaded by', 'Date', '', ''].map((h, i) => (
                      <th key={i} style={{ textAlign: 'left', fontWeight: 600, color: '#525870', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', padding: '10px 14px', borderBottom: '1px solid #e0e3ed', background: '#f4f5f9' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {docs.map(d => (
                    <tr key={d.id} onMouseEnter={e => e.currentTarget.style.background = '#f8f9fd'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', fontWeight: 600 }}>📄 {d.name}</td>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', color: '#525870', textTransform: 'capitalize' }}>{CAT_LABEL(d.category || 'other')}</td>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', color: '#525870' }}>{staffById[d.uploaded_by]?.full_name || '—'}</td>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', color: '#525870' }}>{d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}</td>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8' }}>
                        <button onClick={() => handleDownload(d)} style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Download</button>
                      </td>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8' }}>
                        <button onClick={() => handleDelete(d)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
