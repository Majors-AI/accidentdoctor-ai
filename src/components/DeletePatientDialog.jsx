import { useState } from 'react';
import { db } from '@/api/entities';

/**
 * Confirmation dialog for permanently deleting a patient + chart + appointments.
 * Caller is responsible for only rendering this when user is practice_admin.
 *
 * Props:
 *   patient    – Patient record { id, full_name }
 *   chart      – PatientChart record { id }
 *   appointments – array of Appointment records [{ id }]
 *   onSuccess  – called after all deletes succeed (navigate away)
 *   onClose    – called when dialog is dismissed without deleting
 */
export default function DeletePatientDialog({ patient, chart, appointments, onSuccess, onClose }) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const expectedName = patient?.full_name || '';
  const canDelete = confirmText.trim() === expectedName.trim();

  async function handleDelete() {
    setError('');
    setDeleting(true);
    try {
      // 1. Delete all appointments
      for (const appt of (appointments || [])) {
        await db.entities.Appointment.delete(appt.id);
      }
      // 2. Delete the chart
      await db.entities.PatientChart.delete(chart.id);
      // 3. Delete the patient
      await db.entities.Patient.delete(patient.id);

      onSuccess();
    } catch (err) {
      setDeleting(false);
      setError(err?.message || 'An unexpected error occurred. Check your permissions and try again.');
    }
  }

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Dialog */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, padding: '32px 36px',
          maxWidth: 480, width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: '#fee2e2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>🗑️</div>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#16181f' }}>
            Delete patient permanently
          </h2>
        </div>

        <p style={{ fontSize: 13.5, color: '#525870', lineHeight: 1.6, margin: '0 0 18px' }}>
          This permanently deletes <strong>{expectedName}</strong>, their chart, and all{' '}
          {appointments?.length > 0 ? `${appointments.length} appointment${appointments.length !== 1 ? 's' : ''}` : 'appointments'}.{' '}
          <strong style={{ color: '#dc2626' }}>This action cannot be undone.</strong>
        </p>

        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#16181f', marginBottom: 6 }}>
          Type <span style={{ fontFamily: 'monospace', background: '#f4f5f9', padding: '1px 6px', borderRadius: 4 }}>{expectedName}</span> to confirm
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={e => { setConfirmText(e.target.value); setError(''); }}
          placeholder={expectedName}
          disabled={deleting}
          style={{
            width: '100%', boxSizing: 'border-box',
            border: '1px solid #e0e3ed', borderRadius: 8,
            padding: '8px 11px', fontSize: 13.5, color: '#16181f',
            background: '#fff', outline: 'none', marginBottom: 16,
          }}
        />

        {error && (
          <div style={{
            background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 9,
            padding: '10px 14px', marginBottom: 16, color: '#991b1b', fontSize: 13,
          }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={deleting}
            style={{
              background: '#fff', border: '1px solid #e0e3ed', borderRadius: 8,
              padding: '8px 18px', fontWeight: 600, fontSize: 13.5,
              cursor: deleting ? 'not-allowed' : 'pointer', color: '#525870',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!canDelete || deleting}
            style={{
              background: canDelete && !deleting ? '#dc2626' : '#fca5a5',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 20px', fontWeight: 700, fontSize: 13.5,
              cursor: canDelete && !deleting ? 'pointer' : 'not-allowed',
            }}
          >
            {deleting ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}