-- Gestion des matchs — réutilise coach_activities (activity_type='Match')
-- plutôt que de dupliquer la planification/le staffing/la paie déjà en
-- place (voir coach_activities/coach_assignments). Ces tables n'ajoutent
-- que ce qui est spécifique à un match : détails, convocations, alignement
-- visuel, temps de jeu et évaluations post-match par position.

create table public.match_details (
  activity_id uuid primary key references public.coach_activities(id) on delete cascade,
  opponent_name text not null,
  home_away text not null default 'home' check (home_away in ('home', 'away')),
  formation text,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'cancelled')),
  final_score_us integer,
  final_score_them integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.match_convocations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.coach_activities(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  status text not null default 'convoked' check (status in ('convoked', 'confirmed', 'declined', 'absent')),
  created_at timestamptz not null default now(),
  unique (activity_id, registration_id)
);

create table public.match_lineup_slots (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.coach_activities(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  position_code text,
  x numeric,
  y numeric,
  is_starter boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, registration_id)
);

create table public.match_playtime_segments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.coach_activities(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  minute_in integer not null,
  minute_out integer,
  created_at timestamptz not null default now()
);
create index idx_match_playtime_activity on public.match_playtime_segments(activity_id);

create table public.match_player_evaluations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.coach_activities(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  position_code text,
  scale integer not null default 10 check (scale in (10, 100)),
  score numeric,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, registration_id, coach_id)
);

alter table public.match_details enable row level security;
alter table public.match_convocations enable row level security;
alter table public.match_lineup_slots enable row level security;
alter table public.match_playtime_segments enable row level security;
alter table public.match_player_evaluations enable row level security;

create policy match_details_service_role_all on public.match_details for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy match_convocations_service_role_all on public.match_convocations for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy match_lineup_slots_service_role_all on public.match_lineup_slots for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy match_playtime_segments_service_role_all on public.match_playtime_segments for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy match_player_evaluations_service_role_all on public.match_player_evaluations for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
