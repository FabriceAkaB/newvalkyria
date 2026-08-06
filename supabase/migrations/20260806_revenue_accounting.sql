-- Extension du calculateur de revenus vers un vrai système comptable,
-- inspiré du gabarit personnel de l'utilisateur (taxes, comptes, objectifs
-- mensuels) — scope New Valkyria uniquement.

-- Taxe et compte de paiement par charge (comme "TAX %" / "PAID WITH" du
-- gabarit Excel).
alter table public.revenue_expenses add column if not exists tax_rate numeric not null default 0;
alter table public.revenue_expenses add column if not exists paid_with text not null default 'Compte bancaire';

-- Taux de taxe unique appliqué aux revenus (ces derniers proviennent de
-- systèmes existants — leads, inscriptions, boutique — sans colonne de
-- taxe par transaction ; un seul taux global suffit pour la ventilation
-- net/taxe à l'affichage et à l'export).
create table if not exists public.revenue_settings (
  id boolean primary key default true,
  revenue_tax_rate numeric not null default 0,
  constraint revenue_settings_singleton check (id)
);
insert into public.revenue_settings (id) values (true) on conflict do nothing;

alter table public.revenue_settings enable row level security;
drop policy if exists "service_role_all" on public.revenue_settings;
create policy "service_role_all" on public.revenue_settings
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Objectif de profit mensuel (en plus des objectifs par saison déjà en
-- place) — mois au format 'YYYY-MM'.
create table if not exists public.revenue_monthly_goals (
  month text primary key,
  goal_cents integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.revenue_monthly_goals enable row level security;
drop policy if exists "service_role_all" on public.revenue_monthly_goals;
create policy "service_role_all" on public.revenue_monthly_goals
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
