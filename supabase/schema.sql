-- Wealth Tracker — Supabase schema
-- Run this once in the Supabase SQL editor after creating the project.

create extension if not exists "pgcrypto";

create table if not exists positions (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  name text not null,
  shares numeric not null,
  avg_price_usd numeric,
  category text not null,        -- 'Crypto' | 'Crypto Proxy' | 'Gold Miners' | 'Equities' | 'Liquidez'
  platform text not null,        -- 'Binance' | 'IBKR' | 'Wallet'
  role text not null,            -- 'core' | 'tactica' | 'cobertura' | 'complemento' | 'caja' | 'residual'
  target_price_usd numeric,
  is_crypto boolean default false,
  created_at timestamptz default now()
);

create table if not exists manual_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  value_eur numeric not null,
  category text not null default 'Liquidez',
  platform text not null,
  rate_label text,
  updated_at timestamptz default now()
);

create table if not exists snapshots (
  id uuid primary key default gen_random_uuid(),
  total_eur numeric not null,
  breakdown jsonb not null,      -- { "Crypto": 1234.56, "Equities": ... }
  prices jsonb not null default '{}'::jsonb,  -- { ticker: { price, change } }
  usd_eur_rate numeric not null,
  btc_price_usd numeric not null,
  created_at timestamptz default now()
);

create table if not exists contributions (
  id uuid primary key default gen_random_uuid(),
  amount_eur numeric not null,
  type text not null,            -- 'liquidez' | 'inversion' | 'nomina' | 'otro'
  note text,
  date date not null default current_date,
  created_at timestamptz default now()
);

create index if not exists snapshots_created_at_idx on snapshots (created_at desc);
create index if not exists contributions_date_idx on contributions (date desc);

-- Row-level security: since this is a single-user app without auth we simply
-- enable public read/write via the anon key. If you add auth later, tighten
-- these policies so only auth.uid() = owner_id can access rows.
alter table positions       enable row level security;
alter table manual_assets   enable row level security;
alter table snapshots       enable row level security;
alter table contributions   enable row level security;

create policy "anon all positions"      on positions       for all using (true) with check (true);
create policy "anon all manual_assets"  on manual_assets   for all using (true) with check (true);
create policy "anon all snapshots"      on snapshots       for all using (true) with check (true);
create policy "anon all contributions"  on contributions   for all using (true) with check (true);
