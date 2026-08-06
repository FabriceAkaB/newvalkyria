-- Espace "Entraîneur" — comptes individuels, présences des joueuses par
-- activité, évaluations post-pratique, objectifs individuels. Phase 1 :
-- fondation + boucle quotidienne (tableau de bord, présence, évaluation).

-- Identifiants de connexion pour chaque entraîneur (distinct du compte
-- admin/gérante) — mot de passe haché (scrypt), jamais en clair.
alter table public.coaches add column if not exists username text unique;
alter table public.coaches add column if not exists password_hash text;

create table if not exists public.coach_sessions (
  token text primary key,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.coach_sessions enable row level security;
drop policy if exists "service_role_all" on public.coach_sessions;
create policy "service_role_all" on public.coach_sessions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Présence des JOUEUSES à une activité (distinct de coach_assignments, qui
-- suit la présence des ENTRAÎNEURS).
create table if not exists public.activity_player_attendance (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.coach_activities(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  status text not null default 'present' check (status in ('present', 'absent', 'injured', 'late', 'left_early')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, registration_id)
);

create index if not exists activity_player_attendance_activity_idx on public.activity_player_attendance (activity_id);
create index if not exists activity_player_attendance_registration_idx on public.activity_player_attendance (registration_id);

alter table public.activity_player_attendance enable row level security;
drop policy if exists "service_role_all" on public.activity_player_attendance;
create policy "service_role_all" on public.activity_player_attendance
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Rapport d'évaluation d'une joueuse pour une activité donnée, par un
-- entraîneur donné. `ratings` est un objet libre { critere: note 1-5, ... }
-- pour rester extensible sans migration future.
create table if not exists public.player_evaluations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.coach_activities(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  ratings jsonb not null default '{}',
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, registration_id, coach_id)
);

create index if not exists player_evaluations_registration_idx on public.player_evaluations (registration_id);

alter table public.player_evaluations enable row level security;
drop policy if exists "service_role_all" on public.player_evaluations;
create policy "service_role_all" on public.player_evaluations
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Objectifs individuels d'une joueuse, visibles à chaque pratique.
create table if not exists public.player_objectives (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  objective text not null,
  created_by uuid references public.coaches(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists player_objectives_registration_idx on public.player_objectives (registration_id);

alter table public.player_objectives enable row level security;
drop policy if exists "service_role_all" on public.player_objectives;
create policy "service_role_all" on public.player_objectives
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
