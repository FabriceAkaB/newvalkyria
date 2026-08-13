-- Terrains configurables + lien structuré depuis coach_activities, pour
-- pouvoir détecter les doubles réservations (section 11/43 de l'audit).
-- Additif : coach_activities.location (texte libre) reste en place pour
-- l'affichage, terrain_id est la nouvelle référence structurée optionnelle.

create table if not exists public.terrains (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.terrains enable row level security;
create policy terrains_service_role_all on public.terrains
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

alter table public.coach_activities add column if not exists terrain_id uuid references public.terrains(id);
create index if not exists idx_coach_activities_terrain_date on public.coach_activities(terrain_id, activity_date);
