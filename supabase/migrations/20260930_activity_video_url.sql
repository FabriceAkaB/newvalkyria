-- Lien vidéo (film de séance/match) — additif, même esprit que le champ
-- notes déjà utilisé pour le lien Google Sheet des ressources d'activité.
alter table public.coach_activities add column if not exists video_url text;
