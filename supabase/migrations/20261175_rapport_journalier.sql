-- Rapport journalier des pratiques (JP, 20 nov. 2026) : la mémoire de chaque pratique, rempli au fil de la journée,
-- distinct de l'évaluation professionnelle du coach. Ajouté au retour sur la pratique (même ligne par pratique et par coach).
alter table public.practice_debriefs add column if not exists journal jsonb not null default '{}'::jsonb;
alter table public.practice_debriefs add column if not exists journal_at timestamptz;
