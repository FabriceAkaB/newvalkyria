-- Migre club-aliases-store.ts et trial-dates-store.ts, jusqu'ici 100% en
-- mémoire (perdus à chaque redéploiement), vers de vraies tables Supabase.

create table if not exists public.club_groups (
  id uuid primary key default gen_random_uuid(),
  canonical text not null unique,
  aliases jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.club_groups enable row level security;
create policy club_groups_service_role_all on public.club_groups
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Singleton (même patron que revenue_settings) : une seule ligne, id fixe.
create table if not exists public.trial_config (
  id boolean primary key default true,
  config jsonb not null,
  updated_at timestamptz not null default now(),
  constraint trial_config_singleton check (id)
);

alter table public.trial_config enable row level security;
create policy trial_config_service_role_all on public.trial_config
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
