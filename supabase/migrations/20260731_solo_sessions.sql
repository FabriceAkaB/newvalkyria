-- Séances individuelles (solo) — programmes Solo Valkyria / SVA.
-- Système séparé des plages de pratique technique : rotation de groupes
-- (ex. 4 joueuses aux 2 semaines) avec calendrier de dates précises.

create table if not exists public.solo_groups (
  id uuid primary key default gen_random_uuid(),
  season_id text not null references public.seasons(id),
  label text not null,
  day text not null,
  start_time text not null,
  end_time text not null,
  location text not null,
  max_places integer not null default 4,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.solo_groups enable row level security;
drop policy if exists "service_role_all" on public.solo_groups;
create policy "service_role_all" on public.solo_groups
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists idx_solo_groups_season on public.solo_groups(season_id);

create table if not exists public.solo_group_dates (
  id uuid primary key default gen_random_uuid(),
  solo_group_id uuid not null references public.solo_groups(id) on delete cascade,
  occurs_on date not null,
  cancelled boolean not null default false
);

alter table public.solo_group_dates enable row level security;
drop policy if exists "service_role_all" on public.solo_group_dates;
create policy "service_role_all" on public.solo_group_dates
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists idx_solo_group_dates_group on public.solo_group_dates(solo_group_id);

create table if not exists public.solo_group_members (
  id uuid primary key default gen_random_uuid(),
  solo_group_id uuid not null references public.solo_groups(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (registration_id)
);

alter table public.solo_group_members enable row level security;
drop policy if exists "service_role_all" on public.solo_group_members;
create policy "service_role_all" on public.solo_group_members
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists idx_solo_group_members_group on public.solo_group_members(solo_group_id);
