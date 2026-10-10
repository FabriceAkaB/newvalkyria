-- 1) Matchs à vendre à d'autres académies : plages de match (domicile) que les
--    équipes extérieures réservent en ligne, 100 $ par plage, 2 plages max par équipe.
create table if not exists public.match_slots (
  id uuid primary key default gen_random_uuid(),
  slot_date date not null,
  start_time text not null,
  end_time text not null,
  location text not null,
  field_label text,
  price_cents integer not null default 10000 check (price_cents >= 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (slot_date, start_time, location)
);

create table if not exists public.match_slot_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.match_slots(id) on delete cascade,
  org_name text not null,
  org_key text not null,
  team_label text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  price_cents integer not null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  reservation_expires_at timestamptz,
  confirmation_sent_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_match_slot_bookings_org on public.match_slot_bookings(org_key);
create index if not exists idx_match_slot_bookings_email on public.match_slot_bookings(contact_email);
create index if not exists idx_match_slot_bookings_session on public.match_slot_bookings(stripe_checkout_session_id);
-- Une seule réservation active par plage, même sous requêtes simultanées.
create unique index if not exists match_slot_bookings_one_active on public.match_slot_bookings(slot_id) where status in ('pending', 'paid');

-- 2) Essai gratuit le mardi pour les programmes garçons.
create table if not exists public.boys_trials (
  id uuid primary key default gen_random_uuid(),
  program_slug text not null references public.session_programs(slug),
  date_id uuid not null references public.session_program_dates(id) on delete cascade,
  trial_date date not null,
  player_first_name text not null,
  player_last_name text not null,
  birth_year integer not null,
  parent_name text not null,
  parent_email text not null,
  parent_phone text not null,
  notes text,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'attended', 'absent')),
  created_at timestamptz not null default now()
);
create index if not exists idx_boys_trials_date on public.boys_trials(date_id);
create unique index if not exists boys_trials_one_per_child on public.boys_trials(program_slug, lower(parent_email), lower(player_first_name), lower(player_last_name)) where status <> 'cancelled';
alter table public.session_programs add column if not exists trial_capacity integer not null default 3;

alter table public.match_slots enable row level security;
alter table public.match_slot_bookings enable row level security;
alter table public.boys_trials enable row level security;
create policy match_slots_service_role_all on public.match_slots for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy match_slot_bookings_service_role_all on public.match_slot_bookings for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy boys_trials_service_role_all on public.boys_trials for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
