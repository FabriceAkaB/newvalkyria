-- Contrôle des dépenses, fournisseurs et inventaire (Mandalart P7.6.02, P7.6.03, automatisation AU10).
--
-- 1) inventory_items : le matériel de l'académie (ballons, dossards, cônes, mini-buts…), où il est,
--    à qui il est confié, son état et sa durée de vie. L'année de remplacement est CALCULÉE par le site
--    (src/lib/inventory-repo.ts) à partir de la date d'achat, de la durée de vie et de l'état.
-- 2) contract_registry : le registre des contrats. Une ligne saisie à la main pour ce qui n'existe nulle
--    part ailleurs (assurances, logiciels, fournisseurs), ou une ligne reliée à un contrat existant
--    (venue_rentals, employee_contracts, sponsors) pour en préciser les dates, le renouvellement,
--    le montant ou la décision (renouvelé, terminé). Les tables d'origine ne sont jamais modifiées.
--
-- Colonne club_id partout : le même système peut servir à un autre club. Aucune donnée d'enfant (Loi 25).

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  name text not null check (length(name) between 1 and 120),
  category text not null default 'autre'
    check (category in ('ballons', 'dossards', 'cones', 'mini-buts', 'tapis', 'cibles', 'camera', 'premiers-soins', 'autre')),
  quantity integer not null default 1 check (quantity >= 0),
  location text,
  assigned_to text,
  condition text not null default 'bon' check (condition in ('neuf', 'bon', 'use', 'a_remplacer')),
  -- Moment où l'état a été noté : un article « usé » doit être remplacé dans les 12 mois qui suivent.
  condition_at timestamptz not null default now(),
  purchased_on date,
  unit_cost_cents integer check (unit_cost_cents is null or unit_cost_cents >= 0),
  lifespan_months integer check (lifespan_months is null or lifespan_months between 1 and 240),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inventory_items_club_idx on public.inventory_items (club_id, archived_at, category);

create table if not exists public.contract_registry (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  -- Contrat d'origine (null = contrat saisi seulement ici : assurance, logiciel, fournisseur…)
  source_type text check (source_type in ('venue_rental', 'employee_contract', 'sponsor')),
  source_id text,
  kind text not null default 'autre'
    check (kind in ('terrain', 'gymnase', 'embauche', 'commandite', 'assurance', 'logiciel', 'fournisseur', 'autre')),
  title text,
  supplier text,
  start_date date,
  end_date date,
  -- manuel = à renégocier ; automatique = se renouvelle seul (attention au préavis) ; aucun = se termine
  renewal text not null default 'manuel' check (renewal in ('manuel', 'automatique', 'aucun')),
  notice_days integer check (notice_days is null or notice_days between 0 and 365),
  alert_days integer check (alert_days is null or alert_days between 1 and 365),
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  amount_period text not null default 'total' check (amount_period in ('total', 'annuel', 'mensuel')),
  status text not null default 'actif' check (status in ('actif', 'termine')),
  decision_note text,
  decided_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((source_type is null) = (source_id is null))
);
create unique index if not exists contract_registry_source_uidx
  on public.contract_registry (club_id, source_type, source_id) where source_type is not null;
create index if not exists contract_registry_club_end_idx on public.contract_registry (club_id, status, end_date);

alter table public.inventory_items enable row level security;
alter table public.contract_registry enable row level security;

do $$
declare t text;
begin
  foreach t in array array['inventory_items', 'contract_registry'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_service_role_all') then
      execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t || '_service_role_all', t);
    end if;
  end loop;
end $$;
