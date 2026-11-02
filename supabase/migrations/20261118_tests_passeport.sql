-- Passeport et tests de progression (Mandalart P1.2.01, P1.2.03, P1.2.04, P1.5.03 ; indicateur joueuses_filmees_jour1).
-- Les tables d'évaluation existantes servent aux journées de sélection (tryout_*) et à l'évaluation après chaque
-- pratique (player_evaluations) : aucune ne garde un score chronométré répété. D'où ces deux tables.

-- Catalogue des tests, fixé par JP : ce qu'on mesure, comment, et le score de chaque niveau du passeport.
create table if not exists public.skill_tests (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  name text not null,
  gesture text,                               -- geste filmé (convention de nom des vidéos)
  unit text not null,                         -- touches, secondes, réussites…
  higher_is_better boolean not null default true,
  duration_seconds integer,
  protocol text,                              -- même exercice, même angle, même durée
  thresholds jsonb not null default '{}'::jsonb, -- { "bronze": 40, "argent": 55, "or": 70, "mauve": 85 }
  sort_order integer not null default 0,
  active boolean not null default true,
  validated_at timestamptz,                   -- validé par JP (sinon « proposition »)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.skill_tests enable row level security;
drop policy if exists "service_role_all" on public.skill_tests;
create policy "service_role_all" on public.skill_tests
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Feuille de suivi : une ligne par test passé par une joueuse. Vidéo = lien (YouTube non répertorié ou dossier
-- privé), jamais un fichier public (Loi 25).
create table if not exists public.skill_test_results (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  test_id uuid not null references public.skill_tests(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  player_id uuid,                             -- même joueuse d'une saison à l'autre
  tested_on date not null,
  context text not null default 'mensuel' check (context in ('jour-1', 'mensuel', 'fin-de-saison', 'autre')),
  score numeric not null,
  video_url text,
  coach_id uuid references public.coaches(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists skill_test_results_registration_idx on public.skill_test_results (registration_id, test_id, tested_on);
create index if not exists skill_test_results_player_idx on public.skill_test_results (player_id);
-- Une seule ligne par joueuse, test, jour et type de test : une nouvelle saisie corrige la précédente.
create unique index if not exists skill_test_results_one_per_day on public.skill_test_results (registration_id, test_id, tested_on, context);

alter table public.skill_test_results enable row level security;
drop policy if exists "service_role_all" on public.skill_test_results;
create policy "service_role_all" on public.skill_test_results
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Propositions de départ (P1.2.01) : JP les ajuste et les valide ; les seuils restent vides tant qu'il ne les a pas fixés.
insert into public.skill_tests (name, gesture, unit, higher_is_better, duration_seconds, protocol, sort_order)
select * from (values
  ('Touches en 30 secondes', 'touches', 'touches', true, 30,
   'Ballon au pied, touches de semelle alternées droite-gauche pendant 30 secondes. On compte chaque touche. Filmé de face, à 3 m, toute la joueuse dans l''image.', 1),
  ('Conduite chronométrée', 'conduite', 'secondes', false, null,
   'Slalom de 6 cônes espacés de 1,5 m, aller-retour, ballon toujours contrôlé. Chrono du départ au retour sur la ligne. Filmé de côté.', 2),
  ('Passes des deux pieds', 'passes', 'réussites', true, 30,
   'Passes contre un mur ou une cible à 5 m pendant 30 secondes, en alternant pied droit et pied gauche. On compte les passes réussies (bon pied, ballon contrôlé au retour). Filmé de dos.', 3)
) as v(name, gesture, unit, higher_is_better, duration_seconds, protocol, sort_order)
where not exists (select 1 from public.skill_tests);
