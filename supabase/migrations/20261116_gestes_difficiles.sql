-- Évaluation rapide : les gestes que la joueuse trouve difficiles pendant la pratique (ball mastery du jour ou autre),
-- notés par l'éducateur ; repris au briefing de la pratique suivante.
alter table player_evaluations add column if not exists gestures jsonb not null default '[]'::jsonb;
