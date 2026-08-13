-- Bibliothèque d'exercices + planification de séance par blocs + thèmes
-- saisonniers (sections 13-15 de l'audit).

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  objective text,
  category text,
  level text,
  duration_minutes integer,
  material text,
  min_players integer,
  max_players integer,
  dimensions text,
  instructions text,
  variants text,
  coaching_points text,
  common_mistakes text,
  image_url text,
  video_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exercises enable row level security;
create policy exercises_service_role_all on public.exercises
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Blocs de séance, rattachés à une activité entraîneur existante.
create table if not exists public.activity_session_blocks (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.coach_activities(id) on delete cascade,
  block_order integer not null default 0,
  block_type text not null,
  exercise_id uuid references public.exercises(id) on delete set null,
  custom_title text,
  duration_minutes integer not null default 10,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.activity_session_blocks enable row level security;
create policy activity_session_blocks_service_role_all on public.activity_session_blocks
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create index if not exists idx_session_blocks_activity on public.activity_session_blocks(activity_id, block_order);

-- Thème pédagogique par semaine, par saison.
create table if not exists public.season_themes (
  id uuid primary key default gen_random_uuid(),
  season_id text not null references public.seasons(id) on delete cascade,
  week_start_date date not null,
  theme text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (season_id, week_start_date)
);

alter table public.season_themes enable row level security;
create policy season_themes_service_role_all on public.season_themes
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
