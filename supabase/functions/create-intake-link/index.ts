// supabase/functions/create-intake-link/index.ts
// AUTHENTICATED (verify JWT). front_desk or practice_admin creates an intake
// link with a 32-byte crypto-random token. Faithful port of base44
// createIntakeLink, with one HARDENING: practice_id is taken from the caller's
// own profile (server-side), NOT from the request body — so a user cannot mint
// a link for another practice.
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

    // Identify the caller from their JWT.
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await admin.from('profiles')
      .select('role, practice_id, is_platform_admin').eq('id', user.id).single();
    if (!profile) return json({ error: 'Unauthorized' }, 401);

    const allowed = ['front_desk', 'practice_admin', 'platform_admin'];
    if (!allowed.includes(profile.role)) {
      return json({ error: 'Forbidden: front_desk or practice_admin only' }, 403);
    }
    if (!profile.practice_id) return json({ error: 'Caller has no practice' }, 400);

    const b = await req.json();
    const { patient_name, patient_email, patient_phone, firm_name, purpose, phi_scope, expires_in_days = 14 } = b;
    if (!patient_name || !firm_name || !purpose || !phi_scope) {
      return json({ error: 'patient_name, firm_name, purpose, phi_scope are required' }, 400);
    }

    // 32-byte hex token
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes).map((x) => x.toString(16).padStart(2, '0')).join('');

    const now = new Date();
    const expires_at = new Date(now.getTime() + expires_in_days * 86400 * 1000).toISOString();

    const { data: link, error } = await admin.from('intake_links').insert({
      token,
      patient_name,
      patient_email: patient_email ?? '',
      patient_phone: patient_phone ?? '',
      practice_id: profile.practice_id, // HARDENING: from caller, not body
      firm_name,
      purpose,
      phi_scope,
      status: 'pending',
      created_by: user.id,
      expires_at,
    }).select('id').single();
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, token, url: `/intake/${token}`, id: link.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
