-- ============================================================================
-- 08_training.sql — staff training modules + per-user assignments.
-- Run AFTER 07_intake_authorization.sql. Idempotent. Matches 02/04 RLS pattern.
--
-- DECISIONS FOR REVIEW:
--   1. base44's TrainingModule had NO practice_id (it was single-tenant). For
--      the multi-tenant Supabase model I added practice_id so each practice
--      manages its own modules and can't see another practice's. If you instead
--      want a single GLOBAL module catalog shared across all practices, drop
--      practice_id here and make read open to all staff / write platform-only.
--   2. training_assignments are isolated by the assigned user's practice
--      (user_id -> profiles.practice_id). A staff member can read + update
--      (progress) their OWN assignment; practice_admin manages all in-practice.
-- ============================================================================

-- ── training_modules ─────────────────────────────────────────────────────────
create table if not exists training_modules (
  id                uuid primary key default gen_random_uuid(),
  practice_id       uuid not null references practices(id) on delete cascade,
  title             text not null,
  description       text,
  category          text check (category in ('HIPAA','Onboarding','Billing','Clinical','General')),
  required          boolean default false,
  estimated_minutes integer default 30,
  created_at        timestamptz default now()
);
create index if not exists training_modules_practice_idx on training_modules(practice_id);
alter table training_modules enable row level security;

drop policy if exists "training_modules read"  on training_modules;
drop policy if exists "training_modules write" on training_modules;
create policy "training_modules read" on training_modules for select
  using (is_platform() or practice_id = my_practice_id());
create policy "training_modules write" on training_modules for all
  using       (is_platform() or (is_practice_admin() and practice_id = my_practice_id()))
  with check  (is_platform() or (is_practice_admin() and practice_id = my_practice_id()));

-- ── training_assignments ─────────────────────────────────────────────────────
create table if not exists training_assignments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  module_id    uuid not null references training_modules(id) on delete cascade,
  status       text not null default 'assigned'
               check (status in ('assigned','in_progress','completed')),
  assigned_at  timestamptz default now(),
  completed_at timestamptz,
  created_at   timestamptz default now()
);
create index if not exists training_assignments_user_idx   on training_assignments(user_id);
create index if not exists training_assignments_module_idx on training_assignments(module_id);
alter table training_assignments enable row level security;

drop policy if exists "training_assignments read"   on training_assignments;
drop policy if exists "training_assignments insert" on training_assignments;
drop policy if exists "training_assignments update" on training_assignments;
drop policy if exists "training_assignments delete" on training_assignments;

-- Read: your own assignments, or practice_admin sees all in-practice.
create policy "training_assignments read" on training_assignments for select
  using (is_platform() or user_id = auth.uid()
         or (is_practice_admin() and user_id in (select id from profiles where practice_id = my_practice_id())));
-- Create: practice_admin, for users in their practice.
create policy "training_assignments insert" on training_assignments for insert
  with check (is_platform()
              or (is_practice_admin() and user_id in (select id from profiles where practice_id = my_practice_id())));
-- Update: your own (mark progress) or practice_admin in-practice.
create policy "training_assignments update" on training_assignments for update
  using (is_platform() or user_id = auth.uid()
         or (is_practice_admin() and user_id in (select id from profiles where practice_id = my_practice_id())))
  with check (is_platform() or user_id = auth.uid()
         or (is_practice_admin() and user_id in (select id from profiles where practice_id = my_practice_id())));
-- Delete: practice_admin in-practice.
create policy "training_assignments delete" on training_assignments for delete
  using (is_platform()
         or (is_practice_admin() and user_id in (select id from profiles where practice_id = my_practice_id())));
