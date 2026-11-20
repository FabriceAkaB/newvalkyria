-- Équipes du jour (JP, 20 nov. 2026) : la couleur de chaque équipe (dossards) et les équipes préparées d'avance
-- par le site (planned = proposées avant la pratique, pas encore confirmées par l'éducateur ou JP).
alter table public.practice_teams add column if not exists color text;
alter table public.practice_teams add column if not exists planned boolean not null default false;
