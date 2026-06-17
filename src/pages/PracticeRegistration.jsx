// Stage 1 — Practice Registration (admin onboarding placeholder)
// Grows into the full onboarding wizard in a later pass.
import { useNavigate } from 'react-router-dom';

export default function PracticeRegistration() {
  return (
    <div style={{ padding: '36px 44px', maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.03em', margin: 0 }}>Practice Registration</h1>
        <p style={{ color: '#525870', fontSize: 13.5, marginTop: 3 }}>Onboard new practices to the AccidentDoctor.AI platform</p>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e0e3ed', borderRadius: 14, padding: '28px', boxShadow: '0 1px 3px rgba(22,24,31,.08)', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>Admin onboarding surface</h3>
        <p style={{ color: '#525870', fontSize: 13.5, margin: 0 }}>
          This stage will contain the practice sign-up flow: agreement to HIPAA data security terms,
          plan selection, initial admin user invite, and practice profile creation.
          Wires into the Practices admin console below.
        </p>
      </div>
      <div style={{ border: '1.5px dashed #e0e3ed', borderRadius: 10, padding: 24, color: '#525870', fontSize: 13.5, background: '#fff' }}>
        Scaffold — full onboarding wizard coming in a future pass.
      </div>
    </div>
  );
}