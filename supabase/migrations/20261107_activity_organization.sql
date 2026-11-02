-- Pratiques que JP donne hors de l'Académie (CF Montréal, St-Gabriel…) : même outil de plan de séance,
-- mais rangées à part. organization = null → activité de l'Académie (seules exportées vers MonClubSportif).
alter table public.coach_activities add column if not exists organization text;
