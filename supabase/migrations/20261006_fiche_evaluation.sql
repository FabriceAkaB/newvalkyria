-- La fiche d'évaluation de l'athlète (PDF « Fiche d'évaluation ») devient le
-- modèle unique de toutes les évaluations/tests : en-tête athlète, 4 sections
-- notées de 5 à 1 (Technique 9, Tactique 4, Physique 4, Mentalité 4) avec une
-- remarque par section, commentaires généraux, évaluateur et date.

-- ── En-tête de la fiche : infos de l'athlète propres à cette évaluation ──
alter table public.tryout_participants add column if not exists preferred_position text;
alter table public.tryout_participants add column if not exists strong_foot text;
alter table public.tryout_participants add column if not exists group_label text;
alter table public.tryout_participants add column if not exists current_level text;

-- ── Pied de la fiche : remarques par section + date de l'évaluation ──
-- section_remarks : { "technique": "...", "tactique": "...", "physique": "...", "mentalite": "..." }
alter table public.tryout_evaluations add column if not exists section_remarks jsonb not null default '{}';
alter table public.tryout_evaluations add column if not exists evaluated_on date;

-- ── Critères par défaut = ceux de la fiche (échelle 5 → 1) ──
update public.tryout_criteria_config
set criteria = '[
  {"id":"t1","block":"technique","label":"Dribble","coefficient":1,"order":1},
  {"id":"t2","block":"technique","label":"Conduite","coefficient":1,"order":2},
  {"id":"t3","block":"technique","label":"Passe courte","coefficient":1,"order":3},
  {"id":"t4","block":"technique","label":"Passe longue","coefficient":1,"order":4},
  {"id":"t5","block":"technique","label":"Première touche","coefficient":1,"order":5},
  {"id":"t6","block":"technique","label":"Tir","coefficient":1,"order":6},
  {"id":"t7","block":"technique","label":"Tête","coefficient":1,"order":7},
  {"id":"t8","block":"technique","label":"Pied faible","coefficient":1,"order":8},
  {"id":"t9","block":"technique","label":"Coup de pied arrêté","coefficient":1,"order":9},
  {"id":"x1","block":"tactique","label":"Jeu défensif (marquage, couverture)","coefficient":1,"order":10},
  {"id":"x2","block":"tactique","label":"Jeu offensif (démarquage, implication)","coefficient":1,"order":11},
  {"id":"x3","block":"tactique","label":"Vision (lève la tête, prise d''information)","coefficient":1,"order":12},
  {"id":"x4","block":"tactique","label":"Prise de décision (choix de jeu)","coefficient":1,"order":13},
  {"id":"p1","block":"physique","label":"Coordination","coefficient":1,"order":14},
  {"id":"p2","block":"physique","label":"Vitesse","coefficient":1,"order":15},
  {"id":"p3","block":"physique","label":"Endurance","coefficient":1,"order":16},
  {"id":"p4","block":"physique","label":"Force","coefficient":1,"order":17},
  {"id":"m1","block":"mentalite","label":"Attitude (veut progresser)","coefficient":1,"order":18},
  {"id":"m2","block":"mentalite","label":"Leadership (influence positivement son équipe)","coefficient":1,"order":19},
  {"id":"m3","block":"mentalite","label":"Intensité/Compétitivité (se donne à fond)","coefficient":1,"order":20},
  {"id":"m4","block":"mentalite","label":"Assiduité (toujours là)","coefficient":1,"order":21}
]'::jsonb,
thresholds = '{
  "attitude_criterion_id": "m1",
  "attitude_red_flag_max": 1,
  "technical_block_min_for_pass": 23,
  "tiers": [
    {"min_technical": 34, "min_total": 79, "verdict": "pret", "label": "Prête — profil sport-études"},
    {"min_technical": 27, "min_total": 65, "verdict": "bonne_voie", "label": "En bonne voie"},
    {"min_technical": 23, "min_total": 0, "verdict": "juste", "label": "Juste — technique prioritaire"}
  ],
  "default_verdict": {"verdict": "pas_prete", "label": "Pas prête"},
  "attitude_flag_verdict": {"verdict": "a_revoir", "label": "À revoir — enjeu d''attitude"},
  "technical_block_fail_verdict": {"verdict": "pas_prete_technique", "label": "Pas prête — technique insuffisante"},
  "maturation_alert": {"physical_criteria_ids": ["p2", "p3"], "physical_min": 4, "technical_max_trigger": 23}
}'::jsonb,
updated_at = now()
where event_id is null;

-- Surcharges par événement éventuelles (aucune à ce jour) : on les retire
-- pour que tous les événements utilisent le modèle de la fiche.
delete from public.tryout_criteria_config where event_id is not null;
