-- Équipes, duos et capitaines de chaque pratique (JP, 17 nov. 2026) : qui était avec qui, qui a été capitaine,
-- sa tâche selon le thème et la note de son leadership. Sert à faire des équipes nouvelles la fois suivante.
create table if not exists public.practice_teams (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.coach_activities(id) on delete cascade,
  kind text not null default 'equipe' check (kind in ('equipe', 'duo')),
  label text not null,
  position smallint not null default 0,
  members uuid[] not null default '{}',
  captain_registration_id uuid,
  captain_task text,
  leadership smallint check (leadership between 1 and 5),
  leadership_note text,
  rated_by text,
  rated_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists practice_teams_activity_idx on public.practice_teams (activity_id);
create index if not exists practice_teams_members_idx on public.practice_teams using gin (members);
alter table public.practice_teams enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'practice_teams' and policyname = 'service_role_all') then
    create policy service_role_all on public.practice_teams for all to service_role using (true) with check (true);
  end if;
end $$;
