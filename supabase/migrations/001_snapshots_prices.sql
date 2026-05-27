-- Add `prices` column to snapshots (added after initial schema.sql).
-- Safe to re-run.
alter table snapshots
  add column if not exists prices jsonb not null default '{}'::jsonb;
