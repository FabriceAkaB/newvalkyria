-- Contrats d'embauche signés en ligne (lien personnel envoyé à l'employée).
-- Le PDF original, la copie signée et le spécimen de chèque restent dans un
-- espace de stockage privé ; le NAS est chiffré, jamais conservé en clair.
create table if not exists public.employee_contracts (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  employee_name text not null,
  employee_email text,
  title text not null,
  template_path text not null,
  status text not null default 'sent' check (status in ('sent', 'signed', 'cancelled')),
  summary jsonb not null default '[]'::jsonb,
  pay_schedule jsonb not null default '[]'::jsonb,
  prefill jsonb not null default '{}'::jsonb,
  employee_data jsonb,
  sin_encrypted text,
  signed_at timestamptz,
  signer_ip text,
  signer_user_agent text,
  signed_pdf_path text,
  cheque_path text,
  employer_signature_path text,
  employer_signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employee_contracts enable row level security;
create policy employee_contracts_service_role_all on public.employee_contracts
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

insert into storage.buckets (id, name, public)
values ('employee-contracts', 'employee-contracts', false)
on conflict (id) do nothing;
