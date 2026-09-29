-- Nouveaux programmes à dates fixes (pas des plages horaires récurrentes comme
-- TV/SV/NV) : "Privilège Valkyria" (filles 2013-2012, semi-privé du samedi) et
-- "Programme Intensif" (garçons 2015-2014). Modelé sur sport_etudes_* (même
-- logique : sessions fixes + inscription unique + Stripe paiement comptant),
-- mais générique par `program_slug` puisque ces deux programmes partagent une
-- structure identique — additive only, aucune table existante touchée.

create table public.session_programs (
  slug text primary key,
  name text not null,
  gender text not null check (gender in ('filles', 'garcons')),
  birth_years text not null,
  price_cents integer not null,
  max_capacity integer not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.session_program_dates (
  id uuid primary key default gen_random_uuid(),
  program_slug text not null references public.session_programs(slug) on delete cascade,
  session_date date not null,
  start_time text not null,
  end_time text not null,
  location text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_session_program_dates_slug on public.session_program_dates(program_slug);

create table public.session_program_registrations (
  id uuid primary key default gen_random_uuid(),
  program_slug text not null references public.session_programs(slug),
  player_id uuid references public.players(id),
  player_first_name text not null,
  player_last_name text not null,
  player_dob date,
  parent_name text not null,
  parent_email text not null,
  parent_phone text not null,
  city text,
  comments text,
  terms_accepted boolean not null default false,
  status text not null default 'pending' check (status in ('pending','confirmed','paid','waitlist','cancelled')),
  price_cents integer,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_session_program_regs_slug on public.session_program_registrations(program_slug);
create index idx_session_program_regs_status on public.session_program_registrations(status);
create index idx_session_program_regs_stripe_session on public.session_program_registrations(stripe_checkout_session_id);

create table public.session_program_enrollments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.session_program_registrations(id) on delete cascade,
  date_id uuid not null references public.session_program_dates(id) on delete cascade,
  unique (registration_id, date_id)
);

-- ── Paiement en 1, 2 ou 3 fois (Programme Intensif seulement pour l'instant,
--    mais générique par registration_id au cas où un autre programme en
--    profite plus tard) — miroir de sport_etudes_payment_plans, avec
--    "on delete cascade" dès le départ (contrairement à l'oubli corrigé le
--    23 sept. sur registration_payment_plans).
create table public.session_program_payment_plans (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.session_program_registrations(id) on delete cascade,
  stripe_customer_id text,
  stripe_payment_method_id text,
  total_amount_cents integer not null,
  installment_count integer not null,
  created_at timestamptz not null default now()
);

create table public.session_program_payment_plan_installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.session_program_payment_plans(id) on delete cascade,
  sequence_no integer not null,
  amount_cents integer not null,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending','paid','failed','failed_final')),
  attempt_count integer not null default 0,
  failure_notified boolean not null default false,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.session_programs enable row level security;
alter table public.session_program_dates enable row level security;
alter table public.session_program_registrations enable row level security;
alter table public.session_program_enrollments enable row level security;
alter table public.session_program_payment_plans enable row level security;
alter table public.session_program_payment_plan_installments enable row level security;
create policy session_programs_service_role_all on public.session_programs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy session_program_dates_service_role_all on public.session_program_dates for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy session_program_regs_service_role_all on public.session_program_registrations for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy session_program_enrollments_service_role_all on public.session_program_enrollments for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy session_program_payment_plans_service_role_all on public.session_program_payment_plans for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy session_program_payment_plan_installments_service_role_all on public.session_program_payment_plan_installments for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

insert into public.session_programs (slug, name, gender, birth_years, price_cents, max_capacity, description) values
  ('privilege-valkyria', 'Privilège Valkyria', 'filles', '2013-2012', 87595, 5,
   'Semi-privé du samedi en très petit groupe (5 places) — 15 séances techniques, encadrement personnalisé.'),
  ('intensif-garcons', 'Programme Intensif', 'garcons', '2015-2014', 87595, 14,
   'Préparation technique intensive pour garçons — 12 séances réparties entre deux lieux d''entraînement.');

insert into public.session_program_dates (program_slug, session_date, start_time, end_time, location, display_order) values
  ('privilege-valkyria', '2026-10-10', '17:00', '18:15', '99 Rue Émilien Marcoux #108, Blainville, QC J7C 0B4', 1),
  ('privilege-valkyria', '2026-10-17', '17:00', '18:15', '99 Rue Émilien Marcoux #108, Blainville, QC J7C 0B4', 2),
  ('privilege-valkyria', '2026-10-24', '17:00', '18:15', '99 Rue Émilien Marcoux #108, Blainville, QC J7C 0B4', 3),
  ('privilege-valkyria', '2026-10-31', '17:00', '18:15', '99 Rue Émilien Marcoux #108, Blainville, QC J7C 0B4', 4),
  ('privilege-valkyria', '2026-11-07', '17:45', '19:00', '99 Rue Émilien Marcoux #108, Blainville, QC J7C 0B4', 5),
  ('privilege-valkyria', '2026-11-14', '17:45', '19:00', '99 Rue Émilien Marcoux #108, Blainville, QC J7C 0B4', 6),
  ('privilege-valkyria', '2026-11-21', '17:45', '19:00', '99 Rue Émilien Marcoux #108, Blainville, QC J7C 0B4', 7),
  ('privilege-valkyria', '2026-11-28', '17:00', '18:15', '99 Rue Émilien Marcoux #108, Blainville, QC J7C 0B4', 8),
  ('privilege-valkyria', '2026-12-05', '17:00', '18:15', '99 Rue Émilien Marcoux #108, Blainville, QC J7C 0B4', 9),
  ('privilege-valkyria', '2026-12-12', '17:00', '18:15', '99 Rue Émilien Marcoux #108, Blainville, QC J7C 0B4', 10),
  ('privilege-valkyria', '2026-12-19', '17:00', '18:15', '99 Rue Émilien Marcoux #108, Blainville, QC J7C 0B4', 11),
  ('privilege-valkyria', '2027-01-09', '17:00', '18:15', '99 Rue Émilien Marcoux #108, Blainville, QC J7C 0B4', 12),
  ('privilege-valkyria', '2027-01-16', '17:00', '18:15', '99 Rue Émilien Marcoux #108, Blainville, QC J7C 0B4', 13),
  ('privilege-valkyria', '2027-01-23', '17:00', '18:15', '99 Rue Émilien Marcoux #108, Blainville, QC J7C 0B4', 14),
  ('privilege-valkyria', '2027-01-30', '17:00', '18:15', '99 Rue Émilien Marcoux #108, Blainville, QC J7C 0B4', 15),
  ('intensif-garcons', '2026-10-06', '19:30', '20:55', 'École de la Voltige (gym / futsal), 191 rue Saint-Pierre, Sainte-Thérèse', 1),
  ('intensif-garcons', '2026-10-13', '19:30', '20:55', 'École de la Voltige (gym / futsal), 191 rue Saint-Pierre, Sainte-Thérèse', 2),
  ('intensif-garcons', '2026-10-20', '19:30', '20:55', 'École de la Voltige (gym / futsal), 191 rue Saint-Pierre, Sainte-Thérèse', 3),
  ('intensif-garcons', '2026-10-24', '12:00', '13:25', 'École Chambéry (gym / futsal), 100 rue de Bellevue, Blainville', 4),
  ('intensif-garcons', '2026-10-27', '19:30', '20:55', 'École de la Voltige (gym / futsal), 191 rue Saint-Pierre, Sainte-Thérèse', 5),
  ('intensif-garcons', '2026-10-31', '12:00', '13:25', 'École Chambéry (gym / futsal), 100 rue de Bellevue, Blainville', 6),
  ('intensif-garcons', '2026-11-03', '19:30', '20:55', 'École de la Voltige (gym / futsal), 191 rue Saint-Pierre, Sainte-Thérèse', 7),
  ('intensif-garcons', '2026-11-07', '12:00', '13:25', 'École Chambéry (gym / futsal), 100 rue de Bellevue, Blainville', 8),
  ('intensif-garcons', '2026-11-10', '19:30', '20:55', 'École de la Voltige (gym / futsal), 191 rue Saint-Pierre, Sainte-Thérèse', 9),
  ('intensif-garcons', '2026-11-14', '12:00', '13:25', 'École Chambéry (gym / futsal), 100 rue de Bellevue, Blainville', 10),
  ('intensif-garcons', '2026-11-21', '12:00', '13:25', 'École Chambéry (gym / futsal), 100 rue de Bellevue, Blainville', 11),
  ('intensif-garcons', '2026-11-28', '12:00', '13:25', 'École Chambéry (gym / futsal), 100 rue de Bellevue, Blainville', 12);
