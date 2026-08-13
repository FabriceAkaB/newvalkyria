-- Entité "joueuse" canonique — additif uniquement, ne supprime ni ne modifie
-- aucune colonne existante. Voir l'audit du 12 août 2026 pour le contexte :
-- une joueuse existait jusqu'ici dans 3-4 tables non reliées (leads, registrations,
-- children, shop_orders.customer_name). Cette table sert de point de liaison ;
-- les colonnes texte existantes restent la donnée affichée de chaque ligne.

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  dob date,
  -- false = créé par rapprochement automatique incertain (ex. lead jamais
  -- transféré, sans date de naissance) — à confirmer manuellement plus tard.
  verified boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.players enable row level security;
create policy players_service_role_all on public.players
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

alter table public.registrations add column if not exists player_id uuid references public.players(id);
alter table public.children add column if not exists player_id uuid references public.players(id);
alter table public.leads add column if not exists player_id uuid references public.players(id);

create index if not exists idx_registrations_player_id on public.registrations(player_id);
create index if not exists idx_children_player_id on public.children(player_id);
create index if not exists idx_leads_player_id on public.leads(player_id);
