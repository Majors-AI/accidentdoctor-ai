-- 10_documents_storage.sql
-- FileCabinet -> per-patient clinical documents (Option A).
--
-- Creates the PRIVATE 'patient-documents' Storage bucket and the storage.objects
-- policies that scope it by practice. Document-ROW access is governed by the
-- "documents practice" policy below.
--
-- "documents practice": this policy already existed on the LIVE database but was
-- NOT in this repo (out-of-band drift — flagged for Dom). It is codified here so
-- a fresh rebuild reproduces live, and is the SINGLE source of truth for the
-- documents table: any practice staff member may read/insert/update/delete a
-- document whose chart belongs to their practice. (An earlier draft of this file
-- added separate select/insert/delete policies; those were redundant — RLS
-- policies are OR'd — so they were removed in favour of this one.)
-- NOTE: the body below is reconstructed from the live policy and is behaviourally
-- equivalent (is_practice_staff() gates on auth.uid(), so role targeting is moot).
-- Before relying on it in a rebuild, diff against the live definition.
--
-- COMPLIANCE NOTE (Dom): under this model ANY practice staff (not just admins)
-- can delete/replace patient documents, and document rows are mutable. If you
-- want admin-only delete or immutability, that's a deliberate change to BOTH the
-- "documents practice" policy AND the storage DELETE policy below.
--
-- Helpers (live): my_practice_id() [02], is_practice_staff() [02].
-- Path convention the app uses: {practice_id}/{chart_id}/{uuid}_{filename}
-- PHI access is logged from the app (phi_access_log via logChartAccess).

-- 1. Private bucket -----------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('patient-documents', 'patient-documents', false)
on conflict (id) do nothing;

-- 2. documents table — single governing policy (mirrors live) -----------------
drop policy if exists "documents practice" on public.documents;
create policy "documents practice" on public.documents
  for all
  using (
    chart_id in (select id from patient_charts where practice_id = my_practice_id())
    and is_practice_staff()
  )
  with check (
    chart_id in (select id from patient_charts where practice_id = my_practice_id())
    and is_practice_staff()
  );

-- 3. storage.objects policies for 'patient-documents' (staff, practice-scoped) -
drop policy if exists "patient-documents read" on storage.objects;
create policy "patient-documents read" on storage.objects for select
  using (
    bucket_id = 'patient-documents'
    and is_practice_staff()
    and (storage.foldername(name))[1] = my_practice_id()::text
  );

drop policy if exists "patient-documents upload" on storage.objects;
create policy "patient-documents upload" on storage.objects for insert
  with check (
    bucket_id = 'patient-documents'
    and is_practice_staff()
    and (storage.foldername(name))[1] = my_practice_id()::text
  );

drop policy if exists "patient-documents delete" on storage.objects;
create policy "patient-documents delete" on storage.objects for delete
  using (
    bucket_id = 'patient-documents'
    and is_practice_staff()
    and (storage.foldername(name))[1] = my_practice_id()::text
  );
