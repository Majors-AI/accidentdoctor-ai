-- ============================================================================
-- 02_platform.sql — multi-tenant platform layer
-- Run AFTER schema.sql.
-- ============================================================================

-- ============================================================================
-- 1. Tenancy helpers
-- ============================================================================

-- Returns the caller's practice_id only while account is active or past_due.
-- Returns NULL for suspended/cancelled — gates all data-access policies.
create or replace function my_practice_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select p.practice_id
  from   profiles p
  join   practices pr on pr.id = p.practice_id
  where  p.id = auth.uid()
    and  pr.account_status in ('active', 'past_due');
$$;

-- Returns practice_id regardless of account status; used by billing pages
-- so a suspended practice can still log in and pay.
create or replace function my_practice_id_raw() returns uuid
  language sql stable security definer set search_path = public as $$
  select practice_id from profiles where id = auth.uid();
$$;

-- True for any authenticated clinic staff member (all non-patient roles).
create or replace function is_practice_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where  id = auth.uid()
      and  role in ('front_desk','provider','billing_staff','practice_admin','platform_admin')
  );
$$;

-- True for the platform super-admin.
create or replace function is_super_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_platform_admin from profiles where id = auth.uid()),
    false
  );
$$;

-- ============================================================================
-- 2. Practices RLS
-- ============================================================================

drop policy if exists "practices self read"    on practices;
drop policy if exists "practices self update"  on practices;
drop policy if exists "practices super manage" on practices;

create policy "practices self read" on practices for select
  using (id = my_practice_id_raw() or is_super_admin());

create policy "practices self update" on practices for update
  using  (id = my_practice_id() and is_practice_staff())
  with check (id = my_practice_id());

create policy "practices super manage" on practices for all
  using  (is_super_admin())
  with check (is_super_admin());

-- ============================================================================
-- 3. Profiles RLS
-- ============================================================================

drop policy if exists "profiles self read"    on profiles;
drop policy if exists "profiles self update"  on profiles;
drop policy if exists "profiles super manage" on profiles;

create policy "profiles self read" on profiles for select
  using (
    id = auth.uid()
    or (is_practice_staff() and practice_id = my_practice_id())
    or is_super_admin()
  );

create policy "profiles self update" on profiles for update
  using (id = auth.uid());

create policy "profiles super manage" on profiles for all
  using  (is_super_admin())
  with check (is_super_admin());

-- ============================================================================
-- 4. Patients RLS
-- ============================================================================

drop policy if exists "patients practice read"  on patients;
drop policy if exists "patients practice write" on patients;

create policy "patients practice read" on patients for select
  using (
    (is_practice_staff() and practice_id = my_practice_id())
    or profile_id = auth.uid()
  );

create policy "patients practice write" on patients for all
  using  (is_practice_staff() and practice_id = my_practice_id())
  with check (is_practice_staff() and practice_id = my_practice_id());

-- ============================================================================
-- 5. Patient charts RLS
-- ============================================================================

drop policy if exists "charts practice read"  on patient_charts;
drop policy if exists "charts practice write" on patient_charts;

create policy "charts practice read" on patient_charts for select
  using (is_practice_staff() and practice_id = my_practice_id());

create policy "charts practice write" on patient_charts for all
  using  (is_practice_staff() and practice_id = my_practice_id())
  with check (is_practice_staff() and practice_id = my_practice_id());

-- ============================================================================
-- 6. Chart-scoped clinical tables — single policy per table via loop
-- ============================================================================

do $$ declare t text; begin
  foreach t in array array[
    'treatment_plans', 'appointments', 'visit_notes', 'charges',
    'billing_ledger',  'discharge_packages', 'wc_auth_requests',
    'reduction_requests', 'documents', 'tasks'
  ] loop
    execute format('drop policy if exists "%1$s practice" on %1$I;', t);
    execute format($f$
      create policy "%1$s practice" on %1$I for all
        using (
          chart_id in (
            select id from patient_charts where practice_id = my_practice_id()
          )
          and is_practice_staff()
        )
        with check (
          chart_id in (
            select id from patient_charts where practice_id = my_practice_id()
          )
          and is_practice_staff()
        );
    $f$, t);
  end loop;
end $$;

-- reduction_audit_log reaches chart via reduction_id -> reduction_requests.
drop policy if exists "reduction_audit_log practice" on reduction_audit_log;
create policy "reduction_audit_log practice" on reduction_audit_log for all
  using (
    reduction_id in (
      select r.id from reduction_requests r
      join   patient_charts c on c.id = r.chart_id
      where  c.practice_id = my_practice_id()
    )
    and is_practice_staff()
  )
  with check (
    reduction_id in (
      select r.id from reduction_requests r
      join   patient_charts c on c.id = r.chart_id
      where  c.practice_id = my_practice_id()
    )
    and is_practice_staff()
  );

-- wc_fee_schedules is a platform-wide reference table, not practice-scoped.
-- All practice staff can read; only super-admin manages rows.
drop policy if exists "wc_fee_schedules staff read"   on wc_fee_schedules;
drop policy if exists "wc_fee_schedules super manage" on wc_fee_schedules;
create policy "wc_fee_schedules staff read" on wc_fee_schedules for select
  using (is_practice_staff() or is_super_admin());

create policy "wc_fee_schedules super manage" on wc_fee_schedules for all
  using  (is_super_admin())
  with check (is_super_admin());

-- ============================================================================
-- 7. Messages (provider/staff communications, linked to a chart)
-- ============================================================================

create table messages (
  id          uuid primary key default gen_random_uuid(),
  chart_id    uuid references patient_charts(id) on delete cascade,
  sender_id   uuid references profiles(id),
  sender_role text,
  body        text not null,
  created_at  timestamptz default now(),
  read_at     timestamptz
);
alter table messages enable row level security;

create policy "messages practice" on messages for all
  using (
    is_practice_staff()
    and chart_id in (
      select id from patient_charts where practice_id = my_practice_id()
    )
  )
  with check (
    is_practice_staff()
    and chart_id in (
      select id from patient_charts where practice_id = my_practice_id()
    )
  );

-- ============================================================================
-- 8. Integrations  (Twilio, SendGrid, Google, al_bridge per practice)
-- ============================================================================

create table integrations (
  id           uuid primary key default gen_random_uuid(),
  practice_id  uuid references practices(id) on delete cascade,
  provider     text not null,
  connected    boolean default false,
  config       jsonb default '{}',
  updated_at   timestamptz default now(),
  unique (practice_id, provider)
);
alter table integrations enable row level security;

create policy "integrations practice" on integrations for all
  using  (practice_id = my_practice_id() and is_practice_staff())
  with check (practice_id = my_practice_id() and is_practice_staff());

-- ============================================================================
-- 9. Calendar events
-- ============================================================================

create table calendar_events (
  id              uuid primary key default gen_random_uuid(),
  practice_id     uuid references practices(id) on delete cascade,
  chart_id        uuid references patient_charts(id) on delete set null,
  appointment_id  uuid references appointments(id) on delete set null,
  title           text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  google_event_id text,
  meet_link       text,
  synced          boolean default false,
  created_at      timestamptz default now()
);
alter table calendar_events enable row level security;

create policy "calendar practice" on calendar_events for all
  using  (practice_id = my_practice_id() and is_practice_staff())
  with check (practice_id = my_practice_id() and is_practice_staff());

-- ============================================================================
-- 10. Backup runs
-- ============================================================================

create table backup_runs (
  id          uuid primary key default gen_random_uuid(),
  practice_id uuid references practices(id) on delete cascade,
  target      text default 'dropbox',
  scope       text,
  status      text default 'pending',
  file_count  int default 0,
  ran_at      timestamptz default now()
);
alter table backup_runs enable row level security;

create policy "backup practice" on backup_runs for all
  using  (practice_id = my_practice_id() and is_practice_staff())
  with check (practice_id = my_practice_id() and is_practice_staff());

-- ============================================================================
-- 11. Platform metrics (super-admin only; aggregates, no patient PII)
-- ============================================================================

create or replace function platform_metrics()
returns table (
  practice_id      uuid,
  practice_name    text,
  patient_count    bigint,
  active_charts    bigint,
  marketing_source text
)
language sql stable security definer set search_path = public as $$
  select
    pr.id,
    pr.name,
    count(distinct p.id)                                                 as patient_count,
    count(c.id) filter (where c.status not in ('discharged', 'closed')) as active_charts,
    pr.marketing_source
  from  practices pr
  left  join patients       p on p.practice_id = pr.id
  left  join patient_charts c on c.practice_id = pr.id
  where pr.allow_platform_metrics = true
    and is_super_admin()
  group by pr.id, pr.name, pr.marketing_source;
$$;
