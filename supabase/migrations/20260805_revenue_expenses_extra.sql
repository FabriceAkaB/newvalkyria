-- Catégories et récurrence pour les charges du calculateur de revenus admin.
alter table public.revenue_expenses add column if not exists category text not null default 'Autre';
alter table public.revenue_expenses add column if not exists is_recurring boolean not null default false;
alter table public.revenue_expenses add column if not exists recurrence_end_date date;
