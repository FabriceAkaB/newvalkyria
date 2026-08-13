-- Pièces jointes sur une dépense (facture, reçu, photo) — plusieurs fichiers
-- possibles par dépense. Bucket privé (documents financiers) : accès
-- uniquement via URL signée générée côté serveur, jamais d'URL publique.
insert into storage.buckets (id, name, public)
values ('expense-documents', 'expense-documents', false)
on conflict (id) do nothing;

create table if not exists public.revenue_expense_documents (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.revenue_expenses(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

alter table public.revenue_expense_documents enable row level security;
drop policy if exists "service_role_all" on public.revenue_expense_documents;
create policy "service_role_all" on public.revenue_expense_documents
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists idx_revenue_expense_documents_expense on public.revenue_expense_documents(expense_id);
