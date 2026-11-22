-- Fiche d'évaluation d'un match en 10 points (JP, 22 nov. 2026) : critères notés de 1 à 5, points forts, à travailler.
-- La note sur 10 (score, scale 10) reste calculée à partir des critères pour les statistiques existantes.
alter table public.match_player_evaluations add column if not exists criteria jsonb not null default '{}'::jsonb;
alter table public.match_player_evaluations add column if not exists strengths text;
alter table public.match_player_evaluations add column if not exists to_improve text;
alter table public.match_player_evaluations add column if not exists updated_at timestamptz default now();
