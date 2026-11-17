-- Guide de l'éducateur (JP, 17 nov. 2026) : la liste cochée avant chaque pratique (alarmes, montage, matériel, rôles,
-- capitaines, variante et progression de chaque exercice). Une liste par éducateur et par pratique.
alter table public.practice_debriefs add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table public.practice_debriefs add column if not exists checklist_at timestamptz;
