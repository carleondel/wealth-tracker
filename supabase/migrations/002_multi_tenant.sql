-- Multi-tenant migration. Each row belongs to an auth user.
-- IMPORTANT: this truncates the current demo data. After running it, sign in
-- with magic link and click "Cargar datos de ejemplo" to reseed your account.

truncate table contributions, snapshots, manual_assets, positions;

alter table positions
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table manual_assets
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table snapshots
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table contributions
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create index if not exists positions_owner_idx     on positions(owner_id);
create index if not exists manual_assets_owner_idx on manual_assets(owner_id);
create index if not exists snapshots_owner_idx     on snapshots(owner_id, created_at desc);
create index if not exists contributions_owner_idx on contributions(owner_id, date desc);

drop policy if exists "anon all positions"     on positions;
drop policy if exists "anon all manual_assets" on manual_assets;
drop policy if exists "anon all snapshots"     on snapshots;
drop policy if exists "anon all contributions" on contributions;

create policy "own positions"     on positions     for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "own manual_assets" on manual_assets for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "own snapshots"     on snapshots     for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "own contributions" on contributions for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
