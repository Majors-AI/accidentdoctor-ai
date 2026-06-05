-- ============================================================================
-- 05_consent.sql — consent to share clinical records with the referring firm.
-- Run AFTER 04_role_access.sql. Idempotent.
-- ============================================================================
alter table patient_charts add column if not exists hipaa_authorization_signed boolean default false;
alter table patient_charts add column if not exists hipaa_signed_at            timestamptz;
alter table patient_charts add column if not exists consent_share_with_firm    boolean default false;
alter table patient_charts add column if not exists consent_granted_at         timestamptz;
alter table patient_charts add column if not exists consent_revoked_at         timestamptz;
