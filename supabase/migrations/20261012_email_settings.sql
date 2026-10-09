-- Boîte d'envoi des courriels du site (Gmail / Google Workspace, SMTP avec
-- mot de passe d'application). Le mot de passe est CHIFFRÉ (AES-256-GCM) —
-- jamais stocké en clair. Ligne unique.
create table if not exists public.email_settings (
  id boolean primary key default true check (id),
  smtp_user text not null,
  smtp_password_enc text not null,
  from_name text not null default 'New Valkyria',
  updated_at timestamptz not null default now()
);
alter table public.email_settings enable row level security;
create policy email_settings_service_role_all on public.email_settings for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
