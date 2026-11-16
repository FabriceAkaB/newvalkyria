-- Éducateurs assignés d'avance d'après MonClubSportif (présent dans MCS = assigné à la pratique du site).
-- `assigned_by` = « MonClubSportif » quand le robot a créé l'assignation (il peut alors l'enlever si l'éducateur retire sa réponse).
alter table public.coach_assignments add column if not exists assigned_by text;
