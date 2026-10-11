-- Habyt szinkron: egy sor felhasználónként, benne a teljes (összefésülhető) állapot.
-- Futtasd le egyszer a Supabase projekt SQL Editorában (SQL Editor -> New query -> Run).

create table if not exists public.habyt_state (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  rev integer not null default 1,
  updated_at timestamptz not null default now()
);

-- Mindenki csak a saját sorát láthatja és módosíthatja.
alter table public.habyt_state enable row level security;

drop policy if exists "habyt sajat sor olvasasa" on public.habyt_state;
create policy "habyt sajat sor olvasasa" on public.habyt_state
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "habyt sajat sor letrehozasa" on public.habyt_state;
create policy "habyt sajat sor letrehozasa" on public.habyt_state
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "habyt sajat sor modositasa" on public.habyt_state;
create policy "habyt sajat sor modositasa" on public.habyt_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.habyt_state from anon;
grant select, insert, update on public.habyt_state to authenticated;

-- Ranglétra: felhasználónként egy nyilvános sor (csak a hős neve, szintje, rangja, XP-je; email nincs benne).
-- Az app minden szinkron után frissíti. Bejelentkezett felhasználók láthatják a látható sorokat.
create table if not exists public.habyt_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  hero_name text not null default 'Hős' check (char_length(hero_name) between 1 and 20),
  level integer not null default 1 check (level between 1 and 1000),
  xp integer not null default 0 check (xp between 0 and 10000000),
  stage text not null default 'Újonc' check (char_length(stage) <= 20),
  visible boolean not null default true,
  updated_at timestamptz not null default now()
);

-- A dobogón a hős a saját kinézetével áll (nem és bőrszín).
alter table public.habyt_profiles
  add column if not exists gender text not null default 'm' check (gender in ('m', 'f')),
  add column if not exists skin text not null default 'bezs' check (char_length(skin) <= 20);

create index if not exists habyt_profiles_rank on public.habyt_profiles (xp desc) where visible;
create index if not exists habyt_profiles_rank_order on public.habyt_profiles (xp desc, updated_at asc) where visible;

alter table public.habyt_profiles enable row level security;

drop policy if exists "habyt ranglista olvasasa" on public.habyt_profiles;
create policy "habyt ranglista olvasasa" on public.habyt_profiles
  for select to authenticated using (visible or (select auth.uid()) = user_id);

drop policy if exists "habyt sajat profil letrehozasa" on public.habyt_profiles;
create policy "habyt sajat profil letrehozasa" on public.habyt_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "habyt sajat profil modositasa" on public.habyt_profiles;
create policy "habyt sajat profil modositasa" on public.habyt_profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.habyt_profiles from anon;
grant select, insert, update on public.habyt_profiles to authenticated;
-- Saját helyezés (a 100. hely utáni is): hányan vannak előtted + 1, és hány látható hős van összesen.
create or replace function public.habyt_my_rank()
returns table (rank bigint, total bigint, visible boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select count(*) from public.habyt_profiles p where p.visible and p.xp > me.xp) + 1,
    (select count(*) from public.habyt_profiles p where p.visible),
    me.visible
  from public.habyt_profiles me
  where me.user_id = (select auth.uid());
$$;

revoke all on function public.habyt_my_rank() from public, anon;
grant execute on function public.habyt_my_rank() to authenticated;