-- Gestion des uniformes — construit par-dessus la boutique existante
-- (shop_orders / shop_order_items) plutôt que de dupliquer les données,
-- conformément au principe "une seule source d'information" du client.

-- Lien vers la joueuse (facultatif — une commande boutique peut rester
-- anonyme), saison explicite (une commande n'est pas toujours reliée à une
-- inscription, ex. achat direct), notes libres.
alter table public.shop_orders add column if not exists registration_id uuid references public.registrations(id) on delete set null;
alter table public.shop_orders add column if not exists season_key text;
alter table public.shop_orders add column if not exists notes text;

-- Cycle de vie de la distribution — distinct du statut de paiement
-- (`status`, déjà existant). Toutes les commandes payées existantes
-- démarrent à "a_commander" faute de mieux savoir où elles en sont.
alter table public.shop_orders add column if not exists distribution_status text not null default 'a_commander'
  check (distribution_status in ('a_commander', 'en_production', 'recu', 'pret_a_remettre', 'partiellement_remis', 'remis'));

create index if not exists idx_shop_orders_registration on public.shop_orders(registration_id);
create index if not exists idx_shop_orders_distribution on public.shop_orders(distribution_status);

-- Quantité effectivement remise, par article de commande — permet les
-- remises partielles (ex. chandail + short remis, bas manquants).
alter table public.shop_order_items add column if not exists delivered_quantity integer not null default 0;

-- Historique complet des mouvements d'une commande (création, changement de
-- statut, remise, problème) — jamais modifié après coup, seulement ajouté.
create table if not exists public.shop_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  event text not null,
  detail text,
  performed_by text,
  created_at timestamptz not null default now()
);

alter table public.shop_order_events enable row level security;
drop policy if exists "service_role_all" on public.shop_order_events;
create policy "service_role_all" on public.shop_order_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists idx_shop_order_events_order on public.shop_order_events(order_id);

-- Problèmes à régler sur une commande (mauvaise taille, article manquant,
-- endommagé, échange demandé, etc.), suivis jusqu'à résolution.
create table if not exists public.shop_order_problems (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  problem_type text not null check (problem_type in (
    'mauvaise_taille', 'article_manquant', 'mauvais_article', 'quantite_incorrecte',
    'article_endommage', 'commande_incomplete', 'echange_demande', 'retour_fournisseur', 'autre'
  )),
  description text,
  status text not null default 'ouvert' check (status in ('ouvert', 'resolu')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.shop_order_problems enable row level security;
drop policy if exists "service_role_all" on public.shop_order_problems;
create policy "service_role_all" on public.shop_order_problems
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists idx_shop_order_problems_order on public.shop_order_problems(order_id);
create index if not exists idx_shop_order_problems_status on public.shop_order_problems(status);
