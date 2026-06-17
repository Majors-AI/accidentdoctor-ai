// supabase/functions/get-intake-by-token/index.ts
// PUBLIC (deploy with --no-verify-jwt). Patient opens an intake link; returns
// only safe display context (no token, no internal ids). Auto-expires stale
// pending links. Faithful port of base44 getIntakeByToken.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const sb = admin();
    const { token } = await req.json();
    if (!token) return json({ error: 'token is required' }, 400);

    const { data: link } = await sb.from('intake_links').select('*').eq('token', token).maybeSingle();
    if (!link) return json({ ok: false, reason: 'not_found' });

    const now = new Date();
    if (link.status === 'pending' && link.expires_at && new Date(link.expires_at) < now) {
      await sb.from('intake_links').update({ status: 'expired' }).eq('id', link.id);
      return json({ ok: false, reason: 'expired' });
    }
    if (link.status !== 'pending') return json({ ok: false, reason: link.status });

    // Only display context — no token, no internal ids.
    return json({
      ok: true,
      patient_name: link.patient_name,
      firm_name: link.firm_name,
      purpose: link.purpose,
      phi_scope: link.phi_scope,
      expires_at: link.expires_at,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
