-- Points des joueuses et récompenses (demande de JP, 2 nov. 2026 ; P4.6 Appartenance). Les points de présence se
-- calculent à partir des présences (activity_player_attendance), sans double saisie. Ici : les gagnantes du jour
-- choisies par l'éducateur (victoire, attitude), les bonus et les échanges contre une récompense (points négatifs).
create table if not exists public.player_points (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  registration_id uuid not null references public.registrations(id) on delete cascade,
  player_id uuid,
  activity_id uuid references public.coach_activities(id) on delete cascade,
  kind text not null check (kind in ('victoire', 'attitude', 'bonus', 'echange')),
  points integer not null,
  reward_id uuid,
  note text,
  coach_id uuid references public.coaches(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Une seule fois par joueuse, pratique et catégorie (les échanges n'ont pas de pratique : activity_id nul, donc jamais en conflit).
drop index if exists public.player_points_one_win_per_kind;
create unique index if not exists player_points_one_per_activity_kind on public.player_points (activity_id, registration_id, kind);
create index if not exists player_points_registration_idx on public.player_points (registration_id, created_at);

alter table public.player_points enable row level security;
drop policy if exists "service_role_all" on public.player_points;
create policy "service_role_all" on public.player_points
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Catalogue des récompenses : un produit de la boutique ou autre chose (ex. choisir le jeu de fin de pratique).
create table if not exists public.point_rewards (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  name text not null,
  cost integer not null check (cost > 0),
  product_id uuid,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.point_rewards enable row level security;
drop policy if exists "service_role_all" on public.point_rewards;
create policy "service_role_all" on public.point_rewards
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
