-- Comptabilité : distingue une charge déjà payée (sort de l'encaisse tout de
-- suite) d'une facture à payer plus tard (engagement réel mais l'argent est
-- encore en banque) — nécessaire pour "argent disponible" vs "factures en
-- attente" et la projection de trésorerie.
alter table public.revenue_expenses
  add column if not exists status text not null default 'paid' check (status in ('paid', 'due'));
alter table public.revenue_expenses
  add column if not exists due_date date;

-- Budget annuel par catégorie de charge, comparé aux dépenses réelles.
create table if not exists public.revenue_budgets (
  category text primary key,
  amount_cents integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.revenue_budgets enable row level security;
drop policy if exists "service_role_all" on public.revenue_budgets;
create policy "service_role_all" on public.revenue_budgets
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
