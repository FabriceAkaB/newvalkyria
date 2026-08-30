-- Module « Évaluation » — journées de tests/sélection (préparation Sport-Études).
-- Préfixe tryout_ pour ne jamais être confondu avec player_evaluations, qui
-- est un système DIFFÉRENT et existant (bulletins post-pratique par
-- entraîneur, lié à registrations/coach_activities) — on n'y touche pas.
--
-- Réutilise l'entité canonique players (photo/consentement/contact
-- d'urgence ajoutés ici) plutôt que de dupliquer l'identité de l'athlète.

-- ── Colonnes additives sur players ──────────────────────────────────
alter table public.players add column if not exists photo_url text;
alter table public.players add column if not exists image_consent boolean not null default false;
alter table public.players add column if not exists parent_relationship text;
alter table public.players add column if not exists emergency_contact_name text;
alter table public.players add column if not exists emergency_contact_phone text;
alter table public.players add column if not exists medical_notes text;

-- Bucket public (même patron que child-photos / exercise-images) — photo
-- permanente de l'athlète, réutilisée événement après événement.
insert into storage.buckets (id, name, public)
values ('athlete-photos', 'athlete-photos', true)
on conflict (id) do nothing;

-- ── Événement d'évaluation — contenant isolé ────────────────────────
create table public.tryout_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  start_time time,
  location text,
  terrain_id uuid references public.terrains(id),
  status text not null default 'brouillon' check (status in ('brouillon', 'en_cours', 'termine', 'archive')),
  age_category text,
  organizer_notes text,
  -- Traçabilité quand créé par duplication d'un événement (structure +
  -- équipes copiées, jamais les athlètes ni les notes — voir section 2).
  duplicated_from_id uuid references public.tryout_events(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Équipes/couleurs — définies au niveau de l'événement ────────────
create table public.tryout_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tryout_events(id) on delete cascade,
  name text not null,
  color_hex text not null,
  display_order integer not null default 0
);
create index idx_tryout_teams_event on public.tryout_teams(event_id);

-- ── Évaluateurs assignés à l'événement ───────────────────────────────
-- coach_id quand l'évaluateur est un entraîneur déjà en base ; guest_name
-- sinon (ex. bénévole ponctuel) — l'un des deux est requis.
create table public.tryout_evaluators (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tryout_events(id) on delete cascade,
  coach_id uuid references public.coaches(id),
  guest_name text,
  created_at timestamptz not null default now(),
  constraint tryout_evaluators_identity check (coach_id is not null or guest_name is not null)
);
create index idx_tryout_evaluators_event on public.tryout_evaluators(event_id);

-- ── Participation d'un athlète à CET événement précis ────────────────
-- Aucune donnée ne traverse d'un événement à l'autre : un même player_id
-- peut avoir une ligne tryout_participants par événement, chacune avec son
-- propre dossard/couleur/présence — jamais partagés entre événements.
create table public.tryout_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tryout_events(id) on delete cascade,
  player_id uuid not null references public.players(id),
  bib_number integer,
  team_id uuid references public.tryout_teams(id),
  attendance_status text not null default 'attendu'
    check (attendance_status in ('attendu', 'present', 'absent', 'en_retard', 'parti_tot', 'blesse')),
  quick_note text,
  primary_position_observed text,
  is_trial boolean not null default false,
  sweetheart boolean not null default false,
  insufficient_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, player_id)
);
create index idx_tryout_participants_event on public.tryout_participants(event_id);
create index idx_tryout_participants_player on public.tryout_participants(player_id);
-- Un seul numéro de dossard actif par événement (numéro null = pas encore
-- attribué, plusieurs null autorisés).
create unique index idx_tryout_participants_bib_unique
  on public.tryout_participants(event_id, bib_number) where bib_number is not null;

-- ── Notes d'un évaluateur pour un participant ────────────────────────
-- criteria_scores : { "c1": {"score": 7} } ou, avec double notation,
-- { "c1": {"isole": 6, "match": 5} } — voir tryout_criteria_config pour la
-- définition des critères et le calcul du verdict (fait côté application).
create table public.tryout_evaluations (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.tryout_participants(id) on delete cascade,
  evaluator_id uuid not null references public.tryout_evaluators(id) on delete cascade,
  criteria_scores jsonb not null default '{}',
  comment text,
  comment_internal boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, evaluator_id)
);
create index idx_tryout_evaluations_participant on public.tryout_evaluations(participant_id);
create index idx_tryout_evaluations_evaluator on public.tryout_evaluations(evaluator_id);

-- ── Journal des modifications (qui a changé quelle note, quand) ──────
create table public.tryout_evaluation_history (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.tryout_evaluations(id) on delete cascade,
  changed_by text,
  field text not null,
  old_value text,
  new_value text,
  changed_at timestamptz not null default now()
);
create index idx_tryout_eval_history_evaluation on public.tryout_evaluation_history(evaluation_id);

-- ── Configuration des critères/coefficients/seuils ──────────────────
-- event_id null = configuration par défaut globale, appliquée à tout
-- événement sans surcharge propre — modifiable depuis l'admin sans
-- toucher au code (section 7 : "pas codés en dur dans l'interface").
create table public.tryout_criteria_config (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.tryout_events(id) on delete cascade,
  criteria jsonb not null,
  thresholds jsonb not null,
  double_scoring_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id)
);

-- ── Commentaires rapides préécrits (terrain), gérés par l'admin ──────
create table public.tryout_quick_comments (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  active boolean not null default true,
  display_order integer not null default 0
);

-- ── Tentatives de code d'accès (espace 175175, section 12) ──────────
-- Même patron que admin_login_attempts (limitation de tentatives).
create table public.tryout_gate_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  success boolean not null,
  attempted_at timestamptz not null default now()
);
create index idx_tryout_gate_attempts_ip on public.tryout_gate_attempts(ip, attempted_at);

-- Code haché (scrypt, voir src/lib/password.ts), modifiable depuis
-- l'admin — jamais stocké en clair. Ligne singleton, comme
-- sport_etudes_settings.
create table public.tryout_gate_settings (
  id boolean primary key default true check (id),
  code_hash text not null,
  updated_at timestamptz not null default now()
);

-- ── RLS — même patron que le reste du projet ─────────────────────────
alter table public.tryout_events enable row level security;
alter table public.tryout_teams enable row level security;
alter table public.tryout_evaluators enable row level security;
alter table public.tryout_participants enable row level security;
alter table public.tryout_evaluations enable row level security;
alter table public.tryout_evaluation_history enable row level security;
alter table public.tryout_criteria_config enable row level security;
alter table public.tryout_quick_comments enable row level security;
alter table public.tryout_gate_attempts enable row level security;
alter table public.tryout_gate_settings enable row level security;

create policy tryout_events_service_role_all on public.tryout_events for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy tryout_teams_service_role_all on public.tryout_teams for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy tryout_evaluators_service_role_all on public.tryout_evaluators for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy tryout_participants_service_role_all on public.tryout_participants for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy tryout_evaluations_service_role_all on public.tryout_evaluations for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy tryout_evaluation_history_service_role_all on public.tryout_evaluation_history for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy tryout_criteria_config_service_role_all on public.tryout_criteria_config for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy tryout_quick_comments_service_role_all on public.tryout_quick_comments for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy tryout_gate_attempts_service_role_all on public.tryout_gate_attempts for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy tryout_gate_settings_service_role_all on public.tryout_gate_settings for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- ════════════════════════════════════════════════════════════════
-- Données de départ (seed)
-- ════════════════════════════════════════════════════════════════

-- Les deux événements demandés en section 2.
insert into public.tryout_events (name, event_date, status, age_category)
values
  ('Évaluation test 1 — Garçons', current_date, 'brouillon', null),
  ('Évaluation test — Filles', current_date, 'brouillon', null);

-- Couleurs de départ — seulement sur l'événement Garçons (4 équipes) ;
-- l'événement Filles démarre sans équipe.
insert into public.tryout_teams (event_id, name, color_hex, display_order)
select e.id, c.name, c.hex, c.ord
from public.tryout_events e
cross join (values
  ('Rouge', '#e6394a', 1), ('Jaune', '#e6c93a', 2), ('Orange', '#e68a3a', 3), ('Noir', '#1a1a1a', 4)
) as c(name, hex, ord)
where e.name = 'Évaluation test 1 — Garçons';

-- Configuration par défaut des critères/coefficients/seuils (section 7).
insert into public.tryout_criteria_config (event_id, criteria, thresholds, double_scoring_enabled)
values (
  null,
  '[
    {"id":"c1","block":"technique","label":"Première touche / contrôle orienté","coefficient":1.5,"order":1},
    {"id":"c2","block":"technique","label":"Passe : précision, dosage, variété","coefficient":1.5,"order":2},
    {"id":"c3","block":"technique","label":"Conduite de balle et 1v1","coefficient":1.0,"order":3},
    {"id":"c4","block":"technique","label":"Pied faible","coefficient":1.0,"order":4},
    {"id":"c5","block":"technique","label":"Frappe et finition","coefficient":0.5,"order":5},
    {"id":"c6","block":"technique","label":"Aisance avec le ballon (jonglerie, coordination)","coefficient":0.5,"order":6},
    {"id":"c7","block":"jeu","label":"Prise de décision / vitesse d''exécution","coefficient":1.0,"order":7},
    {"id":"c8","block":"jeu","label":"Placement sans ballon et jeu défensif","coefficient":1.0,"order":8},
    {"id":"c9","block":"jeu","label":"Vitesse, explosivité, volume","coefficient":1.0,"order":9},
    {"id":"c10","block":"jeu","label":"Mental, attitude, coachabilité","coefficient":1.0,"order":10}
  ]'::jsonb,
  '{
    "attitude_criterion_id": "c10",
    "attitude_red_flag_max": 3,
    "technical_block_min_for_pass": 30,
    "tiers": [
      {"min_technical": 45, "min_total": 75, "verdict": "pret", "label": "Prête — profil sport-études"},
      {"min_technical": 36, "min_total": 62, "verdict": "bonne_voie", "label": "En bonne voie"},
      {"min_technical": 30, "min_total": 0, "verdict": "juste", "label": "Juste — technique prioritaire"}
    ],
    "default_verdict": {"verdict": "pas_prete", "label": "Pas prête"},
    "attitude_flag_verdict": {"verdict": "a_revoir", "label": "À revoir — enjeu d''attitude"},
    "technical_block_fail_verdict": {"verdict": "pas_prete_technique", "label": "Pas prête — technique insuffisante"},
    "maturation_alert": {"physical_criteria_ids": ["c8", "c9"], "physical_min": 7, "technical_max_trigger": 30}
  }'::jsonb,
  false
);

-- Commentaires rapides par défaut (section 8).
insert into public.tryout_quick_comments (text, display_order) values
  ('Bon contrôle sous pression', 1),
  ('Manque de vitesse d''exécution', 2),
  ('Attitude exemplaire', 3),
  ('À revoir sur pied faible', 4),
  ('Profil à suivre', 5);
