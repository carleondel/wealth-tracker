-- Web Push (installed iOS app / browsers) for price-target alerts.

-- One row per device that enabled alerts.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_owner_idx on push_subscriptions(owner_id);

alter table push_subscriptions enable row level security;

create policy "own push_subscriptions" on push_subscriptions
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Targets already notified, so the daily cron alerts once per crossing.
-- The row is removed when the price falls back clearly below the target,
-- which re-arms the alert. Written by the cron with the service role.
create table if not exists target_alerts (
  position_id uuid not null references positions(id) on delete cascade,
  target_price_usd numeric not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  notified_at timestamptz not null default now(),
  primary key (position_id, target_price_usd)
);

alter table target_alerts enable row level security;

create policy "own target_alerts" on target_alerts
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
