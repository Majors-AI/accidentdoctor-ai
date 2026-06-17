// supabase/functions/revoke-patient-authorization/index.ts
// AUTHENTICATED (verify JWT). practice_admin revokes a signed authorization.
// Faithful port of base44 revokePatientAuthorization, with one HARDENING: the
// target authorization must belong to the caller's OWN practice (base44 only
// checked the role, not practice ownership — a gap in multi-tenant).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await admin.from('profiles')
      .select('role, practice_id, is_platform_admin').eq('id', user.id).single();
    if (!profile) return json({ error: 'Unauthorized' }, 401);
    if (!['practice_admin', 'platform_admin'].includes(profile.role)) {
      return json({ error: 'Forbidden: practice_admin only' }, 403);
    }

    const { authorization_id, revoke_reason } = await req.json();
    if (!authorization_id) return json({ error: 'authorization_id is required' }, 400);

    // HARDENING: confirm the authorization belongs to the caller's practice
    // (platform_admin may revoke any).
    const { data: target } = await admin.from('patient_authorizations')
      .select('id, practice_id').eq('id', authorization_id).maybeSingle();
    if (!target) return json({ error: 'Not found' }, 404);
    if (profile.role !== 'platform_admin' && target.practice_id !== profile.practice_id) {
      return json({ error: 'Forbidden: not your practice' }, 403);
    }

    const { data: updated, error } = await admin.from('patient_authorizations').update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_by: user.id,
      revoke_reason: revoke_reason ?? '',
    }).eq('id', authorization_id).select().single();
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, authorization: updated });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
