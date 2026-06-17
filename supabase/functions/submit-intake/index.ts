// supabase/functions/submit-intake/index.ts
// PUBLIC (deploy with --no-verify-jwt). Patient-facing intake submission +
// HIPAA authorization signing. Server-stamps signer_ip, signed_at, and a
// SHA-256 signature hash; writes patient_intakes + patient_authorizations and
// closes the link — all via service_role (bypasses RLS by design; this is the
// trusted server boundary). Faithful port of base44 submitIntake.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const admin = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const sb = admin();
    const b = await req.json();
    const {
      token, date_of_injury, injury_description, body_parts, symptoms,
      insurance_type, insurance_details, accident_description,
      authorization_affirmed, signer_name,
    } = b;

    if (!token) return json({ error: 'token is required' }, 400);
    if (authorization_affirmed !== true) return json({ error: 'authorization_affirmed must be true' }, 400);
    if (!signer_name?.trim()) return json({ error: 'signer_name is required' }, 400);

    const { data: link } = await sb.from('intake_links').select('*').eq('token', token).maybeSingle();
    if (!link) return json({ error: 'Not found' }, 404);

    const now = new Date();
    if (link.status === 'pending' && link.expires_at && new Date(link.expires_at) < now) {
      await sb.from('intake_links').update({ status: 'expired' }).eq('id', link.id);
      return json({ error: 'This intake link has expired' }, 410);
    }
    if (link.status !== 'pending') return json({ error: `Link is ${link.status}` }, 410);

    // Double-submit guard
    const { data: existing } = await sb.from('patient_authorizations')
      .select('id').eq('link_id', link.id).limit(1);
    if (existing && existing.length > 0) {
      await sb.from('intake_links').update({ status: 'completed', completed_at: now.toISOString() }).eq('id', link.id);
      return json({ ok: true, already_submitted: true });
    }

    const signed_at = now.toISOString();
    const fwd = req.headers.get('x-forwarded-for');
    const signer_ip = fwd ? fwd.split(',')[0].trim() : 'unknown';

    const intakeFields = { date_of_injury, injury_description, body_parts, symptoms, insurance_type, insurance_details, accident_description };
    const signature_hash = await sha256Hex(
      token + signer_name + signed_at + JSON.stringify(intakeFields) + JSON.stringify(link.phi_scope ?? []),
    );

    await sb.from('patient_intakes').insert({
      link_id: link.id, patient_name: link.patient_name,
      date_of_injury: date_of_injury ?? null, injury_description: injury_description ?? '',
      body_parts: body_parts ?? [], symptoms: symptoms ?? '',
      insurance_type: insurance_type ?? '', insurance_details: insurance_details ?? '',
      accident_description: accident_description ?? '',
      submitted_at: signed_at, signer_name, signer_ip, signature_hash,
    });
    await sb.from('patient_authorizations').insert({
      link_id: link.id, patient_name: link.patient_name, practice_id: link.practice_id,
      firm_name: link.firm_name, phi_scope: link.phi_scope ?? [], purpose: link.purpose,
      signed_at, signer_name, signer_ip, signature_hash, expires_at: link.expires_at, status: 'active',
    });
    await sb.from('intake_links').update({ status: 'completed', completed_at: signed_at }).eq('id', link.id);

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
