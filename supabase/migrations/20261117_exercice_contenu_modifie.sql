-- Date du dernier changement du CONTENU d'un exercice (règles, consignes, points clés…), pas d'une note ou d'une
-- validation : le portail avertit l'éducateur quand la fiche a changé après la préparation de la pratique (diapo).
alter table public.exercises add column if not exists content_updated_at timestamptz;
