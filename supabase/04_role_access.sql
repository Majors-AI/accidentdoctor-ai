-- ============================================================================
-- 04_role_access.sql — minimum-necessary role-based access within a practice.
-- Run AFTER 03_billing_docs.sql. Idempotent. Practice isolation already done in 02.
-- ============================================================================

create or replace function is_clinical_role() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid()
                 and role in ('provider','practice_admin','platform_admin'));
$$;
create or replace function is_billing_role() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid()
                 and role in ('billing_staff','practice_admin','platform_admin'));
$$;

-- CLINICAL: SOAP notes + treatment plans -> clinical roles only
do $$ declare t text; begin
  foreach t in array array['visit_notes','treatment_plans'] loop
    execute format('drop policy if exists "%1$s practice" on %1$I;', t);
    execute format('drop policy if exists "%1$s clinical" on %1$I;', t);
    execute format($f$create policy "%1$s clinical" on %1$I for all
      using (is_clinical_role() and chart_id in (select id from patient_charts where practice_id = my_practice_id()))
      with check (is_clinical_role() and chart_id in (select id from patient_charts where practice_id = my_practice_id()));$f$, t);
  end loop;
end $$;

-- CHARGES + WC AUTH: clinical OR billing (not front desk), read+write
do $$ declare t text; begin
  foreach t in array array['charges','wc_auth_requests'] loop
    execute format('drop policy if exists "%1$s practice" on %1$I;', t);
    execute format('drop policy if exists "%1$s clinbill" on %1$I;', t);
    execute format($f$create policy "%1$s clinbill" on %1$I for all
      using ((is_clinical_role() or is_billing_role()) and chart_id in (select id from patient_charts where practice_id = my_practice_id()))
      with check ((is_clinical_role() or is_billing_role()) and chart_id in (select id from patient_charts where practice_id = my_practice_id()));$f$, t);
  end loop;
end $$;

-- FINANCIAL: billing_ledger + reduction_requests -> read clin/bill, write billing
do $$ declare t text; begin
  foreach t in array array['billing_ledger','reduction_requests'] loop
    execute format('drop policy if exists "%1$s practice" on %1$I;', t);
    execute format('drop policy if exists "%1$s read" on %1$I;', t);
    execute format('drop policy if exists "%1$s write" on %1$I;', t);
    execute format($f$create policy "%1$s read" on %1$I for select
      using ((is_clinical_role() or is_billing_role()) and chart_id in (select id from patient_charts where practice_id = my_practice_id()));$f$, t);
    execute format($f$create policy "%1$s write" on %1$I for all
      using (is_billing_role() and chart_id in (select id from patient_charts where practice_id = my_practice_id()))
      with check (is_billing_role() and chart_id in (select id from patient_charts where practice_id = my_practice_id()));$f$, t);
  end loop;
end $$;

-- DISCHARGE: read clin/bill, write clinical
drop policy if exists "discharge_packages practice" on discharge_packages;
drop policy if exists "discharge_packages read" on discharge_packages;
drop policy if exists "discharge_packages write" on discharge_packages;
create policy "discharge_packages read" on discharge_packages for select
  using ((is_clinical_role() or is_billing_role()) and chart_id in (select id from patient_charts where practice_id = my_practice_id()));
create policy "discharge_packages write" on discharge_packages for all
  using (is_clinical_role() and chart_id in (select id from patient_charts where practice_id = my_practice_id()))
  with check (is_clinical_role() and chart_id in (select id from patient_charts where practice_id = my_practice_id()));

-- AUDIT LOG: read clin/bill, insert billing, immutable (no update/delete)
drop policy if exists "reduction_audit_log practice" on reduction_audit_log;
drop policy if exists "reduction_audit_log read" on reduction_audit_log;
drop policy if exists "reduction_audit_log insert" on reduction_audit_log;
create policy "reduction_audit_log read" on reduction_audit_log for select
  using ((is_clinical_role() or is_billing_role()) and reduction_id in (
    select r.id from reduction_requests r join patient_charts c on c.id=r.chart_id where c.practice_id = my_practice_id()));
create policy "reduction_audit_log insert" on reduction_audit_log for insert
  with check (is_billing_role() and reduction_id in (
    select r.id from reduction_requests r join patient_charts c on c.id=r.chart_id where c.practice_id = my_practice_id()));

-- ROLLBACK: restore the single all-staff policy per table, e.g.:
--   drop the policies above, then for each table:
--   create policy "<t> practice" on <t> for all
--     using (chart_id in (select id from patient_charts where practice_id = my_practice_id()) and is_practice_staff())
--     with check (chart_id in (select id from patient_charts where practice_id = my_practice_id()) and is_practice_staff());
--   (reduction_audit_log via reduction_id join, as in 02_platform.sql)
