-- Certifications entraîneurs (section 30 de l'audit) : nom, niveau/organisme,
-- date d'obtention, date d'expiration (nullable — certaines ne périment pas),
-- document justificatif optionnel.

create table if not exists public.coach_certifications (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  name text not null,
  issued_date date,
  expiry_date date,
  document_url text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.coach_certifications enable row level security;
create policy coach_certifications_service_role_all on public.coach_certifications
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create index if not exists idx_coach_certifications_coach on public.coach_certifications(coach_id);

insert into storage.buckets (id, name, public)
values ('coach-certification-documents', 'coach-certification-documents', false)
on conflict (id) do nothing;
