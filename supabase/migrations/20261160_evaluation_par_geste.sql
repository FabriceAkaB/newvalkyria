-- Évaluation par geste (JP, 18 nov. 2026) : chaque geste du ball mastery noté de 1 (incapable) à 10 (parfait) ;
-- sert aux 3 lignes de la pratique suivante, aux bulletins et aux gestes à faire à la maison (Valkyria Lab).
alter table public.player_evaluations add column if not exists gesture_scores jsonb not null default '{}'::jsonb;
