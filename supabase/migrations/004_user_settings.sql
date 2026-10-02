-- Per-user settings. Starts with the target allocation per category, which
-- used to be a hardcoded constant and reset on every reload.
-- category_targets: { "Crypto": 35, "Crypto Proxy": 20, ... } (percent, 0-100)
create table if not exists user_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  category_targets jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy "own user_settings" on user_settings
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
