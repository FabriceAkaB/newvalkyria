-- Système documentaire général (section 29 de l'audit) : contrats,
-- formulaires, autorisations, factures... rattachés à une inscription, un
-- lead ou un entraîneur. Référence polymorphe (entity_type/entity_id),
-- même patron assumé que registration_uniform_kits — intégrité côté
-- application, ces trois tables cibles existent déjà et sont stables.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('registration', 'lead', 'coach')),
  entity_id uuid not null,
  category text not null default 'Autre',
  file_name text not null,
  storage_path text not null,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

alter table public.documents enable row level security;
create policy documents_service_role_all on public.documents
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create index if not exists idx_documents_entity on public.documents(entity_type, entity_id);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
