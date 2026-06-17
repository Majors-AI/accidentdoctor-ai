-- ============================================================================
-- 07_intake_authorization.sql
-- Intake links + patient intake submissions + HIPAA authorizations.
-- Run AFTER 06_access_log.sql. Idempotent. Matches the 02/04 RLS pattern
-- (my_practice_id() isolation + minimum-necessary role access).
--
-- These tables hold PHI + signed consent: patient-entered injury detail,
-- signer name/IP, signature hashes, HIPAA phi_scope.
--
-- DECISIONS FOR REVIEW:
--   1. Patient-facing intake SUBMISSION and authorization REVOKE run through
--      SERVER functions (ported in wave-2c) using service_role, which BYPASSES
--      RLS. So client-side WRITE policies below are deliberately restrictive
--      (platform admin only) — the public/patient writes go through the function.
--   2. base44 granted create/update to platform admin only; intake_links WRITE
--      is opened to practice_admin (same practice) so a practice can manage its
--      own links from the app. Tighten to platform-only if you'd rather all
--      link creation go through the server function.
--   3. PHI access logging for these surfaces (phi_access_log from 06) is wired
--      at the app layer when the pages are swapped, not here.
-- ============================================================================

-- Helpers (idempotent; distinct names from the profiles.is_platform_admin column)
create or replace function is_platform() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid()
                 and (p.is_platform_admin = true or p.role = 'platform_admin'));
$$;
create or replace function is_practice_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid()
                 and p.role in ('practice_admin','platform_admin'));
$$;

-- ── intake_links ────────────────────────────────────────────────────────────
create table if not exists intake_links (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,
  patient_name  text,
  patient_email text,
  patient_phone text,
  practice_id   uuid not null references practices(id) on delete cascade,
  firm_name     text,
  purpose       text,
  phi_scope     text[],
  status        text not null default 'pending'
                check (status in ('pending','completed','expired','revoked')),
  created_by    uuid references profiles(id),
  expires_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz default now()
);
create index if not exists intake_links_practice_idx on intake_links(practice_id);
create index if not exists intake_links_token_idx     on intake_links(token);
alter table intake_links enable row level security;

drop policy if exists "intake_links read"  on intake_links;
drop policy if exists "intake_links write" on intake_links;
create policy "intake_links read" on intake_links for select
  using (is_platform() or practice_id = my_practice_id());
create policy "intake_links write" on intake_links for all
  using       (is_platform() or (is_practice_admin() and practice_id = my_practice_id()))
  with check  (is_platform() or (is_practice_admin() and practice_id = my_practice_id()));

-- ── patient_intakes (PHI; isolation via the parent link) ─────────────────────
create table if not exists patient_intakes (
  id                  uuid primary key default gen_random_uuid(),
  link_id             uuid not null references intake_links(id) on delete cascade,
  patient_name        text,
  date_of_injury      date,
  injury_description  text,
  body_parts          text[],
  symptoms            text,
  insurance_type      text,
  insurance_details   text,
  accident_description text,
  submitted_at        timestamptz,
  signer_name         text,
  signer_ip           text,
  signature_hash      text,
  created_at          timestamptz default now()
);
create index if not exists patient_intakes_link_idx on patient_intakes(link_id);
alter table patient_intakes enable row level security;

drop policy if exists "patient_intakes read"  on patient_intakes;
drop policy if exists "patient_intakes write" on patient_intakes;
-- Read: clinical roles, scoped to their practice via the link. Submission is
-- written by the server function (service_role), so client write is admin-only.
create policy "patient_intakes read" on patient_intakes for select
  using (is_platform() or (is_clinical_role()
         and link_id in (select id from intake_links where practice_id = my_practice_id())));
create policy "patient_intakes write" on patient_intakes for all
  using (is_platform()) with check (is_platform());

-- ── patient_authorizations (signed HIPAA authorization; isolation via practice) ─
create table if not exists patient_authorizations (
  id             uuid primary key default gen_random_uuid(),
  link_id        uuid not null references intake_links(id) on delete cascade,
  patient_name   text,
  practice_id    uuid not null references practices(id) on delete cascade,
  firm_name      text,
  phi_scope      text[],
  purpose        text,
  signed_at      timestamptz,
  signer_name    text,
  signer_ip      text,
  signature_hash text,
  expires_at     timestamptz,
  status         text not null default 'active'
                 check (status in ('active','expired','revoked')),
  revoked_at     timestamptz,
  revoked_by     uuid references profiles(id),
  revoke_reason  text,
  created_at     timestamptz default now()
);
create index if not exists patient_authorizations_practice_idx on patient_authorizations(practice_id);
create index if not exists patient_authorizations_link_idx     on patient_authorizations(link_id);
alter table patient_authorizations enable row level security;

drop policy if exists "patient_authorizations read"  on patient_authorizations;
drop policy if exists "patient_authorizations write" on patient_authorizations;
-- Read: any practice staff, own practice. Sign (public) + revoke run through the
-- server function (service_role), so client write is admin-only.
create policy "patient_authorizations read" on patient_authorizations for select
  using (is_platform() or practice_id = my_practice_id());
create policy "patient_authorizations write" on patient_authorizations for all
  using (is_platform()) with check (is_platform());
