-- Kit d'uniforme de base (chandail + short + bas, inclus avec toute
-- inscription payée — pas un achat boutique séparé) + sac pour les 30
-- premiers payants de la saison hiver. Référence soit un lead (Été 2026,
-- table `leads`) soit une inscription (Automne/Hiver et saisons futures,
-- table `registrations`) — deux tables différentes, donc pas de clé
-- étrangère native ; l'intégrité est garantie côté application.
create table if not exists public.registration_uniform_kits (
  id uuid primary key default gen_random_uuid(),
  season_key text not null,
  source_type text not null check (source_type in ('lead', 'registration')),
  source_id uuid not null,
  delivered boolean not null default false,
  delivered_at timestamptz,
  delivered_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_key, source_type, source_id)
);

alter table public.registration_uniform_kits enable row level security;
drop policy if exists "service_role_all" on public.registration_uniform_kits;
create policy "service_role_all" on public.registration_uniform_kits
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists idx_uniform_kits_season on public.registration_uniform_kits(season_key);
