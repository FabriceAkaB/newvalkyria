-- Rappel de la veille aux éducateurs (JP, 17 nov. 2026) : un courriel par assignation, la veille de la pratique,
-- avec ce qu'il faut avoir repéré avant d'arriver.
alter table public.coach_assignments add column if not exists eve_reminder_sent_at timestamptz;
