-- Programme technique de préparation aux évaluations du Sport-Études —
-- indépendant des programmes féminins réguliers (leads/registrations), voir
-- le plan pour le raisonnement. Aucune date/heure/lieu codé en dur côté
-- application : tout vit dans sport_etudes_sessions, éditable en admin.

create table public.sport_etudes_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  start_time text,
  end_time text,
  location text not null,
  terrain_id uuid references public.terrains(id),
  kind text not null check (kind in ('diagnostic_gratuit','seance_payante','diagnostic_final')),
  label text not null,
  is_time_tbd boolean not null default false,
  display_order integer not null default 0,
  active boolean not null default true,
  admin_warning text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sport_etudes_registrations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players(id),
  parent_user_id uuid references auth.users(id) on delete set null,
  player_first_name text not null,
  player_last_name text not null,
  player_dob date,
  player_birth_year text,
  player_level text,
  primary_position text,
  secondary_position text,
  current_team text,
  current_club text,
  soccer_experience text,
  player_goals text,
  parent_assessed_strengths text,
  parent_assessed_areas_to_improve text,
  parent_first_name text not null,
  parent_last_name text not null,
  parent_email text not null,
  parent_phone text not null,
  parent_relationship text,
  sport_etudes_experience text,
  prior_evaluations_done text,
  target_sport_etudes_program text,
  comments text,
  important_coach_info text,
  terms_accepted boolean not null default false,
  option_chosen text not null check (option_chosen in ('diagnostic_only','full_program')),
  status text not null default 'pending' check (status in ('pending','confirmed','paid','cancelled')),
  price_cents integer,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  whatsapp_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_se_regs_status on public.sport_etudes_registrations(status);
create index idx_se_regs_stripe_session on public.sport_etudes_registrations(stripe_checkout_session_id);

create table public.sport_etudes_enrollments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.sport_etudes_registrations(id) on delete cascade,
  session_id uuid not null references public.sport_etudes_sessions(id) on delete cascade,
  unique (registration_id, session_id)
);

create table public.sport_etudes_attendance (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.sport_etudes_enrollments(id) on delete cascade,
  status text not null default 'to_confirm' check (status in ('present','absent','justified_absent','to_confirm')),
  updated_by text,
  notes text,
  updated_at timestamptz not null default now(),
  unique (enrollment_id)
);

create table public.sport_etudes_technical_notes (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.sport_etudes_registrations(id) on delete cascade,
  phase text not null check (phase in ('initial','final')),
  technique integer,
  ball_control integer,
  passing integer,
  first_touch integer,
  one_v_one integer,
  speed integer,
  decision_making integer,
  game_understanding integer,
  finishing integer,
  strengths text,
  areas_to_improve text,
  coach_notes text,
  recorded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_id, phase)
);

create table public.sport_etudes_settings (
  id boolean primary key default true check (id),
  max_capacity integer not null default 30,
  updated_at timestamptz not null default now()
);
insert into public.sport_etudes_settings (id, max_capacity) values (true, 30) on conflict do nothing;

alter table public.sport_etudes_sessions enable row level security;
alter table public.sport_etudes_registrations enable row level security;
alter table public.sport_etudes_enrollments enable row level security;
alter table public.sport_etudes_attendance enable row level security;
alter table public.sport_etudes_technical_notes enable row level security;
alter table public.sport_etudes_settings enable row level security;

create policy sport_etudes_sessions_service_role_all on public.sport_etudes_sessions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy sport_etudes_registrations_service_role_all on public.sport_etudes_registrations
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy sport_etudes_enrollments_service_role_all on public.sport_etudes_enrollments
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy sport_etudes_attendance_service_role_all on public.sport_etudes_attendance
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy sport_etudes_technical_notes_service_role_all on public.sport_etudes_technical_notes
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy sport_etudes_settings_service_role_all on public.sport_etudes_settings
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Séances connues du programme — dates/heures/lieux modifiables en tout
-- temps depuis l'admin, jamais recodées en dur côté application.
insert into public.sport_etudes_sessions (session_date, start_time, end_time, location, kind, label, is_time_tbd, display_order, admin_warning) values
  ('2026-08-29', '09:00', '10:30', 'Complexe sportif Rosemère / Collège Hubert-Maisonneuve', 'diagnostic_gratuit', 'Diagnostic gratuit', false, 1,
   'Le texte fourni indique « dimanche 29 août », mais le 29 août 2026 est un samedi — confirmer la date avant publication.'),
  ('2026-09-11', '18:00', '19:30', 'École Hubert-Maisonneuve, Rosemère', 'seance_payante', 'Séance 1', false, 2, null),
  ('2026-09-13', null, null, 'Complexe sportif Rosemère', 'seance_payante', 'Séance 2', true, 3,
   'Le texte initial mentionne « dimanche 123 septembre » — interprété comme le 13 septembre 2026, à confirmer. Heure à préciser.'),
  ('2026-09-18', '18:00', '19:30', 'École Hubert-Maisonneuve, Rosemère', 'seance_payante', 'Séance 3', false, 4, null),
  ('2026-09-25', '18:00', '19:30', 'École Hubert-Maisonneuve, Rosemère', 'seance_payante', 'Séance 4', false, 5, null),
  ('2026-09-27', null, null, 'Complexe sportif Rosemère', 'diagnostic_final', 'Diagnostic final / préparation finale', true, 6,
   'Heure à préciser (non fournie dans la demande initiale).'),
  ('2026-10-02', '18:00', '19:30', 'École Hubert-Maisonneuve, Rosemère', 'seance_payante', 'Séance 6', false, 7, null);
