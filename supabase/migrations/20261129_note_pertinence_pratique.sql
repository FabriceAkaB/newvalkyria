-- Note de JP sur la pertinence d'une pratique au thème de la semaine (sur 10). À 8 et plus, la pratique entre dans la
-- galerie des pratiques modèles (demande de JP, 3 nov. 2026).
alter table public.coach_activities add column if not exists theme_score smallint check (theme_score between 0 and 10);
alter table public.coach_activities add column if not exists theme_scored_at timestamptz;
