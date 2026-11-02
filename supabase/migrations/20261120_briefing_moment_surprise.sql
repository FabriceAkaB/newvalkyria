-- Briefing de 5 minutes avant chaque séance (Mandalart P1.4.01) : le moment surprise prévu pour la pratique,
-- écrit à l'avance par JP ou la coach-chef. Les fiches joueuses du briefing viennent des tables existantes
-- (objectifs, évaluations, routine de fin, présences, essais).
alter table public.coach_activities add column if not exists surprise_moment text;
