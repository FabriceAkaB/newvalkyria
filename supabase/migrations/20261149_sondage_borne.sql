-- Sondage de fin sur la borne (iPad au bord du terrain, 13 nov. 2026) : chaque joueuse touche sa photo et répond
-- elle-même à 5 questions sur 10 : plaisir et fatigue (déjà là), apprentissage, compréhension de la pratique, confiance.
alter table public.activity_player_attendance add column if not exists learning smallint;
alter table public.activity_player_attendance add column if not exists understanding smallint;
alter table public.activity_player_attendance add column if not exists confidence smallint;
