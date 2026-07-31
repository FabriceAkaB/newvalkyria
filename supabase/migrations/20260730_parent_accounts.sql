-- Phase 4 — Comptes clients (espace parent)
-- Additive only : aucune table existante n'est modifiée à part l'ajout
-- d'une colonne nullable sur `registrations`.

create extension if not exists pgcrypto;

-- ── Enfants rattachés à un compte parent (auth.users) ────────────────
create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  dob date not null,
  level text,
  club text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.children enable row level security;

drop policy if exists "service_role_all" on public.children;
create policy "service_role_all" on public.children
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists idx_children_parent on public.children(parent_user_id);

-- ── Sessions parent (jeton opaque, vérifié côté serveur) ─────────────
create table if not exists public.parent_sessions (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.parent_sessions enable row level security;

drop policy if exists "service_role_all" on public.parent_sessions;
create policy "service_role_all" on public.parent_sessions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists idx_parent_sessions_user on public.parent_sessions(user_id);

-- ── Lien optionnel entre une inscription et le compte qui l'a soumise ─
alter table public.registrations add column if not exists parent_user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_registrations_parent_user on public.registrations(parent_user_id);
