-- Prise de connaissance de la pratique par chaque éducateur assigné (portail, étape « Avant ») :
-- les éléments vus (diapos « deck:<document> », exercices « block:<bloc> ») et la confirmation finale.
alter table coach_assignments add column if not exists practice_read_items jsonb not null default '[]'::jsonb;
alter table coach_assignments add column if not exists practice_read_at timestamptz;
