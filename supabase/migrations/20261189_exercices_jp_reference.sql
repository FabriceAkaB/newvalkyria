-- Exercices JP référence (JP, 26 nov. 2026) : les exercices phares de JP, ceux qu'il a choisis comme les meilleurs
-- pour un thème. Marqueur posé par JP seulement (admin), avec « le meilleur pour … » facultatif. Distinct de la
-- validation (validated_version), qui rend un exercice « approuvé » : la référence est la courte liste des phares.
alter table public.exercises add column if not exists jp_reference_at timestamptz;
alter table public.exercises add column if not exists jp_reference_note text;
