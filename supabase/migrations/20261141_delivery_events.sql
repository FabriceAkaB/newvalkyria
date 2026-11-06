-- Promesses tenues : chaque activité de chaque équipe MonClubSportif de la saison (relue chaque jour), pour comparer ce
-- qui a été vendu (pratiques promises par programme) à ce qui est donné, à venir ou annulé (séances à remettre).
create table if not exists public.delivery_events (
  id bigint generated always as identity primary key,
  club_id text not null default 'new-valkyria',
  team_id uuid not null references public.mcs_teams(id) on delete cascade,
  mcs_event_id bigint not null,
  title text not null default '',
  event_date date,
  kind text not null default 'pratique' check (kind in ('pratique', 'match')),
  cancelled boolean not null default false,
  removed_at timestamptz,
  seen_at timestamptz not null default now(),
  unique (team_id, mcs_event_id)
);
create index if not exists delivery_events_team_idx on public.delivery_events (team_id, event_date);
alter table public.delivery_events enable row level security;
do $$ begin
  create policy delivery_events_service_role_all on public.delivery_events for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;
