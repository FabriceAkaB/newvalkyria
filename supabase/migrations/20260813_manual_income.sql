-- Revenus saisis manuellement (commandites, subventions, dons, autres) —
-- symétrique à revenue_expenses. Les inscriptions/boutique restent
-- automatiques (jamais saisies ici, pour éviter le double-comptage).
create table if not exists public.revenue_income (
  id uuid primary key default gen_random_uuid(),
  season_key text not null,
  category text not null,
  label text not null,
  amount_cents integer not null,
  income_date date not null,
  paid_with text not null default 'Compte bancaire',
  tax_rate numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.revenue_income enable row level security;
drop policy if exists "service_role_all" on public.revenue_income;
create policy "service_role_all" on public.revenue_income
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists idx_revenue_income_season on public.revenue_income(season_key);
