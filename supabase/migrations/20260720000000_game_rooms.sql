create table if not exists public.game_rooms (
  code text primary key check (code ~ '^[0-9]{5}$'),
  request_id text,
  player_name text,
  approved_request_id text,
  host_x double precision,
  host_y double precision,
  guest_x double precision,
  guest_y double precision,
  updated_at timestamptz not null default now()
);

alter table public.game_rooms enable row level security;

drop policy if exists "game rooms are publicly readable" on public.game_rooms;
create policy "game rooms are publicly readable" on public.game_rooms for select using (true);

drop policy if exists "game rooms can be created" on public.game_rooms;
create policy "game rooms can be created" on public.game_rooms for insert with check (true);

drop policy if exists "game rooms can be updated" on public.game_rooms;
create policy "game rooms can be updated" on public.game_rooms for update using (true) with check (true);

grant select, insert, update on public.game_rooms to anon, authenticated;
