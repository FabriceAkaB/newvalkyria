-- Contrats de location de gymnases et de terrains (heures réservées et coût),
-- utilisés pour calculer les marges par saison (terrain + entraîneurs).
create table if not exists public.venue_rentals (
  id uuid primary key default gen_random_uuid(),
  season_key text not null,
  venue text not null,
  address text,
  space text,
  period text not null,
  schedule text not null,
  hours numeric not null,
  total_cents integer not null,
  tax_included boolean not null default false,
  payments text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.venue_rentals enable row level security;
create policy venue_rentals_service_role_all on public.venue_rentals
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
