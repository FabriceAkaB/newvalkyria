-- Historique exact de chaque pratique (demande de JP, 3 nov. 2026) : le lien des diapos de la pratique et l'analyse
-- d'après pratique (ce qui a marché, ce qu'on change), sur l'activité elle-même.
alter table public.coach_activities add column if not exists deck_url text;
alter table public.coach_activities add column if not exists analysis text;
alter table public.coach_activities add column if not exists analysis_at timestamptz;
