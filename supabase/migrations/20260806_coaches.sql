-- Section "Gestion des entraîneurs" — fiches, calendrier d'activités,
-- assignation/présence, taux horaires, paiements. Phase 1 : fondation.

create table if not exists public.coaches (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  role text not null default 'Entraîneur',
  default_hourly_rate_cents integer not null default 0,
  hired_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coaches enable row level security;
drop policy if exists "service_role_all" on public.coaches;
create policy "service_role_all" on public.coaches
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Taux horaire différent selon le type d'activité, par entraîneur (surcharge
-- du taux par défaut de coaches.default_hourly_rate_cents).
create table if not exists public.coach_type_rates (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  activity_type text not null,
  hourly_rate_cents integer not null,
  created_at timestamptz not null default now(),
  unique (coach_id, activity_type)
);

alter table public.coach_type_rates enable row level security;
drop policy if exists "service_role_all" on public.coach_type_rates;
create policy "service_role_all" on public.coach_type_rates
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create table if not exists public.coach_activities (
  id uuid primary key default gen_random_uuid(),
  activity_date date not null,
  start_time time not null,
  end_time time not null,
  location text,
  category text,
  activity_type text not null,
  title text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_activities_date_idx on public.coach_activities (activity_date);

alter table public.coach_activities enable row level security;
drop policy if exists "service_role_all" on public.coach_activities;
create policy "service_role_all" on public.coach_activities
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Assignation d'un entraîneur à une activité : présence, heures réelles
-- (par défaut celles de l'activité), taux horaire (surcharge ponctuelle
-- possible), et suivi du paiement pour CETTE activité précise.
create table if not exists public.coach_assignments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.coach_activities(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  status text not null default 'present' check (status in ('present', 'absent', 'replaced', 'cancelled')),
  arrival_time time,
  departure_time time,
  hourly_rate_cents integer,
  paid boolean not null default false,
  paid_on date,
  payment_method text,
  payment_reference text,
  payment_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, coach_id)
);

create index if not exists coach_assignments_activity_idx on public.coach_assignments (activity_id);
create index if not exists coach_assignments_coach_idx on public.coach_assignments (coach_id);

alter table public.coach_assignments enable row level security;
drop policy if exists "service_role_all" on public.coach_assignments;
create policy "service_role_all" on public.coach_assignments
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
