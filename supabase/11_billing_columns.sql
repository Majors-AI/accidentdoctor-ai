-- 11_billing_columns.sql
-- BillingSection "Billing Defaults": the practice's OWN default CPT charges,
-- a JSONB array of { code, description, charge }, stored on the practice row
-- (mirrors the base44 shape exactly).
--
-- NOTE: this is the practice's *configured charges* and is DISTINCT from
-- wc_fee_schedules, which holds statutory Workers'-Comp ALLOWED amounts by
-- state/CPT. No overlap — different concepts.
--
-- No new RLS needed: practices already carries the update policy that
-- SchedulingSection's Practice.update relies on (a practice_admin updating
-- their own practice). Idempotent.

alter table practices
  add column if not exists fee_schedule jsonb not null default '[]'::jsonb;
