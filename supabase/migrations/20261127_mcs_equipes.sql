-- MonClubSportif relié au site (demande de JP, 3 nov. 2026 ; agent A12, P8.4.08) : une ligne par équipe MCS avec son lien
-- d'abonnement iCal « Sync » (lecture seule, officiel), et les événements lus (cache rafraîchi par le site).
-- Sert à : ne jamais vendre une plage de match où l'équipe est déjà prise, voir les matchs sans adversaire, comparer
-- MCS et l'admin. Aucune donnée d'enfant (Loi 25) : noms d'équipes, dates, lieux, titres d'événements.
create table if not exists public.mcs_teams (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  name text not null,
  birth_years integer[] not null default '{}',
  gender text not null default 'filles' check (gender in ('filles', 'garcons', 'mixte')),
  ical_url text,
  active boolean not null default true,
  last_sync_at timestamptz,
  last_error text,
  events_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.mcs_events (
  team_id uuid not null references public.mcs_teams(id) on delete cascade,
  key text not null,
  event_date date not null,
  start_time text,
  end_time text,
  title text not null,
  location text,
  type text not null,
  opponent text,
  synced_at timestamptz not null default now(),
  primary key (team_id, key)
);
create index if not exists mcs_events_date_idx on public.mcs_events (event_date);

alter table public.mcs_teams enable row level security;
alter table public.mcs_events enable row level security;
drop policy if exists "service_role_all" on public.mcs_teams;
create policy "service_role_all" on public.mcs_teams for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
drop policy if exists "service_role_all" on public.mcs_events;
create policy "service_role_all" on public.mcs_events for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
