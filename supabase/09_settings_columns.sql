-- ============================================================================
-- 09_settings_columns.sql — backfill the columns the write-path pages expect.
-- Run AFTER 08_training.sql. Idempotent.
--
-- These close three of the four write-payload gaps found in P3 wave-1:
--   * patient_charts.notes            — NewReferral writes a chart note
--   * practices.appt_duration_default — SchedulingSection
--   * practices.practice_hours        — SchedulingSection
--
-- DELIBERATELY OMITTED: practices.fee_schedule (the 4th gap) — held for Dom.
-- It overlaps the existing wc_fee_schedules table, so its shape/placement is a
-- product decision, not a guess.
--
-- FOR REVIEW: practice_hours is typed jsonb (flexible per-day hours object). If
-- the SchedulingSection UI stores a plain string, change this to text when the
-- page is wired in wave-2.
-- ============================================================================

alter table patient_charts add column if not exists notes text;
alter table practices      add column if not exists appt_duration_default integer default 30;
alter table practices      add column if not exists practice_hours jsonb default '{}'::jsonb;
