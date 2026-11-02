-- Banque d'exercices Valkyria (Mandalart P1.3.12 à P1.3.17) : fiche complète sur la table
-- exercises existante, numéro de version, validation de JP, et notes sur 10 des éducateurs.
-- Le statut (à tester, à valider, approuvé, à changer, retiré) se calcule dans
-- src/lib/exercise-bank.ts à partir des notes de la version en cours.

alter table public.exercises
  add column if not exists exercise_type text,          -- ball-mastery, analytique, jeu-reduit, forme-jouee, physique, echauffement
  add column if not exists session_place text,          -- jeu-entree, ball-mastery, technique, forme-jouee
  add column if not exists age_groups text[] not null default '{}', -- U7 … U14+
  add column if not exists venue text,                  -- gymnase, synthetique, les-deux
  add column if not exists setup_5_7 text,              -- organisation selon le nombre de joueuses
  add column if not exists setup_8_10 text,
  add column if not exists setup_11_16 text,
  add column if not exists variant_easier text,
  add column if not exists variant_harder text,
  add column if not exists variant_cognitive text,
  add column if not exists progression text,
  add column if not exists physical_metrics text,       -- exercices physiques : séries, durée, récupération, distance…
  add column if not exists author text,
  add column if not exists created_by_coach_id uuid references public.coaches(id) on delete set null,
  add column if not exists version integer not null default 1,
  add column if not exists version_history jsonb not null default '[]'::jsonb, -- [{version, at, note}]
  add column if not exists validated_version integer,   -- version validée par JP
  add column if not exists validated_at timestamptz,
  add column if not exists retired_at timestamptz,      -- retiré à la main par JP
  add column if not exists retired_reason text;

-- Une note par éducateur, par exercice, par séance (rapport des 24 heures).
create table if not exists public.exercise_ratings (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  exercise_version integer not null default 1,
  activity_id uuid references public.coach_activities(id) on delete set null,
  activity_date date,
  coach_id uuid references public.coaches(id) on delete set null,
  rater_name text,
  scores jsonb not null default '{}'::jsonb,             -- {engagement, touches, objectif, adapte, explication} : 0, 1 ou 2
  total integer not null check (total between 0 and 10),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exercise_ratings enable row level security;
do $$ begin
  create policy exercise_ratings_service_role_all on public.exercise_ratings
    for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;

create unique index if not exists exercise_ratings_one_per_session on public.exercise_ratings(exercise_id, activity_id, coach_id);
create index if not exists idx_exercise_ratings_exercise on public.exercise_ratings(exercise_id, created_at);
