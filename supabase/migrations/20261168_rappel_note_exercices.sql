-- Rappel de la note des exercices (JP, 19 nov. 2026) : une heure après la pratique, l'éducateur qui n'a pas noté
-- les exercices reçoit un courriel (une seule fois par pratique).
alter table public.coach_assignments add column if not exists rating_reminder_sent_at timestamptz;
