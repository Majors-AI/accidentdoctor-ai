-- ============================================================================
-- 06_access_log.sql — PHI access audit log. Run AFTER 05_consent.sql. Idempotent.
-- Records who accessed which chart. Append-only (no update/delete policy).
-- ============================================================================
create table if not exists phi_access_log (
  id          uuid primary key default gen_random_uuid(),
  practice_id uuid references practices(id),
  chart_id    uuid references patient_charts(id) on delete cascade,
  actor_id    uuid references profiles(id),
  actor_role  text,
  action      text,            -- view_chart | view_notes | view_billing | transmit
  created_at  timestamptz default now()
);
alter table phi_access_log enable row level security;

create or replace function is_practice_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid()
                 and role in ('practice_admin','platform_admin'));
$$;

drop policy if exists "phi_access_log insert" on phi_access_log;
create policy "phi_access_log insert" on phi_access_log for insert
  with check (is_practice_staff() and practice_id = my_practice_id() and actor_id = auth.uid());

drop policy if exists "phi_access_log read" on phi_access_log;
create policy "phi_access_log read" on phi_access_log for select
  using (is_super_admin() or (is_practice_admin() and practice_id = my_practice_id()));
-- no update/delete policies => append-only / immutable
