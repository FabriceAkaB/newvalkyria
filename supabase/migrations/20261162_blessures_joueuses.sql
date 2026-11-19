-- Fiche de blessure (JP, 18 nov. 2026) : l'éducateur signale une blessure ou un malaise pendant la pratique, avec
-- les premiers soins et si le parent est avisé ; JP reçoit une tâche « appeler la famille » et suit jusqu'au retour au jeu.
-- Données d'enfant (Loi 25) : table privée, lue seulement par le serveur (service_role).
create table if not exists public.player_incidents (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  activity_id uuid references public.coach_activities(id) on delete set null,
  registration_id uuid not null,
  player_name text not null,
  coach_id uuid references public.coaches(id) on delete set null,
  reported_by text,
  kind text not null default 'blessure' check (kind in ('blessure', 'choc-tete', 'malaise', 'autre')),
  body_part text,
  description text not null,
  first_aid text,
  stopped_playing boolean not null default false,
  parent_notified boolean not null default false,
  status text not null default 'ouverte' check (status in ('ouverte', 'suivi', 'fermee')),
  follow_up text,
  return_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists player_incidents_open_idx on public.player_incidents (club_id, status, created_at desc);
create index if not exists player_incidents_activity_idx on public.player_incidents (activity_id);
do $$
begin
  execute 'alter table public.player_incidents enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'player_incidents' and policyname = 'player_incidents_service_role_all') then
    execute 'create policy player_incidents_service_role_all on public.player_incidents for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end $$;
