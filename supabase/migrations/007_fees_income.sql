-- Commissions and dividends. Until now a fee was only visible as a slightly
-- lower cash balance and dividends had to be typed as plain deposits, so
-- neither could be reported (e.g. for taxes) or attributed to a position.

-- Commission paid on a buy/sell, in EUR. The cash counterpart already
-- includes it (buy: amount + fee leaves the account; sell: amount - fee
-- arrives). Not folded into avg_price_usd; the tax report adds it to cost.
alter table trades add column if not exists fee_eur numeric;

-- Dividends (and similar income) cashed into a liquidity account. Counts as
-- return, never as a contribution.
create table if not exists income (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  gross_eur numeric not null,          -- before withholding
  withholding_eur numeric not null default 0,
  account text,                        -- manual asset name the net amount went to
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists income_owner_date_idx on income(owner_id, date desc, created_at desc);

alter table income enable row level security;

create policy "own income" on income
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
