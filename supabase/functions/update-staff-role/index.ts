// supabase/functions/update-staff-role/index.ts
// AUTHENTICATED. A practice_admin changes a COLLEAGUE's practice role. The
// profiles UPDATE policy is self-only (id = auth.uid()), so this privileged
// cross-user write must run server-side via service_role, with guards.
//
// Port of base44 updateStaffRole, with hardenings:
//   - target must belong to the CALLER's own practice (base44 only checked role)
//   - cannot change your own role (preserved from base44)
//   - role identity comes from the caller's JWT, never the request body
//
// NOTE: base44 allowed newRole = null to "deactivate" a user. profiles.role is
// NOT NULL here, so deactivation is unsupported pending a product decision
// (likely an `active` flag column). null requests are rejected with a clear msg.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ALLOWED_ROLES = ['front_desk', 'provider', 'billing_staff', 'practice_admin'];

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
    if (!user) return json({ error: 'Unauthenticated' }, 401);

    const { data: caller } = await admin.from('profiles')
      .select('role, practice_id').eq('id', user.id).single();
    if (!caller || !['practice_admin', 'platform_admin'].includes(caller.role)) {
      return json({ error: "You don't have permission to change roles." }, 403);
    }

    const { userId, newRole } = await req.json();
    if (!userId) return json({ error: 'userId is required.' }, 400);
    if (userId === user.id) {
      return json({ error: 'You cannot change your own role. Ask another Practice Admin or a platform administrator.' }, 403);
    }
    if (newRole === null) {
      return json({ error: 'Deactivation is not supported yet (role is required). Pending an account-status field.' }, 400);
    }
    if (!ALLOWED_ROLES.includes(newRole)) {
      return json({ error: `Invalid role "${newRole}". Allowed: ${ALLOWED_ROLES.join(', ')}.` }, 400);
    }

    // HARDENING: target must be in the caller's practice (platform_admin exempt).
    const { data: target } = await admin.from('profiles')
      .select('id, practice_id').eq('id', userId).maybeSingle();
    if (!target) return json({ error: 'Not found' }, 404);
    if (caller.role !== 'platform_admin' && target.practice_id !== caller.practice_id) {
      return json({ error: 'Forbidden: not your practice' }, 403);
    }

    const { error } = await admin.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, userId, newRole });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
