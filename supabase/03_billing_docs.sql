-- ============================================================================
-- 03_billing_docs.sql — SaaS billing, approvals, and storage
-- Run AFTER 02_platform.sql.
-- ============================================================================

-- ============================================================================
-- 1. SaaS billing tables  (repointed from firms to practices)
-- ============================================================================

create table invoices (
  id           uuid primary key default gen_random_uuid(),
  practice_id  uuid references practices(id) on delete cascade,
  period_label text,
  amount       numeric default 0,
  late_fee     numeric default 0,
  status       text default 'open',   -- open | paid | overdue
  issued_at    timestamptz default now(),
  due_at       timestamptz default (now() + interval '30 days'),
  paid_at      timestamptz
);

create table invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid references invoices(id) on delete cascade,
  kind        text not null,   -- subscription | document_order | late_fee
  description text,
  amount      numeric default 0
);

create table payments (
  id          uuid primary key default gen_random_uuid(),
  practice_id uuid references practices(id) on delete cascade,
  invoice_id  uuid references invoices(id),
  amount      numeric,
  method      text default 'card',
  status      text default 'succeeded',
  created_at  timestamptz default now()
);

create table document_orders (
  id          uuid primary key default gen_random_uuid(),
  practice_id uuid references practices(id) on delete cascade,
  chart_id    uuid references patient_charts(id) on delete set null,
  type        text not null,   -- records_request | imaging | other
  vendor      text,
  cost        numeric default 0,
  status      text default 'ordered',   -- ordered | received | cancelled
  billed      boolean default false,
  ordered_at  timestamptz default now()
);

-- ============================================================================
-- 2. Approvals / e-signatures
-- kind values: note_sign_off | discharge_sign_off | reduction_approval | document
-- ============================================================================

create table approvals (
  id                 uuid primary key default gen_random_uuid(),
  chart_id           uuid references patient_charts(id) on delete cascade,
  kind               text not null,
  title              text,
  requires_signature boolean default false,
  status             text default 'requested',   -- requested | approved | signed | declined
  document_id        uuid references documents(id),
  reduction_id       uuid references reduction_requests(id),
  requested_by       uuid references profiles(id),
  signature_name     text,
  signed_at          timestamptz,
  created_at         timestamptz default now()
);

-- ============================================================================
-- 3. RLS for billing and approval tables
-- ============================================================================

alter table invoices        enable row level security;
alter table invoice_items   enable row level security;
alter table payments        enable row level security;
alter table document_orders enable row level security;
alter table approvals       enable row level security;

-- Billing tables use _raw so a suspended practice can still log in and pay.
drop policy if exists "invoices practice"        on invoices;
drop policy if exists "invoice_items practice"   on invoice_items;
drop policy if exists "payments practice"        on payments;
drop policy if exists "document_orders practice" on document_orders;
drop policy if exists "approvals practice"       on approvals;

create policy "invoices practice" on invoices for all
  using  (practice_id = my_practice_id_raw() or is_super_admin())
  with check (practice_id = my_practice_id_raw());

create policy "invoice_items practice" on invoice_items for all
  using (
    invoice_id in (select id from invoices where practice_id = my_practice_id_raw())
    or is_super_admin()
  )
  with check (
    invoice_id in (select id from invoices where practice_id = my_practice_id_raw())
  );

create policy "payments practice" on payments for all
  using  (practice_id = my_practice_id_raw())
  with check (practice_id = my_practice_id_raw());

create policy "document_orders practice" on document_orders for all
  using  (practice_id = my_practice_id() and is_practice_staff())
  with check (practice_id = my_practice_id() and is_practice_staff());

create policy "approvals practice" on approvals for all
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
-- 4. Storage bucket — patient-files (private)
-- Path convention: {practice_id}/{chart_id}/{category}/{filename}
-- ============================================================================

insert into storage.buckets (id, name, public)
  values ('patient-files', 'patient-files', false)
  on conflict (id) do nothing;

drop policy if exists "case-files firm"        on storage.objects;
drop policy if exists "case-files client read" on storage.objects;
drop policy if exists "patient-files practice" on storage.objects;

create policy "patient-files practice" on storage.objects for all to authenticated
  using (
    bucket_id = 'patient-files'
    and (storage.foldername(name))[1] = my_practice_id()::text
  )
  with check (
    bucket_id = 'patient-files'
    and (storage.foldername(name))[1] = my_practice_id()::text
  );

-- ============================================================================
-- 5. Helper: does this chart have a pending approval blocking progress?
-- ============================================================================

create or replace function chart_can_advance(p_chart uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from approvals
    where  chart_id = p_chart and status = 'requested'
  );
$$;
