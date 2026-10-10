-- Formulaire « Votre équipe » : une équipe extérieure doit décrire son groupe AVANT de
-- pouvoir choisir une plage de match. Le profil est conservé (même sans réservation) pour
-- permettre un suivi, et chaque réservation exige un profil valide.
create table if not exists public.match_team_profiles (
  id uuid primary key default gen_random_uuid(),
  org_name text not null,
  org_key text not null,
  team_label text not null,
  team_gender text not null check (team_gender in ('filles', 'garcons', 'mixte')),
  team_birth_year integer not null,
  team_level text not null,
  team_players integer,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists match_team_profiles_unique on public.match_team_profiles(lower(contact_email), org_key, team_gender, team_birth_year, lower(team_label));
alter table public.match_team_profiles enable row level security;
create policy match_team_profiles_service_role_all on public.match_team_profiles for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

alter table public.match_slot_bookings add column if not exists team_level text;
alter table public.match_slot_bookings add column if not exists team_players integer;
alter table public.match_slot_bookings add column if not exists team_profile_id uuid references public.match_team_profiles(id);
