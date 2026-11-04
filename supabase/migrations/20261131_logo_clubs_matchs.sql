-- Logo de chaque club qui réserve des matchs (ajouté par JP dans l'admin) : même logo pour toutes les équipes du club.
alter table public.match_team_profiles add column if not exists logo_url text;
