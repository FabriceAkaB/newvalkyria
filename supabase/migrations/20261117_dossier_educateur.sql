-- Mon dossier de l'éducateur (JP, 17 nov. 2026) : ses objectifs professionnels (écrits par lui) et son plan de
-- développement (écrit par JP).
alter table public.coaches add column if not exists pro_goals text;
alter table public.coaches add column if not exists development_plan text;
