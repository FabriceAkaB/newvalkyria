-- Objectifs financiers par saison pour le calculateur de revenus admin.
-- season_key est libre : id réel de la table `seasons` pour le nouveau
-- système, ou une clé fixe ("ete-2026", "boutique") pour l'ancien système
-- Été et la boutique, qui n'ont pas de ligne dans `seasons`.
create table if not exists public.revenue_goals (
  season_key text primary key,
  season_label text not null,
  goal_cents integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.revenue_goals enable row level security;
drop policy if exists "service_role_all" on public.revenue_goals;
create policy "service_role_all" on public.revenue_goals
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
