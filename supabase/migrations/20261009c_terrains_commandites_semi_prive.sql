-- Phase 4 : location de plages de terrain, suivi des commandites et structure
-- réutilisable des programmes juvéniles semi-privés. Additif seulement.

-- ═══ 1) Location de terrains ═══
create extension if not exists btree_gist;

-- Réglages publics d'un terrain (le terrain interne existant reste inchangé).
alter table public.terrains add column if not exists rentable boolean not null default false;
alter table public.terrains add column if not exists rental_description text;

-- Plages offertes à la location : récurrentes (jour de semaine) ou à une date précise,
-- découpées en créneaux de `slot_minutes`. Les prix sont par créneau.
create table if not exists public.terrain_rental_windows (
  id uuid primary key default gen_random_uuid(),
  terrain_id uuid not null references public.terrains(id) on delete cascade,
  weekday integer check (weekday between 0 and 6),          -- 0 = dimanche … 6 = samedi
  specific_date date,
  start_time text not null,                                   -- HH:MM
  end_time text not null,
  slot_minutes integer not null default 90 check (slot_minutes > 0),
  price_cents integer not null check (price_cents >= 0),
  valid_from date,
  valid_until date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint terrain_rental_windows_when check ((weekday is not null) <> (specific_date is not null))
);
create index if not exists idx_terrain_rental_windows_terrain on public.terrain_rental_windows(terrain_id);

-- Dates (ou plages d'une date) bloquées.
create table if not exists public.terrain_rental_blocks (
  id uuid primary key default gen_random_uuid(),
  terrain_id uuid not null references public.terrains(id) on delete cascade,
  block_date date not null,
  start_time text,
  end_time text,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_terrain_rental_blocks_terrain_date on public.terrain_rental_blocks(terrain_id, block_date);

create table if not exists public.terrain_rentals (
  id uuid primary key default gen_random_uuid(),
  terrain_id uuid not null references public.terrains(id),
  rental_date date not null,
  start_time text not null,
  end_time text not null,
  start_minute integer not null,
  end_minute integer not null,
  price_cents integer not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  organization_name text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  notes text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  reservation_expires_at timestamptz,
  confirmation_sent_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_terrain_rentals_terrain_date on public.terrain_rentals(terrain_id, rental_date);
-- Aucune double réservation, même sous requêtes simultanées : deux créneaux
-- actifs ne peuvent pas se chevaucher sur le même terrain/jour.
alter table public.terrain_rentals drop constraint if exists terrain_rentals_no_overlap;
alter table public.terrain_rentals add constraint terrain_rentals_no_overlap
  exclude using gist (terrain_id with =, rental_date with =, int4range(start_minute, end_minute) with &&)
  where (status in ('pending', 'paid'));

-- ═══ 2) Commandites ═══
create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  category text not null default 'equipement' check (category in ('equipement', 'developpement', 'evenement', 'principal')),
  partnership_type text,
  proposed_amount_cents integer not null default 0,
  status text not null default 'prospect' check (status in ('prospect', 'contacte', 'negociation', 'confirme', 'paye', 'refuse', 'termine')),
  last_contact_at date,
  last_contact_note text,
  follow_up_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sponsor_payments (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  amount_cents integer not null,
  due_date date,
  paid_at date,
  method text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_sponsor_payments_sponsor on public.sponsor_payments(sponsor_id);

-- Documents associés à un commanditaire (contrats, factures…) : même table que le reste.
alter table public.documents drop constraint if exists documents_entity_type_check;
alter table public.documents add constraint documents_entity_type_check
  check (entity_type in ('registration', 'lead', 'coach', 'coach_activity', 'sponsor'));

-- ═══ 3) Programmes juvéniles semi-privés : même socle que les programmes privés ═══
alter table public.session_programs add column if not exists program_kind text not null default 'standard';
alter table public.session_programs add column if not exists published boolean not null default true;
alter table public.session_programs add column if not exists cost_per_session_cents integer not null default 0;
alter table public.session_programs add column if not exists fixed_costs_cents integer not null default 0;
alter table public.session_programs drop constraint if exists session_programs_gender_check;
alter table public.session_programs add constraint session_programs_gender_check check (gender in ('filles', 'garcons', 'mixte'));

-- RLS (même patron : service role uniquement)
alter table public.terrain_rental_windows enable row level security;
alter table public.terrain_rental_blocks enable row level security;
alter table public.terrain_rentals enable row level security;
alter table public.sponsors enable row level security;
alter table public.sponsor_payments enable row level security;
create policy terrain_rental_windows_service_role_all on public.terrain_rental_windows for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy terrain_rental_blocks_service_role_all on public.terrain_rental_blocks for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy terrain_rentals_service_role_all on public.terrain_rentals for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy sponsors_service_role_all on public.sponsors for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy sponsor_payments_service_role_all on public.sponsor_payments for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
