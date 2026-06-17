import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export default function FileCabinet() {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // In Phase 1 we store file metadata as PatientChart notes or a simple local list.
  // This is a scaffold — real file storage via UploadFile integration.
  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFiles(prev => [...prev, {
      name: file.name,
      url: file_url,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user?.full_name || 'Unknown',
    }]);
    setUploading(false);
  };

  return (
    <div style={{ padding: '36px 44px', maxWidth: 1060 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.03em', margin: 0 }}>File Cabinet</h1>
          <p style={{ color: '#525870', fontSize: 13.5, marginTop: 3 }}>Practice-wide documents and files</p>
        </div>
        <label style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 18px', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', display: 'inline-block' }}>
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
        {uploading ? 'Uploading…' : 'Drop files here, or use the button above'}
      </div>

      {files.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, padding: 32, textAlign: 'center', color: '#525870' }}>
          No files uploaded yet.
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(22,24,31,.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr>
                {['File name', 'Type', 'Size', 'Uploaded by', 'Date', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontWeight: 600, color: '#525870', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', padding: '10px 14px', borderBottom: '1px solid #e0e3ed', background: '#f4f5f9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {files.map((f, i) => (
                <tr key={i} onMouseEnter={e => e.currentTarget.style.background = '#f8f9fd'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', fontWeight: 600 }}>📄 {f.name}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', color: '#525870' }}>{f.type || '—'}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', color: '#525870' }}>{f.size ? `${(f.size / 1024).toFixed(1)} KB` : '—'}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', color: '#525870' }}>{f.uploadedBy}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8', color: '#525870' }}>{new Date(f.uploadedAt).toLocaleDateString()}</td>
                  <td style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f8' }}>
                    <a href={f.url} target="_blank" rel="noreferrer" style={{ color: '#4f46e5', fontSize: 12.5, fontWeight: 600 }}>Download</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}