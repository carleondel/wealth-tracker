-- Persistent trade log. Until now a buy/sell only mutated the position, so
-- "when did I buy X and at what price" was unanswerable. One row per
-- adjust_position op applied from the Journal.
create table if not exists trades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  shares numeric not null,            -- signed: > 0 buy, < 0 sell
  price_usd numeric,                  -- unit price, if given
  amount_eur numeric,                 -- cash side in EUR, if given
  funding text,                       -- account name, 'external' or null
  realized_usd numeric,               -- sells only: (price - avg_before) * |shares|
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists trades_owner_date_idx on trades(owner_id, date desc, created_at desc);

alter table trades enable row level security;

create policy "own trades" on trades
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
