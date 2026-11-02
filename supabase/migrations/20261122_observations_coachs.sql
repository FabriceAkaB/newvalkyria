-- Formation des coachs (Mandalart P1.4.03) : une séance observée et filmée par coach chaque mois, notée sur 10 selon
-- la règle du coach, avec le retour de JP publié dans le portail de l'éducateur.
create table if not exists public.coach_observations (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  coach_id uuid not null references public.coaches(id) on delete cascade,
  activity_id uuid references public.coach_activities(id) on delete set null,
  observed_on date not null,
  video_url text,                             -- lien privé (YouTube non répertorié), jamais un fichier public
  scores jsonb not null default '{}'::jsonb,  -- { parle_peu: 0-2, questions: 0-2, compliments: 0-2, toutes_actives: 0-2, plan: 0-2 }
  total integer check (total between 0 and 10),
  strengths text,
  to_improve text,
  next_focus text,
  shared_at timestamptz,                      -- publié à l'éducateur dans son portail
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_observations_coach_idx on public.coach_observations (club_id, coach_id, observed_on desc);

alter table public.coach_observations enable row level security;
drop policy if exists "service_role_all" on public.coach_observations;
create policy "service_role_all" on public.coach_observations
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
