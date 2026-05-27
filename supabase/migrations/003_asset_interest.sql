-- Add annual interest rate to manual assets (for interest-bearing cash accounts).
-- Stored as decimal: 0.0125 = 1.25% TAE.
alter table manual_assets
  add column if not exists interest_rate_annual numeric not null default 0;
