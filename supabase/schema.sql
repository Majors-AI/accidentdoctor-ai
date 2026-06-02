-- ============================================================================
-- AccidentDoctor.AI — Phase 1 schema  (provider / clinic portal)
-- Run order: schema.sql → 02_platform.sql → 03_billing_docs.sql
-- Safe to re-run: drops all old + new objects before recreating.
-- ============================================================================

-- ============================================================================
-- 0. Drop retired objects
-- ============================================================================

-- Functions drop with CASCADE, which also removes any triggers that call them.
drop function if exists handle_new_user()           cascade;
drop function if exists seed_conflicts_check()      cascade;
drop function if exists is_firm_user()              cascade;
drop function if exists case_can_advance(uuid)      cascade;
drop function if exists platform_metrics()          cascade;
drop function if exists my_firm_id()                cascade;
drop function if exists my_firm_id_raw()            cascade;
drop function if exists is_super_admin()            cascade;
drop function if exists my_practice_id()            cascade;
drop function if exists my_practice_id_raw()        cascade;
drop function if exists is_practice_staff()         cascade;
drop function if exists chart_can_advance(uuid)     cascade;

-- Explicit trigger drop in case function drop didn't cascade to auth.users trigger.
drop trigger if exists on_auth_user_created on auth.users;

-- Tables: most-dependent first; CASCADE handles FK constraints in dependents.
drop table if exists mediations          cascade;
drop table if exists pleadings           cascade;
drop table if exists litigation          cascade;
drop table if exists disbursements       cascade;
drop table if exists trust_ledger        cascade;
drop table if exists reductions          cascade;
drop table if exists liens               cascade;
drop table if exists settlements         cascade;
drop table if exists demands             cascade;
drop table if exists follow_ups          cascade;
drop table if exists communications      cascade;
drop table if exists journal_entries     cascade;
drop table if exists conflicts_checks    cascade;
drop table if exists parties             cascade;
drop table if exists insurance_policies  cascade;
drop table if exists treatments          cascade;
drop table if exists deadlines           cascade;
-- Rebuilt tables (drop so schema change is clean)
drop table if exists approvals           cascade;
drop table if exists document_orders     cascade;
drop table if exists payments            cascade;
drop table if exists invoice_items       cascade;
drop table if exists invoices            cascade;
drop table if exists backup_runs         cascade;
drop table if exists calendar_events     cascade;
drop table if exists integrations        cascade;
drop table if exists messages            cascade;
drop table if exists tasks               cascade;
drop table if exists documents           cascade;
-- New clinical tables (idempotent on re-run)
drop table if exists reduction_audit_log cascade;
drop table if exists reduction_requests  cascade;
drop table if exists wc_auth_requests    cascade;
drop table if exists wc_fee_schedules    cascade;
drop table if exists discharge_packages  cascade;
drop table if exists billing_ledger      cascade;
drop table if exists charges             cascade;
drop table if exists visit_notes         cascade;
drop table if exists appointments        cascade;
drop table if exists treatment_plans     cascade;
drop table if exists patient_charts      cascade;
drop table if exists patients            cascade;
-- Core entities
drop table if exists profiles            cascade;
drop table if exists practices           cascade;
-- Legacy names
drop table if exists cases               cascade;
drop table if exists clients             cascade;
drop table if exists providers           cascade;
drop table if exists firms               cascade;
drop table if exists templates           cascade;
drop table if exists sol_rules           cascade;
drop table if exists jurisdictions       cascade;

-- Enums: retired
drop type if exists user_role        cascade;
drop type if exists case_status      cascade;
drop type if exists claim_type       cascade;
drop type if exists fee_phase        cascade;
drop type if exists party_role       cascade;
drop type if exists policy_kind      cascade;
drop type if exists comm_channel     cascade;
drop type if exists comm_status      cascade;
drop type if exists doc_category     cascade;
drop type if exists lien_type        cascade;
drop type if exists task_status      cascade;
drop type if exists deadline_type    cascade;
drop type if exists conflict_result  cascade;
-- Enums: new (idempotent drop before create)
drop type if exists practice_role      cascade;
drop type if exists chart_status       cascade;
drop type if exists payer_type         cascade;
drop type if exists appointment_status cascade;
drop type if exists note_status        cascade;
drop type if exists charge_status      cascade;
drop type if exists reduction_status   cascade;
drop type if exists discharge_status   cascade;
drop type if exists doc_category       cascade;

-- ============================================================================
-- 1. Enums
-- ============================================================================

create type practice_role as enum (
  'front_desk',
  'provider',
  'billing_staff',
  'practice_admin',
  'platform_admin'
);

create type chart_status as enum (
  'referral_received',
  'intake_scheduled',
  'intake_complete',
  'in_treatment',
  'treatment_paused',
  'treatment_complete',
  'discharged',
  'records_requested',
  'records_sent',
  'closed'
);

-- All payer-specific branching keys off this field.
-- payer_type = 'workers_comp' gates WC columns/tables (built; no fee data in Phase 1).
create type payer_type as enum (
  'pi_lien',
  'workers_comp',
  'health_insurance',
  'pip_medpay',
  'cash'
);

create type appointment_status as enum (
  'scheduled', 'confirmed', 'checked_in',
  'in_progress', 'completed', 'no_show', 'cancelled'
);

create type note_status as enum ('draft', 'signed', 'amended', 'finalized');

create type charge_status as enum (
  'pending', 'billed', 'adjusted', 'written_off', 'paid'
);

-- Applicable only when patient_charts.payer_type = 'pi_lien'.
create type reduction_status as enum (
  'pending', 'approved', 'countered', 'declined', 'lien_released'
);

create type discharge_status as enum ('draft', 'complete', 'sent');

create type doc_category as enum (
  'intake_form', 'imaging', 'lab', 'referral',
  'records_request', 'records_package',
  'billing', 'auth_request', 'lien_document', 'other'
);

-- ============================================================================
-- 2. Core entities
-- ============================================================================

-- Replaces firms. One row per clinic/practice tenant.
create table practices (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  npi              text,          -- National Provider Identifier
  tax_id           text,
  specialty        text,          -- chiropractic | orthopedics | physical_therapy | multi
  address          text,
  city             text,
  state            text,
  zip              text,
  phone            text,
  fax              text,
  account_status   text default 'active',  -- active | past_due | suspended | cancelled
  plan             text default 'standard',
  billing_email    text,
  cancel_notice_at timestamptz,
  access_ends_at   timestamptz,
  data_security_agreed   boolean default false,
  allow_platform_metrics boolean default false,
  marketing_source text,
  status           text default 'active',
  created_at       timestamptz default now()
);

-- Mirrors auth.users 1:1; row created by handle_new_user trigger.
create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text,
  email             text,
  role              practice_role not null default 'front_desk',
  practice_id       uuid references practices(id),
  phone             text,
  is_platform_admin boolean default false,
  created_at        timestamptz default now()
);

-- Replaces clients. Patient demographics; one row per person across all charts.
create table patients (
  id                   uuid primary key default gen_random_uuid(),
  practice_id          uuid references practices(id),
  profile_id           uuid references profiles(id) on delete set null,
  full_name            text not null,
  email                text,
  phone                text,
  dob                  date,
  is_minor             boolean default false,
  address              text,
  ssn_last4            text,
  health_insurer       text,
  health_policy_number text,
  -- AccidentLawyer.AI bridge (null until bridge mode = live)
  al_patient_ref       text,
  referral_firm_name   text,
  created_at           timestamptz default now()
);

-- ============================================================================
-- 3. Patient charts  (replaces cases)
-- ============================================================================

create table patient_charts (
  id                  uuid primary key default gen_random_uuid(),
  practice_id         uuid references practices(id),
  patient_id          uuid references patients(id),
  primary_provider_id uuid references profiles(id),
  status              chart_status default 'referral_received',
  -- Injury
  date_of_injury          date,
  mechanism_of_injury     text,
  injury_description      text,
  body_regions_affected   text[],
  -- Payer — all downstream branching keys off this single field
  payer_type              payer_type,
  -- PI-lien fields (populate when payer_type = 'pi_lien')
  referring_attorney_name text,
  referring_law_firm      text,
  al_case_ref             text,   -- AccidentLawyer.AI case ID (bridge seam)
  lien_on_file            boolean default false,
  lien_amount             numeric,
  -- Workers' comp fields (built; WC fee/auth logic inactive until Phase 3 data load)
  wc_claim_number         text,
  wc_employer             text,
  wc_carrier              text,
  wc_adjuster_name        text,
  wc_adjuster_phone       text,
  wc_auth_status          text,   -- pending | authorized | denied | not_required
  -- Discharge
  discharge_status    discharge_status default 'draft',
  discharge_date      date,
  -- Running totals (app-managed; updated on billing events)
  total_billed        numeric default 0,
  total_paid          numeric default 0,
  total_balance       numeric default 0,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ============================================================================
-- 4. Clinical workflow tables
-- ============================================================================

create table treatment_plans (
  id              uuid primary key default gen_random_uuid(),
  chart_id        uuid references patient_charts(id) on delete cascade,
  created_by      uuid references profiles(id),
  diagnosis_codes text[],
  planned_visits  int,
  frequency       text,
  modalities      text[],
  goals           text,
  -- WC auth (populated when payer_type = 'workers_comp' and auth is received)
  wc_auth_required         boolean default false,
  wc_auth_number           text,
  wc_auth_visits_authorized int,
  wc_auth_expiry           date,
  status          text default 'active',   -- active | completed | modified
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table appointments (
  id               uuid primary key default gen_random_uuid(),
  chart_id         uuid references patient_charts(id) on delete cascade,
  practice_id      uuid references practices(id),
  provider_id      uuid references profiles(id),
  scheduled_at     timestamptz not null,
  duration_minutes int default 30,
  visit_type       text,   -- initial_eval | follow_up | re_eval | discharge_visit
  status           appointment_status default 'scheduled',
  -- Twilio reminder tracking (messaging seam)
  reminder_sent_at    timestamptz,
  reminder_status     text,   -- queued | sent | failed | opted_out
  twilio_message_sid  text,
  -- Outcome
  confirmed_at        timestamptz,
  cancelled_at        timestamptz,
  cancellation_reason text,
  no_show             boolean default false,
  created_at          timestamptz default now()
);

create table visit_notes (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid references appointments(id) on delete cascade,
  chart_id       uuid references patient_charts(id) on delete cascade,
  provider_id    uuid references profiles(id),
  visit_date     date not null,
  -- SOAP
  subjective     text,
  objective      text,
  assessment     text,
  plan           text,
  diagnosis_codes text[],
  -- Workflow
  status         note_status default 'draft',
  signed_at      timestamptz,
  signed_by      uuid references profiles(id),
  -- AccidentLawyer.AI bridge sync (mock in Phase 1; live in Phase 4)
  synced_to_attorney boolean default false,
  synced_at          timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- One row per CPT code per visit note.
create table charges (
  id               uuid primary key default gen_random_uuid(),
  visit_note_id    uuid references visit_notes(id) on delete cascade,
  chart_id         uuid references patient_charts(id) on delete cascade,
  cpt_code         text not null,
  description      text,
  units            int default 1,
  fee_amount       numeric not null,   -- practice chargemaster rate
  -- WC fee schedule override (null until Phase 3 fee data is loaded)
  fee_schedule_amount numeric,
  wc_modifier         text,
  -- Adjudication
  allowed_amount   numeric,
  adjustment_amount numeric,
  paid_amount      numeric default 0,
  status           charge_status default 'pending',
  created_at       timestamptz default now()
);

-- Append-only financial ledger per chart.
-- entry_type semantics vary by payer_type on the parent chart:
--   pi_lien:       charge | lien_reduction | settlement_payment | writeoff
--   workers_comp:  charge | wc_payment | wc_adjustment | wc_denial | writeoff
--   health/pip:    charge | insurance_payment | patient_payment | adjustment
create table billing_ledger (
  id             uuid primary key default gen_random_uuid(),
  chart_id       uuid references patient_charts(id) on delete cascade,
  practice_id    uuid references practices(id),
  entry_date     date default current_date,
  entry_type     text not null,
  amount         numeric not null,   -- positive = charge, negative = credit
  reference_id   uuid,
  reference_type text,               -- 'charge' | 'reduction' | 'payment'
  memo           text,
  created_by     uuid references profiles(id),
  created_at     timestamptz default now()
);

create table discharge_packages (
  id                uuid primary key default gen_random_uuid(),
  chart_id          uuid references patient_charts(id) on delete cascade,
  status            discharge_status default 'draft',
  visit_count       int,
  date_first_visit  date,
  date_last_visit   date,
  total_billed      numeric,
  total_paid        numeric,
  total_balance     numeric,
  diagnosis_summary text,
  treatment_summary text,
  -- SendGrid delivery (messaging seam)
  sent_at                timestamptz,
  sent_to_attorney_email text,
  sendgrid_message_id    text,
  -- AccidentLawyer.AI bridge sync (mock in Phase 1)
  synced_to_attorney_portal boolean default false,
  synced_at                 timestamptz,
  created_by   uuid references profiles(id),
  created_at   timestamptz default now()
);

-- ============================================================================
-- 5. Workers' comp structural tables
-- Built now; no fee schedule data loaded until Phase 3 (authoritative source).
-- Do NOT hardcode any rates or treatment standards here.
-- ============================================================================

create table wc_fee_schedules (
  id             uuid primary key default gen_random_uuid(),
  state          text not null,
  effective_date date not null,
  cpt_code       text not null,
  description    text,
  allowed_amount numeric not null,
  modifier       text not null default '',
  unique (state, cpt_code, modifier, effective_date)
);

create table wc_auth_requests (
  id                uuid primary key default gen_random_uuid(),
  chart_id          uuid references patient_charts(id) on delete cascade,
  treatment_plan_id uuid references treatment_plans(id) on delete set null,
  cpt_codes         text[],
  visits_requested  int,
  status            text default 'pending',   -- pending | approved | denied | modified
  carrier           text,
  adjuster_name     text,
  adjuster_phone    text,
  auth_number       text,
  auth_visits_authorized int,
  decision_notes    text,
  submitted_at      timestamptz,
  decided_at        timestamptz,
  created_at        timestamptz default now()
);

-- ============================================================================
-- 6. Documents
-- ============================================================================

create table documents (
  id           uuid primary key default gen_random_uuid(),
  chart_id     uuid references patient_charts(id) on delete cascade,
  name         text not null,
  category     doc_category default 'other',
  storage_path text,
  uploaded_by  uuid references profiles(id),
  created_at   timestamptz default now()
);

-- ============================================================================
-- 7. Reduction portal  (tables live; Phase 2 UI)
-- Only instantiated for charts where payer_type = 'pi_lien'.
-- ============================================================================

create table reduction_requests (
  id                     uuid primary key default gen_random_uuid(),
  chart_id               uuid references patient_charts(id) on delete cascade,
  practice_id            uuid references practices(id),
  requesting_attorney    text,
  requesting_firm        text,
  -- AccidentLawyer.AI bridge: arrives via bridge or entered manually by billing staff
  al_reduction_ref       text,
  total_billed           numeric not null,
  reduction_requested_to numeric not null,
  status                 reduction_status default 'pending',
  counter_amount         numeric,
  reviewed_by            uuid references profiles(id),
  reviewed_at            timestamptz,
  notes                  text,
  lien_release_doc_id    uuid references documents(id) on delete set null,
  created_at             timestamptz default now()
);

-- Append-only audit trail; one row per status transition.
create table reduction_audit_log (
  id             uuid primary key default gen_random_uuid(),
  reduction_id   uuid references reduction_requests(id) on delete cascade,
  action         text not null,   -- submitted | countered | approved | declined | lien_released
  performed_by   uuid references profiles(id),
  old_status     reduction_status,
  new_status     reduction_status,
  amount_at_time numeric,
  notes          text,
  created_at     timestamptz default now()
);

-- ============================================================================
-- 8. Tasks
-- ============================================================================

create table tasks (
  id             uuid primary key default gen_random_uuid(),
  chart_id       uuid references patient_charts(id) on delete cascade,
  title          text not null,
  assignee       uuid references profiles(id),
  due_at         timestamptz,
  status         text default 'open',   -- open | done | snoozed
  auto_generated boolean default false,
  created_at     timestamptz default now()
);

-- ============================================================================
-- 9. Trigger: auto-create profile on auth signup
-- ============================================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::practice_role, 'front_desk')
  );
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- 10. Enable RLS on all tables
-- Policies are added in 02_platform.sql after tenancy helpers are defined.
-- ============================================================================

alter table practices          enable row level security;
alter table profiles           enable row level security;
alter table patients           enable row level security;
alter table patient_charts     enable row level security;
alter table treatment_plans    enable row level security;
alter table appointments       enable row level security;
alter table visit_notes        enable row level security;
alter table charges            enable row level security;
alter table billing_ledger     enable row level security;
alter table discharge_packages enable row level security;
alter table wc_fee_schedules   enable row level security;
alter table wc_auth_requests   enable row level security;
alter table documents          enable row level security;
alter table reduction_requests enable row level security;
alter table reduction_audit_log enable row level security;
alter table tasks              enable row level security;
