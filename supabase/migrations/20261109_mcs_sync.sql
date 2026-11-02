-- MonClubSportif : ce qui a déjà été importé (membres, événements) pour ne produire que les nouveautés,
-- et repérer les joueuses à retirer. Base de l'agent MonClubSportif (A12) et de l'automatisation AU19.
create table if not exists public.mcs_sync_items (
  id bigserial primary key,
  club_id text not null default 'new-valkyria',
  kind text not null check (kind in ('membre', 'evenement')),
  key text not null,
  label text,
  synced_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (club_id, kind, key)
);
alter table public.mcs_sync_items enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'mcs_sync_items' and policyname = 'mcs_sync_items_service_role_all') then
    create policy mcs_sync_items_service_role_all on public.mcs_sync_items for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
end $$;
