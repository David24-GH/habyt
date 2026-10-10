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
