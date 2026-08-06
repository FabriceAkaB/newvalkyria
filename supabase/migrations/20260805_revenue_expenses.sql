-- Charges saisies manuellement pour le calculateur de revenus admin — permet
-- de voir un net (revenus - charges) par saison/boutique, comme un vrai
-- document comptable. season_key suit la même convention que revenue_goals
-- ("ete-2026", l'id d'une vraie saison, "boutique", ou "general" pour les
-- charges non rattachées à une saison précise (frais fixes, assurance, etc.)
create table if not exists public.revenue_expenses (
  id uuid primary key default gen_random_uuid(),
  season_key text not null,
  label text not null,
  amount_cents integer not null,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists revenue_expenses_season_idx on public.revenue_expenses (season_key);

alter table public.revenue_expenses enable row level security;
drop policy if exists "service_role_all" on public.revenue_expenses;
create policy "service_role_all" on public.revenue_expenses
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
