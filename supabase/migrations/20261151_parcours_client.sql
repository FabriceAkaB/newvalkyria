-- Parcours client décortiqué (13 nov. 2026) : un arbre étape par étape (découverte, essai, inscription, programme,
-- accueil, saison, fin de saison), avec ce que la famille fait, ce à quoi elle a droit et ce que l'académie fait
-- (à la main ou automatiquement). Modifiable dans l'admin : on le bonifie au fur et à mesure.
create table if not exists public.customer_journey_nodes (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  parent_id uuid references public.customer_journey_nodes(id) on delete cascade,
  sort_order integer not null default 0,
  kind text not null default 'etape' check (kind in ('etape', 'famille', 'droit', 'academie', 'auto', 'choix')),
  title text not null,
  detail text,
  status text not null default 'en-place' check (status in ('en-place', 'en-cours', 'prevu')),
  where_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customer_journey_nodes_parent_idx on public.customer_journey_nodes (club_id, parent_id, sort_order);

do $$
begin
  execute 'alter table public.customer_journey_nodes enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'customer_journey_nodes' and policyname = 'customer_journey_nodes_service_role_all') then
    execute 'create policy customer_journey_nodes_service_role_all on public.customer_journey_nodes for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end $$;
