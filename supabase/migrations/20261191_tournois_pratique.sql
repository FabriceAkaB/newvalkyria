-- Tournoi de fin de pratique (JP, 26 nov. 2026) : 3 contre 3 à 6 contre 6, équipes formées par le site
-- (qui était avec qui, notes des joueuses, joker), horaire, scores et classement. Un tournoi par pratique.
create table if not exists practice_tournaments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null unique references coach_activities(id) on delete cascade,
  settings jsonb not null,
  teams jsonb not null default '[]'::jsonb,
  results jsonb not null default '{}'::jsonb,
  present text[] not null default '{}',
  theme text,
  captain_task text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table practice_tournaments enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'practice_tournaments' and policyname = 'service_role_all') then
    create policy service_role_all on practice_tournaments for all to service_role using (true) with check (true);
  end if;
end $$;
