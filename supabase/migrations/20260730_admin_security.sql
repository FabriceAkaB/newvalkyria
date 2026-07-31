-- Phase Sécurité — renforcer l'authentification admin
-- Additive only : nouvelles tables, aucune table existante touchée.
-- Remplace le cookie statique "nv_admin=ok" par un vrai jeton de session
-- vérifié côté serveur, et ajoute un limiteur de tentatives de connexion.

create table if not exists public.admin_sessions (
  token text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.admin_sessions enable row level security;
drop policy if exists "service_role_all" on public.admin_sessions;
create policy "service_role_all" on public.admin_sessions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create table if not exists public.admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  attempted_at timestamptz not null default now(),
  success boolean not null
);

alter table public.admin_login_attempts enable row level security;
drop policy if exists "service_role_all" on public.admin_login_attempts;
create policy "service_role_all" on public.admin_login_attempts
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists idx_admin_login_attempts_ip_time on public.admin_login_attempts(ip, attempted_at);
