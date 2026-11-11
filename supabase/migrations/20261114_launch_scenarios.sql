-- Calculateur de lancement GO / NO-GO (Mandalart P7.2.02, automatisation AU11).
-- Chaque scénario garde les entrées du calcul (coûts fixes, coûts par participante, places, prix)
-- et les résultats recalculés par le serveur (prix plancher, seuils, marge à 70 % de remplissage,
-- verdict). Un scénario peut être relié à un programme existant (saison filles ou programme à
-- dates fixes) pour suivre les préventes : deux semaines avant la date de début, « Aujourd'hui »
-- signale un lancement dont les préventes sont sous le seuil de survie.
-- Aucune donnée d'enfant ici (Loi 25) : seulement des montants et des nombres.

create table if not exists public.launch_scenarios (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  name text not null,
  source_kind text check (source_kind in ('saison', 'session')),
  source_id text,
  start_date date,
  inputs jsonb not null,
  results jsonb not null,
  verdict text not null check (verdict in ('go', 'risque', 'no-go')),
  margin_at_70 numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists launch_scenarios_club_created_idx on public.launch_scenarios (club_id, created_at desc);
create index if not exists launch_scenarios_club_start_idx on public.launch_scenarios (club_id, start_date);

alter table public.launch_scenarios enable row level security;

do $$
declare t text;
begin
  foreach t in array array['launch_scenarios'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_service_role_all') then
      execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t || '_service_role_all', t);
    end if;
  end loop;
end $$;
