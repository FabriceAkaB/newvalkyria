-- Confirmation du rapport à l'éducateur (JP, 25 nov. 2026) : un courriel par pratique dont le rapport est fini, avec les
-- heures entrées dans sa paie. La date d'envoi est gardée sur l'assignation (un seul courriel par pratique et par éducateur).
alter table public.coach_assignments add column if not exists report_confirmed_at timestamptz;

-- Heures approuvées par JP (JP, 25 nov. 2026) : une assignation approuvée compte pour la paie même si le rapport de la
-- pratique n'est pas complet (ex. l'assistant, qui n'écrit pas le rapport des joueuses). Qui a approuvé et quand.
alter table public.coach_assignments add column if not exists pay_approved_at timestamptz;
alter table public.coach_assignments add column if not exists pay_approved_by text;
